import type { ReactNode } from "react";
import { requireAdminPage } from "@/lib/server-route-auth";

export default async function AuditLayout({ children }: { children: ReactNode }) {
  await requireAdminPage("/audit");
  return children;
}
