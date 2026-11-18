"use client";
import Link from "next/link";
import { LocaleText, localized, useLocale } from "@/i18n/locale";

export default function AdminHelp() {
  const { locale } = useLocale();
  return (
    <main className="identity-page identity-guide">
      <article className="identity-card">
        <span className="eyebrow"><LocaleText vi="HƯỚNG DẪN ADMIN" en="ADMIN GUIDE" /></span>
        <h1><LocaleText vi="Tiếp nhận và xử lý yêu cầu" en="Review and resolve requests" /></h1>
        <p><LocaleText vi="Đối chiếu yêu cầu với dữ kiện, bằng chứng và policy trước khi phản hồi. Mỗi quyết định được lưu trong lịch sử xử lý." en="Check each request against its facts, evidence, and policy before responding. Decisions are recorded in the activity history." /></p>
        <nav className="identity-links" aria-label={localized("Thao tác Admin", "Admin actions", locale)}>
          <Link className="button primary" href="/review"><LocaleText vi="Mở hàng đợi yêu cầu" en="Open request queue" /></Link>
          <Link href="/audit"><LocaleText vi="Lịch sử xử lý" en="Activity history" /></Link>
          <Link href="/verify"><LocaleText vi="Kiểm thử / Verify" en="Tests / Verify" /></Link>
          <Link href="/help"><LocaleText vi="Tất cả hướng dẫn" en="All guides" /></Link>
        </nav>
        <section>
          <h2><LocaleText vi="1. Tìm yêu cầu" en="1. Find requests" /></h2>
          <p><LocaleText vi="Dùng tìm kiếm và bộ lọc trong hàng đợi để xem hồ sơ chờ xử lý, ngoài policy, cần xác minh thẩm quyền hoặc có gợi ý tri thức. Mở một hồ sơ để đọc nội dung nguyên văn đã qua xử lý dữ liệu nhạy cảm." en="Use queue search and filters to find requests that are pending, outside policy, need authority checks, or have knowledge suggestions. Open a request to review its original text after supported sensitive data has been redacted." /></p>
        </section>
        <section>
          <h2><LocaleText vi="2. Đối chiếu nội dung và bằng chứng" en="2. Check the request and evidence" /></h2>
          <p><LocaleText vi="Bản tóm tắt AI chỉ hỗ trợ đọc nhanh. Mở Xem lịch sử & bằng chứng để đối chiếu rule, dữ kiện còn thiếu, hướng dẫn đã gửi và thay đổi trạng thái. Nếu tóm tắt lỗi, hồ sơ vẫn có thể được đọc và xử lý." en="The AI summary is for quick reference. Open View history & evidence to check rules, missing facts, guidance sent, and status changes. The request remains available if its summary fails." /></p>
        </section>
        <section>
          <h2><LocaleText vi="3. Phản hồi và ra quyết định" en="3. Respond and decide" /></h2>
          <p><LocaleText vi="Dùng Hỏi thêm thông tin khi cần dữ kiện bổ sung. Duyệt, từ chối, dừng hoặc điều chỉnh trạng thái theo điều kiện của hồ sơ. Ghi rõ lý do khi thao tác yêu cầu. Duyệt hồ sơ không tự cấp quyền hoặc thay đổi hạ tầng ngoài ứng dụng." en="Use Ask for more information when facts are missing. Approve, reject, stop, or change the status according to the request. Provide a reason when prompted. Approving a request does not grant access or modify external infrastructure." /></p>
        </section>
        <section>
          <h2><LocaleText vi="4. Xử lý sự cố có nhiều yêu cầu" en="4. Handle related requests" /></h2>
          <p><LocaleText vi="Một số yêu cầu cùng chủ đề và địa điểm được liên kết vào sự cố chung. Mỗi người gửi vẫn có hồ sơ riêng; cập nhật tiến độ được chọn sẵn hiển thị trên các hồ sơ liên kết." en="Some requests with the same topic and location are linked to a shared incident. Each requester keeps a separate case; selected progress updates appear on the linked cases." /></p>
        </section>
        <section>
          <h2><LocaleText vi="5. Kiểm tra lịch sử và Verify" en="5. Review history and Verify" /></h2>
          <p><LocaleText vi="Mở Lịch sử xử lý để đối chiếu quyết định và người thực hiện. Verify chạy các tình huống giả lập và input mới để kiểm tra quyết định, hồ sơ và audit. Bộ test được xây dựng để đáp ứng yêu cầu kiểm thử của track VNG tại MLAI Hackathon 2026; kết quả không phải đánh giá người dùng thật." en="Open Activity history to inspect decisions and actors. Verify runs synthetic scenarios and new inputs to check decisions, request records, and audit events. These test cases were built to meet the VNG track testing requirements at MLAI Hackathon 2026; they do not evaluate real users." /></p>
        </section>
        <section className="guide-note">
          <h2><LocaleText vi="Môi trường demo" en="Demo environment" /></h2>
          <p><LocaleText vi="Trong public-demo, tài khoản requester đã đăng nhập cũng có thể xem hàng đợi Support, audit và Verify; chỉ dùng dữ liệu tổng hợp. Trang yêu cầu cấp tài khoản chỉ dành cho Admin, có thao tác xác nhận hoặc từ chối. Email thông báo chỉ mở danh sách; Admin đăng nhập rồi chọn quyết định. Khi bật email, hệ thống tự gửi thông tin đăng nhập hoặc kết quả từ chối đến người yêu cầu." en="In public-demo mode, signed-in requester accounts can also view the Support queue, audit history, and Verify; use synthetic data only. Account requests are Admin-only and have explicit approve and reject actions. The notification email only opens the list; an Admin signs in and chooses an action. When email is configured and enabled, the system sends sign-in details or the rejection result to the applicant." /></p>
          <p><Link href="/identity/review"><LocaleText vi="Mở quản lý cấp ID →" en="Open employee ID requests →" /></Link></p>
        </section>
      </article>
    </main>
  );
}
