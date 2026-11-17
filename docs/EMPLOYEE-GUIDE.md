# Hướng dẫn nhân viên gửi yêu cầu

Support Desk nhận mô tả vấn đề, tạo preview để bạn kiểm tra, rồi lưu yêu cầu sau khi bạn xác nhận. Token trong liên kết theo dõi cho phép tiếp tục hồ sơ; trên website public, nội dung vẫn hiển thị với reviewer demo.

## Bắt đầu

1. Từ trang chủ, chọn **Tôi cần hỗ trợ** rồi đăng nhập bằng Google với tài khoản đã được IT duyệt. Google xác minh tài khoản; ID nội bộ không phải mật khẩu.
2. Nếu chưa có ID, chọn **Nhân viên mới?** sau khi đăng nhập Google và gửi đơn cấp quyền. IT xác minh nhân sự/phạm vi rồi mới cấp ID. Để thử luồng công khai, chọn **Đăng nhập không cần tài khoản**; đây là demo không xác minh người dùng.
3. Mở [Gửi yêu cầu hỗ trợ](https://nsclub-support-desk.vercel.app/send-help). Chọn **Mô tả vấn đề** để viết tự do hoặc **Chọn theo danh mục** để điền trường phù hợp.

![Màn hình gửi yêu cầu demo và chọn phòng ban](images/guest-department.png)

## Gửi và theo dõi

1. Mô tả điều đang gặp, điều bạn đã thử và kết quả quan sát được. Chỉ điền dữ kiện bạn biết; không nhập mật khẩu, mã xác thực hoặc khóa API.
2. Chọn **Gửi** để xem preview. Preview chưa được lưu thành hồ sơ. Kiểm tra nội dung và hướng xử lý; chọn **Quay lại sửa** nếu cần.
3. Chọn **Xác nhận và gửi yêu cầu** để tạo hồ sơ, hoặc **Lưu và tiếp tục trò chuyện** nếu muốn hỏi tiếp.
4. Lưu liên kết theo dõi đầy đủ. Token trong liên kết cho phép người gửi đọc và tiếp tục hồ sơ. Bản demo vẫn mở API reviewer công khai, vì vậy token không làm nội dung yêu cầu trở nên bí mật; chỉ dùng dữ liệu tổng hợp trên website public. Tại trang theo dõi, bạn có thể trả lời câu hỏi bổ sung, hỏi tiếp, báo đã giải quyết, báo vẫn còn lỗi hoặc yêu cầu nhân viên hỗ trợ.

![Hướng dẫn và phản hồi của trợ lý trên thiết bị di động](images/luna-reply-sender-mobile.png)

## Cập nhật sự cố chung

Một số yêu cầu đủ điều kiện có thể được liên kết với sự cố cùng chủ đề và địa điểm. Mỗi yêu cầu vẫn giữ lịch sử và trang theo dõi riêng; cập nhật chung được hiển thị trên các hồ sơ đã liên kết. Thông báo tiến độ không xác nhận rằng vấn đề cá nhân đã được khắc phục.

## Quyền riêng tư và giới hạn

- Google Sign-In dùng tài khoản Gmail đã xác minh, nhưng không xác nhận người dùng là nhân viên. IT phải kiểm tra đơn cấp ID trước khi phê duyệt. ID và phòng ban của luồng khách chỉ liên kết hồ sơ, không xác minh danh tính.
- Hướng dẫn tự động dựa trên policy và kho tri thức của ứng dụng. Yêu cầu thiếu căn cứ, vượt thẩm quyền hoặc có rủi ro được hỏi thêm hoặc chuyển cho nhân viên.
- Không dùng môi trường demo để gửi dữ liệu nhạy cảm hoặc yêu cầu thao tác trên hạ tầng thật.

Mở [trang hướng dẫn trong ứng dụng](https://nsclub-support-desk.vercel.app/help/employee) hoặc trở lại [mục lục hướng dẫn](USAGE.md).
