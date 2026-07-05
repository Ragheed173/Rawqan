import type { OpeningHour, RestaurantSettings, Weekday } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { deleteAssets } from '../../lib/cloudinary.js';
import type { UpdateHoursInput, UpdateSettingsInput } from './settings.schemas.js';

const WEEK_ORDER: Weekday[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

/** There is exactly one settings row; create it lazily on first access. */
async function ensureSettings() {
  const existing = await prisma.restaurantSettings.findFirst({ include: { openingHours: true } });
  if (existing) return existing;
  return prisma.restaurantSettings.create({
    data: {
      openingHours: {
        create: WEEK_ORDER.map((weekday) => ({
          weekday,
          isClosed: weekday === 'MONDAY',
          opensAt: '12:00',
          closesAt: '23:59',
        })),
      },
    },
    include: { openingHours: true },
  });
}

/** Computes whether the venue is open now from opening hours + manual override. */
function computeIsOpen(settings: RestaurantSettings, hours: OpeningHour[]): boolean {
  if (settings.isOpenOverride !== null) return settings.isOpenOverride;
  const now = new Date();
  const today = WEEK_ORDER[now.getDay()];
  const slot = hours.find((h) => h.weekday === today);
  if (!slot || slot.isClosed || !slot.opensAt || !slot.closesAt) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = slot.opensAt.split(':').map(Number);
  const [ch, cm] = slot.closesAt.split(':').map(Number);
  return cur >= oh * 60 + om && cur <= ch * 60 + cm;
}

function serialize(settings: RestaurantSettings & { openingHours: OpeningHour[] }) {
  const hours = settings.openingHours
    .slice()
    .sort((a, b) => WEEK_ORDER.indexOf(a.weekday) - WEEK_ORDER.indexOf(b.weekday));
  return {
    id: settings.id,
    name: settings.name,
    nameEn: settings.nameEn,
    tagline: settings.tagline,
    taglineEn: settings.taglineEn,
    description: settings.description,
    logoUrl: settings.logoUrl,
    logoPublicId: settings.logoPublicId,
    coverUrl: settings.coverUrl,
    coverPublicId: settings.coverPublicId,
    phone: settings.phone,
    whatsapp: settings.whatsapp,
    facebook: settings.facebook,
    instagram: settings.instagram,
    tiktok: settings.tiktok,
    googleMapsUrl: settings.googleMapsUrl,
    addressLine: settings.addressLine,
    latitude: settings.latitude,
    longitude: settings.longitude,
    currency: settings.currency,
    footerText: settings.footerText,
    theme: {
      primary: settings.colorPrimary,
      accent: settings.colorAccent,
      background: settings.colorBackground,
    },
    isOpen: computeIsOpen(settings, settings.openingHours),
    maintenanceMode: settings.maintenanceMode,
    maintenanceMessage: settings.maintenanceMessage,
    comingSoonMode: settings.comingSoonMode,
    openingHours: hours.map((h) => ({
      weekday: h.weekday,
      isClosed: h.isClosed,
      opensAt: h.opensAt,
      closesAt: h.closesAt,
    })),
    updatedAt: settings.updatedAt,
  };
}

export async function get() {
  return serialize(await ensureSettings());
}

export async function update(input: UpdateSettingsInput) {
  const current = await ensureSettings();
  // Clean up replaced logo/cover assets (best-effort).
  const orphans: string[] = [];
  if (input.logoPublicId !== undefined && current.logoPublicId && current.logoPublicId !== input.logoPublicId) {
    orphans.push(current.logoPublicId);
  }
  if (input.coverPublicId !== undefined && current.coverPublicId && current.coverPublicId !== input.coverPublicId) {
    orphans.push(current.coverPublicId);
  }
  if (orphans.length) await deleteAssets(orphans);

  const updated = await prisma.restaurantSettings.update({
    where: { id: current.id },
    data: input,
    include: { openingHours: true },
  });
  return serialize(updated);
}

export async function updateHours(input: UpdateHoursInput) {
  const current = await ensureSettings();
  await prisma.$transaction(
    input.hours.map((h) =>
      prisma.openingHour.upsert({
        where: { settingsId_weekday: { settingsId: current.id, weekday: h.weekday } },
        create: { settingsId: current.id, ...h },
        update: { isClosed: h.isClosed, opensAt: h.opensAt, closesAt: h.closesAt },
      }),
    ),
  );
  const refreshed = await prisma.restaurantSettings.findUniqueOrThrow({
    where: { id: current.id },
    include: { openingHours: true },
  });
  return serialize(refreshed);
}
