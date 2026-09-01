import { posDb } from "../db/schema";
import { requestPosPersistence } from "../db/diagnostics";
import type { OfflinePinVerifier, OfflineSession } from "../types";
import { scheduleDesktopBackup } from "../db/backup";

interface CapabilityPayload {
  version: 2;
  deviceId: string;
  userId: string;
  role: string;
  permissions: string[];
  pinVerifier: OfflinePinVerifier;
  issuedAt: string;
  expiresAt: string;
}
const b64 = (value: string) =>
  Uint8Array.from(
    atob(
      value
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(value.length / 4) * 4, "="),
    ),
    (char) => char.charCodeAt(0),
  );

async function verifyPin(
  pin: string,
  verifier: OfflinePinVerifier,
) {
  if (verifier.algorithm !== "PBKDF2-SHA256" || verifier.iterations < 100_000)
    throw new Error("OFFLINE_CAPABILITY_REPAIR_REQUIRED");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const actual = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: b64(verifier.saltBase64),
        iterations: verifier.iterations,
      },
      key,
      256,
    ),
  );
  const expected = b64(verifier.hashBase64);
  let difference = actual.length ^ expected.length;
  for (
    let index = 0;
    index < Math.max(actual.length, expected.length);
    index += 1
  )
    difference |= (actual[index] ?? 0) ^ (expected[index] ?? 0);
  return difference === 0;
}

export async function verifyAndStoreCapability(
  capability: string,
  publicKeyBase64: string,
) {
  const [header, body, signature, extra] = capability.split(".");
  if (!header || !body || !signature || extra)
    throw new Error("INVALID_CAPABILITY");
  const protectedHeader = JSON.parse(new TextDecoder().decode(b64(header))) as {
    alg?: string;
    typ?: string;
    v?: number;
  };
  if (
    protectedHeader.alg !== "EdDSA" ||
    protectedHeader.typ !== "RWQ-OFFLINE" ||
    protectedHeader.v !== 2
  )
    throw new Error("INVALID_CAPABILITY");
  const key = await crypto.subtle.importKey(
    "spki",
    b64(publicKeyBase64),
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    { name: "Ed25519" },
    key,
    b64(signature),
    new TextEncoder().encode(`${header}.${body}`),
  );
  if (!valid) throw new Error("INVALID_CAPABILITY");
  const payload = JSON.parse(
    new TextDecoder().decode(b64(body)),
  ) as CapabilityPayload;
  if (payload.version !== 2 || !payload.pinVerifier)
    throw new Error("OFFLINE_CAPABILITY_REPAIR_REQUIRED");
  if (new Date(payload.expiresAt) <= new Date())
    throw new Error("OFFLINE_CAPABILITY_EXPIRED");
  await posDb.offlineSession.put({
    id: `${payload.deviceId}:${payload.userId}`,
    deviceId: payload.deviceId,
    userId: payload.userId,
    role: payload.role,
    permissions: payload.permissions,
    capability,
    expiresAt: payload.expiresAt,
    standalone: Boolean(window.rawaqanDesktop?.isDesktop),
    pinVerifier: payload.pinVerifier,
    failedPinAttempts: 0,
  });
  // Pairing is an explicit user gesture and the best opportunity for browsers to
  // grant persistence. Denial must never prevent the terminal from operating.
  await requestPosPersistence();
  scheduleDesktopBackup("device-pairing");
  return payload;
}

/**
 * Promotes an already verified desktop pairing to a permanent local cashier
 * profile. The signed capability is still retained for audit and cloud sync,
 * while the local PIN verifier keeps the single-terminal POS usable when the
 * Render session or internet connection is unavailable.
 */
export async function prepareStandaloneSession(): Promise<OfflineSession | null> {
  const session = await posDb.offlineSession.toCollection().first();
  if (!session) return null;
  if (!window.rawaqanDesktop?.isDesktop) return session;

  let pinVerifier = session.pinVerifier;
  if (!pinVerifier) {
    const body = session.capability.split(".")[1];
    if (!body) throw new Error("INVALID_CAPABILITY");
    const payload = JSON.parse(
      new TextDecoder().decode(b64(body)),
    ) as CapabilityPayload;
    if (payload.version !== 2 || !payload.pinVerifier)
      throw new Error("OFFLINE_CAPABILITY_REPAIR_REQUIRED");
    pinVerifier = payload.pinVerifier;
  }

  if (!session.standalone || !session.pinVerifier) {
    await posDb.offlineSession.update(session.id, {
      standalone: true,
      pinVerifier,
    });
  }
  return { ...session, standalone: true, pinVerifier };
}

export async function unlockOffline(
  deviceId: string,
  userId: string,
  pin: string,
) {
  const session = await posDb.offlineSession.get(`${deviceId}:${userId}`);
  const standalone = Boolean(
    session?.standalone && window.rawaqanDesktop?.isDesktop,
  );
  if (!session || (!standalone && new Date(session.expiresAt) <= new Date()))
    throw new Error("OFFLINE_CAPABILITY_EXPIRED");
  if (session.lockedUntil && new Date(session.lockedUntil) > new Date())
    throw new Error("OFFLINE_PIN_LOCKED");
  const body = session.capability.split(".")[1];
  if (!body) throw new Error("INVALID_CAPABILITY");
  const payload = JSON.parse(
    new TextDecoder().decode(b64(body)),
  ) as CapabilityPayload;
  const pinVerifier = session.pinVerifier ?? payload.pinVerifier;
  if (payload.version !== 2 || !pinVerifier)
    throw new Error("OFFLINE_CAPABILITY_REPAIR_REQUIRED");
  if (!(await verifyPin(pin, pinVerifier))) {
    const attempts = (session.failedPinAttempts ?? 0) + 1;
    const lockedUntil =
      attempts >= 5
        ? new Date(Date.now() + 15 * 60_000).toISOString()
        : undefined;
    await posDb.offlineSession.update(session.id, {
      failedPinAttempts: attempts >= 5 ? 0 : attempts,
      lockedUntil,
      unlockedAt: undefined,
    });
    throw new Error(lockedUntil ? "OFFLINE_PIN_LOCKED" : "INVALID_PIN");
  }
  await posDb.offlineSession.update(session.id, {
    unlockedAt: undefined,
    failedPinAttempts: 0,
    lockedUntil: undefined,
  });
  return {
    ...session,
    unlockedAt: new Date().toISOString(),
    failedPinAttempts: 0,
    lockedUntil: undefined,
  };
}
