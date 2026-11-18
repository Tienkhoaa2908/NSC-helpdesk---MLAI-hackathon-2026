"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Files } from "lucide-react";
import { SiteAccess } from "./site-access";
import { TransitionLink } from "./route-transition";
import { localized, useLocale } from "@/i18n/locale";
export function Header() {
  const path = usePathname();
  const { locale, setLocale } = useLocale();
  const staff = /^\/(review|audit|verify|identity\/(review|authority))/.test(path);
  const supportPath = "/send-help";
  const openGuide = () => window.dispatchEvent(new Event("vng-open-guide"));
  return (
    <header className={`site-header${staff ? " it-header" : ""}`}>
      <SiteAccess />
      <TransitionLink href="/" className="brand" transition="wipe" title={localized("Màn hình chính", "Home", locale)}>
        <span className="brand-mark">
          <Files size={23} />
        </span>
        VNG Support
      </TransitionLink>
      <nav className="header-actions" aria-label={localized("Điều hướng chính", "Main navigation", locale)}>
        {staff && <>
          <Link href="/help/admin">{localized("Hướng dẫn Admin", "Admin guide", locale)}</Link>
          <button className="button secondary" type="button" onClick={openGuide}>{localized("Hướng dẫn nhanh", "Quick guide", locale)}</button>
        </>}
        {path === "/login" && <Link href="/help/employee">{localized("Hướng dẫn nhân viên", "Employee guide", locale)}</Link>}
        {path !== "/" && path !== "/login" && !staff && <>
          <Link href={supportPath} aria-current={path === "/send-help" || path === "/workspace" || path === "/guest" ? "page" : undefined}>{localized("Gửi yêu cầu", "Submit a request", locale)}</Link>
          <Link href="/track" aria-current={path === "/track" ? "page" : undefined}>{localized("Theo dõi yêu cầu", "Track a request", locale)}</Link>
          <Link href="/login">{localized("Đăng nhập", "Sign in", locale)}</Link>
          <Link href="/help" aria-current={path === "/help" ? "page" : undefined}>{localized("Hướng dẫn", "Help", locale)}</Link>
        </>}
        {path === "/" && <>
          <Link href="/login">{localized("Đăng nhập", "Sign in", locale)}</Link>
          <Link className="button secondary" href="/identity/new">{localized("Đăng ký", "Register", locale)}</Link>
        </>}
        <button
          className="button secondary locale-toggle"
          type="button"
          aria-label={localized("Chuyển sang tiếng Anh", "Switch to Vietnamese", locale)}
          onClick={() => setLocale(locale === "vi" ? "en" : "vi")}
        >{locale === "vi" ? "EN" : "VI"}</button>
      </nav>
    </header>
  );
}
