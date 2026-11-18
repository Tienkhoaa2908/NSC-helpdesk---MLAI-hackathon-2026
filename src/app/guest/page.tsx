import { redirect } from "next/navigation";

export default function GuestAlias() {
  redirect("/login?next=%2Fsend-help");
}
