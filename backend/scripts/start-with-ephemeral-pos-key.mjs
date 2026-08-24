import { generateKeyPairSync } from "node:crypto";

if (process.env.NODE_ENV === "production") throw new Error("Ephemeral POS signing keys are forbidden in production");
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
process.env.POS_OFFLINE_PRIVATE_KEY_BASE64 = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
process.env.POS_OFFLINE_PUBLIC_KEY_BASE64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");
await import("../dist/server.js");
