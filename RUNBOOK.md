# NoSleepClub Support Desk — Hướng dẫn vận hành

Hướng dẫn thao tác sản phẩm nằm trong [README](README.md). File này dành cho cài đặt, kiểm tra và bảo trì repository.

## Chạy local

Dùng Node.js từ 22.13 trong nhánh 22.x trở lên, hoặc từ 24 trở lên, cùng npm. Node 23 không tương thích với khai báo engine của một số dependency. Trong PowerShell, tại thư mục repository:

Repository giữ duy nhất `package-lock.json`, CI và Vercel đều cài dependency bằng `npm ci` để dùng cùng lockfile.

```powershell
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run dev
```

Chỉ sao chép `.env.example` khi chưa có `.env.local`, giữ cấu hình cá nhân đã có. Mở `http://localhost:3000`. Cấu hình mẫu sử dụng model mock và `memory-demo`.

## Kiểm tra trước khi phát hành

```powershell
npm run check:docs
npm run lint
npm run typecheck
npm test
node --test scripts/mongo-smoke-guard.test.mjs scripts/development-report.test.mjs scripts/check-docs.test.mjs
npm run build
npm run test:persistence
$env:SUPPORT_E2E_PRODUCTION='true'
npm run test:e2e -- --project=chromium
npm run test:e2e -- --project=mobile
npm audit
npm audit --omit=dev
```

Playwright tự khởi động server riêng tại `127.0.0.1:3227` với model mock và bộ nhớ tạm. Chạy build xong mới chạy E2E vì cùng sử dụng `.next`. Chạy desktop và mobile riêng để mỗi lượt có server và hạn mức request riêng. Không dừng một tiến trình khác đang dùng cổng này.

Báo cáo, ảnh chụp và video do test sinh ra cần được kiểm tra riêng trước khi đưa vào Git. Kết quả local không thay thế kiểm tra dịch vụ đang triển khai.

## Cập nhật sơ đồ workflow

Nguồn Mermaid nằm trong `docs/diagrams/*.mmd`, README và tài liệu kiến trúc dùng SVG dựng sẵn để nhãn không bị renderer của GitHub cắt. Giữ `look: classic`, font Arial và ngắt dòng chủ động. Không sửa chữ trực tiếp trong SVG.

Cài Mermaid được ghim phiên bản ở thư mục công cụ tạm, ngoài repository, Playwright dùng dependency đã có của dự án:

```powershell
$diagramTools = Join-Path $env:TEMP 'vng-support-diagram-tools'
npm install --prefix $diagramTools --no-save --package-lock=false --ignore-scripts mermaid@12.2.0
$diagramBundle = Join-Path $diagramTools 'node_modules/mermaid/dist/mermaid.min.js'
$diagramPreview = Join-Path $env:TEMP 'vng-support-diagram-preview'
node scripts/render-diagrams.mjs --bundle $diagramBundle --screenshots $diagramPreview
npm run check:docs
git diff --check
```

Renderer dừng nếu thiếu nhãn, chữ vượt khung, node chồng nhau hoặc SVG còn HTML nhúng. Trước commit, xem ảnh ở kích thước README và thử ảnh SVG qua thẻ `img` trên nền sáng/tối, kiểm tra link mở ảnh đầy đủ trên mobile. Commit cả nguồn `.mmd` lẫn `.svg`, ảnh kiểm tra để ngoài repo.

## Đối chiếu bản triển khai cá nhân

