import { errorResponse } from "@/lib/api-response";
import { createIdentitySession, identitySessionCookie, recordGoogleLoginFailure } from "@/lib/identity-auth";
import { consumeGoogleAuthorization, exchangeGoogleAuthorizationCode, googleFlowCookie, googleFlowId } from "@/lib/google-oidc";
import { SupportError } from "@/lib/support-repository";

export const dynamic = "force-dynamic";

function failureResponse(appOrigin?: string) {
  if (appOrigin) {
    const target = new URL("/login?error=google_sign_in", appOrigin);
    const response = Response.redirect(target, 303);
    response.headers.set("set-cookie", googleFlowCookie("", true));
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
  const response = errorResponse("GOOGLE_SIGN_IN_FAILED", "Không hoàn tất được đăng nhập Google. Quay lại trang đăng nhập và thử lại.", 400);
  response.headers.set("set-cookie", googleFlowCookie("", true));
  return response;
}

export async function GET(request: Request) {
  let appOrigin: string | undefined;
  try {
    const flowId = googleFlowId(request);
    if (!flowId) throw new SupportError("GOOGLE_FLOW_MISSING", "Phiên đăng nhập Google đã hết hạn. Bắt đầu lại.", 400);
    const transaction = await consumeGoogleAuthorization(flowId);
    if (!transaction) throw new SupportError("GOOGLE_FLOW_MISSING", "Phiên đăng nhập Google đã hết hạn hoặc đã được sử dụng. Bắt đầu lại.", 400);
    appOrigin = transaction.appOrigin;
    const callbackUrl = new URL(request.url);
    if (callbackUrl.searchParams.has("error")) throw new SupportError("GOOGLE_SIGN_IN_CANCELLED", "Đăng nhập Google chưa được hoàn tất.", 401);
    if (!callbackUrl.searchParams.has("code")) throw new SupportError("GOOGLE_CODE_MISSING", "Google không trả về mã đăng nhập. Bắt đầu lại.", 400);
    const google = await exchangeGoogleAuthorizationCode(callbackUrl, transaction);
    const token = await createIdentitySession(google);
    const response = Response.redirect(new URL(transaction.returnTo, transaction.appOrigin), 303);
    response.headers.append("set-cookie", identitySessionCookie(token));
    response.headers.append("set-cookie", googleFlowCookie("", true));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    await recordGoogleLoginFailure();
    return failureResponse(appOrigin);
  }
}
