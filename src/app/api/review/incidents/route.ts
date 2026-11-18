import { z } from "zod";
import { supportApi, supportBody, requireDemoReviewer, enforceDemoRateLimit } from "@/lib/support-http";
import { incidentQueue, publishIncident } from "@/lib/support-incidents";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return supportApi(async () => { await requireDemoReviewer(request); return incidentQueue(); });
}
export async function POST(request: Request) {
  return supportApi(async () => {
    enforceDemoRateLimit(request, "mutation");
    const actor = await requireDemoReviewer(request);
    const body = z.object({ id: z.string().uuid(), version: z.number(), state: z.string(), updateId: z.string().uuid() }).strict().parse(await supportBody(request));
    const { id, ...input } = body;
    return publishIncident(id, input, actor);
  });
}
