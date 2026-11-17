import Link from "next/link";

export default function HelpIndex() {
  return (
    <main className="identity-page identity-guide">
      <article className="identity-card">
        <span className="eyebrow">HƯỚNG DẪN SỬ DỤNG</span>
        <h1>VNG Support</h1>
        <p>Chọn hướng dẫn theo công việc bạn cần thực hiện.</p>
        <nav className="identity-links" aria-label="Chọn hướng dẫn">
          <Link className="button primary" href="/send-help">Gửi yêu cầu hỗ trợ</Link>
          <Link href="/help/employee">Hướng dẫn nhân viên</Link>
          <Link href="/help/admin">Hướng dẫn Admin</Link>
        </nav>
        <section>
          <h2>Người gửi yêu cầu</h2>
          <p>Gửi mô tả vấn đề, kiểm tra preview, xác nhận lưu hồ sơ và giữ liên kết để theo dõi phản hồi.</p>
          <p><Link href="/help/employee">Mở hướng dẫn nhân viên →</Link></p>
        </section>
        <section>
          <h2>Admin</h2>
          <p>Tìm hồ sơ cần xử lý, đối chiếu dữ kiện và policy, phản hồi người gửi, rồi kiểm tra audit.</p>
          <p><Link href="/help/admin">Mở hướng dẫn Admin →</Link></p>
        </section>
      </article>
    </main>
  );
}
