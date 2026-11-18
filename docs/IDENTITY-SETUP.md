# Đăng nhập và cấp tài khoản demo

Ứng dụng dùng ID nhân viên và mật khẩu. Người đăng ký gửi họ tên cùng Gmail, email trở thành ID khi Admin cấp tài khoản. Đây là luồng onboarding minh họa, không thay thế Google Workspace, IAM hoặc quy trình cấp tài khoản của doanh nghiệp.

## Luồng cấp tài khoản

1. Người dùng gửi họ tên và Gmail ở mục **Nhân viên mới?**. Server kiểm tra dữ liệu rồi lưu đơn chờ trong MongoDB. Nếu email thông báo chưa được cấu hình hoặc gửi thất bại, đơn vẫn được lưu với trạng thái gửi lỗi và hiển thị cho Admin trong danh sách.
2. Khi email được bật và cấu hình gửi thư hoàn tất, server gửi thông báo cố định đến hộp thư Admin. Thư ghi tên, email/ID dự kiến, mã đơn và nút mở trang **Cấp ID nhân viên**.
3. Nút trong email chỉ mở trang Admin, thao tác GET không thay đổi trạng thái. Admin đăng nhập, kiểm tra đơn rồi chọn **Xác nhận cấp tài khoản** hoặc **Từ chối yêu cầu**.
4. Khi xác nhận, server tạo mật khẩu demo ngẫu nhiên năm chữ số, lưu bản băm bằng bcrypt và gửi ID/mật khẩu đến Gmail đã đăng ký. Tài khoản chỉ chuyển sang ACTIVE sau khi email thông tin đăng nhập được gửi thành công.
5. Khi từ chối, hệ thống ghi quyết định vào audit và gửi email thông báo cố định. Lỗi gửi email được giữ lại để Admin có thể thử gửi lại từ danh sách.
6. Mọi yêu cầu cấp tài khoản và thao tác duyệt/từ chối chỉ hiển thị cho Admin. Trong `public-demo`, `guest01 / 12345` và các requester đã đăng nhập có thể mở khu Support review, audit và Verify, nhưng chỉ truy cập hồ sơ khớp với bộ Verify do server tạo. Yêu cầu thông thường ẩn trong khu reviewer, người gửi vẫn theo dõi hồ sơ của mình bằng liên kết riêng. Trang cấp tài khoản hiện thông báo chỉ dành cho Admin.

Họ tên, Gmail và kết quả xử lý nằm trong MongoDB. Cơ sở dữ liệu không lưu mật khẩu dạng rõ. Email của người đăng ký chưa được xác minh độc lập trước khi Admin quyết định, không dùng luồng này để cấp quyền truy cập hệ thống thật.

## Phiên đăng nhập

Sau khi đăng nhập, trình duyệt nhận cookie phiên HttpOnly, SameSite=Lax và Secure trên Production. Cookie không có Max-Age để thuộc phiên trình duyệt, MongoDB lưu hash của token cùng thời hạn server-side tám giờ. Header hiện ID đang đăng nhập và cung cấp nút đăng xuất. Đăng xuất thu hồi phiên trong MongoDB và xóa cookie. Việc đóng cửa sổ không đảm bảo xóa cookie trên trình duyệt có khôi phục phiên, thời hạn server-side vẫn được áp dụng.

ID Admin và mật khẩu được cấu hình phía server. ID dùng giá trị IDENTITY_ADMIN_ID, nếu để trống, ứng dụng dùng IDENTITY_ADMIN_EMAIL. Không tạo Admin trong collection nhân viên, không đưa mật khẩu vào source code, chat, URL hoặc log. Mật khẩu Admin đã được chia sẻ trong chat trước đây không được dùng lại, hãy thay bằng một mật khẩu mới trước khi bật đăng nhập Admin.

## Nội dung email đang chờ duyệt

