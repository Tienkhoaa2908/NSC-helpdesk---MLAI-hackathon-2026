import type { ReactNode } from "react";
import { requireAdminPage } from "@/lib/server-route-auth";

export default async function VerifyLayout({ children }: { children: ReactNode }) {
  await requireAdminPage("/verify");
  return children;
}
