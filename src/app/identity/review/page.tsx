import { redirect } from "next/navigation";
import { IdentityAdminOnlyNotice, IdentityReview } from "@/components/identity-review";
import { getCurrentIdentityPrincipal } from "@/lib/server-route-auth";

export default async function IdentityReviewPage() {
  const principal = await getCurrentIdentityPrincipal();
  if (!principal) redirect("/login?next=%2Fidentity%2Freview");
  if (principal.status !== "ADMIN" || !principal.canReviewIds) return <IdentityAdminOnlyNotice />;
  return <IdentityReview />;
}
