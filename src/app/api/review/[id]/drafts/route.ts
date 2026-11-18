import { supportApi, supportBody, requestId, requireDemoReviewer, enforceDemoRateLimit } from "@/lib/support-http";
import { draftReviewReasons } from "@/services/review-drafts";
import { requestLocale } from "@/i18n/server";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return supportApi(async () => {
    enforceDemoRateLimit(request, "mutation");
    await requireDemoReviewer(request);
    return draftReviewReasons(requestId((await context.params).id), await supportBody(request), { locale: requestLocale(request) });
  });
}
