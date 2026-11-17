# NoSleepClub Help Desk

> **MLAI Hackathon 2026:** NoSleepClub đạt **Giải Nhất track VNG** và **Giải Ba chung cuộc**. [Thông báo kết quả của HUTECH](https://www.facebook.com/hutechuniversity/posts/pfbid02aDmtNL88SKFYwZUSW7gRMWut1BLRCKFEPxb2ZkhA3j2vRQx8P5epe2AaP63dhZ82l) · [Trang cuộc thi](https://ai-network.hcmut.edu.vn/mlai2026)

Support Desk là hệ thống tiếp nhận và xử lý yêu cầu hỗ trợ bằng ngôn ngữ tự nhiên. Sản phẩm được phát triển cho đề bài VNG **The Escalation Referee** trong [brief MLAI 2026](challenge/mlai-2026/CHALLENGE-BRIEF.md): tự động xử lý trường hợp thường quy, nhận diện phần còn thiếu, giới hạn thẩm quyền và rủi ro, rồi chuyển đúng trường hợp cho nhân viên kèm câu hỏi cần xác minh.

## Đóng góp của tôi

### Hệ thống policy phân loại yêu cầu

Tôi xây dựng policy runtime để chuyển yêu cầu đã được trích xuất dữ kiện thành quyết định có thể giải thích. Bộ phân loại kiểm tra tín hiệu rủi ro, thẩm quyền, dữ kiện bắt buộc và điều kiện xử lý thường quy; quyết định được xếp vào bốn bucket: **ROUTINE**, **MISSING_INFO**, **BEYOND_AUTHORITY** hoặc **SECURITY_RISK**. Các trường hợp chưa thể xử lý tự động được gắn lớp bất định như **MISSING_FACTS**, **OUT_OF_POLICY** hoặc **AUTHORITY_REQUIRED**. Policy tạo lý do, câu hỏi xác minh và nhóm phụ trách. Mô hình ngôn ngữ hỗ trợ hiểu câu chữ; server áp dụng policy xác định và giữ quyết định cuối cùng. Quy tắc được phiên bản hóa trong [`src/domain/policy-source.ts`](src/domain/policy-source.ts) và đánh giá tại [`src/domain/policy.ts`](src/domain/policy.ts).

### Thiết kế UI/UX

Tôi hỗ trợ thiết kế các luồng gửi yêu cầu, xem trước và xác nhận, theo dõi phản hồi, cùng không gian Admin để tìm kiếm, đọc bằng chứng và xử lý hồ sơ. Giao diện tách thông tin người gửi nhìn thấy khỏi lý do và audit dành cho người xử lý, hướng dẫn trong sản phẩm chỉ đến đúng thao tác theo vai trò.

### Nhóm yêu cầu cùng một vấn đề

Tôi thiết kế cơ chế liên kết các yêu cầu đủ điều kiện vào một sự cố chung dựa trên chủ đề và địa điểm đã chuẩn hóa. Mỗi người gửi vẫn có hồ sơ và liên kết theo dõi riêng; Admin đăng một cập nhật tiến độ cho nhóm và hệ thống hiển thị cập nhật đó trên các hồ sơ liên kết. Cơ chế này áp dụng cho một tập con yêu cầu có metadata phù hợp, nhóm tự hết hạn sau 24 giờ và không thay thế phản hồi riêng cho từng hồ sơ. Đây là phần mở rộng của sản phẩm, không phải tiêu chí ghi trong brief VNG.

## Quy trình xử lý

1. Người gửi mô tả vấn đề hoặc chọn một danh mục. Server kiểm tra input, che thông tin nhạy cảm và trích xuất dữ kiện có cấu trúc.
2. Bộ policy kiểm tra rủi ro, thẩm quyền, thông tin bắt buộc và căn cứ nội bộ. Trường hợp an toàn, đủ căn cứ nhận hướng dẫn có nguồn; trường hợp chưa đủ căn cứ được hỏi bổ sung hoặc chuyển người xử lý.
3. Khi người gửi xác nhận preview, hệ thống lưu hồ sơ, sự kiện và trạng thái để tiếp tục theo dõi.
4. Admin xem nội dung, bằng chứng và lịch sử; các quyết định được ghi audit. Verify chạy bộ tình huống hồi quy và đối chiếu kết quả với hồ sơ đã lưu.

![Sơ đồ policy: bằng chứng được kiểm tra trước khi server áp dụng quyết định](docs/diagrams/ai-policy.svg)

Sơ đồ Mermaid và các luồng khác nằm trong [`docs/diagrams`](docs/diagrams/); mô tả hệ thống ở [tài liệu kiến trúc](docs/ARCHITECTURE.md).

## Kiến trúc và công nghệ

Ứng dụng dùng **Next.js App Router**, **React**, **TypeScript** và **MongoDB**. MongoDB lưu hồ sơ hỗ trợ, sự kiện, nhóm sự cố, lượt Verify và dữ liệu Identity trong các collection riêng; Support và Identity có thể cấu hình database/connection riêng. Gemini API hỗ trợ trích xuất và soạn nội dung qua adapter tương thích OpenAI; Google Search grounding là tùy chọn riêng. Quyết định policy và kiểm tra an toàn chạy ở server, không giao quyền quyết định cuối cùng cho mô hình.

### Một số luồng giao diện

Ảnh dưới đây là ảnh chụp minh họa các luồng demo được lưu trong repository.

**Tóm tắt hồ sơ trong không gian Admin**

![Bản tóm tắt hồ sơ hỗ trợ dành cho Admin](docs/images/review-summary-desktop.png)

**Theo dõi tiến trình Verify**

![Tiến trình chạy bộ Verify](docs/images/verify-progress.png)

## Bắt đầu

Yêu cầu Node.js 22.13 trở lên và npm.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Mở `http://localhost:3000`. Cấu hình mẫu dùng AI mock và bộ nhớ demo, không cần API key hay dịch vụ ngoài.

Để bật Gemini, đặt `AI_PROVIDER="gemini"`, `AI_MODEL="gemini-3.8-flash"` và `GEMINI_API_KEY` trong `.env.local`. Không đưa khóa vào Git, frontend hoặc nội dung chat. Xem [cấu hình AI và quản lý khóa](docs/AI-CONFIGURATION.md) và [RUNBOOK](RUNBOOK.md).

## Kiểm tra

```powershell
npm run check:docs
npm run lint
npm run typecheck
npm test
npm run build
```

## Tài liệu

- [Hướng dẫn nhân viên gửi yêu cầu](docs/EMPLOYEE-GUIDE.md)
- [Hướng dẫn Admin xử lý yêu cầu](docs/ADMIN-GUIDE.md)
- [Kiến trúc](docs/ARCHITECTURE.md)
- [Đánh giá và giới hạn](docs/EVALUATION.md)
- [Dữ liệu và bộ Verify MLAI 2026](challenge/mlai-2026/README.md)
- [Cấu hình Gemini và bảo vệ API key](docs/AI-CONFIGURATION.md)
- [Mục lục tài liệu](docs/README.md)
