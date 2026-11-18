import { supportApi, requireDemoReviewer } from "@/lib/support-http";
import { supportMetrics } from "@/lib/support-query";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return supportApi(async () => {
    await requireDemoReviewer(request);
    return {
      scope:
        "All persisted synthetic requests, including Verify; not real-user outcome metrics",
      ...(await supportMetrics()),
    };
  });
}
