# Hướng dẫn nhân viên gửi yêu cầu

Support Desk tiếp nhận mô tả sự cố, tạo bản xem trước để bạn kiểm tra, rồi lưu hồ sơ sau khi bạn xác nhận. Người gửi cần đăng nhập bằng ID và mật khẩu.

## Đăng nhập hoặc xin cấp tài khoản

1. Tại trang chủ, chọn **Tôi cần hỗ trợ** rồi nhập ID và mật khẩu. Tài khoản thử nghiệm là `guest01 / 12345`; chỉ dùng dữ liệu tổng hợp.
2. Nếu chưa có tài khoản, chọn **Nhân viên mới?**, nhập họ tên và Gmail. Đơn được lưu trong MongoDB và chỉ chủ hệ thống có thể xem.
3. Email thông báo mở danh sách riêng cho Admin; Admin đăng nhập rồi xác nhận hoặc từ chối. Gmail đã đăng ký trở thành ID đăng nhập; mật khẩu tạm gồm năm chữ số và được gửi qua email đó. Nếu email thông báo chưa gửi được, đơn vẫn nằm trong danh sách riêng để Admin xử lý sau khi cấu hình email.

Đơn cấp tài khoản chưa được duyệt sẽ không cho phép đăng nhập. Tài khoản mới không được cấp quyền Admin.

## Gửi và theo dõi yêu cầu

1. Đăng nhập trước bằng ID nhân viên và mật khẩu, sau đó mở [Gửi yêu cầu hỗ trợ](https://nsclub-support-desk.vercel.app/send-help). Chọn **Mô tả vấn đề** để viết tự do hoặc **Chọn theo danh mục** để điền trường phù hợp.
2. Mô tả điều đang gặp, điều đã thử và kết quả quan sát được. Chỉ nhập dữ kiện bạn biết; không đưa mật khẩu, mã xác thực hoặc khóa API vào biểu mẫu.
3. Bấm **Gửi** để xem trước phản hồi và hướng xử lý. Bản xem trước chưa tạo hồ sơ. Chọn **Quay lại sửa** nếu cần cập nhật nội dung.
4. Chọn **Xác nhận và gửi yêu cầu** để lưu hồ sơ. Lưu lại liên kết theo dõi riêng được hiển thị sau khi gửi.
5. Mở liên kết để đọc phản hồi, trả lời câu hỏi bổ sung, thêm ngữ cảnh hoặc yêu cầu nhân viên hỗ trợ. Mỗi hồ sơ giữ hội thoại và lịch sử riêng.

## Cập nhật sự cố chung

Một số yêu cầu đủ điều kiện có thể được liên kết theo chủ đề và địa điểm. Mỗi người gửi vẫn giữ hồ sơ và liên kết theo dõi riêng; cập nhật sự cố chung xuất hiện trên các hồ sơ liên quan. Cập nhật tiến độ không xác nhận rằng vấn đề riêng của bạn đã được khắc phục.

## Quyền riêng tư và giới hạn

- Tên và Gmail trong đơn cấp tài khoản chỉ hiển thị cho Admin. Website không xác minh độc lập quan hệ lao động; chủ hệ thống cần kiểm tra người yêu cầu trước khi cấp tài khoản.
- Tài khoản mẫu `guest01 / 12345` và mật khẩu năm chữ số chỉ phục vụ trình diễn với dữ liệu tổng hợp. Không dùng cho tài khoản hoặc thông tin doanh nghiệp thật.
- Trong `public-demo`, requester đã đăng nhập có thể xem hàng đợi Support, audit và Verify; chỉ danh sách cấp tài khoản cùng thao tác duyệt dành cho Admin. Dữ liệu demo phải là dữ liệu tổng hợp.
- Policy và kho tri thức hỗ trợ hướng dẫn. Yêu cầu thiếu bằng chứng, vượt thẩm quyền hoặc có rủi ro được hỏi thêm hoặc chuyển cho người xử lý.
- Liên kết theo dõi là thông tin truy cập hồ sơ; không chia sẻ liên kết cho người khác.

Mở [hướng dẫn nhân viên trong ứng dụng](https://nsclub-support-desk.vercel.app/help/employee) hoặc xem [mục lục hướng dẫn](USAGE.md).
