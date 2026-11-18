import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LoginPanel } from "@/components/identity-ui";
import { LocaleText } from "@/i18n/locale";

export default function LoginPage() {
  return (
    <main className="login-page">
      <Link href="/" className="back-link"><ArrowLeft size={18} /><LocaleText as="span" vi="Màn hình chính" en="Home" /></Link>
      <LoginPanel />
    </main>
  );
}