Email được soạn song ngữ. Nội dung cố định, chỉ tên, email, mã yêu cầu, liên kết và thông tin đăng nhập thay đổi theo người dùng.

### Thông báo gửi Admin

**Tiêu đề:** Yêu cầu cấp tài khoản / Employee account request — NSClub Help Desk

```text
YÊU CẦU CẤP TÀI KHOẢN

Họ tên: {họ tên}
Email / ID nhân viên: {Gmail}
Mã yêu cầu: {mã yêu cầu}

Mở danh sách yêu cầu trong trang Admin: {liên kết /identity/review}
Đăng nhập bằng tài khoản Admin, sau đó chọn Xác nhận cấp tài khoản hoặc Từ chối. Mở liên kết này không tự thay đổi trạng thái.

ACCOUNT REQUEST

Name: {full name}
Email / employee ID: {Gmail}
Request ID: {request ID}

Open the account request list in Admin: {link to /identity/review}
Sign in as Admin, then choose Approve and issue or Reject. Opening this link does not change the request state.
```

### Email cấp tài khoản

**Tiêu đề:** Tài khoản đã được cấp / Employee account issued — NSClub Help Desk

```text
TÀI KHOẢN ĐÃ ĐƯỢC CẤP

Xin chào {họ tên},
Yêu cầu cấp tài khoản của bạn đã được xác nhận.
ID nhân viên: {Gmail}
Mật khẩu tạm thời: {mật khẩu 5 chữ số}
Đăng nhập tại: {liên kết /login}
Đây là tài khoản demo. Không dùng lại mật khẩu cho tài khoản khác.

ACCOUNT ISSUED

Hello {full name},
Your account request has been approved.
Employee ID: {Gmail}
Temporary password: {five-digit password}
Sign in at: {link to /login}
This is a demo account. Do not reuse this password for another account.
```

### Email từ chối

**Tiêu đề:** Kết quả yêu cầu cấp tài khoản / Account request result — NSClub Help Desk

```text
KẾT QUẢ YÊU CẦU CẤP TÀI KHOẢN

Xin chào {họ tên},
Yêu cầu cấp tài khoản của bạn chưa được chấp thuận.
Email / ID đã đăng ký: {Gmail}
Mã yêu cầu: {mã yêu cầu}
Nếu cần làm rõ, hãy liên hệ quản trị viên tại {email Admin}.

ACCOUNT REQUEST RESULT

Hello {full name},
Your account request was not approved.
Registered email / ID: {Gmail}
Request ID: {request ID}
For clarification, contact the administrator at {Admin email}.
```

Các mẫu này chưa được bật gửi cho tới khi được duyệt. Biến IDENTITY_EMAIL_ENABLED mặc định là false, chỉ chuyển thành true sau khi duyệt nội dung và hoàn tất cấu hình SMTP Production.

## Cấu hình môi trường

Khai báo secrets trong môi trường local không commit hoặc tại Vercel → Project Settings → Environment Variables. Sau khi đổi biến Production, tạo deployment mới để áp dụng.

| Biến | Mục đích |
| --- | --- |
| IDENTITY_ADMIN_ID | ID đăng nhập Admin, dùng Gmail Admin đã xác định. |
| IDENTITY_ADMIN_PASSWORD | Mật khẩu Admin mới, duy nhất, tối thiểu 12 ký tự. |
| IDENTITY_ADMIN_EMAIL | Gmail nhận yêu cầu và địa chỉ liên hệ trong email kết quả. |
| IDENTITY_EMAIL_ENABLED | Để false đến khi nội dung email được duyệt, bật true mới cho phép gửi. |
| SMTP_HOST | Gmail SMTP: smtp.gmail.com. |
| SMTP_PORT | 465 cho TLS hoặc 587 cho STARTTLS. |
| SMTP_USER | Gmail dùng để gửi thư. |
| SMTP_PASSWORD | Mật khẩu ứng dụng Gmail, không phải mật khẩu đăng nhập Google. |
| SMTP_FROM | Địa chỉ gửi được Gmail cho phép, có thể trùng SMTP_USER. |
| APP_BASE_URL | Origin HTTPS Production, ví dụ https://nsclub-support-desk.vercel.app. |
| MONGODB_URI, MONGODB_DB | MongoDB của Support và database mặc định nsclub_support_desk. |
| IDENTITY_MONGODB_URI, IDENTITY_MONGODB_DB | Tùy chọn dùng database Identity riêng, URI trống sẽ dùng cấu hình MongoDB chung. |

