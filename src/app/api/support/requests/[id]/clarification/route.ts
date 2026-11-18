import {
  supportApi,
  supportBody,
  requestId,
  enforceDemoRateLimit,
} from "@/lib/support-http";
import { clarifySupport } from "@/services/review";
import { requireRequesterTracking } from "@/lib/support-tracking";
import { requestLocale } from "@/i18n/server";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return supportApi(async () => {
    enforceDemoRateLimit(request, "mutation");
    const id = requestId((await context.params).id);
    await requireRequesterTracking(id, request.headers.get("x-tracking-token"));
    return clarifySupport(
      id,
      await supportBody(request),
      { locale: requestLocale(request) },
    );
  });
}
