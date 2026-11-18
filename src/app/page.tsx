"use client";
import { TransitionLink } from "@/components/route-transition";
import Image from "next/image";
import { ArrowRight, Headphones, ClipboardList } from "lucide-react";
import { localized, useLocale } from "@/i18n/locale";

export default function Home() {
  const { locale } = useLocale();
  return (
    <main className="welcome role-welcome" aria-label={localized("Chọn vai trò", "Choose a role", locale)}>
      <section className="welcome-copy">
        <h1>{localized("Bạn cần hỗ trợ", "How can we help", locale)}<br />{localized("gì hôm nay?", "you today?", locale)}</h1>
        <div className="entry-links">
          <TransitionLink transition="line" aria-label={localized("Tôi cần hỗ trợ", "I need help", locale)} className="entry-card entry-primary" href="/login">
            <span className="entry-icon"><Headphones size={28} /></span>
            <strong>{localized("Tôi cần hỗ trợ", "I need help", locale)}</strong>
            <ArrowRight size={24} aria-hidden="true" />
          </TransitionLink>
          <TransitionLink transition="line" aria-label={localized("Dành cho Admin", "For admins", locale)} className="entry-card" href="/login?next=%2Freview">
            <span className="entry-icon"><ClipboardList size={27} /></span>
            <strong>{localized("Dành cho Admin", "For admins", locale)}</strong>
            <ArrowRight size={24} aria-hidden="true" />
          </TransitionLink>
        </div>
      </section>
      <div className="welcome-art">
        <span className="mascot-orbit" aria-hidden="true" />
        <span className="hello-note" aria-hidden="true">{localized("Xin chào!", "Hello!", locale)}</span>
        <Image src="/illustrations/vng-support-mascot-navi-wave.png" width={1024} height={1024}
          priority alt={localized("Navi màu cam với mặt hình folder đang nháy mắt và giơ một tay chào", "Orange Navi mascot with a folder-shaped face, winking and waving", locale)} />
      </div>
    </main>
  );
}
