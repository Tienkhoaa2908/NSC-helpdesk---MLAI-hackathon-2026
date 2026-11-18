import type { ReactNode } from "react";
import { requireSupportReviewPage } from "@/lib/server-route-auth";

export default async function ReviewLayout({ children }: { children: ReactNode }) {
  await requireSupportReviewPage("/review");
  return children;
}
