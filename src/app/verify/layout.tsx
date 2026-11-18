import type { ReactNode } from "react";
import { requireSupportReviewPage } from "@/lib/server-route-auth";

export default async function VerifyLayout({ children }: { children: ReactNode }) {
  await requireSupportReviewPage("/verify");
  return children;
}
