import { supportApi, requireDemoReviewer, withDemoReviewerDataScope } from "@/lib/support-http";
import { supportMetrics } from "@/lib/support-query";
import { isVerifyOnlySupportScope } from "@/lib/support-data-scope";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return supportApi(async () => {
    const actor = await requireDemoReviewer(request);
    return withDemoReviewerDataScope(actor, async () => ({
      scope: isVerifyOnlySupportScope()
        ? "Linked synthetic Verify cases only"
        : "All persisted Support requests",
      ...(await supportMetrics()),
    }));
  });
}
