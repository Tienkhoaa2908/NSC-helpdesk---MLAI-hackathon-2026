# Đăng nhập và cấp tài khoản demo

Ứng dụng dùng ID nhân viên và mật khẩu. Người đăng ký gửi họ tên cùng Gmail, email trở thành ID khi Admin cấp tài khoản. Đây là luồng onboarding minh họa, không thay thế Google Workspace, IAM hoặc quy trình cấp tài khoản của doanh nghiệp.

## Luồng cấp tài khoản

1. Người dùng gửi họ tên và Gmail ở mục **Nhân viên mới?**. Server kiểm tra dữ liệu rồi lưu đơn chờ trong MongoDB. Đơn được giữ lại nếu email thông báo bị lỗi hoặc không xác nhận được.
2. Sau khi đã lưu đơn, API trả HTTP 202. Khi email được bật và cấu hình gửi thư hoàn tất, server tiếp tục gửi thông báo cố định đến hộp thư Admin. Thư ghi tên, email/ID dự kiến, mã đơn và nút mở trang **Cấp ID nhân viên**. Admin có thể gửi lại thông báo từ cùng dòng đơn.
3. Nút trong email chỉ mở trang Admin, thao tác GET không thay đổi trạng thái. Admin đăng nhập, kiểm tra đơn rồi chọn **Xác nhận cấp tài khoản** hoặc **Từ chối yêu cầu**. Quyết định đầu tiên được khóa, lần thử lại chỉ gửi lại cùng quyết định.
4. Khi xác nhận, server tạo mật khẩu demo ngẫu nhiên dưới dạng chuỗi đúng năm chữ số, có thể có số 0 ở đầu. Server lưu hash bcrypt cùng một bản mã hóa AES-256-GCM để gửi lại cùng mật khẩu nếu kết quả SMTP hoặc Mongo chưa xác nhận được. Tài khoản vẫn chưa hoạt động trong thời gian này. Khi SMTP chấp nhận thông điệp và Mongo cập nhật trạng thái thành công trong cùng transaction, tài khoản chuyển sang ACTIVE và bản mã hóa bị xóa.
5. Khi từ chối, hệ thống ghi quyết định vào audit và gửi email thông báo cố định. Lỗi hoặc trạng thái gửi chưa rõ được giữ lại để Admin có thể thử lại cùng quyết định.
6. Mọi yêu cầu cấp tài khoản và thao tác duyệt/từ chối chỉ hiển thị cho Admin. Trong `public-demo`, `guest01 / 12345` và các requester đã đăng nhập có thể mở khu Support review, audit và Verify, nhưng chỉ truy cập hồ sơ khớp với bộ Verify do server tạo. Yêu cầu thông thường ẩn trong khu reviewer, người gửi vẫn theo dõi hồ sơ của mình bằng liên kết riêng. Trang cấp tài khoản hiện thông báo chỉ dành cho Admin.

Họ tên, Gmail và kết quả xử lý nằm trong MongoDB. Cơ sở dữ liệu không lưu mật khẩu dạng rõ. Email của người đăng ký chưa được xác minh độc lập trước khi Admin quyết định, không dùng luồng này để cấp quyền truy cập hệ thống thật.

Biểu mẫu công khai trả cùng xác nhận cho Gmail mới, đang có đơn hoặc đã có tài khoản. Gửi lặp lại không tạo yêu cầu hoặc email Admin trùng, và không cho biết một địa chỉ đã đăng ký hay chưa. Danh sách cùng trạng thái chi tiết chỉ hiển thị cho Admin.

## Phiên đăng nhập

Sau khi đăng nhập, trình duyệt nhận cookie phiên HttpOnly, SameSite=Lax và Secure trên Production. Cookie không có Max-Age để thuộc phiên trình duyệt, MongoDB lưu hash của token cùng thời hạn server-side tám giờ. Header hiện ID đang đăng nhập và cung cấp nút đăng xuất. Đăng xuất thu hồi phiên và ghi audit trong cùng transaction MongoDB. Trình duyệt chỉ xóa cookie sau khi server xác nhận. Nếu chưa nhận được xác nhận, hãy bấm Đăng xuất lần nữa. Việc đóng cửa sổ không đảm bảo xóa cookie trên trình duyệt có khôi phục phiên, thời hạn server-side vẫn được áp dụng.

ID Admin và mật khẩu được cấu hình phía server. ID dùng giá trị IDENTITY_ADMIN_ID, nếu để trống, ứng dụng dùng IDENTITY_ADMIN_EMAIL. Không tạo Admin trong collection nhân viên, không đưa mật khẩu vào source code, chat, URL hoặc log. Mật khẩu Admin đã được chia sẻ trong chat trước đây không được dùng lại, hãy thay bằng một mật khẩu mới trước khi bật đăng nhập Admin.

## Nội dung email đã duyệt

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

