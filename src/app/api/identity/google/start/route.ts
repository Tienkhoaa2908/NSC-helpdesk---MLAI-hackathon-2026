import { z } from "zod";
import { successResponse } from "@/lib/api-response";
import { googleFlowCookie, startGoogleAuthorization } from "@/lib/google-oidc";
import { identityClientRateLimitKey, identityRateLimit } from "@/lib/identity-auth";
import { supportApi, supportBody } from "@/lib/support-http";
import { SupportError } from "@/lib/support-repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return supportApi(async () => {
    const origin = request.headers.get("origin");
    const target = new URL(request.url);
    const parsedOrigin = origin ? URL.parse(origin) : null;
    const sameOrigin = Boolean(parsedOrigin && parsedOrigin.origin === origin &&
      (origin === target.origin || parsedOrigin.host === request.headers.get("host") && parsedOrigin.protocol === target.protocol));
    if (!sameOrigin || request.headers.get("sec-fetch-site") === "cross-site")
      throw new SupportError("INVALID_ORIGIN", "Origin không hợp lệ.", 403);
    const input = z.object({ returnTo: z.string().max(100).optional() }).strict().parse(await supportBody(request));
    await identityRateLimit(`google-login:${identityClientRateLimitKey(request)}`, 40);
    const result = await startGoogleAuthorization(input.returnTo ?? "/send-help");
    const response = successResponse({ authorizationUrl: result.authorizationUrl });
    response.headers.set("set-cookie", googleFlowCookie(result.flowId));
    return response;
  });
}