Không đặt biến bí mật trong NEXT_PUBLIC_*, Git, README hoặc log. Chỉ cấu hình biến Production sau khi xác nhận project Vercel cá nhân đang được chọn.

## Dùng Gmail SMTP

Plugin Gmail trong Codex chỉ cho phép thao tác Gmail của tài khoản đang kết nối, nó không cấp credential SMTP cho hàm chạy trên Vercel. Tài khoản gửi hiện dùng trong ứng dụng phải được cấu hình riêng.

1. Bật 2-Step Verification cho Gmail dùng gửi thư.
2. Nếu tài khoản cho phép, tạo App Password trong phần bảo mật Google. Google mô tả App Password là phương thức kém an toàn hơn OAuth và yêu cầu 2-Step Verification, tạo credential chỉ dành cho ứng dụng này và có thể thu hồi sau demo.
3. Đặt SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_USER và SMTP_FROM theo địa chỉ gửi.
4. Dán App Password trực tiếp vào biến Production SMTP_PASSWORD trong Vercel, không gửi nó qua chat.
5. Đặt IDENTITY_ADMIN_ID và IDENTITY_ADMIN_EMAIL bằng hộp thư Admin đã chọn. Đặt IDENTITY_ADMIN_PASSWORD bằng mật khẩu Admin mới, không dùng lại thông tin đã lộ trong chat.
6. Giữ IDENTITY_EMAIL_ENABLED=false cho đến khi mẫu email được duyệt. Sau khi được duyệt, bật biến này và tạo deployment Production mới.
7. Thử với một Gmail do bạn kiểm soát, xác nhận cả thư Admin, thư cấp tài khoản và thư từ chối trước khi chia sẻ demo.

Google cho biết App Password chỉ khả dụng khi bật 2-Step Verification và khuyến nghị ưu tiên Sign in with Google khi dịch vụ hỗ trợ. Xem [hướng dẫn App Password](https://support.google.com/accounts/answer/185833?hl=vi), [Gmail API gửi thư](https://developers.google.com/workspace/gmail/api/guides/sending) và [cấu hình environment variables của Vercel](https://vercel.com/docs/environment-variables). Triển khai Vercel hiện dùng SMTP port 465 hoặc 587, Gmail quota và chính sách tài khoản vẫn áp dụng.

## Giới hạn vận hành

- Mật khẩu năm chữ số và tài khoản guest01 / 12345 chỉ dành cho demo dữ liệu synthetic.
- Email yêu cầu do người dùng nhập chưa chứng minh danh tính hoặc quan hệ lao động.
- Hộp thư Admin và database chứa họ tên/email, chỉ Admin được phép đọc danh sách đơn.
- Người có tài khoản `guest01` công khai chỉ xem và thao tác được hồ sơ khớp với ca Verify do server tạo khi Production đang ở chế độ `public-demo`. Yêu cầu thông thường ẩn trong khu reviewer, người gửi vẫn theo dõi hồ sơ riêng bằng tracking link. Identity request chỉ hiển thị cho Admin.
- Đây không phải hệ thống IAM, Google Workspace provisioning, xác minh nhân sự hay quản lý credential cho tổ chức.

Xem thêm [kiến trúc](ARCHITECTURE.md), [inventory riêng tư](PRIVACY-INVENTORY.md) và [runbook](../RUNBOOK.md).
