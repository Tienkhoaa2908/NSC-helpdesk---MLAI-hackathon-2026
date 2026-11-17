import Link from "next/link";

export default function AdminHelp() {
  return (
    <main className="identity-page identity-guide">
      <article className="identity-card">
        <span className="eyebrow">HƯỚNG DẪN ADMIN</span>
        <h1>Tiếp nhận và xử lý yêu cầu</h1>
        <p>Đối chiếu yêu cầu với dữ kiện, bằng chứng và policy trước khi phản hồi. Mỗi quyết định được lưu trong lịch sử xử lý.</p>
        <nav className="identity-links" aria-label="Thao tác Admin">
          <Link className="button primary" href="/review">Mở hàng đợi yêu cầu</Link>
          <Link href="/audit">Lịch sử xử lý</Link>
          <Link href="/verify">Kiểm thử / Verify</Link>
          <Link href="/help">Tất cả hướng dẫn</Link>
        </nav>
        <section>
          <h2>1. Tìm yêu cầu</h2>
          <p>Dùng tìm kiếm và bộ lọc trong hàng đợi để xem hồ sơ chờ xử lý, ngoài policy, cần xác minh thẩm quyền hoặc có gợi ý tri thức. Mở một hồ sơ để đọc nội dung nguyên văn đã qua xử lý dữ liệu nhạy cảm.</p>
        </section>
        <section>
          <h2>2. Đối chiếu nội dung và bằng chứng</h2>
          <p>Bản tóm tắt AI chỉ hỗ trợ đọc nhanh. Mở <strong>Xem lịch sử &amp; bằng chứng</strong> để đối chiếu rule, dữ kiện còn thiếu, hướng dẫn đã gửi và thay đổi trạng thái. Nếu tóm tắt lỗi, hồ sơ vẫn có thể được đọc và xử lý.</p>
        </section>
        <section>
          <h2>3. Phản hồi và ra quyết định</h2>
          <p>Dùng <strong>Hỏi thêm thông tin</strong> khi cần dữ kiện bổ sung. Duyệt, từ chối, dừng hoặc điều chỉnh trạng thái theo điều kiện của hồ sơ. Các thao tác yêu cầu lý do cần được ghi rõ. Duyệt hồ sơ không tự cấp quyền hoặc thay đổi hạ tầng ngoài ứng dụng.</p>
        </section>
        <section>
          <h2>4. Xử lý sự cố có nhiều yêu cầu</h2>
          <p>Một số yêu cầu cùng chủ đề và địa điểm được liên kết vào sự cố chung. Mỗi người gửi vẫn có hồ sơ riêng; cập nhật tiến độ được chọn sẵn hiển thị trên các hồ sơ liên kết, không gửi email hoặc thông báo đẩy.</p>
        </section>
        <section>
          <h2>5. Kiểm tra lịch sử và Verify</h2>
          <p>Mở <strong>Lịch sử xử lý</strong> để đối chiếu quyết định và actor. Verify chạy bộ tình huống giả lập và input mới để kiểm tra quyết định, hồ sơ và audit; kết quả không phải đánh giá người dùng thật.</p>
        </section>
        <section className="guide-note">
          <h2>Môi trường demo</h2>
          <p>Hàng đợi reviewer Support là demo công khai, chỉ dùng dữ liệu tổng hợp hoặc giả lập. Quản trị cấp ID là luồng riêng, yêu cầu Google Sign-In có email trong <code>IDENTITY_ADMIN_EMAILS</code>; IT phải xác minh nhân sự và phạm vi trước khi duyệt. Quyền này không biến reviewer Support thành khu vực riêng tư hoặc IAM của tổ chức.</p>
          <p><Link href="/identity/review">Mở quản lý cấp ID →</Link></p>
        </section>
      </article>
    </main>
  );
}
