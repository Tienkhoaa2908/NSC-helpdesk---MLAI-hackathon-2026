# Kiến trúc kỹ thuật — NoSleepClub Support Desk

Ứng dụng Next.js App Router, TypeScript, React, MongoDB và Gemini API qua giao diện chat tương thích OpenAI. Tra cứu web dùng Google Search grounding riêng, chỉ chạy khi được bật. `src/domain/policy-source.ts` là nguồn phiên bản policy runtime, không lấy phiên bản từ một báo cáo lịch sử.

## Tiếp nhận và quyết định

[![Phân tích input, kiểm chứng bằng chứng và áp policy tại server](diagrams/ai-policy.svg)](diagrams/ai-policy.svg)

[Nguồn Mermaid](diagrams/ai-policy.mmd).

- API kiểm tra origin, kích thước JSON, rate limit và ngữ cảnh phiên identity/Verify phù hợp.
- Baseline giữ dữ kiện và rủi ro đã xác định, model không được xóa risk hoặc tự xác minh approval.
- Thứ tự ưu tiên: security risk → authority → missing information → routine. Policy, approval, entitlement và capacity có contract riêng.
- Khi mở port có rủi ro rõ, vẫn giữ thông tin được cung cấp như số cổng và quote, không tự suy diễn protocol hoặc nguồn/đích.
- Freeform đủ điều kiện dùng Structured Outputs và quote được kiểm chứng. Structured, reset mơ hồ và risk rõ có nhánh server riêng.
- Intent mơ hồ cần làm rõ, xung đột có bằng chứng vẫn được giữ. Lỗi model không được suy thành phê duyệt.

## Câu trả lời và độ trễ

[![Tạo câu trả lời: hướng dẫn đã duyệt, retrieval, cache và kiểm tra safety](diagrams/answer-generation.svg)](diagrams/answer-generation.svg)

[Nguồn Mermaid](diagrams/answer-generation.mmd).

`createConversationAnswer` truy xuất corpus bằng BM25, alias Việt–Anh và chuẩn hóa typo. Web search chỉ dùng khi được bật và đúng chủ đề/nguồn cho phép, URL trong ticket không cấp quyền đọc tài liệu riêng. Quote phải khớp bài nguồn, chỉ nguồn thực sự sử dụng mới được hiển thị. Nhãn conversation do server sở hữu, không bị model đổi quyền hay route.

Hướng dẫn đã duyệt đủ đáp ứng câu hỏi không cần thêm lượt AI chỉ để diễn đạt lại. Nguồn độc lập có thể được đọc song song, các bước phụ thuộc policy/quyền vẫn giữ thứ tự. Cache gắn revision và kiểm tra lại trước khi dùng, không cache câu trả lời riêng tư như câu công khai.

Model có deadline/retry giới hạn, không retry vô hạn hoặc bỏ evidence validation để đạt latency. Chỉ dùng dự phòng cho tác vụ mà server xác định đủ an toàn, giữ source, fallback reason và model metadata trong hồ sơ. Thông báo cho người gửi dùng ngôn ngữ dễ hiểu, mã kỹ thuật thuộc màn hình hỗ trợ.

`support-telemetry.ts` ghi thời gian từng stage, số lượt/token model và cache, không ghi input hay credential. `first_observed` không chứng minh Vercel cold start. Đo thời gian đến kết quả dùng được và tách cache hit/miss, thành công/fallback, không coi một sample là SLA.

## Lưu và hiển thị theo vai trò

[![Theo dõi, bàn giao và cập nhật hồ sơ theo version](diagrams/support-followup.svg)](diagrams/support-followup.svg)

[Nguồn Mermaid](diagrams/support-followup.mmd).

Preview chưa tạo ticket, kiểm tra TTL, fingerprint và policy trước xác nhận. Request, assistance, feedback và events được ghi trong document `v3_support_requests`, cập nhật dùng version để chống ghi đè giữa các tab. Intake sentiment được lưu khi có phân tích, không chạy lại AI chỉ để hiển thị cho nhân viên. Hồ sơ cũ thiếu trường này vẫn đọc được và không được bịa dữ liệu bổ sung.

| Người gửi | Nhân viên hỗ trợ |
| --- | --- |
| Nội dung gốc, hướng dẫn, cảnh báo an toàn và nguồn tham khảo | Toàn bộ hướng dẫn, kiểm tra an toàn nội bộ và expected result |
| Trạng thái, thời gian và tiến trình dễ hiểu | Actor, action, rule, evidence, policy và lý do audit |
| Hỏi tiếp, bổ sung hoặc yêu cầu gặp nhân viên | Sentiment khi tiếp nhận và assessment của phản hồi |

Sentiment là thông tin quan sát, không tự cấp quyền, đặt ưu tiên, đóng ticket hoặc thay yêu cầu gặp người. Lựa chọn hiểu hướng dẫn không tự xác nhận sự cố thiết bị đã được giải quyết.

