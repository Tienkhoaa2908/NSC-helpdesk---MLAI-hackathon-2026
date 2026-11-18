import {
  enforceDemoRateLimit,
  supportApi,
  supportBody,
  requestId,
} from "@/lib/support-http";
import { continueConversation } from "@/services/conversation";
import { requireRequesterTracking } from "@/lib/support-tracking";
import { requestLocale } from "@/i18n/server";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return supportApi(async () => {
    enforceDemoRateLimit(request, "intake");
    const id = requestId((await context.params).id);
    await requireRequesterTracking(id, request.headers.get("x-tracking-token"));
    return continueConversation(
      id,
      await supportBody(request),
      { locale: requestLocale(request) },
    );
  });
}
