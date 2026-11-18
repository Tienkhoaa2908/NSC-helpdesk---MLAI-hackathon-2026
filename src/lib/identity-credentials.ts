import { createCipheriv, createDecipheriv, randomBytes, randomInt } from "node:crypto";
import type { CredentialEnvelope } from "@/domain/password-identity";

const ALGORITHM = "aes-256-gcm";

function encryptionKey() {
  const encoded = process.env.IDENTITY_CREDENTIAL_ENCRYPTION_KEY?.trim() ?? "";
  if (!/^[A-Za-z0-9+/]{43}=$/.test(encoded))
    throw new Error("IDENTITY_CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded)
    throw new Error("IDENTITY_CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return key;
}

export function assertIdentityCredentialEncryptionConfigured() {
  encryptionKey();
}

export function formatTemporaryPassword(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 99_999)
    throw new RangeError("Temporary password value must be an integer from 0 to 99999.");
  return String(value).padStart(5, "0");
}

export function generateTemporaryPassword() {
  return formatTemporaryPassword(randomInt(0, 100_000));
}

export function encryptTemporaryPassword(password: string): CredentialEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return {
    version: 1,
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptTemporaryPassword(envelope: CredentialEnvelope) {
  if (envelope.version !== 1) throw new Error("Unsupported encrypted credential version.");
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
