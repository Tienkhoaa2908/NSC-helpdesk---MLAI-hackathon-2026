"use client";
import Link from "next/link";
import { LocaleText, localized, useLocale } from "@/i18n/locale";

export default function EmployeeHelp() {
  const { locale } = useLocale();
  return (
    <main className="identity-page identity-guide">
      <article className="identity-card">
        <span className="eyebrow"><LocaleText vi="HƯỚNG DẪN NHÂN VIÊN" en="EMPLOYEE GUIDE" /></span>
        <h1><LocaleText vi="Gửi và theo dõi yêu cầu" en="Submit and track requests" /></h1>
        <p><LocaleText vi="Support Desk tạo preview để bạn kiểm tra trước khi lưu hồ sơ. Sau khi gửi, hãy giữ liên kết theo dõi để tiếp tục trao đổi." en="Support Desk prepares a preview for you to check before saving a request. After submission, keep the tracking link to continue the conversation." /></p>
        <nav className="identity-links" aria-label={localized("Thao tác người gửi", "Requester actions", locale)}>
          <Link className="button primary" href="/send-help"><LocaleText vi="Gửi yêu cầu hỗ trợ" en="Submit a support request" /></Link>
          <Link href="/login"><LocaleText vi="Đăng nhập" en="Sign in" /></Link>
          <Link href="/help"><LocaleText vi="Tất cả hướng dẫn" en="All guides" /></Link>
        </nav>
        <section>
          <h2><LocaleText vi="1. Đăng nhập hoặc đăng ký" en="1. Sign in or register" /></h2>
          <p><LocaleText vi="Đăng nhập bằng ID nhân viên và mật khẩu đã được cấp. Nếu chưa có tài khoản, chọn Đăng ký, nhập họ tên và Gmail để gửi yêu cầu. Email thông báo mở danh sách riêng cho Admin; Admin đăng nhập rồi xác nhận hoặc từ chối. Nếu gửi email thông báo thất bại, đơn vẫn được lưu để Admin xử lý sau. Sau khi cấp, ID và mật khẩu được gửi tới Gmail đã đăng ký. Bạn có thể dùng guest01 / 12345 để trải nghiệm bằng dữ liệu tổng hợp." en="Sign in with your assigned employee ID and password. If you do not have an account, choose Register and submit your name and Gmail address. The notification email opens the private Admin list; an Admin signs in and explicitly approves or rejects the request. If the notification email fails, the request remains saved for the Admin to review later. Issued sign-in details are sent to the registered Gmail address. You can use guest01 / 12345 with synthetic data to explore the system." /></p>
        </section>
        <section>
          <h2><LocaleText vi="2. Mô tả vấn đề" en="2. Describe the issue" /></h2>
          <p><LocaleText vi="Mở form, chọn mô tả tự do hoặc danh mục. Ghi điều đang gặp, điều đã thử và kết quả quan sát được. Chỉ điền dữ kiện bạn biết; không nhập mật khẩu, mã xác thực hoặc khóa API." en="Open the form and describe the issue or choose a category. Include what happened, what you tried, and the observed result. Enter only facts you know; do not include passwords, verification codes, or API keys." /></p>
        </section>
        <section>
          <h2><LocaleText vi="3. Kiểm tra preview và gửi" en="3. Review the preview and submit" /></h2>
          <p><LocaleText vi="Chọn Gửi để xem nội dung hệ thống hiểu và hướng xử lý. Preview chưa tạo hồ sơ. Sửa nội dung nếu cần, rồi chọn Xác nhận và gửi yêu cầu hoặc Lưu và tiếp tục trò chuyện." en="Choose Submit to review how the system interpreted the issue and its proposed next step. A preview does not create a request. Edit the description if needed, then choose Confirm and submit request or Save and continue conversation." /></p>
        </section>
        <section>
          <h2><LocaleText vi="4. Theo dõi hồ sơ" en="4. Track the request" /></h2>
          <p><LocaleText vi="Lưu liên kết đầy đủ để mở lại hồ sơ, trả lời câu hỏi làm rõ, hỏi tiếp, báo đã giải quyết, báo vẫn còn lỗi hoặc yêu cầu nhân viên hỗ trợ. Trong public-demo, requester đã đăng nhập có thể trải nghiệm hàng đợi Support, audit và Verify; chỉ danh sách yêu cầu cấp tài khoản và thao tác quyết định dành cho Admin. Môi trường demo chỉ dùng dữ liệu tổng hợp." en="Keep the full link to reopen the request, answer clarification questions, ask a follow-up, report whether the issue is resolved, or request staff assistance. In public-demo mode, signed-in requester accounts can explore the Support queue, audit history, and Verify. Account requests and approval actions are Admin-only. Use synthetic data only." /></p>
          <p><Link href="/track"><LocaleText vi="Mở trang theo dõi yêu cầu →" en="Open request tracking →" /></Link></p>
        </section>
        <section className="guide-note">
          <h2><LocaleText vi="Lưu ý về tài khoản demo" en="Demo account notice" /></h2>
          <p><LocaleText vi="Tài khoản guest01 / 12345 dùng chung để trải nghiệm, không xác minh danh tính nhân viên. Tài khoản này có thể xem khu Support reviewer trong public-demo, nhưng không thể xem đơn cấp tài khoản hoặc duyệt yêu cầu. Chỉ dùng dữ liệu tổng hợp. Hệ thống áp policy và kho tri thức để hướng dẫn; trường hợp thiếu căn cứ, vượt thẩm quyền hoặc có rủi ro sẽ được hỏi thêm hoặc chuyển nhân viên." en="The shared guest01 / 12345 account is for exploration and does not verify employee identity. It can access the Support review workspace in public-demo mode, but cannot view account applications or approve requests. Use synthetic data only. The system applies policy and a knowledge base to provide guidance; cases with missing facts, authority limits, or risks are clarified or routed to staff." /></p>
        </section>
      </article>
    </main>
  );
}