Ba mẫu song ngữ ở trên đã được duyệt. Biến `IDENTITY_EMAIL_ENABLED` mặc định là `false`, chỉ bật trong Vercel Production sau khi SMTP, Admin và khóa mã hóa đã được cấu hình.

Trạng thái `SENT` nghĩa là máy chủ SMTP đã chấp nhận thông điệp, không chứng minh thư đã vào Inbox. Lỗi timeout cũng có thể xảy ra sau khi máy chủ đã nhận thư. Vì vậy màn hình Admin gọi các trạng thái này là chưa xác nhận, và lần thử lại credential sẽ dùng đúng cùng mật khẩu. Có thể nhận hai bản email nếu phản hồi SMTP hoặc transaction Mongo bị mất sau khi thư đã được nhận.

## Cấu hình môi trường

Khai báo secrets trong môi trường local không commit hoặc tại Vercel → Project Settings → Environment Variables. Sau khi đổi biến Production, tạo deployment mới để áp dụng.

| Biến | Mục đích |
| --- | --- |
| IDENTITY_ADMIN_ID | ID đăng nhập Admin, dùng Gmail Admin đã xác định. |
| IDENTITY_ADMIN_PASSWORD | Mật khẩu Admin mới, duy nhất, tối thiểu 12 ký tự. |
| IDENTITY_CREDENTIAL_ENCRYPTION_KEY | Khóa base64 của 32 byte ngẫu nhiên, dùng mã hóa credential chờ gửi lại. Không đổi hoặc làm mất khi còn đơn đã duyệt nhưng chưa kích hoạt. |
| IDENTITY_ADMIN_EMAIL | Gmail nhận yêu cầu và địa chỉ liên hệ trong email kết quả. |
| IDENTITY_EMAIL_ENABLED | Mặc định false. Bật true sau khi mẫu đã duyệt và toàn bộ biến gửi thư, Admin, Mongo cùng khóa mã hóa đã sẵn sàng. |
| SMTP_HOST | Gmail SMTP: smtp.gmail.com. |
| SMTP_PORT | 465 cho TLS hoặc 587 cho STARTTLS. |
| SMTP_USER | Gmail dùng để gửi thư. |
| SMTP_PASSWORD | Mật khẩu ứng dụng Gmail, không phải mật khẩu đăng nhập Google. |
| SMTP_FROM | Địa chỉ gửi được Gmail cho phép, có thể trùng SMTP_USER. |
| APP_BASE_URL | Origin HTTPS Production, ví dụ https://nsclub-support-desk.vercel.app. |
| MONGODB_URI, MONGODB_DB | MongoDB của Support và database mặc định nsclub_support_desk. |
| IDENTITY_MONGODB_URI, IDENTITY_MONGODB_DB | Tùy chọn dùng database Identity riêng, URI trống sẽ dùng cấu hình MongoDB chung. |

Tạo khóa cục bộ rồi dán thẳng vào Vercel Production, không gửi qua chat:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Giữ nguyên khóa khi còn tài khoản ở `PENDING_DELIVERY`. Nếu khóa sai, bản mã bị hỏng hoặc không khớp với hash, hệ thống dừng gửi, giữ nguyên hash và ghi audit. Nếu đã đổi nhầm khóa, khôi phục khóa gốc và tạo deployment mới trước khi thử lại. Nếu mất khóa gốc, lần gửi lại vẫn bị chặn. Chỉ bản ghi cũ chưa từng có bản mã, không có dấu vết chuẩn bị bản mã trong audit và còn chờ kích hoạt mới được tạo credential thay thế có ghi audit.

Không đặt biến bí mật trong NEXT_PUBLIC_*, Git, README hoặc log. Chỉ cấu hình biến Production sau khi xác nhận project Vercel cá nhân đang được chọn.

## Dùng Gmail SMTP

Plugin Gmail trong Codex chỉ cho phép thao tác Gmail của tài khoản đang kết nối, nó không cấp credential SMTP cho hàm chạy trên Vercel. Tài khoản gửi hiện dùng trong ứng dụng phải được cấu hình riêng.

1. Bật 2-Step Verification cho Gmail dùng gửi thư.
2. Nếu tài khoản cho phép, tạo App Password trong phần bảo mật Google. Google mô tả App Password là phương thức kém an toàn hơn Google sign-in và yêu cầu 2-Step Verification. Một số loại tài khoản không có tùy chọn này.
3. Đặt SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_USER và SMTP_FROM theo địa chỉ gửi.
4. Dán App Password trực tiếp vào biến Production SMTP_PASSWORD trong Vercel, không gửi nó qua chat.
5. Đặt IDENTITY_ADMIN_ID và IDENTITY_ADMIN_EMAIL bằng hộp thư Admin đã chọn. Đặt IDENTITY_ADMIN_PASSWORD bằng mật khẩu Admin mới, không dùng lại thông tin đã lộ trong chat.
6. Tạo một khóa ngẫu nhiên 32 byte được mã hóa base64, rồi lưu trực tiếp vào biến Production `IDENTITY_CREDENTIAL_ENCRYPTION_KEY`. Giữ lại khóa an toàn và không thay đổi khi còn credential chờ gửi.
7. Khi các biến SMTP, Admin, Mongo và khóa mã hóa đã có mặt, đặt `IDENTITY_EMAIL_ENABLED=true` rồi tạo deployment Production mới.
8. Thử bằng mailbox do bạn kiểm soát, sau đó xác minh trực tiếp thư Admin, thư credential, thư từ chối và trạng thái đăng nhập trước khi chia sẻ demo.

