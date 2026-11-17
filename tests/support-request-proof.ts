import { randomBytes } from "node:crypto";

const proofs = new Map<string, string>();

/** Reuse a synthetic requester proof when a test retries the same idempotency key. */
export function supportRequestProof(idempotencyKey: unknown) {
  const key = typeof idempotencyKey === "string" ? idempotencyKey : "";
  if (key && proofs.has(key)) return proofs.get(key)!;
  const proof = randomBytes(32).toString("hex");
  if (key) proofs.set(key, proof);
  return proof;
}