Website: [nsclub-support-desk.vercel.app](https://nsclub-support-desk.vercel.app). Production deployment thuộc project Vercel `nsclub-support-desk`.

```powershell
git rev-parse HEAD
Invoke-RestMethod https://nsclub-support-desk.vercel.app/api/support/health
```

Đối chiếu `sourceRevision` với commit đã triển khai, cùng `status`, `policy`, `storage` và `durable`. Runtime lưu dữ liệu qua MongoDB, cấu hình nằm trong môi trường của project. `.vercelignore` loại environment files, dependencies, artifacts và worktree khỏi gói upload. Không đưa secret vào Git hoặc output kiểm tra.

Sau khi triển khai, kiểm tra trang chọn vai trò, popup lần đầu, URL/QR, trang gửi, reviewer, lịch sử và Verify trên desktop/mobile. Việc chạy kiểm thử có ghi dữ liệu hoặc gọi model trên site cần được phân biệt với kiểm tra chỉ đọc.

## Tiếp tục một lượt Verify

Mở **Kiểm thử**, chọn lượt đã lưu rồi tiếp tục sau khi lỗi mạng hoặc giới hạn tần suất đã hết. Trường hợp có thể thử lại giữ nguyên mã yêu cầu. Một kết quả không khớp policy vẫn được ghi là không đạt, không thay kỳ vọng để che lỗi.

## Bảo trì policy và chất lượng

Policy runtime nằm trong `src/domain/policy-source.ts` và `src/domain/policy.ts`. Giữ nguyên dataset/Ground Truth, thay đổi contract phải có regression và quyết định có nguồn gốc. Bump policy khi nội dung preview/cache cũ không còn hợp lệ.

`npm test` kiểm tra định tuyến, safety, authority, bằng chứng, hội thoại, identity và lưu trữ. `node scripts/development-report.mjs` tạo báo cáo local, không stage artifact chứa trace, UUID hoặc dữ liệu chưa được rà soát. [Evaluation](docs/EVALUATION.md) mô tả cách diễn giải.

Lời gọi AI thật local cần key riêng và opt-in:

```powershell
node --env-file=.env.local scripts/check-support-ai-live.mjs --live
```

Script dùng storage bộ nhớ, không tạo ticket hoặc ghi Mongo. Kết quả này không thay kiểm tra UI Production. Telemetry preview có stage timing và model calls, không ghi raw input hoặc credential.

Đối chiếu chất lượng trước/sau bằng cùng input, model và môi trường. Tách warm/cold quan sát được, cache hit/miss và fallback, thời gian đến câu trả lời đầy đủ quan trọng hơn ký tự đầu. Không bỏ validation hoặc đổi quyền để tăng tốc.

## Kiểm tra Mongo trong môi trường thử nghiệm riêng

`npm run test:persistence` chạy bài integration có opt-in. Khi chưa cấu hình
`SUPPORT_TEST_MONGO_URI` và `SUPPORT_TEST_MONGO_ACK`, test **skip** với
`persistenceVerification=NOT_PERFORMED`, không kết nối Mongo. Cấu hình thiếu
một phần/không an toàn hoặc test đã opt-in nhưng thất bại là **fail**, không skip.
Không có memory fallback. Cần build trước, port 3227 trống và Mongo disposable
loopback đã được operator xác nhận như hướng dẫn bên dưới.

Harness hiện đọc lại request/audit sau restart app, thực hiện STOP/CAS, restart
app lần nữa và đối chiếu quyết định reviewer/audit nguyên vẹn với Mongo. Chỉ khi
mọi assertion đạt mới trả `APP_RESTART_VERIFIED`. Không restart mongod, không
chứng minh identity transaction/replica set hay production durability. Lượt
kiểm tra này không có Mongo test: xem [bằng chứng hiện tại](docs/evidence/2026/REPO-AUDIT-2026-10-14.json).

Ưu tiên harness có guard và tự restart tiến trình tại [hướng dẫn kiểm tra persistence](https://github.com/dakiemdarktharr/vng-support/blob/cd50d826003f2e49e8d52b3e695ad6fe74fe15b7/docs/archive/FEEDBACK-EVIDENCE-REVIEW.md#reproducible-mongo-evidence): `node scripts/mongo-restart-smoke.mjs`. Harness chỉ chấp nhận Mongo loopback trên instance disposable được khai báo rõ, database mới do script chọn, không có `.env` local, model mock và budget 0. Chưa có kết quả live từ harness trong lượt sửa này. `durable=true` vẫn là metadata của adapter, trường health `persistenceVerification=NOT_PERFORMED` nói rõ endpoint không kiểm tra restart.

Quy trình thủ công dưới đây dành cho operator đã xác nhận database thử nghiệm riêng, không chạy trên production:

Chỉ dùng Mongo local hoặc credential thử nghiệm giới hạn trên database mới, tên `sprint1_test_<suffix>`. Không copy URI/credential production. Giữ `AI_PROVIDER=mock` và model keys rỗng. Đặt `MONGODB_URI`, `MONGODB_DB` riêng cùng `SUPPORT_ACCESS_MODE=public-demo`, chạy server tại3227. Health ping thành công chưa chứng minh persistence sau restart.

Trong terminal khác, tạo duy nhất dữ liệu synthetic rồi giữ lại các biến:

```powershell
$baseUrl = 'http://127.0.0.1:3227'
$body = @{rawText='Restart synthetic laptop'; fields=@{department='engineering'; employeeId='EMP-SMOKE-01'}; confirmed=$true; idempotencyKey=[guid]::NewGuid().ToString()} | ConvertTo-Json
$before = (Invoke-RestMethod "$baseUrl/api/support/requests" -Method Post -ContentType 'application/json' -Body $body).data
$requestId = $before.id
if (-not $requestId) { throw 'Create failed' }
$beforeJson = $before | ConvertTo-Json -Depth 40 -Compress
```

Dừng đúng server vừa khởi chạy, rồi khởi động lại với cùng URI/database. Đọc lại:

```powershell
$after = (Invoke-RestMethod "$baseUrl/api/support/requests/$requestId").data
if (($after | ConvertTo-Json -Depth 40 -Compress) -cne $beforeJson) { throw 'Restart read-back differs' }
```

Mở hai tab reviewer cùng request/version, bấm Stop: một thành công, một409, version chỉ tăng1 và chỉ có một event STOP. Ngắt Mongo thử nghiệm rồi thử đọc/ghi: phải503, không fallback memory hoặc lộ URI. Chạy lại với một credential synthetic có nhãn và kiểm tra response/document/audit chỉ giữ bản redact. Ghi kết quả kèm commit, Node/Mongo version và DB name, không log URI, secret hoặc raw personal input, không xóa collection/reset budget. Test adapter mock không thay thế quy trình live này.

## Giới hạn riêng tư và phép đo local

Redaction nhận diện một số credential/OTP (gồm JSON quote), CCCD 12 số có nhãn
với dấu phân cách giới hạn, mobile Việt Nam có nhãn, email ASCII và employee ID
có nhãn trong nội dung. [Inventory hiện tại](docs/PRIVACY-INVENTORY.md) nêu các
biến thể được test và loại chưa hỗ trợ. Tên/địa chỉ tự do, metadata ID và dữ liệu
không nhận diện có thể đến storage/audit/UI, input chưa che có thể đến model.
Chỉ dùng synthetic hoặc ẩn danh trước. Form vẫn giữ dữ liệu trước khi server
xử lý, không tự sửa/xóa dữ liệu lịch sử.

`node scripts/measure-support-latency.mjs` dùng server loopback3227 mock/memory và câu CAPABILITIES có thể hiện bực bội để đi qua đường tạo câu trả lời cùng prompt tone. Script bỏ5 warmup, đo15 preview tuần tự và một burst 5 request đồng thời, trả p50/p95/max HTTP+JSON. Có đúng 30 request nên chạy trên server vừa khởi động để không đụng rate limit demo. Ghi kèm OS, Node, commit và production start mode. Preview chỉ lưu tạm trong memory, không tạo support request. Provider mock chỉ dựng prompt rồi trả fallback, phép đo không bao gồm OpenAI, Mongo, production hoặc tải lớn, và không tự chứng minh lợi ích từ song song hóa.

`.github/workflows/qa.yml` chạy unit/lint/types/build và E2E desktop/mobile riêng bằng production build, không có deploy step. `.github/workflows/reproducibility.yml` kiểm tra clean `npm ci` trên Ubuntu và Windows. CI chỉ chứng minh đúng các bước đã chạy, bài Mongo restart sẽ skip nếu không có URI kiểm thử riêng và acknowledgement, nên trạng thái xanh không chứng minh độ bền dữ liệu Mongo thật.

## Chẩn đoán API và sentiment

Preview trả `data.diagnostics` và `Server-Timing`: stage, model attempts,
usage khi provider trả, cache state và process invocation. Đo client từ trước
fetch đến sau đọc JSON, không gọi thời gian ký tự đầu là phản hồi sử dụng
được. Giữ request tuần tự, một warm-up tách riêng và tối thiểu 20 mẫu để
so sánh cùng input/model, nearest-rank p50/p95, tách fallback/cache, cold
unknown nếu không có bằng chứng. Không log input/key/URI, chỉ dọn chính xác
ID thử nghiệm đã ghi trong manifest sau lưu bằng chứng. [Contract và giới
hạn phép đo](https://github.com/dakiemdarktharr/vng-support/blob/cd50d826003f2e49e8d52b3e695ad6fe74fe15b7/docs/QUALITY-LATENCY-2026-10-15.md).

Đánh giá fallback offline riêng (không model/API/Mongo), tại repository root:

```powershell
$env:SENTIMENT_REPORT_OUT='sentiment-evaluation-local.json'
npm run evaluate:sentiment
Remove-Item Env:SENTIMENT_REPORT_OUT
```

Đầu ra JSON ghi revision, hash runtime/dataset/evaluator, confusion matrix,
precision/recall/F1, coverage, mismatch và hàng đợi ambiguous. File đích phải
chưa tồn tại, không ghi đè baseline. Không đặt biến output thì chỉ kiểm tra
schema/metrics, không xuất báo cáo. Không stage artifact này.
Xem [nguồn dữ liệu, kết quả và giới hạn](docs/SENTIMENT-EVALUATION.md).
Nhánh sentiment sau trả lời không tự đóng/chuyển ticket, nút xác nhận kết quả,
yêu cầu chuyển người và policy được xét độc lập với nhãn cảm xúc.

Provider có thể là `gemini`, `openai` hoặc `mock`. Với Gemini, đặt
`AI_PROVIDER=gemini`, `GEMINI_API_KEY` và `AI_MODEL` theo model đang được cấp
trong Google AI Studio. Mã dùng endpoint tương thích OpenAI, cấu trúc `system` /
`user` và prompt hiện có được giữ nguyên. `AI_CONVERSATION_MODEL` để trống sẽ
kế thừa `AI_MODEL`, `AI_WEB_MODEL` có thể cấu hình riêng.

Tạo key tại [Google AI Studio](https://aistudio.google.com/api-keys), rồi lưu trực
tiếp trong biến môi trường server của Vercel, không gửi key qua chat, Git hoặc
log. Model và quota khả dụng phụ thuộc project. Theo [bảng giá Gemini API](https://ai.google.dev/gemini-api/docs/pricing), API Free tier có thể dùng
nội dung gửi lên để cải thiện sản phẩm Google và không cung cấp Google Search
grounding qua API. Vì vậy chỉ dùng dữ liệu synthetic/ẩn danh với Free tier.
Grounding giữ khả năng cấu hình trong ứng dụng nhưng mặc định tắt, chỉ đặt
`AI_WEB_SEARCH=true` sau khi xác nhận quyền, billing và giới hạn phát sinh phí.

Production hiện không có hạn mức model-call theo ngày ở cấp ứng dụng, provider
vẫn có thể trả 429 theo quota/rate limit. API intake demo còn giới hạn 30 request/
phút/client. Khi demo offline, giữ `AI_PROVIDER=mock` và model keys rỗng.

Nếu preview ghi “Dự phòng theo luật”, đọc **Vì sao dùng dự phòng**:

- `AUTHENTICATION`: provider trả 401. Cập nhật key tương ứng với provider trong
  Vercel → project → Settings → Environment Variables → Production, rồi triển
  khai lại để nhận biến mới. Không gửi key qua chat/Git/log.
- `NOT_CONFIGURED`: thiếu provider/model/API key.
- `BUDGET_EXHAUSTED`: chỉ còn ở dữ liệu lịch sử hoặc test-only, production hiện không chặn theo ngân sách ngày của ứng dụng.
- `RATE_LIMIT`/`TIMEOUT`: thử lại sau, không retry vô hạn.
- Output/evidence không hợp lệ: giữ fallback có nhãn và kiểm tra log đã lọc,
  không bỏ validation để ép nhãn `model`.

Health 200 và `provider=gemini` (hoặc provider đã cấu hình) chỉ xác nhận app/cấu hình, trường
`modelConnectivity=NOT_CHECKED` nhắc rằng endpoint này không gọi inference.
Kiểm tra thật bằng một preview synthetic, không xác nhận lưu ticket, chỉ coi
sentiment dùng model khi `sentiment.source=model` và model ID đúng. Cần key
hợp lệ, quyền model và quota API, thay tên model không sửa được key lỗi 401.

## Hệ thống ID nhân viên

Đăng nhập dùng ID nhân viên và mật khẩu. Người đăng ký gửi họ tên cùng email, email trở thành ID sau khi chủ hệ thống cấp tài khoản. Đơn chờ được lưu trong MongoDB và chỉ Admin đăng nhập mới xem được. Tài khoản demo không thay thế SSO, IAM hoặc xác minh nhân sự doanh nghiệp. Xem [hướng dẫn đăng nhập và cấp tài khoản](docs/IDENTITY-SETUP.md).

### Biến môi trường Identity

- `IDENTITY_ADMIN_ID` và `IDENTITY_ADMIN_PASSWORD`: thông tin đăng nhập Admin, chỉ lưu ở server secret store. Dùng một mật khẩu dài, duy nhất.
- `IDENTITY_ADMIN_EMAIL`: hộp thư nhận thông báo đơn cấp tài khoản và địa chỉ liên hệ trong thư kết quả.
- `IDENTITY_EMAIL_ENABLED`: mặc định `false`, chỉ bật sau khi duyệt mẫu email và cấu hình SMTP.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`: cấu hình gửi email. Với Gmail, dùng `smtp.gmail.com`, port `465` hoặc `587`, và App Password sau khi bật 2-Step Verification. Không dùng mật khẩu Gmail chính.
- `APP_BASE_URL`: origin HTTPS của website, dùng làm gốc cho liên kết email. Local có thể dùng `http://localhost:3000` trong môi trường phát triển.
- `IDENTITY_MONGODB_URI`: Mongo Identity riêng tùy chọn, nếu rỗng, dùng `MONGODB_URI`. `IDENTITY_MONGODB_DB` mặc định `nsclub_support_desk`.
- `MONGODB_URI` và `MONGODB_DB`: database Support, quyền ứng dụng phải giới hạn ở database cần dùng. Không dùng Atlas Admin.

Nếu Gmail SMTP thiếu App Password, Vercel không kết nối được SMTP, hoặc provider từ chối gửi, email không được xem là đã gửi và tài khoản không được báo là đã cấp. Vercel SMTP không dùng port 25, ứng dụng hỗ trợ `465` TLS hoặc `587` STARTTLS. Lưu secrets trong Vercel rồi deploy mới để áp dụng. Xem chi tiết tại [IDENTITY-SETUP](docs/IDENTITY-SETUP.md).

### Gửi đơn và cấp tài khoản

1. Người dùng nhập họ tên và Gmail. Đơn được lưu trong MongoDB trước khi gửi thông báo, nếu email tắt hoặc gửi thất bại, đơn vẫn được giữ với trạng thái gửi lỗi để Admin xử lý sau. Email tự khai chưa được xác minh độc lập.
2. Khi `IDENTITY_EMAIL_ENABLED=true` và SMTP đã cấu hình, server gửi thông báo song ngữ đến hộp thư Admin. Nút trong thư chỉ mở danh sách yêu cầu ở `/identity/review`, mở URL bằng `GET` không thay đổi dữ liệu.
3. Admin đăng nhập bằng ID và mật khẩu đã cấu hình, rồi chọn xác nhận cấp tài khoản hoặc từ chối. Danh sách đơn và API quyết định chỉ dành cho Admin.
4. Khi cấp, Gmail trở thành ID đăng nhập, server sinh mật khẩu demo ngẫu nhiên năm chữ số, chỉ lưu hash bcrypt và gửi thông tin qua email. Tài khoản chỉ hoạt động sau khi email gửi thành công. Khi từ chối, hệ thống gửi email kết quả, lỗi gửi có thể được thử lại từ danh sách.
5. Trong `public-demo`, tài khoản `guest01 / 12345` và requester đã đăng nhập có thể mở khu Support reviewer, audit và Verify. API reviewer chỉ trả về và cho phép thao tác trên hồ sơ khớp với bộ Verify do server tạo, kiểm tra đồng thời mã lượt chạy, mã ca và mã yêu cầu. Yêu cầu hỗ trợ thông thường ẩn trong khu reviewer, người gửi vẫn có thể theo dõi hồ sơ của mình bằng liên kết riêng. Identity request và quyết định chỉ dành cho Admin.

Ứng dụng không có SSO/Workspace, phân quyền tổ chức theo team hoặc quy trình khôi phục mật khẩu production. Danh sách mail và nội dung đơn là dữ liệu cá nhân, chỉ dùng mailbox test do bạn kiểm soát.

### Sổ quyền/quota DEMO-SANDBOX

Đây là mô phỏng scope/quota, không tạo entitlement IAM/ITSM, không giữ chỗ cloud và không thực thi thao tác hạ tầng. Script roster/bootstrap cũ không phải luồng cấp người dùng hiện tại. Chỉ vận hành dữ liệu demo theo [contract DEMO-SANDBOX](docs/decisions/DEMO-AUTHORITY-CONTRACT.md), test doubles không chứng minh độ bền Mongo/restart thật.

### Token theo dõi yêu cầu

Mỗi request lưu `trackingTokenHash` và proof hash, không lưu raw token/proof. Trong Production, `SUPPORT_TRACKING_SECRET` phải có đúng 64 ký tự hex (32 byte ngẫu nhiên), tạo giá trị bằng lệnh sau trong terminal riêng, rồi dán trực tiếp vào Vercel Production secret store:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Không tái sử dụng Admin/SMTP secret, đưa secret vào Git, terminal log được chia sẻ hoặc chat. Đổi `SUPPORT_TRACKING_SECRET` sẽ làm các tracking link cũ mất hiệu lực. Nếu tracking secret thiếu hoặc sai, việc gửi request Production trả 503. Request cũ chưa có tracking hash không mở được requester follow-up.

API reviewer Support, tóm tắt, audit, sự kiện, metrics, lịch sử, danh sách và chi tiết hồ sơ yêu cầu tài khoản đã đăng nhập. Trong `public-demo`, Admin có toàn bộ phạm vi reviewer, requester chỉ truy cập được hồ sơ khớp một ca trong tối đa 20 lượt Verify gần nhất dùng bộ dữ liệu server quản lý. Phạm vi này áp dụng cho danh sách, tìm kiếm, audit, chi tiết theo ID, nhóm yêu cầu và thao tác cập nhật. Yêu cầu thông thường không xuất hiện trong khu reviewer, người gửi vẫn theo dõi hồ sơ của mình bằng tracking link. Danh sách cấp tài khoản và API quyết định Identity chỉ dành cho Admin. Tracking token/proof chỉ cho phép người gửi dùng route theo dõi/tiếp tục và khôi phục receipt, chúng không cấp quyền reviewer. Tài khoản requester demo được chia sẻ công khai.

Sau khi đổi biến môi trường trên Vercel, tạo deployment mới. Luồng gửi đơn/cấp tài khoản qua email chưa hoạt động cho tới khi cấu hình Admin, SMTP và MongoDB. Chỉ xác nhận email vận hành sau khi kiểm tra end-to-end bằng mailbox thử nghiệm do bạn kiểm soát.

## Kiểm tra bản trình diễn

Support reviewer, audit và Verify yêu cầu đăng nhập. Trong `public-demo`, requester đã đăng nhập có thể mở các khu này, nhưng API reviewer chỉ cho đọc và thao tác trên yêu cầu khớp với ca Verify do server tạo. Yêu cầu hỗ trợ thông thường không xuất hiện trong khu reviewer, người gửi vẫn truy cập hồ sơ của mình qua tracking link. Danh sách tài khoản và quyết định cấp/từ chối chỉ dành cho Admin. Màn hình người gửi không hiển thị sentiment, expected result hoặc audit thô, khu Support reviewer trình diễn quy trình demo, không phải SSO hoặc IAM production.

Trước buổi trình diễn, kiểm tra máy in, VPN, reset có làm rõ, yêu cầu mở port nguy hiểm, DNS, hỏi tiếp, handoff và tra cứu lại trên desktop/mobile. Kiểm tra bằng lời gọi thật khi được phép, đối chiếu SHA và lưu receipt, dọn đúng ID dữ liệu giả lập vừa tạo sau khi lưu bằng chứng. Không chạy Verify bằng dữ liệu nghiệp vụ hoặc xóa theo điều kiện rộng.

Dependency audit cần tách runtime và toolchain. Rà soát ngày 18/11/2026: `npm audit --omit=dev` không có advisory sau khi cập nhật Next.js, OpenAI SDK và Zod. Full `npm audit` còn 21 advisory thuộc toolchain phát triển (5 moderate, 16 high), gồm nhánh `picomatch`, `minimatch`, Vite và ESLint. Một số advisory có thể xử lý bằng cập nhật tương thích, làm sạch toàn bộ còn cần thay đổi lớn trong toolchain như Tailwind CSS 4. Chưa áp dụng migration major. Không chạy `npm audit fix --force` hoặc nâng framework tùy tiện. Đánh giá migration riêng rồi chạy lại audit và toàn bộ test.

## Tài khoản roster demo cũ

`data/demo/identities.json` và các script `identity-demo-roster.mjs` / `identity-demo-rename.mjs` là tư liệu cho phiên bản roster cũ. Chúng không thay thế tài khoản được lưu trong MongoDB hiện tại, không chạy chúng trên database Identity hoặc Production.

## Vận hành cache và sự cố chung

Support Desk dùng ba ban điều phối `IT`, `COMMERCIAL`, `HR`, `decision.division` do server xác định, không nhận từ browser/model. Query `division` lọc ở server trước tổng số/phân trang/gộp, hồ sơ cũ đọc theo service group. Không migration dữ liệu hoặc thay quyền identity. Index mới `division_queue` hỗ trợ hàng đợi. [Hợp đồng, bộ 30 ca và đánh giá điều hành](docs/SUPPORT-DESK-EXPANSION.md).

Runtime Production chỉ mở Support API khi `SUPPORT_ACCESS_MODE=public-demo`, mọi reviewer vẫn cần phiên tài khoản. Admin có toàn bộ quyền Support, còn requester chỉ truy cập hồ sơ khớp với ca Verify server quản lý. Danh sách đơn Identity và quyết định cấp/từ chối luôn yêu cầu phiên Admin. Các giá trị `SUPPORT_ACCESS_MODE` khác bị chặn bằng `ORGANIZATION_AUTH_REQUIRED`. Health báo `productionReady: false`, chưa có SSO/RBAC tổ chức thực tế. Không đưa dữ liệu công ty thật vào demo. Đánh giá go-live vẫn **Not ready** cho đến khi có xác thực tổ chức, phân quyền từng ban, policy tổ chức và bằng chứng phục hồi/vận hành thật. Cấu hình Mongo/API key hoặc CI xanh không thay thế các điều kiện đó.

Verify nghiệp vụ có bucket 90 request/phút/client sau khi server kiểm tra đúng fixture/run, request nội bộ giữ cùng client để không dùng chung bucket loopback giữa các lượt chạy. Intake thông thường vẫn 30/phút và mutation 15/phút. Bucket ingress 90/phút chặn body không hợp lệ, bộ nhớ limiter có giới hạn. Đây là limiter theo process của demo, không phải kiểm soát abuse phân tán.

Giữ `MONGODB_URI` và `MONGODB_DB` hiện có cho Support. App tạo index trên `v3_support_shared_faq` (TTL 7 ngày) và `v3_support_incidents` (unique activeKey), cùng index liên kết hồ sơ. Không dùng database identity để lưu ticket. Runtime Production thiếu Mongo sẽ từ chối lưu, cache lỗi được coi là miss, không tạo fallback lưu trữ Production khác.

Sự cố chỉ liên kết trong 24 giờ tính từ khi tạo nhóm. Sau 24 giờ hoặc khi đóng, yêu cầu mới tạo nhóm khác. Audit/cập nhật cũ được giữ để theo dõi, không xóa lịch sử theo TTL cache. Cập nhật dùng mẫu server có giới hạn an toàn, không cho gửi secrets hay lệnh tùy ý đến mọi người. Đánh dấu sự cố chung đã khắc phục không tự đóng ticket cá nhân. Màn hình theo dõi polling khi tab đang mở và online, không phải dịch vụ thông báo ngoài app. Danh sách nhóm hiển thị tối đa 50 nhóm đang mở mới nhất, hồ sơ vẫn tra cứu được riêng.

Cache FAQ lưu mô tả công khai thuộc grammar đóng, toàn bộ nội dung trả lời/các bước xử lý và hash template. Mỗi hit kiểm tra body lưu vẫn đúng mẫu hiện hành và policy, entry cũ chỉ có hash sẽ miss. Dice từ vựng chỉ là telemetry, không quyết định hit. Cache hướng dẫn AI có ngữ cảnh dùng `v3_support_guidance_cache`, HMAC bằng server key hiện có, Mongo TTL `deleteAt` 7 ngày, không lưu evidence/identity/trạng thái từ người gửi cũ. Cùng đối tượng/triệu chứng/nền tảng và hash mẫu + policy + intake + provider/model mới dùng lại được. Hit không kéo dài hạn dùng. Đổi API key vô hiệu hóa chữ ký AI cũ. Không fallback memory khi Mongo lỗi. Single-flight chỉ trong cùng process, không hứa gom lời gọi đồng thời giữa nhiều instance.

Không chia sẻ nội dung tự do/credential/entitlement, dữ kiện hoặc cách nói ngoài grammar vẫn chạy phân tích bình thường. Verify và fault injection bỏ qua cache chung. Không thay model, rate limit hoặc quota. [Hợp đồng, kiểm thử và giới hạn](docs/ANSWER-REUSE-CACHE.md). Đây chưa phải kiểm chứng tải 3.000 người hay bảo vệ DDoS đa vùng.


## Tóm tắt hồ sơ cho reviewer

POST `/api/review/:id/summary` yêu cầu quyền reviewer demo và version hiện hành, dùng cùng `AI_PROVIDER`/`AI_MODEL` đang cấu hình. Một lượt inference, timeout 12 giây, tối đa 500 token đầu ra, schema và trích dẫn được kiểm tra trước khi hiển thị. Lỗi AI báo chưa có tóm tắt, nguyên văn và workflow vẫn dùng được. Bản tóm tắt không đi vào policy, routing, approval hoặc tin nhắn người gửi.

Cache Mongo trong `v3_support_reviewer_summaries`, TTL 24 giờ. Khóa gồm request ID, nội dung đã redact, phiên bản prompt, provider/model, thay nội dung làm mất hiệu lực, đổi trạng thái mà không đổi nội dung dùng lại được. Mỗi lần đọc kiểm tra version và hạn dùng, không cache lỗi. Chỉ chế độ support memory-demo dùng cache bộ nhớ local. Mongo cache lỗi được coi là miss, kết quả hợp lệ vừa sinh vẫn hiển thị, không ghi fallback Production vào bộ nhớ. Single-flight chỉ trong cùng process, nhiều instance đồng thời có thể gọi trùng trước khi cache được lưu.

Khi kiểm thử Production, lưu ID ticket và bản ghi summary thuộc đúng ticket đó trong manifest, sau khi lưu bằng chứng, chỉ dọn các ID thử do lượt kiểm tra tạo. Không xóa cache/ticket theo điều kiện rộng. Admin session cho phép xem toàn bộ hàng đợi, requester công khai chỉ xem các ca Verify tổng hợp do server tạo và dùng tracking link riêng cho yêu cầu của mình.
