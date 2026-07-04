import { z } from 'zod';

const weekday = z.enum([
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
]);

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm')
  .optional()
  .nullable();

/**
 * Optional URL field. Empty string (from an untouched form input) and null are
 * both normalized to `null`; a provided value must still be a valid URL. Missing
 * (undefined) is allowed so the field can be omitted from a partial update.
 */
const url = z.preprocess(
  (v) => (v === '' ? null : v),
  z.string().url({ message: 'Invalid URL' }).nullish(),
);

export const updateSettingsSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  nameEn: z.string().max(120).optional().nullable(),
  tagline: z.string().max(200).optional().nullable(),
  taglineEn: z.string().max(200).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  logoUrl: url,
  coverUrl: url,
  phone: z.string().max(40).optional().nullable(),
  whatsapp: z.string().max(40).optional().nullable(),
  facebook: url,
  instagram: url,
  tiktok: url,
  googleMapsUrl: url,
  addressLine: z.string().max(300).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  currency: z.string().min(1).max(8).optional(),
  footerText: z.string().max(500).optional().nullable(),
  colorPrimary: z.string().regex(/^#([0-9a-fA-F]{6})$/).optional().nullable(),
  colorAccent: z.string().regex(/^#([0-9a-fA-F]{6})$/).optional().nullable(),
  colorBackground: z.string().regex(/^#([0-9a-fA-F]{6})$/).optional().nullable(),
  isOpenOverride: z.boolean().optional().nullable(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().max(500).optional().nullable(),
  comingSoonMode: z.boolean().optional(),
});

export const updateHoursSchema = z.object({
  hours: z
    .array(
      z.object({
        weekday,
        isClosed: z.boolean(),
        opensAt: time,
        closesAt: time,
      }),
    )
    .length(7),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type UpdateHoursInput = z.infer<typeof updateHoursSchema>;
