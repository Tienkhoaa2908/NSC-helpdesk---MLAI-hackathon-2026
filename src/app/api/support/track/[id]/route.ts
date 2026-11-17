import { incidentView } from "@/lib/support-incidents";
import { sharedRepliesForRequest } from "@/lib/support-groups";
import { requestId, supportApi } from "@/lib/support-http";
import { getSupportRequest, SupportError } from "@/lib/support-repository";
import { requireRequesterTracking } from "@/lib/support-tracking";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return supportApi(async () => {
    const id = requestId((await context.params).id);
    await requireRequesterTracking(id, request.headers.get("x-tracking-token"));
    const row = await getSupportRequest(id);
    if (!row) throw new SupportError("NOT_FOUND", "Không tìm thấy yêu cầu.", 404);
    const sharedReplies = await sharedRepliesForRequest(row.id);
    return {
      ...row,
      ...(sharedReplies.length ? { sharedReplies } : {}),
      ...(row.incidentId ? { incident: await incidentView(row.incidentId) } : {}),
    };
  });
}
