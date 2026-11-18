# NoSleepClub Support Desk

[![CI](https://github.com/Tienkhoaa2908/NSC-helpdesk---MLAI-hackathon-2026/actions/workflows/qa.yml/badge.svg?branch=main)](https://github.com/Tienkhoaa2908/NSC-helpdesk---MLAI-hackathon-2026/actions/workflows/qa.yml)
[![Reproducibility](https://github.com/Tienkhoaa2908/NSC-helpdesk---MLAI-hackathon-2026/actions/workflows/reproducibility.yml/badge.svg?branch=main)](https://github.com/Tienkhoaa2908/NSC-helpdesk---MLAI-hackathon-2026/actions/workflows/reproducibility.yml)
[![Node.js 22.13+ in 22.x or 24+](https://img.shields.io/badge/Node.js-22.13%2B%20%2822.x%29%20%7C%2024%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Next.js 15.5.29](https://img.shields.io/badge/Next.js-15.5.29-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React 19.1.1](https://img.shields.io/badge/React-19.1.1-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript 5.9.2](https://img.shields.io/badge/TypeScript-5.9.2-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MongoDB Node.js Driver 7.6.0](https://img.shields.io/badge/MongoDB%20Driver-7.6.0-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/docs/drivers/node/current/)
[![Gemini API](https://img.shields.io/badge/LLM-Gemini%20API-4285F4?logo=googlegemini&logoColor=white)](https://ai.google.dev/gemini-api/docs)
[![Google OIDC](https://img.shields.io/badge/Identity-Google%20OIDC-4285F4?logo=google&logoColor=white)](https://developers.google.com/identity/openid-connect/openid-connect)
[![Vercel deploy target](https://img.shields.io/badge/Deploy%20target-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/docs/deployments/overview)
[![Vitest 4.1.12](https://img.shields.io/badge/Unit%20tests-Vitest%204.1.12-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![Playwright 1.63.0](https://img.shields.io/badge/E2E-Playwright%201.63.0-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)

> **Vietnamese below** · [Tiếng Việt](#phần-tiếng-việt)
>
> **MLAI Hackathon 2026:** First Prize, VNG Track · Third Place Overall. [Results announcement](https://www.facebook.com/hutechuniversity/posts/pfbid02aDmtNL88SKFYwZUSW7gRMWut1BLRCKFEPxb2ZkhA3j2vRQx8P5epe2AaP63dhZ82l) · [Competition website](https://ai-network.hcmut.edu.vn/mlai2026)

**Contents:** [My contributions](#my-contributions) · [Product workflow](#product-workflow) · [Architecture](#technical-architecture) · [Interface walkthrough](#interface-walkthrough) · [Run locally](#run-locally) · [Vietnamese](#phần-tiếng-việt)

NoSleepClub Support Desk is an AI-assisted help desk built for VNG’s **The Escalation Referee** challenge at MLAI Hackathon 2026. It turns natural-language support requests into reviewable workflows: resolve routine cases when policy and evidence permit, ask for missing information, and route risk or authority-sensitive cases to a human reviewer.

## My contributions

### Policy-based request triage

I designed the policy runtime that converts structured request evidence into explainable decisions. The model extracts candidate facts into a validated contract; versioned server-side rules evaluate risk signals, authority, required information and routine handling conditions. Requests are classified as **ROUTINE**, **MISSING_INFO**, **BEYOND_AUTHORITY** or **SECURITY_RISK**. Cases that cannot be concluded carry an uncertainty label such as **MISSING_FACTS**, **OUT_OF_POLICY** or **AUTHORITY_REQUIRED**, along with a rationale and owner/team; a targeted requester or reviewer question is included where applicable. The model does not make the final policy decision or authorize an external action. This keeps model-assisted extraction, deterministic decision logic and human review as separate, testable parts of the workflow. See [`policy-source.ts`](src/domain/policy-source.ts) and [`policy.ts`](src/domain/policy.ts).

### Requester and reviewer workflows

I contributed to the UI/UX design for request submission, preview and confirmation, follow-up and case tracking, as well as the Admin workspace for searching requests, inspecting evidence and recording actions. The requester interface presents guidance and status; reviewer-facing policy reasons and audit evidence stay in the review workflow. In-product guidance is organized around the task and role. Representative modules: [`guest-request-history.tsx`](src/components/guest-request-history.tsx), [`support-workspace.tsx`](src/components/support-workspace.tsx) and [`request-detail.tsx`](src/components/request-detail.tsx).

### Controlled grouping of related requests

Eligible requests are grouped by a recognized FAQ topic or a site-scoped incident. Each requester keeps a separate case and tracking link. For eligible reply groups, an Admin can send one shared message to the current group; the system redacts the message, rechecks group membership before saving, and shows the reply on each member's case. Separately, incident groups accept predefined progress updates and remain active for up to 24 hours. These workflows do not merge individual cases. This is a product extension beyond the VNG challenge brief. See [`support-groups.ts`](src/lib/support-groups.ts) and [`support-incidents.ts`](src/lib/support-incidents.ts).

## Product workflow

1. **Submit:** A requester describes an issue in free text or through a guided category form. The server validates the input, redacts supported sensitive patterns and asks the model for structured facts.
2. **Evaluate:** Deterministic policy checks the extracted facts, evidence, risk and authority. Retrieval provides approved support guidance. Missing or unsafe evidence leads to a clarification or human review; a model failure does not become an approval.
3. **Preview and confirm:** The requester reviews the proposed response and next step. The request is stored only after confirmation.
4. **Continue:** The requester uses a tracking capability link to read the response, answer a clarification, add context or request human help. Each saved request keeps its own conversation and history. The token gates requester follow-up routes; because the public demo reviewer can read request records, it does not make ticket contents confidential.
5. **Review and audit:** Admins filter the queue, inspect the request and its evidence, choose an available action, and review the resulting audit history. Related cases may also receive a shared incident update.

## Technical architecture

- **Application:** Next.js App Router, React and TypeScript.
- **Model assistance:** Gemini supports structured request extraction and response drafting through the model adapter. The server validates outputs and retains final policy control. Google Search grounding is optional and separately configured.
- **Policy and safety:** Versioned deterministic rules handle risk, missing facts, authority and routing. Retrieval uses the application knowledge base; source and answer checks run before guidance is shown.
- **Persistence:** MongoDB stores support requests, events, incident groups, Verify runs and Identity records. Support and Identity can use separate configured databases.
- **Employee access:** Google OpenID Connect accepts verified `gmail.com` accounts by default. An Identity administrator manually checks each access request before assigning an internal employee ID and approved scopes. The Support reviewer queue remains a public demo, separate from Identity administration.
- **Requester tracking:** The server derives a stable HMAC token from a dedicated secret and request ID; MongoDB stores only its hash. At submission, the browser also supplies a random recovery proof whose hash is stored separately. That proof is used only by the receipt-recovery endpoint after an ambiguous submission; tracking and follow-up routes require the token. Because reviewer APIs remain public, the token does not make ticket contents confidential.
- **Audit and testing:** Request decisions and reviewer actions are represented in application history. Unit, integration and end-to-end tests cover policy and workflow behavior.

```mermaid
flowchart LR
  R[Requester UI] -->|Preview| I[Validate and redact]
  I --> M[Gemini structured extraction]
  M --> P[Versioned policy and knowledge retrieval]
  P --> V[Answer, clarification or human review]
  V -->|Confirm| S[Support API]
  S -->|Request and token/proof hashes| DB[(MongoDB Support)]
  S -->|HMAC token| R
  R -->|Token| F[Requester follow-up API]
  F --> DB
  R -->|Proof for recovery only| H[Receipt recovery API]
  H --> DB
  A[Admin reviewer UI] -->|Public demo API| Q[Queue, decisions and audit]
  Q --> DB
  G[Google OIDC] --> ID[Identity session and manual approval]
  ID --> DI[(MongoDB Identity)]
```

### Competition test cases

The challenge brief requires at least 15 test scenarios. The MLAI workspace includes a 15-case judge dataset and a separate five-case VNG Verify pack with three automatic-handling and two escalation cases. These fixtures were prepared to satisfy the competition’s test and verification requirements and support regression checks; they are not an independent benchmark of live model quality. See the [challenge brief](challenge/mlai-2026/CHALLENGE-BRIEF.md) and [MLAI dataset notes](challenge/mlai-2026/README.md).

## Interface walkthrough

The screenshots below were captured from the [official live deployment](https://nsclub-support-desk.vercel.app), not from another repository.

### Role selection

![Official website home page with requester and Admin entry points](docs/images/official-home.png)

The home page directs requesters and Admin reviewers to separate entry points. A guest demo route is also available for trying the intake flow without an employee ID.

### Requester intake and follow-up

![Support request form on the official website](docs/images/official-employee-intake.png)

Requesters can describe the issue freely or select a support category. The form asks for only the context needed to route and assess the request; a preview is shown before a saved case is created.

![Requester usage guide on the official website](docs/images/official-employee-guide.png)

The requester guide explains how to review a response, confirm or revise it, then use the case link to answer a clarification or continue the conversation. If the system lacks sufficient evidence or model assistance is unavailable, the policy path can ask for more information or route the case for human review instead of claiming it was resolved.

### Admin review and audit

![Admin support queue on the official website](docs/images/official-admin-queue.png)

The Admin workspace supports filtering and opening a case to inspect its evidence, policy outcome and history before taking an available action. Decisions are recorded for later review.

![Admin usage guide on the official website](docs/images/official-admin-guide.png)

The Admin guide covers queue triage, reviewer actions, incident updates and Verify. The reviewer queue is intentionally public in this demo and must only contain synthetic data. Identity administration is separate: Google Sign-In identifies the applicant, and a manually approved request provisions an internal employee ID. It is not a substitute for an organization’s IAM or HR verification process.

## Run locally

Requires Node.js 22.13 or later in the 22.x line, or 24 or later, and npm. Node 23 is excluded by dependency engine ranges.

```powershell
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run dev
```

Open `http://localhost:3000`. The example environment uses mock AI and demo storage. To enable Gemini, set `AI_PROVIDER="gemini"`, `AI_MODEL` and `GEMINI_API_KEY` in `.env.local`. Keep API keys out of Git, browser code and chat. See [AI configuration](docs/AI-CONFIGURATION.md) and the [runbook](RUNBOOK.md).

## Checks

```powershell
npm run check:docs
npm run lint
npm run typecheck
npm test
npm run build
```

The full release and persistence checks are documented in the [runbook](RUNBOOK.md).
CI runs unit tests, documentation checks, lint, type checking, production build and desktop/mobile end-to-end tests. A separate workflow runs clean `npm ci` on Linux and Windows. Mongo restart persistence is opt-in in hosted CI and is skipped unless an isolated test URI and acknowledgement are configured; a passing badge does not claim live Mongo restart verification.

## Documentation

- [Requester guide](docs/EMPLOYEE-GUIDE.md) · [Admin guide](docs/ADMIN-GUIDE.md)
- [Architecture](docs/ARCHITECTURE.md) · [Evaluation and limitations](docs/EVALUATION.md)
- [Gemini configuration and key handling](docs/AI-CONFIGURATION.md) · [Google Sign-In and employee ID setup](docs/IDENTITY-SETUP.md)
- [MLAI 2026 challenge workspace and datasets](challenge/mlai-2026/README.md)
- [Documentation index](docs/README.md)

## Demo scope

This repository includes public demonstration workflows and synthetic challenge data. Google Sign-In verifies the Google account, while manual Identity approval checks the employee request; this is not organization-wide IAM. Support review APIs remain public by design, so reviewer access is not authenticated and request contents are not confidential on the public deployment. Use synthetic data only. The request tracking token authorizes requester follow-up actions but does not change that reviewer-access boundary.

## Original competition repository

The team repository submitted to the competition is [dakiemdarktharr/nosleepclub-support-desk](https://github.com/dakiemdarktharr/nosleepclub-support-desk).

---

## Phần tiếng Việt

**Nội dung:** [Đóng góp](#đóng-góp-của-tôi) · [Quy trình](#quy-trình-sản-phẩm) · [Kiến trúc](#kiến-trúc-kỹ-thuật) · [Luồng giao diện](#một-số-luồng-giao-diện) · [Chạy local](#chạy-local)

> **MLAI Hackathon 2026:** Giải Nhất track VNG · Giải Ba chung cuộc. [Thông báo kết quả](https://www.facebook.com/hutechuniversity/posts/pfbid02aDmtNL88SKFYwZUSW7gRMWut1BLRCKFEPxb2ZkhA3j2vRQx8P5epe2AaP63dhZ82l) · [Trang cuộc thi](https://ai-network.hcmut.edu.vn/mlai2026)

NoSleepClub Support Desk là hệ thống hỗ trợ ứng dụng AI, được xây dựng cho đề bài **The Escalation Referee** của VNG tại MLAI Hackathon 2026. Sản phẩm chuyển yêu cầu ngôn ngữ tự nhiên thành quy trình có thể kiểm tra: tự xử lý trường hợp thường quy khi policy và bằng chứng cho phép, hỏi bổ sung thông tin còn thiếu, hoặc chuyển trường hợp có rủi ro hay yêu cầu thẩm quyền cho người phụ trách.

## Đóng góp của tôi

### Policy phân loại yêu cầu

Tôi thiết kế policy runtime chuyển dữ kiện yêu cầu có cấu trúc thành quyết định có thể giải thích. Mô hình trích xuất dữ kiện ứng viên theo hợp đồng đã được kiểm tra; các quy tắc phía máy chủ, được phiên bản hóa, đánh giá tín hiệu rủi ro, thẩm quyền, thông tin bắt buộc và điều kiện xử lý thường quy. Yêu cầu được phân loại thành **ROUTINE**, **MISSING_INFO**, **BEYOND_AUTHORITY** hoặc **SECURITY_RISK**. Trường hợp chưa thể kết luận có nhãn bất định như **MISSING_FACTS**, **OUT_OF_POLICY** hoặc **AUTHORITY_REQUIRED**, kèm lý do và đơn vị phụ trách; câu hỏi cụ thể cho người gửi hoặc reviewer được bổ sung khi phù hợp. Mô hình không đưa ra quyết định policy cuối cùng hay cấp phép thao tác bên ngoài. Cách tách này giúp kiểm thử riêng phần trích xuất có hỗ trợ mô hình, quyết định xác định và bước chuyển người xử lý. Xem [`policy-source.ts`](src/domain/policy-source.ts) và [`policy.ts`](src/domain/policy.ts).

### Luồng người gửi và người xử lý

Tôi hỗ trợ thiết kế UI/UX cho các bước gửi, xem trước và xác nhận yêu cầu, hỏi tiếp và theo dõi hồ sơ; đồng thời cho không gian Admin tìm kiếm yêu cầu, kiểm tra bằng chứng và ghi nhận thao tác. Giao diện người gửi tập trung vào hướng dẫn và trạng thái; lý do policy và bằng chứng audit dành cho người xử lý nằm trong luồng review. Hướng dẫn trong sản phẩm được tổ chức theo tác vụ và vai trò. Một số module đại diện: [`guest-request-history.tsx`](src/components/guest-request-history.tsx), [`support-workspace.tsx`](src/components/support-workspace.tsx) và [`request-detail.tsx`](src/components/request-detail.tsx).

### Gom nhóm yêu cầu liên quan có kiểm soát

Các yêu cầu đủ điều kiện được gom theo chủ đề FAQ đã nhận diện hoặc sự cố gắn với một địa điểm. Mỗi người gửi vẫn có hồ sơ riêng và token theo dõi riêng cho hồ sơ đó. Với nhóm đủ điều kiện nhận phản hồi chung, Admin có thể gửi một nội dung cho các thành viên hiện tại; hệ thống che dữ liệu nhạy cảm, kiểm tra lại membership trước khi lưu và hiển thị phản hồi trên từng hồ sơ thành viên. Riêng nhóm sự cố nhận các cập nhật tiến độ theo trạng thái và hoạt động tối đa 24 giờ. Các luồng này không gộp hồ sơ cá nhân. Đây là phần mở rộng sản phẩm ngoài brief VNG. Xem [`support-groups.ts`](src/lib/support-groups.ts) và [`support-incidents.ts`](src/lib/support-incidents.ts).

## Quy trình sản phẩm

1. **Gửi yêu cầu:** Người gửi mô tả vấn đề bằng văn bản tự do hoặc chọn danh mục hỗ trợ. Server kiểm tra input, che các dạng dữ liệu nhạy cảm được hỗ trợ và yêu cầu mô hình trích xuất dữ kiện có cấu trúc.
2. **Đánh giá:** Policy xác định kiểm tra dữ kiện, bằng chứng, rủi ro và thẩm quyền. Retrieval cung cấp hướng dẫn hỗ trợ đã duyệt. Nếu thiếu bằng chứng hoặc có rủi ro, hệ thống hỏi bổ sung hoặc chuyển cho người xử lý; lỗi mô hình không được xem là phê duyệt.
3. **Xem trước và xác nhận:** Người gửi đọc phản hồi và bước tiếp theo được đề xuất. Hồ sơ chỉ được lưu sau khi người gửi xác nhận.
4. **Trao đổi tiếp:** Người gửi dùng liên kết có token theo dõi để đọc phản hồi, trả lời câu hỏi xác minh, bổ sung ngữ cảnh hoặc yêu cầu nhân viên hỗ trợ. Mỗi yêu cầu đã lưu giữ hội thoại và lịch sử riêng. Token giới hạn các API dành cho người gửi; do hàng đợi Admin của bản demo vẫn công khai, token không làm nội dung ticket trở nên bảo mật.
5. **Review và audit:** Admin lọc hàng đợi, mở hồ sơ, đối chiếu bằng chứng và kết quả policy, chọn thao tác phù hợp; lịch sử quyết định được ghi lại để tra cứu. Các hồ sơ liên quan cũng có thể nhận cập nhật chung về sự cố.

## Kiến trúc kỹ thuật

- **Ứng dụng:** Next.js App Router, React và TypeScript.
- **Hỗ trợ bằng mô hình:** Gemini hỗ trợ trích xuất yêu cầu có cấu trúc và soạn phản hồi qua model adapter. Server kiểm tra output và giữ quyền quyết định policy cuối cùng. Google Search grounding là tùy chọn và được cấu hình riêng.
- **Policy và an toàn:** Quy tắc xác định, có phiên bản, xử lý rủi ro, dữ kiện thiếu, thẩm quyền và định tuyến. Retrieval dùng kho tri thức của ứng dụng; nguồn và câu trả lời được kiểm tra trước khi hiển thị.
- **Lưu trữ:** MongoDB lưu yêu cầu, sự kiện, nhóm sự cố, lượt Verify và hồ sơ Identity. Support và Identity có thể dùng database riêng theo cấu hình.
- **Quyền truy cập nhân viên:** Google OpenID Connect mặc định chấp nhận tài khoản `gmail.com` đã xác minh. Quản trị viên Identity kiểm tra thủ công từng đơn trước khi cấp ID nhân viên nội bộ và phạm vi quyền đã duyệt. Hàng đợi Support của Admin vẫn là bản demo công khai, tách biệt với quản trị Identity.
- **Theo dõi yêu cầu:** Server tạo token HMAC ổn định từ secret riêng và mã yêu cầu; MongoDB chỉ lưu hash token. Khi gửi, trình duyệt cũng cung cấp một proof ngẫu nhiên và hệ thống lưu hash riêng. Proof chỉ dùng ở API khôi phục receipt sau lần gửi không rõ kết quả; các route theo dõi và tiếp diễn chỉ cần token. Vì API reviewer vẫn công khai, token không làm nội dung ticket trở nên bí mật.
- **Audit và kiểm thử:** Quyết định của hệ thống và thao tác reviewer được thể hiện trong lịch sử ứng dụng. Unit, integration và end-to-end test bao phủ hành vi policy và workflow.

```mermaid
flowchart LR
  R[Giao diện người gửi] -->|Preview| I[Kiểm tra và che dữ liệu]
  I --> M[Gemini trích xuất có cấu trúc]
  M --> P[Policy phiên bản hóa và retrieval tri thức]
  P --> V[Trả lời, hỏi bổ sung hoặc chuyển người]
  V -->|Xác nhận| S[Support API]
  S -->|Yêu cầu cùng hash token/proof| DB[(MongoDB Support)]
  S -->|Token HMAC| R
  R -->|Token| F[API theo dõi người gửi]
  F --> DB
  R -->|Proof chỉ để khôi phục| H[API khôi phục receipt]
  H --> DB
  A[Giao diện Admin reviewer] -->|API demo công khai| Q[Hàng đợi, quyết định và audit]
  Q --> DB
  G[Google OIDC] --> ID[Session Identity và duyệt thủ công]
  ID --> DI[(MongoDB Identity)]
```

### Bộ test case của cuộc thi

Brief yêu cầu tối thiểu 15 tình huống kiểm thử. Workspace MLAI có bộ 15 tình huống dành cho giám khảo và một bộ VNG Verify riêng gồm năm ca: ba ca xử lý tự động và hai ca chuyển tiếp. Các fixture này được chuẩn bị để hoàn thành yêu cầu kiểm thử, xác minh của cuộc thi và hỗ trợ kiểm tra hồi quy; chúng không phải benchmark độc lập về chất lượng model đang chạy. Xem [brief cuộc thi](challenge/mlai-2026/CHALLENGE-BRIEF.md) và [ghi chú dataset MLAI](challenge/mlai-2026/README.md).

## Một số luồng giao diện

Ảnh dưới đây được chụp từ [website chính thức đang triển khai](https://nsclub-support-desk.vercel.app), không lấy từ repo khác.

### Chọn vai trò

![Trang chủ website chính thức với lối vào dành cho người gửi và Admin](docs/images/official-home.png)

Trang chủ đưa người gửi và Admin đến hai luồng riêng. Website cũng có chế độ demo không cần ID nhân viên để thử biểu mẫu tiếp nhận.

### Người gửi yêu cầu và trao đổi tiếp

![Biểu mẫu yêu cầu hỗ trợ trên website chính thức](docs/images/official-employee-intake.png)

Người gửi có thể mô tả tự do hoặc chọn danh mục hỗ trợ. Biểu mẫu thu thập ngữ cảnh cần thiết để đánh giá và định tuyến; hệ thống hiển thị preview trước khi tạo hồ sơ đã lưu.

![Hướng dẫn sử dụng dành cho nhân viên trên website chính thức](docs/images/official-employee-guide.png)

Hướng dẫn cho người gửi giải thích cách đọc phản hồi, xác nhận hoặc sửa yêu cầu, sau đó dùng liên kết hồ sơ để trả lời câu hỏi xác minh hoặc tiếp tục hội thoại. Nếu thiếu bằng chứng hoặc mô hình không khả dụng, policy có thể yêu cầu thêm thông tin hay chuyển nhân viên xử lý, thay vì khẳng định sự cố đã được giải quyết.

### Admin review và audit

![Hàng đợi yêu cầu Admin trên website chính thức](docs/images/official-admin-queue.png)

Không gian Admin hỗ trợ lọc hàng đợi và mở hồ sơ để xem bằng chứng, kết quả policy và lịch sử trước khi chọn một thao tác được phép. Các quyết định được ghi lại để tra cứu.

![Hướng dẫn sử dụng dành cho Admin trên website chính thức](docs/images/official-admin-guide.png)

Hướng dẫn Admin mô tả cách phân loại hàng đợi, phản hồi người gửi, cập nhật sự cố và chạy Verify. Hàng đợi reviewer công khai có chủ đích trong bản demo, chỉ nên chứa dữ liệu tổng hợp. Quản trị Identity là luồng riêng: Google Sign-In nhận diện tài khoản, còn đơn xin quyền được kiểm tra thủ công trước khi cấp ID nội bộ. Luồng này không thay thế IAM hoặc quy trình xác minh nhân sự của tổ chức.

## Chạy local

Yêu cầu Node.js từ 22.13 trong nhánh 22.x trở lên, hoặc từ 24 trở lên, cùng npm. Node 23 bị loại trừ theo khai báo engine của một số dependency.

```powershell
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run dev
```

Mở `http://localhost:3000`. Môi trường mẫu dùng AI mock và bộ nhớ demo. Để bật Gemini, khai báo `AI_PROVIDER="gemini"`, `AI_MODEL` và `GEMINI_API_KEY` trong `.env.local`. Không commit API key, đưa key vào mã frontend hoặc gửi key qua chat. Xem [cấu hình AI](docs/AI-CONFIGURATION.md) và [RUNBOOK](RUNBOOK.md).

## Kiểm tra

```powershell
npm run check:docs
npm run lint
npm run typecheck
npm test
npm run build
```

Các bước phát hành và kiểm tra persistence đầy đủ được ghi trong [RUNBOOK](RUNBOOK.md).
CI chạy unit test, kiểm tra tài liệu, lint, kiểm tra kiểu, build production và end-to-end desktop/mobile. Workflow riêng chạy `npm ci` sạch trên Linux và Windows. Kiểm tra Mongo sau restart là tùy chọn trong CI và sẽ skip nếu thiếu URI kiểm thử riêng cùng xác nhận an toàn; badge đạt không đồng nghĩa đã xác minh restart trên Mongo thật.

## Tài liệu

- [Hướng dẫn người gửi](docs/EMPLOYEE-GUIDE.md) · [Hướng dẫn Admin](docs/ADMIN-GUIDE.md)
- [Kiến trúc](docs/ARCHITECTURE.md) · [Đánh giá và giới hạn](docs/EVALUATION.md)
- [Cấu hình Gemini và quản lý API key](docs/AI-CONFIGURATION.md) · [Cấu hình Google Sign-In và cấp ID](docs/IDENTITY-SETUP.md)
- [Workspace và dataset MLAI 2026](challenge/mlai-2026/README.md)
- [Mục lục tài liệu](docs/README.md)

## Phạm vi bản demo

Repository có các luồng trình diễn công khai và dữ liệu thử thách tổng hợp. Google Sign-In xác minh tài khoản Google; bước Identity Admin duyệt thủ công đơn xin cấp quyền. Đây không phải IAM của tổ chức. API reviewer Support vẫn công khai theo thiết kế, do đó nội dung yêu cầu không được bảo mật trên website public. Token theo dõi cho phép người gửi dùng các route tiếp diễn nhưng không thay đổi ranh giới truy cập reviewer. Chỉ nhập dữ liệu tổng hợp khi dùng website public.

## Repo nhóm tham gia cuộc thi

Repository nhóm đã nộp dự thi: [dakiemdarktharr/nosleepclub-support-desk](https://github.com/dakiemdarktharr/nosleepclub-support-desk).
