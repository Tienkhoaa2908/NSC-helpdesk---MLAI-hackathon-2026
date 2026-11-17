import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SupportError, getSupportRequestTrackingHash } from "@/lib/support-repository";

const prefix = "support-request-tracking:v1:";
const runtime = globalThis as typeof globalThis & { supportTrackingDevKey?: Buffer };

function trackingKey() {
  const configured = process.env.SUPPORT_TRACKING_SECRET?.trim() ?? "";
  if (/^[a-f0-9]{64}$/i.test(configured)) return Buffer.from(configured, "hex");
  if (process.env.NODE_ENV === "production")
    throw new SupportError(
      "TRACKING_UNAVAILABLE",
      "Cần cấu hình khóa theo dõi yêu cầu.",
      503,
    );
  // Local/test fallback keeps the demo usable; links from this key expire when
  // the server process restarts. Set SUPPORT_TRACKING_SECRET for stable local links.
  return (runtime.supportTrackingDevKey ??= randomBytes(32));
}

export function requesterTrackingToken(id: string) {
  return createHmac("sha256", trackingKey()).update(prefix + id).digest("hex");
}

/** Stable proof for the server-side Verify runner, so a resumed case can recover its receipt. */
export function verificationRequesterProof(runId: string, requestId: string) {
  return createHmac("sha256", trackingKey())
    .update(`support-verification-receipt-proof:v1:${runId}:${requestId}`)
    .digest("hex");
}

export function requesterTrackingTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function requesterTrackingProofHash(proof: string) {
  return createHash("sha256").update(proof.toLowerCase()).digest("hex");
}

export function trackingHashMatches(left: string | null | undefined, right: string | null | undefined) {
  if (typeof left !== "string" || typeof right !== "string" || !/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export async function requireRequesterTracking(id: string, token: string | null) {
  if (!token || !/^[a-f0-9]{64}$/i.test(token))
    throw new SupportError("NOT_FOUND", "Không tìm thấy yêu cầu.", 404);
  const derived = requesterTrackingToken(id);
  const savedHash = await getSupportRequestTrackingHash(id);
  const suppliedHash = requesterTrackingTokenHash(token);
  if (!trackingHashMatches(token, derived) || !trackingHashMatches(suppliedHash, savedHash))
    throw new SupportError("NOT_FOUND", "Không tìm thấy yêu cầu.", 404);
}
