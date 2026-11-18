import { supportApi, supportBody, requestId, requireDemoReviewer, enforceDemoRateLimit } from "@/lib/support-http";
import { summarizeReviewRequest } from "@/services/review-summary";
import { requestLocale } from "@/i18n/server";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return supportApi(async () => {
    await requireDemoReviewer(request);
    // Read-only AI intake: do not consume the separate quota for workflow decisions.
    enforceDemoRateLimit(request, "intake");
    return summarizeReviewRequest(requestId((await context.params).id), await supportBody(request), { locale: requestLocale(request) });
  });
}
