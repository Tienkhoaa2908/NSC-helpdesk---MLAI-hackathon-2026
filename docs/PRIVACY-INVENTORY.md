# Inventory riêng tư và quyền truy cập

Phạm vi: đăng ký tài khoản → Support intake → extraction boundary → request/preview → audit → UI.
Kiểm thử dùng synthetic, mock/memory; không phải chứng nhận anonymization hay
kiểm toán bảo mật production. Dữ liệu gõ ban đầu vẫn nằm trong trình duyệt.

| Loại | Phạm vi nhận diện trong code | Giới hạn |
| --- | --- | --- |
| CCCD | Nhãn CCCD/căn cước + đúng 12 chữ số, liền hoặc cách bằng khoảng trắng/dấu chấm/gạch ngang; JSON quote | Số không có nhãn, dạng khác, ảnh/OCR chưa được che toàn diện. Không kiểm chứng danh tính. |
| Điện thoại | Nhãn phone/mobile/số điện thoại + mobile VN 0/+84, một số dấu phân cách | Số không nhãn, số bàn, số quốc tế khác chưa được bảo đảm. |
| Email | Địa chỉ ASCII có @ và domain nhiều nhãn, gồm dấu + | Unicode email, obfuscation “at/dot”, ảnh, tên hiển thị chưa được bảo đảm. |
| Họ tên | Không hứa nhận diện tự do | Tên giả lập trong test vẫn giữ nguyên; phải ẩn danh trước nhập. |
| Địa chỉ | Không hứa nhận diện tự do | Địa chỉ giả lập trong test vẫn giữ nguyên; phải ẩn danh trước nhập. |
| Employee ID | Che khi nhãn employee ID/mã nhân viên + `:`/`=` nằm trong nội dung; metadata `fields.employeeId` loại khỏi model facts | Tài khoản đã cấp dùng email làm employee ID. Metadata có thể nhận diện/liên kết người dùng, không ẩn danh; email/ID không nhãn trong nội dung chưa được che. Tài khoản demo chung không xác minh danh tính. |
| Secret/key | PEM, token prefixes, Bearer/JWT, labelled password/client_secret/access_token…, connection credentials | Pattern-based; encoding, ảnh, secret không nhãn hoặc bị làm rối có thể lọt. |
| OTP | Nhãn OTP/verification code, 4–10 số, JSON quote, số cách bằng khoảng trắng/gạch ngang | Dạng khác hoặc không nhãn chưa bảo đảm; không log/gửi OTP thật để thử. |
| Unicode | NFKC, tổ hợp dấu và ký tự zero-width theo regex trong code | Không cam kết mọi homograph/encoding/biến thể nhận diện. |

`tests/privacy-boundaries.test.ts` kiểm tra intake, allowed field values,
extraction argument, output đã lưu và audit; clarification, feedback/follow-up,
reviewer reason cũng đi qua redaction. `competition-readiness.spec.ts` kiểm tra
response API, events và trang hồ sơ không chứa các sentinel synthetic. Đây là
model **boundary bằng spy/mock**, không phải model thật hay dữ liệu Mongo thật.
Các ca mới trực tiếp kiểm tra OTP JSON/số cách nhau/fullwidth/zero-width, CCCD
gạch ngang, email có dấu + và employee ID có nhãn. Các biến thể khác trong regex
chưa có test riêng cho từng tổ hợp; bảng không phải bảo đảm mọi định dạng đều được che.

Fail-safe cũ được giữ: recognized redaction marker đi qua kiểm tra rủi ro,
không làm app tự cấp quyền. Vì vậy người dùng gửi PII đã che vẫn có thể bị
chuyển reviewer; không coi privacy masking là đường bỏ qua policy. Không sửa
bản ghi lịch sử hoặc tự purge dữ liệu. Corpus, artifact và screenshots chỉ
được bổ sung từ synthetic; danh bạ seed lịch sử chưa có xác minh nguồn gốc
từng tên, không tái sử dụng tên đó trong test mới hoặc claim đã ẩn danh toàn bộ.

## Quyền và quyết định cần owner

Bộ [sentiment synthetic mới](SENTIMENT-EVALUATION.md) không chứa review được
thu thập, người đánh giá hoặc địa điểm Google Maps. Schema chỉ nhận bản nháp
synthetic development và từ chối provenance/split khác; khai báo không tự chứng
minh giấy phép hay ẩn danh. Không nhập review bên ngoài vào schema bằng cách đổi
nhãn nguồn. Nội dung, evidence và explanation sentiment vẫn đi qua redaction/
validation trước persistence. Feedback lưu assessment đã kiểm tra cùng nguồn
model/fallback khi có; dữ liệu lịch sử thiếu trường này không được backfill.

- API reviewer Support yêu cầu phiên Admin cho hàng đợi, hồ sơ, sự kiện, lịch sử,
  summary và audit. Ẩn nút trong UI không thay kiểm tra quyền phía server.
- Đơn xin cấp tài khoản thu họ tên và email do người dùng nhập; email trở thành
  ID đăng nhập sau khi được cấp. Email chưa được xác minh độc lập trước khi Admin
  cấp tài khoản. Chỉ phiên Admin mới xem danh sách đơn; không render danh sách
  email cho người dùng công khai.
- Tài khoản Admin lấy ID/mật khẩu từ biến môi trường server. Không lưu mật khẩu
  Admin trong Mongo hay gửi qua email. Tài khoản requester demo `guest01 / 12345`
  là thông tin đăng nhập dùng chung, không xác minh người sử dụng; chỉ dùng dữ liệu
  synthetic qua tài khoản này.
- Hệ thống sinh mật khẩu ngẫu nhiên năm chữ số cho tài khoản demo và chỉ lưu hash
  trong MongoDB. Mật khẩu gửi qua email có thể đọc được bởi người kiểm soát hộp
  thư và hạ tầng mail; không dùng mật khẩu này ngoài demo hoặc dùng lại mật khẩu
  cá nhân. Độ dài này không đạt chuẩn mật khẩu production.
- Liên kết cấp tài khoản trong email là bearer token dùng một lần, hết hạn sau
  một giờ. Mở liên kết qua `GET` cấp tài khoản ngay theo quyết định UX hiện tại.
  Bộ lọc/phần mềm quét link email có thể tự kích hoạt liên kết trước khi Admin
  bấm. Đây là rủi ro đã chấp nhận cho demo; không dùng quy trình này cho tài khoản
  tổ chức. Giữ token khỏi log, chat và nơi lưu trữ công khai.
- Tracking token và recovery proof của Support chỉ được lưu dạng hash. Token
  giới hạn route theo dõi/tiếp diễn của người gửi; phiên Admin riêng bảo vệ API
  reviewer. Token theo dõi không thay thế xác thực Admin.
- Kiểm thử hiện dùng dữ liệu synthetic và mock/spies; chưa có bằng chứng kiểm thử
  email giao thật, rate limit Mongo trên Production, hoặc phục hồi/restart database
  Identity thật. Không coi bài test local là chứng nhận bảo mật.
- Đây là đăng nhập demo bằng ID/mật khẩu, không tích hợp SSO/Workspace, xác minh
  việc làm, phân quyền theo nhóm, quy trình khôi phục mật khẩu hoặc IAM/HR doanh
  nghiệp. Đơn xin cấp tài khoản và email là dữ liệu cá nhân; dùng hộp thư test do
  bạn kiểm soát và không nhập ticket hoặc dữ liệu doanh nghiệp thật. Quy trình
  retention, xóa tài khoản và xử lý yêu cầu dữ liệu cần được xác định trước khi
  dùng ngoài demo.
