# Cấu hình Google Sign-In và cấp ID nhân viên

## Mô hình truy cập

Nhân viên đăng nhập bằng Google. Ứng dụng yêu cầu các scope `openid`, `email` và `profile`, kiểm tra danh tính Google ở server rồi gắn session vào `sub` ổn định. Google xác minh tài khoản/email; quản trị viên vẫn phải xác minh quan hệ nhân sự và phạm vi công việc trước khi duyệt đơn.

Sau khi duyệt, hệ thống cấp một ID nội bộ theo mẫu tên cuối + chữ cái đầu các tên đứng trước. Ví dụ `Đào Tiến Khoa` thành `khoadt`. ID dùng để tra cứu và liên kết hồ sơ, không phải tên đăng nhập hay mật khẩu. Nhân viên tiếp tục đăng nhập bằng chính tài khoản Google đã dùng để gửi đơn.

## Cấu hình Google Cloud

1. Tạo project riêng trong Google Cloud Console và cấu hình Google Auth Platform. Tạo OAuth client loại **Web application**.
2. Thêm Authorized redirect URI chính xác:

   ```text
   https://nsclub-support-desk.vercel.app/api/identity/google/callback
   ```

   Khi chạy local, có thể thêm `http://localhost:3000/api/identity/google/callback` vào OAuth client dành cho môi trường phát triển. URI ở Google Cloud và `GOOGLE_REDIRECT_URI` phải trùng tuyệt đối.
3. Lưu Client ID và Client Secret vào password manager hoặc secret store. Không commit, ghi vào issue, gửi qua chat hoặc đưa vào mã trình duyệt.
4. Code chỉ yêu cầu `openid email profile`, không yêu cầu quyền truy cập Gmail, Drive hay dữ liệu Workspace. Mặc định ứng dụng chỉ nhận email đã xác minh có domain chính xác `gmail.com`; đây là tài khoản Gmail tiêu dùng, không phải Workspace domain. Nếu chuyển sang Workspace, đặt `GOOGLE_ALLOWED_DOMAIN` thành domain tổ chức; ứng dụng yêu cầu cả email có domain đó và claim `hd` đã xác minh. IT vẫn phải xác minh quan hệ nhân sự trong bước duyệt vì domain email không chứng minh người dùng là nhân viên.

Google yêu cầu `redirect_uri` khớp chính xác với URI đã đăng ký. Với các scope sign-in cơ bản đang dùng, Google ghi nhận ngoại lệ so với giới hạn test-user và hết hạn bảy ngày của ứng dụng Testing; nếu thêm scope khác, hãy kiểm tra lại audience, test users và yêu cầu xác minh của OAuth client. Xem [OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server) và [quản lý audience](https://support.google.com/cloud/answer/15549945?hl=en).

## Biến môi trường

Thêm các biến sau vào **Vercel → Project Settings → Environment Variables** với scope **Production**. Không lưu chúng trong repository:

```dotenv
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="https://nsclub-support-desk.vercel.app/api/identity/google/callback"
GOOGLE_ALLOWED_DOMAIN="gmail.com"
IDENTITY_ADMIN_EMAILS=""
IDENTITY_MONGODB_DB="nsclub_support_desk"
```

`GOOGLE_ALLOWED_DOMAIN` mặc định là `gmail.com`. Với Gmail tiêu dùng, server đối chiếu domain trong email đã xác minh; Google không phát claim Workspace `hd` cho tài khoản này. Với Workspace, nhập domain tổ chức chính xác và server cũng yêu cầu `hd` khớp. `IDENTITY_ADMIN_EMAILS` là danh sách email đã được domain-check cho phép xem và duyệt đơn, phân tách bằng dấu phẩy. Chỉ điền email của người trực tiếp vận hành cấp ID; không dùng tên hiển thị hoặc giá trị do người dùng gửi lên để cấp quyền. Biến này chỉ bảo vệ màn hình/quy trình Identity, **không khóa hàng đợi Support** đang để public demo.

Identity dùng `IDENTITY_MONGODB_URI` nếu được đặt; nếu không thì dùng `MONGODB_URI`. Dữ liệu nằm trong các collection `identity_*`. MongoDB phải hỗ trợ transaction (replica set hoặc sharded cluster) và tài khoản ứng dụng cần các quyền đọc/ghi, tạo index/collection, cùng quyền cài validator cần thiết. Không dùng tài khoản Atlas Admin cho ứng dụng.

Sau khi thay đổi environment variables, tạo deployment mới để biến có hiệu lực. Không thể kiểm tra live sign-in cho đến khi OAuth Client, callback, MongoDB và ít nhất một `IDENTITY_ADMIN_EMAILS` được cấu hình đúng.

## Luồng cấp quyền

1. Người dùng đăng nhập bằng Google, rồi chọn **Nhân viên mới?**.
2. Người dùng nhập tên pháp lý hiển thị và chức danh/phạm vi cần thiết; ứng dụng không yêu cầu ngày sinh, số điện thoại, mật khẩu hay giấy tờ tùy thân.
3. IT xác minh nhân viên qua kênh đáng tin cậy bên ngoài ứng dụng, rà soát job và scopes, rồi duyệt hoặc từ chối đơn. Đơn trùng ID được giữ ở trạng thái cần xử lý; chỉ IT mới chọn hậu tố số kèm lý do.
4. Khi được duyệt, ứng dụng tạo ID nội bộ, gắn với Google `sub` và profile phạm vi đã duyệt. Session ứng dụng được lưu dạng hash, có thời hạn và có thể thu hồi khi đăng xuất.

Không cấp quyền chỉ vì người dùng có tài khoản Google, tự khai tên/chức danh hoặc biết một ID. Tài khoản Google xác minh quyền kiểm soát tài khoản, không thay thế quy trình HR/IT. Các bản ghi nhân viên cũ không có `googleSub` chưa tự liên kết được với Google Sign-In; không chạy script roster demo trên cơ sở dữ liệu mới để cấp đăng nhập. Cần kế hoạch migration có đối chiếu chủ tài khoản trước khi chuyển dữ liệu cũ.

## Giới hạn của bản triển khai

Hàng đợi reviewer Support, đọc danh sách và các thao tác reviewer vẫn là public demo theo lựa chọn sản phẩm. Google Sign-In và `IDENTITY_ADMIN_EMAILS` chỉ áp dụng cho luồng Identity; chúng không làm nội dung yêu cầu riêng tư hoặc tạo ranh giới bảo mật giữa nhân viên và Admin. Chỉ dùng dữ liệu tổng hợp trên website public. Xem [privacy inventory](PRIVACY-INVENTORY.md) và [hướng dẫn vận hành](../RUNBOOK.md).
