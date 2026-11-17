import { supportApi, requestId, enforceDemoRateLimit } from "@/lib/support-http";
import {
  getSupportRequest,
  getSupportRequestTrackingHash,
  getSupportRequestTrackingProofHash,
  SupportError,
} from "@/lib/support-repository";
import {
  requesterTrackingProofHash,
  requesterTrackingToken,
  requesterTrackingTokenHash,
  trackingHashMatches,
} from "@/lib/support-tracking";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return supportApi(async () => {
    enforceDemoRateLimit(request, "ingress");
    const id = requestId((await context.params).id);
    const proof = request.headers.get("x-tracking-proof")?.trim() ?? "";
    if (!/^[a-f0-9]{64}$/i.test(proof))
      throw new SupportError("NOT_FOUND", "Không tìm thấy yêu cầu.", 404);

    const [row, savedTokenHash, savedProofHash] = await Promise.all([
      getSupportRequest(id),
      getSupportRequestTrackingHash(id),
      getSupportRequestTrackingProofHash(id),
    ]);
    if (!row || !savedTokenHash || !savedProofHash ||
        !trackingHashMatches(savedProofHash, requesterTrackingProofHash(proof)))
      throw new SupportError("NOT_FOUND", "Không tìm thấy yêu cầu.", 404);

    const trackingToken = requesterTrackingToken(id);
    if (!trackingHashMatches(savedTokenHash, requesterTrackingTokenHash(trackingToken)))
      throw new SupportError("NOT_FOUND", "Không tìm thấy yêu cầu.", 404);
    return { id, trackingToken };
  });
}
