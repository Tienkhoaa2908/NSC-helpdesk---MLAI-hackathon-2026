import {
  supportApi,
  supportBody,
  requestId,
  requireDemoReviewer,
  enforceDemoRateLimit,
} from "@/lib/support-http";
import { executeVerifyCase } from "@/services/verification";
import { getVerifyRun } from "@/lib/verify-repository";
import { cachePackId } from "@/domain/cache-verification";
import { identityCookie } from "@/lib/identity-auth";
import { requestLocale } from "@/i18n/server";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return supportApi(async () => {
    await requireDemoReviewer(request);
    const id = requestId((await context.params).id);
    const run = await getVerifyRun(id);
    enforceDemoRateLimit(request, run.pack === cachePackId ? "cache-verify" : "verify");
    const origin = new URL(request.url).origin;
    const productionApi: typeof fetch = (path, init) => {
      const headers = new Headers(init?.headers);
      const client = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
      if (client) headers.set("x-forwarded-for", client.slice(0, 80));
      const sessionCookie = request.headers.get("cookie")?.split(";").map((item) => item.trim())
        .find((item) => item.startsWith(`${identityCookie}=`));
      headers.set("cookie", [sessionCookie, `app_locale=${requestLocale(request)}`].filter(Boolean).join("; "));
      const requestUrl = new URL(request.url);
      if (process.env.SUPPORT_E2E_PRODUCTION === "true" &&
          ["127.0.0.1", "localhost"].includes(requestUrl.hostname) && requestUrl.port === "3227") {
        for (const name of ["x-support-e2e-identity", "x-support-e2e-role"]) {
          const value = request.headers.get(name);
          if (value) headers.set(name, value);
        }
      }
      return fetch(new URL(String(path), origin), { ...init, headers, cache: "no-store" });
    };
    return executeVerifyCase(
      id,
      await supportBody(request),
      productionApi,
    );
  });
}
