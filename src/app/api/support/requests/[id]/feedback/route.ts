import {
  supportApi,
  supportBody,
  requestId,
  enforceDemoRateLimit,
} from "@/lib/support-http";
import { feedbackSupport } from "@/services/review";
import { requireRequesterTracking } from "@/lib/support-tracking";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return supportApi(async () => {
    enforceDemoRateLimit(request, "mutation");
    const id = requestId((await context.params).id);
    await requireRequesterTracking(id, request.headers.get("x-tracking-token"));
    return feedbackSupport(
      id,
      await supportBody(request),
    );
  });
}
