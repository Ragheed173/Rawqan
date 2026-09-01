import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { posDb } from "../db/schema";
import { prepareStandaloneSession, unlockOffline } from "./offline";

vi.stubGlobal("crypto", webcrypto);

async function sessionFor(
  pin: string,
  expiresAt = new Date(Date.now() + 60_000).toISOString(),
) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const key = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const hash = new Uint8Array(await webcrypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 }, key, 256));
  const encode = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
  const payload = { version: 2, deviceId: "device", userId: "user", role: "CASHIER", permissions: ["pos:operate"], pinVerifier: { algorithm: "PBKDF2-SHA256" as const, iterations: 100_000, saltBase64: encode(salt), hashBase64: encode(hash) }, issuedAt: new Date().toISOString(), expiresAt };
  const capability = `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
  await posDb.offlineSession.put({ id: "device:user", deviceId: "device", userId: "user", role: "CASHIER", permissions: ["pos:operate"], capability, expiresAt: payload.expiresAt });
}

beforeEach(async () => {
  delete window.rawaqanDesktop;
  posDb.close();
  await posDb.delete();
  await posDb.open();
});

describe("browser-safe offline PIN", () => {
  it("unlocks with Web Crypto PBKDF2 without bcrypt or Node crypto in the browser bundle", async () => {
    await sessionFor("2468");
    await expect(unlockOffline("device", "user", "2468")).resolves.toMatchObject({ deviceId: "device", unlockedAt: expect.any(String) });
    expect((await posDb.offlineSession.get("device:user"))?.unlockedAt).toBeUndefined();
  });

  it("persists a fifteen-minute lock after five failed attempts", async () => {
    await sessionFor("2468");
    for (let attempt = 0; attempt < 4; attempt += 1) await expect(unlockOffline("device", "user", "0000")).rejects.toThrow("INVALID_PIN");
    await expect(unlockOffline("device", "user", "0000")).rejects.toThrow("OFFLINE_PIN_LOCKED");
    expect(new Date((await posDb.offlineSession.get("device:user"))!.lockedUntil!).getTime()).toBeGreaterThan(Date.now());
    await expect(unlockOffline("device", "user", "2468")).rejects.toThrow("OFFLINE_PIN_LOCKED");
  });

  it("promotes a previously verified desktop pairing and unlocks after its cloud capability expires", async () => {
    await sessionFor("2468", new Date(Date.now() - 60_000).toISOString());
    window.rawaqanDesktop = { isDesktop: true } as RawaqanDesktopBridge;

    await expect(prepareStandaloneSession()).resolves.toMatchObject({
      standalone: true,
      pinVerifier: expect.objectContaining({ algorithm: "PBKDF2-SHA256" }),
    });
    await expect(unlockOffline("device", "user", "2468")).resolves.toMatchObject({
      standalone: true,
      unlockedAt: expect.any(String),
    });
  });

  it("still enforces capability expiry in the browser PWA", async () => {
    await sessionFor("2468", new Date(Date.now() - 60_000).toISOString());
    await expect(unlockOffline("device", "user", "2468")).rejects.toThrow(
      "OFFLINE_CAPABILITY_EXPIRED",
    );
  });
});
