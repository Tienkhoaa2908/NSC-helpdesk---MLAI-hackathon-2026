import type { ReactNode } from "react";
import { requireSupportReviewPage } from "@/lib/server-route-auth";

export default async function AuditLayout({ children }: { children: ReactNode }) {
  await requireSupportReviewPage("/audit");
  return children;
}
