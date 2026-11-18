import type { ReactNode } from "react";
import { requireAdminPage } from "@/lib/server-route-auth";

export default async function IdentityReviewLayout({ children }: { children: ReactNode }) {
  await requireAdminPage("/identity/review");
  return children;
}
