import {
  supportApi,
  supportBody,
  requestId,
  requireDemoReviewer,
  enforceDemoRateLimit,
  withDemoReviewerDataScope,
} from "@/lib/support-http";
import { reviewSupport } from "@/services/review";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return supportApi(async () => {
    enforceDemoRateLimit(request, "mutation");
    const actor = await requireDemoReviewer(request);
    return withDemoReviewerDataScope(actor, async () => reviewSupport(
        requestId((await context.params).id),
        await supportBody(request),
        actor,
      ));
  });
}
