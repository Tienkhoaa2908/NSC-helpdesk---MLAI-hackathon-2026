"use client";
import Link from "next/link";
import { LocaleText, localized, useLocale } from "@/i18n/locale";

export default function HelpIndex() {
  const { locale } = useLocale();
  return (
    <main className="identity-page identity-guide">
      <article className="identity-card">
        <span className="eyebrow"><LocaleText vi="HƯỚNG DẪN SỬ DỤNG" en="USER GUIDE" /></span>
        <h1>VNG Support</h1>
        <p><LocaleText vi="Chọn hướng dẫn theo công việc bạn cần thực hiện." en="Choose a guide for the task you want to complete." /></p>
        <nav className="identity-links" aria-label={localized("Chọn hướng dẫn", "Choose a guide", locale)}>
          <Link className="button primary" href="/send-help"><LocaleText vi="Gửi yêu cầu hỗ trợ" en="Submit a support request" /></Link>
          <Link href="/help/employee"><LocaleText vi="Hướng dẫn nhân viên" en="Employee guide" /></Link>
          <Link href="/help/admin"><LocaleText vi="Hướng dẫn Admin" en="Admin guide" /></Link>
        </nav>
        <section>
          <h2><LocaleText vi="Người gửi yêu cầu" en="Requesters" /></h2>
          <p><LocaleText vi="Gửi mô tả vấn đề, kiểm tra preview, xác nhận lưu hồ sơ và giữ liên kết để theo dõi phản hồi." en="Describe the issue, review the preview, confirm the request, and keep its link to follow the response." /></p>
          <p><Link href="/help/employee"><LocaleText vi="Mở hướng dẫn nhân viên →" en="Open the employee guide →" /></Link></p>
        </section>
        <section>
          <h2>Admin</h2>
          <p><LocaleText vi="Tìm hồ sơ cần xử lý, đối chiếu dữ kiện và policy, phản hồi người gửi, rồi kiểm tra audit." en="Find requests to review, check facts and policy, respond to requesters, and inspect the audit history." /></p>
          <p><Link href="/help/admin"><LocaleText vi="Mở hướng dẫn Admin →" en="Open the Admin guide →" /></Link></p>
        </section>
      </article>
    </main>
  );
}
