# Hướng dẫn Admin xử lý yêu cầu

Admin dùng Support Desk để xem hàng đợi, đối chiếu nội dung với bằng chứng và policy, phản hồi người gửi, rồi kiểm tra lịch sử quyết định.

## Tiếp nhận và xem hồ sơ

1. Mở [Yêu cầu cần xử lý](https://nsclub-support-desk.vercel.app/review) từ trang **Dành cho Admin**.
2. Dùng bộ lọc trạng thái, phòng ban, nguồn hoặc ô tìm kiếm để thu hẹp hàng đợi. Các bộ lọc nhanh giúp xem yêu cầu chờ xử lý, ngoài policy, cần xác minh thẩm quyền và gợi ý tri thức.
3. Mở hồ sơ. Đọc yêu cầu nguyên văn đã qua xử lý dữ liệu nhạy cảm, dữ kiện trích xuất và lý do phân loại. Bản tóm tắt bằng AI chỉ giúp đọc nhanh; khi tóm tắt lỗi, hồ sơ vẫn có nội dung gốc và thao tác xử lý.
4. Mở **Xem lịch sử & bằng chứng** để đối chiếu rule, dữ kiện còn thiếu, hướng dẫn đã gửi và các thay đổi trạng thái.

![Admin xem bản tóm tắt yêu cầu hỗ trợ](images/review-summary-desktop.png)

## Phản hồi và quyết định

- Dùng **Hỏi thêm thông tin** khi cần dữ kiện để đánh giá yêu cầu. Kiểm tra nội dung trước khi gửi.
- Duyệt, từ chối, dừng hoặc điều chỉnh trạng thái theo điều kiện của hồ sơ. Các thao tác cần lý do phải có lý do cụ thể.
- Policy ban đầu, kết quả Verify và quyết định Admin được lưu riêng trong lịch sử. Duyệt hồ sơ không tự cấp quyền hoặc thực thi thao tác trên hệ thống bên ngoài.
- Mở [Lịch sử xử lý](https://nsclub-support-desk.vercel.app/audit) để tìm và đối chiếu quyết định đã ghi audit.

## Sự cố có nhiều yêu cầu liên quan

Hệ thống chỉ nhóm một số yêu cầu tự do có chủ đề nhận diện được và địa điểm hợp lệ; yêu cầu Verify, yêu cầu đã che dữ liệu hoặc có nhiều tiểu yêu cầu không được đưa vào nhóm. Mỗi người gửi vẫn có hồ sơ riêng. Tại **Sự cố chung**, Admin có thể đăng cập nhật tiến độ được chọn sẵn (**Đang xác minh**, **Đang theo dõi**, **Đã xử lý**) cho các hồ sơ liên kết. Cập nhật này không gửi email hoặc thông báo đẩy.

![Admin xem số yêu cầu và cập nhật của nhóm sự cố](images/batch-incident-tracker.png)

## Verify và cấp ID

- [Kiểm thử / Verify](https://nsclub-support-desk.vercel.app/verify) chạy các bộ tình huống giả lập và input mới để kiểm tra quyết định, hồ sơ và audit. Kết quả demo không phải đánh giá người dùng thật hay bằng chứng cho môi trường tổ chức.
- [Cấp ID nhân viên](https://nsclub-support-desk.vercel.app/identity/review) là luồng Identity riêng, yêu cầu Google Sign-In và email nằm trong `IDENTITY_ADMIN_EMAILS`. Admin phải tự xác minh nhân sự/phạm vi trước khi cấp ID. Danh sách reviewer Support vẫn công khai, độc lập với quyền Identity Admin.

## Môi trường demo

> Trang Admin Support hiện là reviewer demo công khai, không phải cơ chế xác thực thành viên tổ chức. Chỉ dùng dữ liệu tổng hợp/giả lập; mã nhân viên tự khai không cấp quyền thật. Google Sign-In và bước IT duyệt trong Identity là luồng riêng, chưa thay thế IAM/HR của tổ chức.

Mở [trang hướng dẫn trong ứng dụng](https://nsclub-support-desk.vercel.app/help/admin) hoặc trở lại [mục lục hướng dẫn](USAGE.md).
