# Hướng dẫn Admin tiếp nhận và xử lý yêu cầu

Admin đăng nhập bằng ID và mật khẩu được cấu hình phía máy chủ. Các API review, audit, kiểm thử và danh sách đơn cấp tài khoản yêu cầu phiên Admin.

## Tiếp nhận yêu cầu

1. Tại trang chủ, chọn **Dành cho Admin** rồi đăng nhập bằng tài khoản Admin.
2. Mở **Yêu cầu cần xử lý**. Lọc theo trạng thái, phòng ban, nguồn hoặc tìm mã yêu cầu/nội dung để thu hẹp danh sách.
3. Mở hồ sơ, đọc nội dung đã xử lý dữ liệu nhạy cảm, thông tin trích xuất và kết quả policy. Bản tóm tắt AI chỉ hỗ trợ đọc nhanh; hãy đối chiếu hồ sơ và bằng chứng trước khi quyết định.
4. Mở **Lịch sử xử lý** để xem thay đổi trạng thái, phản hồi và thao tác đã ghi audit.

## Phản hồi và quyết định

- Dùng **Hỏi thêm thông tin** khi cần dữ kiện để đánh giá yêu cầu. Kiểm tra nội dung trước khi gửi.
- Chỉ chọn thao tác được giao diện cho phép. Một số quyết định yêu cầu lý do hoặc trạng thái đích cụ thể.
- Policy ban đầu, kết quả Verify và quyết định Admin được lưu riêng trong lịch sử. Duyệt hồ sơ không tự thực hiện thao tác trên hệ thống bên ngoài.
- Mở [Lịch sử xử lý](https://nsclub-support-desk.vercel.app/audit) để tra cứu hoạt động đã ghi audit.

## Nhóm yêu cầu liên quan

Một số yêu cầu có thể được liên kết theo chủ đề và địa điểm. Mỗi người gửi giữ hồ sơ riêng. Với nhóm đủ điều kiện, Admin có thể gửi một cập nhật chung; hệ thống kiểm tra lại thành viên trước khi lưu và hiển thị phản hồi trên từng hồ sơ liên quan. Cập nhật không gửi email hoặc thông báo đẩy.

## Kiểm thử và yêu cầu cấp tài khoản

- [Kiểm thử / Verify](https://nsclub-support-desk.vercel.app/verify) là khu vực chạy các bộ tình huống của yêu cầu MLAI Hackathon 2026, track VNG và thử input mới. Bộ dữ liệu gồm test chung, bộ 15 tình huống theo brief và bộ VNG Verify gồm 5 ca (3 tự động, 2 chuyển tiếp). Các ca dùng cùng API policy và đọc lại lịch sử; kết quả là kiểm thử workflow synthetic, không phải benchmark độc lập của model.
- [Cấp ID nhân viên](https://nsclub-support-desk.vercel.app/identity/review) hiển thị đơn cấp tài khoản ở chế độ chỉ đọc. Chỉ tài khoản Admin của chủ hệ thống xem được họ tên và Gmail; màn hình không có nút duyệt/cấp. Việc cấp tài khoản thực hiện qua liên kết một lần gửi đến email Admin. Mở liên kết sẽ gửi ID và mật khẩu tạm cho người đăng ký.

## Phạm vi demo

Tài khoản `guest01 / 12345` dành cho người gửi yêu cầu thử nghiệm bằng dữ liệu tổng hợp. Nó không có quyền truy cập reviewer. Hệ thống ID/mật khẩu và luồng xác nhận qua email trình diễn cách quản lý tài khoản; chúng không thay thế IAM, xác minh nhân sự hoặc quy trình cấp quyền của tổ chức.

Mở [hướng dẫn Admin trong ứng dụng](https://nsclub-support-desk.vercel.app/help/admin) hoặc xem [mục lục hướng dẫn](USAGE.md).
