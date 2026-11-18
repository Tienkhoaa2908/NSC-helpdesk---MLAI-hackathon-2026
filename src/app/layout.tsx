import type { Metadata } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { Header } from "@/components/header";
import { JudgeGuide } from "@/components/judge-guide";
import { RouteTransition } from "@/components/route-transition";
import { LocaleProvider, type Locale } from "@/i18n/locale";
import "./globals.css";

const nunito = localFont({
  src: "./fonts/Nunito.ttf",
  variable: "--font-nunito",
  weight: "200 1000",
  display: "swap",
});
export async function generateMetadata(): Promise<Metadata> {
  const savedLocale = (await cookies()).get("app_locale")?.value;
  return {
    title: "NSClub Help Desk",
    description: savedLocale === "en"
      ? "Get help with work, technology, commerce, and HR through AI-assisted guidance, references, and a clear review process."
      : "Hỗ trợ công việc, công nghệ, thương mại và nhân sự với AI, nguồn tham khảo và quy trình xử lý rõ ràng.",
    icons: {
      icon: "/illustrations/vng-support-mascot-navi-wave.png",
      shortcut: "/illustrations/vng-support-mascot-navi-wave.png",
      apple: "/illustrations/vng-support-mascot-navi-wave.png",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const savedLocale = (await cookies()).get("app_locale")?.value;
  const locale: Locale = savedLocale === "en" ? "en" : "vi";
  return (
    <html lang={locale} className={nunito.variable}>
      <body>
        <LocaleProvider initialLocale={locale}>
          <RouteTransition>
            <JudgeGuide><Header />{children}</JudgeGuide>
          </RouteTransition>
        </LocaleProvider>
      </body>
    </html>
  );
}
