import { getRequestGroup, sendGroupReply } from "@/lib/support-groups";
import { supportApi, supportBody, requireDemoReviewer, enforceDemoRateLimit } from "@/lib/support-http";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return supportApi(async () => {
    await requireDemoReviewer(request);
    return getRequestGroup((await context.params).id);
  });
}
export async function POST(request: Request, context: Context) {
  return supportApi(async () => {
    enforceDemoRateLimit(request, "mutation");
    const actor = await requireDemoReviewer(request);
    return sendGroupReply((await context.params).id, await supportBody(request), actor);
  });
}
