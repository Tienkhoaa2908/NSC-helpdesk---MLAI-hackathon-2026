import Link from "next/link";

export default function EmployeeHelp() {
  return (
    <main className="identity-page identity-guide">
      <article className="identity-card">
        <span className="eyebrow">HƯỚNG DẪN NHÂN VIÊN</span>
        <h1>Gửi và theo dõi yêu cầu</h1>
        <p>Support Desk tạo preview để bạn kiểm tra trước khi lưu hồ sơ. Sau khi gửi, hãy giữ liên kết theo dõi để tiếp tục trao đổi.</p>
        <nav className="identity-links" aria-label="Thao tác người gửi">
          <Link className="button primary" href="/send-help">Gửi yêu cầu hỗ trợ</Link>
          <Link href="/guest">Gửi không cần tài khoản</Link>
          <Link href="/help">Tất cả hướng dẫn</Link>
        </nav>
        <section>
          <h2>1. Chọn cách gửi</h2>
          <p>Chọn <strong>Tôi cần hỗ trợ</strong> rồi đăng nhập bằng Google với tài khoản đã được IT duyệt. Nếu chưa có ID, đăng nhập Google và chọn <strong>Nhân viên mới?</strong> để gửi đơn; IT xác minh nhân sự và phạm vi trước khi cấp ID. ID nội bộ không phải mật khẩu. Muốn thử luồng công khai, chọn <strong>Đăng nhập không cần tài khoản</strong>; luồng demo này không xác minh người dùng.</p>
        </section>
        <section>
          <h2>2. Mô tả vấn đề</h2>
          <p>Mở form, chọn mô tả tự do hoặc danh mục. Ghi điều đang gặp, điều đã thử và kết quả quan sát được. Chỉ điền dữ kiện bạn biết; không nhập mật khẩu, mã xác thực hoặc khóa API.</p>
        </section>
        <section>
          <h2>3. Kiểm tra preview và gửi</h2>
          <p>Chọn <strong>Gửi</strong> để xem nội dung hệ thống hiểu và hướng xử lý. Preview chưa tạo hồ sơ. Sửa nội dung nếu cần, rồi chọn <strong>Xác nhận và gửi yêu cầu</strong> hoặc <strong>Lưu và tiếp tục trò chuyện</strong>.</p>
        </section>
        <section>
          <h2>4. Theo dõi hồ sơ</h2>
          <p>Lưu liên kết đầy đủ. Token trong liên kết cho phép người gửi đọc và tiếp tục hồ sơ; reviewer Support vẫn có thể xem hồ sơ trên hàng đợi công khai, vì vậy chỉ dùng dữ liệu tổng hợp trên website public. Trên trang theo dõi, bạn có thể trả lời câu hỏi làm rõ, hỏi tiếp, báo đã giải quyết, báo vẫn còn lỗi hoặc yêu cầu nhân viên hỗ trợ.</p>
          <p><Link href="/track">Mở trang theo dõi yêu cầu →</Link></p>
        </section>
        <section className="guide-note">
          <h2>Giới hạn môi trường demo</h2>
          <p>Google Sign-In xác minh tài khoản Google, không xác nhận người dùng là nhân viên. IT phải kiểm tra đơn trước khi cấp ID. Phòng ban tự khai trong luồng demo chỉ liên kết hồ sơ. Hướng dẫn tự động theo policy và kho tri thức; trường hợp thiếu căn cứ, vượt thẩm quyền hoặc có rủi ro được hỏi thêm hoặc chuyển nhân viên. Không gửi dữ liệu nhạy cảm.</p>
        </section>
      </article>
    </main>
  );
}
