import { createPrivateKey, createPublicKey, pbkdf2Sync, randomBytes, sign, verify } from "node:crypto";
import { env } from "../../config/env.js";
import type { Permission } from "../../config/permissions.js";
import { PosDomainError } from "../../domain/pos/errors.js";

export interface OfflineCapabilityPayload {
  version: 2;
  deviceId: string;
  userId: string;
  role: string;
  permissions: Permission[];
  pinVerifier: {
    algorithm: "PBKDF2-SHA256";
    iterations: number;
    saltBase64: string;
    hashBase64: string;
  };
  issuedAt: string;
  expiresAt: string;
}

const encode = (value: string | Buffer) => Buffer.from(value).toString("base64url");
const decodeJson = <T>(value: string) => JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;

function privateKey() {
  if (!env.POS_OFFLINE_PRIVATE_KEY_BASE64) throw new Error("POS offline private signing key is not configured");
  return createPrivateKey({ key: Buffer.from(env.POS_OFFLINE_PRIVATE_KEY_BASE64, "base64"), format: "der", type: "pkcs8" });
}

function publicKey() {
  if (!env.POS_OFFLINE_PUBLIC_KEY_BASE64) throw new Error("POS offline public verification key is not configured");
  return createPublicKey({ key: Buffer.from(env.POS_OFFLINE_PUBLIC_KEY_BASE64, "base64"), format: "der", type: "spki" });
}

export function issueOfflineCapability(input: Omit<OfflineCapabilityPayload, "version" | "issuedAt" | "expiresAt">) {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + env.POS_OFFLINE_CAPABILITY_TTL_DAYS * 86_400_000);
  const header = encode(JSON.stringify({ alg: "EdDSA", typ: "RWQ-OFFLINE", v: 2 }));
  const payload: OfflineCapabilityPayload = { version: 2, ...input, issuedAt: issuedAt.toISOString(), expiresAt: expiresAt.toISOString() };
  const body = encode(JSON.stringify(payload));
  const signature = sign(null, Buffer.from(`${header}.${body}`), privateKey()).toString("base64url");
  return { capability: `${header}.${body}.${signature}`, payload, publicKeyBase64: env.POS_OFFLINE_PUBLIC_KEY_BASE64! };
}

export function verifyOfflineCapability(capability: string, now = new Date()): OfflineCapabilityPayload {
  const [header, body, signature, extra] = capability.split(".");
  if (!header || !body || !signature || extra) throw new PosDomainError("DEVICE_NOT_AUTHORIZED", "Malformed offline capability");
  const valid = verify(null, Buffer.from(`${header}.${body}`), publicKey(), Buffer.from(signature, "base64url"));
  if (!valid) throw new PosDomainError("DEVICE_NOT_AUTHORIZED", "Offline capability signature is invalid");
  const payload = decodeJson<OfflineCapabilityPayload>(body);
  if (payload.version !== 2 || new Date(payload.expiresAt) <= now) throw new PosDomainError("OFFLINE_CAPABILITY_EXPIRED", "Offline capability has expired or must be renewed");
  return payload;
}

export function createOfflinePinVerifier(pin: string): OfflineCapabilityPayload["pinVerifier"] {
  const iterations = 600_000;
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(pin, salt, iterations, 32, "sha256");
  return { algorithm: "PBKDF2-SHA256", iterations, saltBase64: salt.toString("base64"), hashBase64: hash.toString("base64") };
}
