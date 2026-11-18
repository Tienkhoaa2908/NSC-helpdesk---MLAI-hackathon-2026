import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { identityPrincipalForRequest, type IdentityPrincipal } from "@/lib/identity-auth";

async function currentPrincipal() {
  const incoming = await headers();
  const host = incoming.get("host") ?? "127.0.0.1:3227";
  const protocol = incoming.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    (host.startsWith("127.0.0.1") || host.startsWith("localhost") ? "http" : "https");
  return identityPrincipalForRequest(new Request(`${protocol}://${host}/api/identity/session`, { headers: incoming }));
}

export async function getCurrentIdentityPrincipal(): Promise<IdentityPrincipal | null> {
  try {
    return await currentPrincipal();
  } catch {
    return null;
  }
}

export async function requireSupportReviewPage(path: "/review" | "/audit" | "/verify") {
  let principal;
  try {
    principal = await currentPrincipal();
  } catch {
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  if (principal.status === "ADMIN") return;
  if (principal.status === "ACTIVE" && process.env.SUPPORT_ACCESS_MODE === "public-demo") return;
  redirect(`/login?next=${encodeURIComponent(path)}`);
}

export async function requireRequesterPage() {
  let principal;
  try {
    principal = await currentPrincipal();
  } catch {
    redirect("/login?next=%2Fsend-help");
  }
  if (principal.status === "ADMIN" && !principal.isTestIdentity) redirect("/review");
  if (principal.status !== "ACTIVE" && !principal.isTestIdentity)
    redirect("/login?next=%2Fsend-help");
}
