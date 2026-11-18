import { afterEach, expect, it, vi } from "vitest";
import { assertIdentityCredentialEncryptionConfigured, decryptTemporaryPassword, encryptTemporaryPassword, formatTemporaryPassword, generateTemporaryPassword } from "@/lib/identity-credentials";

afterEach(() => vi.unstubAllEnvs());

it("keeps the five-digit password as a string, including leading zeroes", () => {
  expect(formatTemporaryPassword(7)).toBe("00007");
  expect(generateTemporaryPassword()).toMatch(/^\d{5}$/);
});

it("encrypts a retry copy that can be recovered with the configured key", () => {
  vi.stubEnv("IDENTITY_CREDENTIAL_ENCRYPTION_KEY", Buffer.alloc(32, 17).toString("base64"));
  const password = "00007";
  const envelope = encryptTemporaryPassword(password);

  expect(envelope).not.toHaveProperty("password");
  expect(envelope.ciphertext).not.toBe(password);
  expect(decryptTemporaryPassword(envelope)).toBe(password);
});

it("rejects tampering and malformed or absent encryption keys", () => {
  vi.stubEnv("IDENTITY_CREDENTIAL_ENCRYPTION_KEY", Buffer.alloc(32, 23).toString("base64"));
  const envelope = encryptTemporaryPassword("12345");
  expect(() => decryptTemporaryPassword({ ...envelope, ciphertext: Buffer.from("12345").toString("base64") })).toThrow();

  vi.stubEnv("IDENTITY_CREDENTIAL_ENCRYPTION_KEY", "not-a-key");
  expect(() => assertIdentityCredentialEncryptionConfigured()).toThrow();
});
