import { prisma } from "../../lib/prisma.js";
import { hashPassword } from "../../lib/password.js";
import { writeActivity } from "../../lib/activityLog.js";
import { ROLE_PERMISSIONS } from "../../config/permissions.js";
import { posAssert } from "../../domain/pos/errors.js";
import { createOfflinePinVerifier, issueOfflineCapability } from "./offlineCapability.js";

async function mainAdmin(actorId: string) {
  const actor = await prisma.admin.findUnique({ where: { id: actorId }, select: { id: true, name: true, role: true, isActive: true } });
  posAssert(actor?.isActive && actor.role === "SUPER_ADMIN", "DEVICE_NOT_AUTHORIZED", "Only the main admin may manage POS devices");
  return actor;
}

export const listDevices = () => prisma.posDevice.findMany({ orderBy: { code: "asc" } });

export async function registerDevice(actorId: string, input: { id?: string; code: string; name: string; isActive?: boolean }) {
  const actor = await mainAdmin(actorId);
  return prisma.$transaction(async (tx) => {
    const device = await tx.posDevice.create({ data: { id: input.id, code: input.code, name: input.name, isActive: input.isActive ?? true } });
    await writeActivity({ adminId: actor.id, actorNameSnapshot: actor.name, actorRoleSnapshot: actor.role, action: "DEVICE_PAIRED", entityType: "PosDevice", entityId: device.id, deviceId: device.id, afterData: { code: device.code, name: device.name, isActive: device.isActive } }, tx);
    return device;
  });
}

export async function updateDevice(actorId: string, deviceId: string, input: { name?: string; isActive?: boolean }) {
  const actor = await mainAdmin(actorId);
  return prisma.$transaction(async (tx) => {
    const current = await tx.posDevice.findUnique({ where: { id: deviceId } });
    posAssert(current, "DEVICE_NOT_AUTHORIZED", "Device not found");
    const device = await tx.posDevice.update({ where: { id: deviceId }, data: input });
    await writeActivity({ adminId: actor.id, actorNameSnapshot: actor.name, actorRoleSnapshot: actor.role, action: "DEVICE_UPDATED", entityType: "PosDevice", entityId: device.id, deviceId: device.id, beforeData: { name: current.name, isActive: current.isActive }, afterData: { name: device.name, isActive: device.isActive } }, tx);
    return device;
  });
}

export async function pairDevice(actorId: string, deviceId: string, userId: string, pin: string) {
  const actor = await mainAdmin(actorId);
  const pinHash = await hashPassword(pin);
  const result = await prisma.$transaction(async (tx) => {
    const [device, user] = await Promise.all([
      tx.posDevice.findUnique({ where: { id: deviceId } }),
      tx.admin.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true, isActive: true } }),
    ]);
    posAssert(device?.isActive && user?.isActive, "DEVICE_NOT_AUTHORIZED", "Device or user is inactive");
    await tx.admin.update({ where: { id: user.id }, data: { posPinHash: pinHash } });
    await writeActivity({ adminId: actor.id, actorNameSnapshot: actor.name, actorRoleSnapshot: actor.role, action: "DEVICE_PAIRED", entityType: "PosDevice", entityId: device.id, deviceId: device.id, afterData: { userId: user.id, role: user.role, expiresInDays: envTtl() } }, tx);
    return { device, user };
  });
  return issueOfflineCapability({ deviceId: result.device.id, userId: result.user.id, role: result.user.role, permissions: [...ROLE_PERMISSIONS[result.user.role]], pinVerifier: createOfflinePinVerifier(pin) });
}

function envTtl() {
  // Avoid returning key material; this value is safe operational metadata.
  return Number(process.env.POS_OFFLINE_CAPABILITY_TTL_DAYS ?? 7);
}
