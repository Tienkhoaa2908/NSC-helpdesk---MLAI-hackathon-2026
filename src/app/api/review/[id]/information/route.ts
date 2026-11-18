import { supportApi, supportBody, requestId, requireDemoReviewer, enforceDemoRateLimit } from "@/lib/support-http";
import { draftReviewInformation } from "@/services/review-information";
import { requestLocale } from "@/i18n/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return supportApi(async () => {
    enforceDemoRateLimit(request, "mutation");
    await requireDemoReviewer(request);
    return draftReviewInformation(requestId((await context.params).id), await supportBody(request), { locale: requestLocale(request) });
  });
}
