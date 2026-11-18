import type { ReactNode } from "react";
import { requireAdminPage } from "@/lib/server-route-auth";

export default async function ReviewLayout({ children }: { children: ReactNode }) {
  await requireAdminPage("/review");
  return children;
}
