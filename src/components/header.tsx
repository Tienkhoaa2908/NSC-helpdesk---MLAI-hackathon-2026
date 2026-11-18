"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Files } from "lucide-react";
import { SiteAccess } from "./site-access";
import { TransitionLink } from "./route-transition";
import { localized, useLocale } from "@/i18n/locale";

type HeaderIdentity = { id: string; status: "ACTIVE" | "ADMIN" };

export function Header() {
  const path = usePathname();
  const { locale, setLocale } = useLocale();
  const [identity, setIdentity] = useState<HeaderIdentity | null>(null);
  const staff = /^\/(review|audit|verify|identity\/(review|authority))/.test(path);
  const supportPath = "/send-help";
  const openGuide = () => window.dispatchEvent(new Event("vng-open-guide"));

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/identity/session", { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : null)
      .then((result) => {
        const current = result?.success && result.data && typeof result.data.id === "string"
          ? { id: result.data.id, status: result.data.status as HeaderIdentity["status"] }
          : null;
        setIdentity(current && (current.status === "ACTIVE" || current.status === "ADMIN") ? current : null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setIdentity(null);
      });
    return () => controller.abort();
  }, [path]);

  async function signOut() {
    try {
      await fetch("/api/identity/logout", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}",
      });
    } finally {
      setIdentity(null);
      window.location.assign("/");
    }
  }

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
          <Link href="/help" aria-current={path === "/help" ? "page" : undefined}>{localized("Hướng dẫn", "Help", locale)}</Link>
        </>}
        {path === "/" && <>
          {!identity && <>
            <Link href="/login">{localized("Đăng nhập", "Sign in", locale)}</Link>
            <Link className="button secondary" href="/identity/new">{localized("Đăng ký", "Register", locale)}</Link>
          </>}
        </>}
        {identity ? <>
          <span className="identity-session-label">{localized("ID", "ID", locale)}: <strong>{identity.id}</strong></span>
          <button className="identity-signout" type="button" onClick={() => void signOut()}>{localized("Đăng xuất", "Sign out", locale)}</button>
        </> : path !== "/" && <Link href="/login">{localized("Đăng nhập", "Sign in", locale)}</Link>}
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
