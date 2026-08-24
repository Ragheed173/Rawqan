import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
process.stdout.write(JSON.stringify({
  POS_OFFLINE_PRIVATE_KEY_BASE64: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
  POS_OFFLINE_PUBLIC_KEY_BASE64: publicKey.export({ format: "der", type: "spki" }).toString("base64"),
}));
