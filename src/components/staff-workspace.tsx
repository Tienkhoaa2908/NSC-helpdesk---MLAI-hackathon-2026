import type { ReactNode } from "react";
import Link from "next/link";
import { FlaskConical, Inbox, ShieldCheck } from "lucide-react";
import { localized, useLocale } from "@/i18n/locale";

type StaffSection = "review" | "audit" | "verify" | "identity";

const navigation: Array<{
  href: "/review" | "/audit" | "/verify" | "/identity/review";
  section: StaffSection;
  label: [string, string];
  icon: typeof Inbox;
}> = [
  { href: "/review", section: "review", label: ["Yêu cầu cần xử lý", "Requests to review"], icon: Inbox },
  { href: "/audit", section: "audit", label: ["Lịch sử xử lý", "Activity history"], icon: ShieldCheck },
  { href: "/verify", section: "verify", label: ["Kiểm thử", "Tests"], icon: FlaskConical },
  { href: "/identity/review", section: "identity", label: ["Cấp ID nhân viên", "Employee IDs"], icon: ShieldCheck },
];

export function StaffWorkspace({
  active,
  children,
}: {
  active: StaffSection;
  children: ReactNode;
}) {
  const { locale } = useLocale();
  return (
    <div className="it-workspace">
      <aside className="it-rail" aria-label={localized("Không gian hỗ trợ", "Support workspace", locale)}>
        <div className="it-rail-title">
          <Inbox size={22} />
          <strong>Support Desk</strong>
        </div>
        <p>{localized("Tiếp nhận và xử lý hỗ trợ", "Receive and resolve support requests", locale)}</p>
        <nav aria-label={localized("Điều hướng hỗ trợ", "Support navigation", locale)}>
          {navigation.map(({ href, section, label, icon: Icon }) => (
            <Link
              key={section}
              href={href}
              aria-current={active === section ? "page" : undefined}
            >
              <Icon size={18} />
              {localized(label[0], label[1], locale)}
            </Link>
          ))}
        </nav>
        <div className="it-demo-note">
          <ShieldCheck size={18} />
          <span>
            {localized("Môi trường mô phỏng", "Demo environment", locale)}
            <br />
            {localized("Mọi quyết định đều có nhật ký.", "Every decision is recorded.", locale)}
          </span>
        </div>
      </aside>
      {children}
    </div>
  );
}
