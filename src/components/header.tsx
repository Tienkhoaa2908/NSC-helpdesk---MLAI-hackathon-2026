"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Files } from "lucide-react";
import { SiteAccess } from "./site-access";
import { TransitionLink } from "./route-transition";
export function Header() {
  const path = usePathname();
  const staff = /^\/(review|audit|verify|identity\/(review|authority))/.test(path);
  const supportPath = path === "/send-help" || path === "/workspace" ? "/send-help" : "/guest";
  const openGuide = () => window.dispatchEvent(new Event("vng-open-guide"));
  return (
    <header className={`site-header${staff ? " it-header" : ""}`}>
      <SiteAccess />
      <TransitionLink href="/" className="brand" transition="wipe" title="Màn hình chính">
        <span className="brand-mark">
          <Files size={23} />
        </span>
        VNG Support
      </TransitionLink>
      {staff && (
        <nav aria-label="Điều hướng Admin">
          <Link href="/help/admin">Hướng dẫn Admin</Link>
          <button className="button secondary" type="button" onClick={openGuide}>Hướng dẫn nhanh</button>
        </nav>
      )}
      {path === "/login" && (
        <nav aria-label="Điều hướng nhân viên">
          <Link href="/help/employee">Hướng dẫn nhân viên</Link>
        </nav>
      )}
      {path !== "/" && path !== "/login" && !staff && (
        <nav aria-label="Điều hướng chính">
          <Link href={supportPath} aria-current={path === "/send-help" || path === "/workspace" || path === "/guest" ? "page" : undefined}>Gửi yêu cầu</Link>
          <Link href="/track" aria-current={path === "/track" ? "page" : undefined}>Theo dõi yêu cầu</Link>
          <Link href="/login" >Đăng nhập</Link>
          <Link href="/help" aria-current={path === "/help" ? "page" : undefined}>Hướng dẫn</Link>
        </nav>
      )}
    </header>
  );
}
