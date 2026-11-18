# Cấu hình đăng nhập và cấp tài khoản demo

Ứng dụng dùng ID nhân viên và mật khẩu. Người đăng ký gửi họ tên cùng email; email được dùng làm ID đăng nhập sau khi chủ hệ thống cấp tài khoản. Đây là cơ chế trình diễn, không thay thế Google Workspace, IAM hoặc quy trình cấp tài khoản doanh nghiệp.

## Luồng tài khoản

1. Người dùng gửi họ tên và email từ mục **Nhân viên mới?**. Email được nhập bởi người dùng và chưa được xác minh độc lập trước khi Admin cấp tài khoản.
2. Đơn chờ được lưu trong MongoDB. Chỉ Admin đăng nhập bằng thông tin cấu hình phía server mới xem được danh sách này; người dùng chưa thể đăng nhập bằng đơn đang chờ.
3. Admin nhận email có liên kết cấp tài khoản dùng một lần, hết hạn sau một giờ. Mở liên kết sẽ cấp tài khoản ngay lập tức và gửi thông tin đăng nhập đến email đã đăng ký. Admin phải xác minh người yêu cầu trước khi bấm liên kết.
4. Email của người đăng ký là ID nhân viên. Server tạo mật khẩu ngẫu nhiên năm chữ số; MongoDB chỉ lưu bản băm mật khẩu. Mật khẩu được gửi qua email để dùng cho bản demo.
5. Người dùng đăng nhập bằng ID email và mật khẩu. Tài khoản mẫu công khai dành cho người gửi yêu cầu là `guest01 / 12345`; dữ liệu qua tài khoản mẫu và các yêu cầu thử nghiệm phải là synthetic.

Admin xem danh sách yêu cầu cấp tài khoản ở chế độ chỉ đọc; không có thao tác duyệt trong màn hình này. API reviewer và audit của Support cũng yêu cầu phiên Admin. Requester chỉ có thể gửi yêu cầu và xem hồ sơ thông qua liên kết theo dõi của chính hồ sơ.

### Rủi ro liên kết cấp tài khoản

Liên kết trong email thực hiện cấp tài khoản ngay khi được mở bằng `GET`, theo lựa chọn cho bản demo. Một số bộ lọc email có thể tự mở liên kết để quét an toàn; khi đó tài khoản có thể được cấp trước khi Admin bấm. Token dùng một lần và có hạn một giờ, nhưng không thể ngăn việc quét tự động. Dùng mailbox riêng cho demo và không áp dụng luồng này cho tài khoản hoặc dữ liệu tổ chức.

## Biến môi trường

Khai báo ở `.env.local` khi chạy local hoặc tại **Vercel → Project Settings → Environment Variables** cho Production. Không ghi giá trị bí mật vào Git, log, issue hoặc chat.

| Biến | Mục đích |
| --- | --- |
| `IDENTITY_ADMIN_ID` | ID đăng nhập Admin. Chỉ cấu hình phía server. |
| `IDENTITY_ADMIN_PASSWORD` | Mật khẩu đăng nhập Admin. Dùng mật khẩu dài, duy nhất; không đưa vào tài liệu hoặc trình duyệt. |
| `IDENTITY_ADMIN_EMAIL` | Hộp thư nhận yêu cầu cấp tài khoản và liên kết xác nhận. |
| `SMTP_HOST` | Máy chủ SMTP; Gmail dùng `smtp.gmail.com`. |
| `SMTP_PORT` | `465` cho TLS hoặc `587` cho STARTTLS. |
| `SMTP_USER` | Tài khoản Gmail dùng xác thực SMTP. |
| `SMTP_PASSWORD` | Mật khẩu ứng dụng Gmail, không phải mật khẩu đăng nhập Gmail. |
| `SMTP_FROM` | Địa chỉ gửi; dùng tài khoản xác thực hoặc alias gửi đã được Gmail cho phép. |
| `APP_BASE_URL` | Origin HTTPS của ứng dụng, ví dụ `https://nsclub-support-desk.vercel.app`. Dùng origin local HTTP chỉ trong môi trường phát triển. |
| `MONGODB_URI`, `MONGODB_DB` | Database lưu Support; `MONGODB_DB` mặc định là `nsclub_support_desk`. |
| `IDENTITY_MONGODB_URI`, `IDENTITY_MONGODB_DB` | Database Identity riêng tùy chọn. Nếu URI để trống, Identity dùng `MONGODB_URI`; database mặc định là `nsclub_support_desk`. |

Các giá trị SMTP và mật khẩu Admin là secrets. Nếu đổi chúng trên Vercel, lưu lại và tạo deployment mới để áp dụng.

## Dùng Gmail SMTP

1. Bật **2-Step Verification** cho tài khoản Gmail dùng gửi thư.
2. Tạo **App Password** trong phần bảo mật tài khoản Google; Google chỉ cho tạo loại mật khẩu này khi 2-Step Verification được bật. Dán App Password vào `SMTP_PASSWORD`. Không dùng mật khẩu Google chính.
3. Đặt `SMTP_HOST=smtp.gmail.com`, chọn `SMTP_PORT=465` hoặc `587`, rồi cấu hình `SMTP_USER` và `SMTP_FROM` bằng địa chỉ gửi đã được phép.
4. Đặt `IDENTITY_ADMIN_EMAIL` là hộp thư Admin nhận thông báo. Có thể trùng `SMTP_USER`.
5. Đặt `APP_BASE_URL` thành origin Production chính xác. `APP_BASE_URL` được dùng để tạo liên kết trong thư.
6. Lưu secrets trong Vercel, sau đó triển khai lại. Dùng địa chỉ thử nghiệm do bạn kiểm soát để xác nhận cả thư yêu cầu và thư cấp tài khoản.

Tham khảo [hướng dẫn App Password của Google](https://support.google.com/accounts/answer/185833?hl=vi) và [giới hạn SMTP của Vercel](https://vercel.com/kb/guide/serverless-functions-and-smtp). Vercel không cho phép SMTP outbound trên port 25; code hiện hỗ trợ port 465/587. Hạn mức gửi của Gmail áp dụng. Nếu thiếu biến, SMTP từ chối kết nối hoặc provider giới hạn gửi, đăng ký không được báo là đã cấp tài khoản; kiểm tra cấu hình server rồi thử lại.

## Vận hành demo

- Tài khoản Admin dùng `IDENTITY_ADMIN_ID` và `IDENTITY_ADMIN_PASSWORD`; không chia sẻ hai giá trị này.
- Tài khoản requester mẫu `guest01 / 12345` và mật khẩu ngẫu nhiên năm chữ số chỉ dùng với dữ liệu synthetic. Không tái sử dụng ngoài demo.
- Không lưu mật khẩu dạng rõ, không ghi mật khẩu phát sinh vào log và không yêu cầu người dùng gửi mật khẩu hiện có.
- Đơn đăng ký chứa họ tên và email. Chỉ Admin xem được; giới hạn quyền truy cập MongoDB ở database ứng dụng.
- Màn hình danh sách đơn không thể tự duyệt hoặc tự gửi credentials. Việc cấp xảy ra khi liên kết một lần trong email được mở.
- Website này không xác minh người đăng ký thuộc công ty nào; email Gmail không phải bằng chứng quan hệ lao động. Không nhập dữ liệu nhân sự, ticket hoặc thông tin doanh nghiệp thật.

Xem thêm [kiến trúc](ARCHITECTURE.md), [inventory riêng tư](PRIVACY-INVENTORY.md) và [runbook](../RUNBOOK.md).
