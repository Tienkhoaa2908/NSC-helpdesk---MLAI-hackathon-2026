import { supportApi, supportBody, requestId, requireDemoReviewer, enforceDemoRateLimit, withDemoReviewerDataScope } from "@/lib/support-http";
import { draftReviewReasons } from "@/services/review-drafts";
import { requestLocale } from "@/i18n/server";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return supportApi(async () => {
    enforceDemoRateLimit(request, "mutation");
    const actor = await requireDemoReviewer(request);
    return withDemoReviewerDataScope(actor, async () => draftReviewReasons(requestId((await context.params).id), await supportBody(request), { locale: requestLocale(request) }));
  });
}