Giao diện tách theo vai trò và server kiểm tra phiên trước khi trả dữ liệu reviewer. API Support review yêu cầu tài khoản đã đăng nhập. Trong `public-demo`, Admin có phạm vi đầy đủ, requester chỉ đọc và thao tác trên hồ sơ khớp với bộ Verify do server tạo. Yêu cầu thông thường ẩn trong reviewer API, người gửi vẫn truy cập hồ sơ của mình bằng tracking link. Danh sách cấp tài khoản và quyết định Identity yêu cầu phiên Admin. Phạm vi dữ liệu được kiểm tra phía server, không chỉ ẩn liên kết trong UI.

## Identity và dữ liệu

Người dùng đăng nhập bằng ID nhân viên và mật khẩu. Người đăng ký gửi họ tên cùng Gmail, Gmail trở thành ID khi tài khoản được cấp. Đơn lưu trong MongoDB và chỉ phiên Admin mới xem được. Biểu mẫu công khai trả cùng xác nhận cho địa chỉ mới, đang có đơn hoặc đã có tài khoản, không tạo bản ghi trùng hay tiết lộ trạng thái. Email thông báo chỉ mở danh sách riêng, Admin đăng nhập rồi chủ động xác nhận hoặc từ chối. Quyết định đầu tiên được khóa, trạng thái email chưa xác nhận chỉ cho phép retry cùng quyết định. Khi cấp, server sinh chuỗi mật khẩu demo ngẫu nhiên đúng năm chữ số, lưu hash bcrypt và bản mã hóa AES-256-GCM trong khi tài khoản chưa hoạt động. Sau khi SMTP chấp nhận thư, một Mongo transaction kích hoạt tài khoản và xóa bản mã hóa. Nếu kết quả gửi hoặc transaction chưa xác nhận được, account vẫn inactive và retry credential gửi cùng mật khẩu. Trạng thái `SENT` chỉ phản ánh SMTP acceptance, không xác nhận Inbox. Email đăng ký chưa được xác minh độc lập. Phiên dùng token opaque, lưu hash, hết hạn phía server sau tám giờ và bị thu hồi khi đăng xuất. Trong chế độ `public-demo`, requester đã đăng nhập có thể dùng Support review, audit và Verify, nhưng chỉ truy cập hồ sơ khớp với ca Verify do server tạo. Yêu cầu thông thường ẩn trong reviewer API, người gửi vẫn dùng tracking link cho hồ sơ của mình. Identity request list/API vẫn chỉ dành cho Admin. `guest01 / 12345` là tài khoản demo công khai. Đây không phải hệ thống IAM/Workspace của tổ chức.

Yêu cầu đã xác nhận nhận tracking token HMAC được tạo từ secret riêng và request ID, MongoDB chỉ lưu hash token. Trình duyệt gửi thêm proof ngẫu nhiên khi tạo yêu cầu, và hệ thống lưu riêng hash proof này. Proof chỉ dùng ở endpoint khôi phục receipt khi kết quả gửi không rõ, các route theo dõi/tiếp diễn chỉ yêu cầu token. Support reviewer APIs dùng phiên requester/Admin theo chế độ triển khai, tracking token chỉ cấp quyền cho các thao tác follow-up của hồ sơ tương ứng và không thay thế phiên reviewer.

Support và identity có collection riêng, có thể dùng cùng database được cấu hình cho ứng dụng. Support có memory-demo khi được cấu hình rõ, identity không có memory/CSV fallback. Không sửa hoặc di chuyển dữ liệu Production từ workflow phát triển UI. Các tài khoản requester trong chế độ demo chỉ đọc hồ sơ Verify được server kiểm tra trong khu reviewer, người gửi vẫn có tracking link cho hồ sơ của mình. Dữ liệu đăng ký và quyết định cấp tài khoản chỉ dành cho Admin.

## Bản đồ code

| Trách nhiệm | Code |
| --- | --- |
| HTTP, input và redaction | [support-http](../src/lib/support-http.ts), [input](../src/domain/input.ts), [redaction](../src/domain/redaction.ts) |
| Phân tích và tiếp nhận | [support service](../src/services/support.ts), [support-model](../src/lib/support-model.ts), [intent contract](../src/lib/intent-contract.ts) |
| Policy và safety | [policy](../src/domain/policy.ts), [policy-source](../src/domain/policy-source.ts), [answer safety](../src/domain/answer-safety.ts) |
| Retrieval, câu trả lời và cache | [conversation-model](../src/lib/conversation-model.ts), [support-knowledge](../src/lib/support-knowledge.ts), [answer-cache](../src/lib/answer-cache.ts) |
| Hội thoại và review | [conversation](../src/services/conversation.ts), [review](../src/services/review.ts) |
| Lưu trữ và telemetry | [support-repository](../src/lib/support-repository.ts), [telemetry](../src/lib/support-telemetry.ts) |
| Identity | [identity service](../src/services/identity.ts), [identity-store](../src/lib/identity-store.ts) |
| Hiển thị | [support-history](../src/components/support-history.tsx), [review-detail](../src/components/review-detail.tsx) |

Không lưu chain-of-thought. Audit là nhật ký ứng dụng, không phải kho chống sửa bởi quản trị database. Redaction có phạm vi hữu hạn, xem [inventory](PRIVACY-INVENTORY.md). Policy mô phỏng, quyền demo và callback chưa tích hợp doanh nghiệp cần được phân biệt với xác thực, thông báo hoặc thực thi thật.
