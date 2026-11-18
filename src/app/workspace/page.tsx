import { SupportWorkspace } from "@/components/support-workspace";
import { requireRequesterPage } from "@/lib/server-route-auth";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  await requireRequesterPage();
  return <SupportWorkspace />;
}
