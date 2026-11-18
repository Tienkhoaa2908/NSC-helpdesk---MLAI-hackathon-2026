import {
  employeeIdSuggestions,
  parseEmployeeSuggestionPrefix,
  supportPage,
  parseSupportQuery,
} from "@/lib/support-query";
import {
  supportApi,
  supportBody,
  enforceDemoRateLimit,
  requireEmployeeIdentity,
  requireDemoReviewer,
  verifyModelOptions,
  withDemoReviewerDataScope,
} from "@/lib/support-http";
import {
  listSupportRequests,
  listSupportSummaries,
  SupportError,
} from "@/lib/support-repository";
import { submitSupport } from "@/services/support";
import { groupedSupportPage } from "@/lib/support-groups";
import { requesterTrackingProofHash, requesterTrackingToken, requesterTrackingTokenHash } from "@/lib/support-tracking";
import { requestLocale } from "@/i18n/server";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  return supportApi(async () => {
    enforceDemoRateLimit(request, "ingress");
    const body = await requireEmployeeIdentity(await supportBody(request), request);
    // Only the server-validated exact fixture may use the verification allowance.
    enforceDemoRateLimit(request, body.verifyRunId ? "verify" : "intake");
    const trackingProof = request.headers.get("x-tracking-proof")?.trim() ?? "";
    if (!/^[a-f0-9]{64}$/i.test(trackingProof))
      throw new SupportError("TRACKING_PROOF_REQUIRED", "Không thể xác nhận biên nhận. Hãy thử gửi lại.", 422);
    const trackingToken = requesterTrackingToken(body.idempotencyKey);
    const row = await submitSupport(
      body,
      { ...verifyModelOptions(request), locale: requestLocale(request) },
      requesterTrackingTokenHash(trackingToken),
      requesterTrackingProofHash(trackingProof),
    );
    // The capability is returned once as part of the confirmed receipt. It is
    // never included in SupportRequest storage or reviewer API responses.
    return { ...row, trackingToken };
  }, 201);
}
export async function GET(request: Request) {
  return supportApi(async () => {
    const actor = await requireDemoReviewer(request);
    return withDemoReviewerDataScope(actor, async () => {
      const view = new URL(request.url).searchParams.get("view");
      if (view === "grouped") return groupedSupportPage(parseSupportQuery(request.url));
      if (view === "employee-suggestions")
        return employeeIdSuggestions(parseEmployeeSuggestionPrefix(request.url), parseSupportQuery(request.url).division);
      if (view === "page")
        return supportPage(parseSupportQuery(request.url));
      return request &&
        new URL(request.url).searchParams.get("view") === "summary"
        ? listSupportSummaries()
        : listSupportRequests();
    });
  });
}