Google yêu cầu 2-Step Verification cho App Password và khuyến nghị dùng Google sign-in khi ứng dụng hỗ trợ. Gmail SMTP cũng hỗ trợ OAuth 2.0, nếu App Password không dùng được thì có thể triển khai OAuth token cho SMTP mà không cần đổi sang Gmail API. Gmail API OAuth là phương án khác nhưng cần API enablement, consent, token refresh/storage và thêm xử lý quota. Vercel hỗ trợ SMTP trên Node.js qua cổng 465 hoặc 587, gửi phải được `await`, và ứng dụng tự quản lý retry. Gmail quota và chính sách tài khoản vẫn áp dụng. Xem [hướng dẫn App Password](https://support.google.com/accounts/answer/185833?hl=vi), [Gmail SMTP và OAuth](https://developers.google.com/workspace/gmail/imap/imap-smtp), [Gmail API gửi thư](https://developers.google.com/workspace/gmail/api/guides/sending), [tài liệu SMTP của Vercel](https://vercel.com/kb/guide/serverless-functions-and-smtp) và [ghi chú nghiên cứu onboarding](IDENTITY-ONBOARDING-RESEARCH.md).

## Nghiệm thu trên website cá nhân

Ngày 20/11/2026, Admin đăng nhập trên Production và mở được danh sách cấp tài khoản cùng hàng đợi hỗ trợ. Lần đầu gửi lại thông báo cho đơn hiện có trả HTTP 503. Sau khi chủ tài khoản cập nhật mật khẩu ứng dụng Gmail và triển khai lại commit `11509ca`, máy chủ SMTP chấp nhận lần gửi lại trên cùng đơn. Lúc 00:25 (giờ Việt Nam), Gmail hiển thị thư **Yêu cầu cấp tài khoản / Employee account request — NSClub Help Desk** trong Hộp thư đến của Admin. Nội dung thư có cả tiếng Việt và tiếng Anh.

Chủ tài khoản duyệt đơn trên website. Khi tải lại danh sách, Admin thấy trạng thái **Đã gửi tài khoản**. Người đăng ký xác nhận đã nhận thư trong Gmail, dùng thông tin trong thư để đăng nhập và mở được biểu mẫu **Gửi yêu cầu hỗ trợ**. Thời điểm và thư mục nhận thư của người đăng ký chưa được ghi nhận.

Đăng nhập Admin, mở đúng đơn đã có rồi đối chiếu mã đơn với thư thông báo. Nếu cần, dùng nút gửi lại trên chính đơn đó. Sau khi Admin chọn duyệt, kiểm tra thư cấp tài khoản trong Inbox hoặc Spam rồi dùng thông tin trong thư đăng nhập và mở **Gửi yêu cầu**. Chỉ ghi lại tiêu đề, thời điểm, thư mục và kết quả đăng nhập.

## Giới hạn vận hành

- Mật khẩu năm chữ số và tài khoản guest01 / 12345 chỉ dành cho demo dữ liệu synthetic.
- Nếu Mongo mất phản hồi xác nhận commit, tải lại đơn và chọn bộ lọc **Tất cả**. Đơn đã cấp có thể đã hoàn tất cả kích hoạt và xóa bản mã. Nếu đơn còn chờ, Admin chỉ gửi lại theo quyết định đã khóa sau khi lượt xử lý trước hết hạn (hai phút).
- Gửi email không đảm bảo Inbox placement. `SENT` chỉ phản ánh SMTP acceptance, không phải xác minh người nhận đã đọc hoặc email được giao cuối cùng.
- Email yêu cầu do người dùng nhập chưa chứng minh danh tính hoặc quan hệ lao động.
- Hộp thư Admin và database chứa họ tên/email, chỉ Admin được phép đọc danh sách đơn.
- Người có tài khoản `guest01` công khai chỉ xem và thao tác được hồ sơ khớp với ca Verify do server tạo khi Production đang ở chế độ `public-demo`. Yêu cầu thông thường ẩn trong khu reviewer, người gửi vẫn theo dõi hồ sơ riêng bằng tracking link. Identity request chỉ hiển thị cho Admin.
- Đây không phải hệ thống IAM, Google Workspace provisioning, xác minh nhân sự hay quản lý credential cho tổ chức.

Xem thêm [kiến trúc](ARCHITECTURE.md), [inventory riêng tư](PRIVACY-INVENTORY.md) và [runbook](../RUNBOOK.md).
