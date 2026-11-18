# NoSleepClub Support Desk

> **MLAI Hackathon 2026:** First Prize, VNG Track · Third Place Overall. [Results announcement](https://www.facebook.com/hutechuniversity/posts/pfbid02aDmtNL88SKFYwZUSW7gRMWut1BLRCKFEPxb2ZkhA3j2vRQx8P5epe2AaP63dhZ82l) · [Competition website](https://ai-network.hcmut.edu.vn/mlai2026)
>
> **Vietnamese below** · [Tiếng Việt](#phần-tiếng-việt)

NoSleepClub Support Desk is an AI-assisted help desk built for VNG’s **The Escalation Referee** challenge at MLAI Hackathon 2026. It turns natural-language support requests into reviewable workflows: resolve routine cases when policy and evidence permit, ask for missing information, and route risk or authority-sensitive cases to a human reviewer.

[![CI](https://github.com/Tienkhoaa2908/NSC-helpdesk---MLAI-hackathon-2026/actions/workflows/qa.yml/badge.svg?branch=main)](https://github.com/Tienkhoaa2908/NSC-helpdesk---MLAI-hackathon-2026/actions/workflows/qa.yml)
[![Reproducibility](https://github.com/Tienkhoaa2908/NSC-helpdesk---MLAI-hackathon-2026/actions/workflows/reproducibility.yml/badge.svg?branch=main)](https://github.com/Tienkhoaa2908/NSC-helpdesk---MLAI-hackathon-2026/actions/workflows/reproducibility.yml)
[![Node.js 22.13+ in 22.x or 24+](https://img.shields.io/badge/Node.js-22.13%2B%20%2822.x%29%20%7C%2024%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Next.js 15.5.29](https://img.shields.io/badge/Next.js-15.5.29-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React 19.1.1](https://img.shields.io/badge/React-19.1.1-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript 5.9.2](https://img.shields.io/badge/TypeScript-5.9.2-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MongoDB Node.js Driver 7.6.0](https://img.shields.io/badge/MongoDB%20Driver-7.6.0-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/docs/drivers/node/current/)
[![Gemini API](https://img.shields.io/badge/LLM-Gemini%20API-4285F4?logo=googlegemini&logoColor=white)](https://ai.google.dev/gemini-api/docs)
[![Identity](https://img.shields.io/badge/Identity-Demo%20ID%20%2B%20Password-555?logo=keycloak&logoColor=white)](docs/IDENTITY-SETUP.md)
[![Vercel deploy target](https://img.shields.io/badge/Deploy%20target-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/docs/deployments/overview)
[![Vitest 4.1.12](https://img.shields.io/badge/Unit%20tests-Vitest%204.1.12-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![Playwright 1.63.0](https://img.shields.io/badge/E2E-Playwright%201.63.0-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)

**Contents:** [My contributions](#my-contributions) · [Product workflow](#product-workflow) · [Architecture](#technical-architecture) · [Interface walkthrough](#interface-walkthrough) · [Run locally](#run-locally) · [Vietnamese](#phần-tiếng-việt)

## My contributions

### Policy-based request triage

I designed the policy runtime that converts structured request evidence into explainable decisions. The model extracts candidate facts into a validated contract; versioned server-side rules evaluate risk signals, authority, required information and routine handling conditions. Requests are classified as **ROUTINE**, **MISSING_INFO**, **BEYOND_AUTHORITY** or **SECURITY_RISK**. Cases that cannot be concluded carry an uncertainty label such as **MISSING_FACTS**, **OUT_OF_POLICY** or **AUTHORITY_REQUIRED**, along with a rationale and owner/team; a targeted requester or reviewer question is included where applicable. The model does not make the final policy decision or authorize an external action. This keeps model-assisted extraction, deterministic decision logic and human review as separate, testable parts of the workflow. The policy paths are checked against the 15-case judge dataset, the five-case Verify pack and regression tests; these are challenge checks, not a benchmark of live model quality. See [`policy-source.ts`](src/domain/policy-source.ts), [`policy.ts`](src/domain/policy.ts), the [judge cases](challenge/mlai-2026/data/verify/judge-15.json) and the [VNG Verify pack](challenge/mlai-2026/data/verify/support-v3.json).

### Requester and reviewer workflows

I contributed to the UI/UX design for request submission, preview and confirmation, follow-up and case tracking, as well as the Admin workspace for searching requests, inspecting evidence and recording actions. The requester interface presents guidance and status; reviewer-facing policy reasons and audit evidence stay in the review workflow. In-product guidance is organized around the task and role. Representative modules: [`support-workspace.tsx`](src/components/support-workspace.tsx), [`request-detail.tsx`](src/components/request-detail.tsx) and [`support-history.tsx`](src/components/support-history.tsx).

### Employee identity and account lifecycle

I built the demo employee-account workflow: an applicant submits a name and Gmail address and the server stores a pending request in MongoDB. Once the fixed bilingual templates are approved and SMTP is configured, the server notifies the system owner. If that notification fails, the request remains stored and appears in the Admin list with a delivery-failure status. The email link opens the private Admin request list; an authenticated Admin must explicitly approve or reject the request. Approval creates the Gmail address as the login ID and a random five-digit demo password. The server stores a bcrypt hash, sends the credentials and activates the account only after the mail operation succeeds. Rejections, delivery failures and retries are recorded in the audit log. Login uses opaque server-side sessions with an eight-hour server expiry and an HttpOnly session cookie; sign-out revokes the session. This demonstrates account lifecycle mechanics and is not production IAM or identity verification. See [`account-requests.ts`](src/services/account-requests.ts), [`identity-auth.ts`](src/lib/identity-auth.ts) and [account setup](docs/IDENTITY-SETUP.md).

### Support API and response orchestration

I implemented the server-side request and response path. The preview API validates and redacts input, uses the Gemini adapter for structured extraction and response drafting, then applies versioned deterministic policy and retrieves approved knowledge. The result can be routine guidance, a clarification request or a human handoff; model output cannot override policy or authorize an external action. A requester confirms the preview before the Support API persists a case and its audit events in MongoDB. Follow-up APIs preserve each case’s conversation, while a scoped tracking capability lets the requester read and continue that case. See [`preview/route.ts`](src/app/api/support/preview/route.ts), [`support.ts`](src/services/support.ts), [`policy.ts`](src/domain/policy.ts) and [`conversation-model.ts`](src/lib/conversation-model.ts).

### Controlled grouping of related requests

Eligible requests are grouped by a recognized FAQ topic or a site-scoped incident. Each requester keeps a separate case and tracking link. For eligible reply groups, an Admin can send one shared message to the current group; the system redacts the message, rechecks group membership before saving, and shows the reply on each member's case. Separately, incident groups accept predefined progress updates and remain active for up to 24 hours. These workflows do not merge individual cases. This is a product extension beyond the VNG challenge brief. See [`support-groups.ts`](src/lib/support-groups.ts) and [`support-incidents.ts`](src/lib/support-incidents.ts).

## Product workflow

1. **Submit:** A requester describes an issue in free text or through a guided category form. The server validates the input, redacts supported sensitive patterns and asks the model for structured facts.
2. **Evaluate:** Deterministic policy checks the extracted facts, evidence, risk and authority. Retrieval provides approved support guidance. Missing or unsafe evidence leads to a clarification or human review; a model failure does not become an approval.
3. **Preview and confirm:** The requester reviews the proposed response and next step. The request is stored only after confirmation.
4. **Continue:** The requester uses a tracking capability link to read the response, answer a clarification, add context or request human help. Each saved request keeps its own conversation and history. The token gates requester follow-up routes. When `SUPPORT_ACCESS_MODE=public-demo`, authenticated requester accounts can also explore Support review pages; the identity request list remains Admin-only.
5. **Review and audit:** Admins filter the queue, inspect the request and its evidence, choose an available action, and review the resulting audit history. Related cases may also receive a shared incident update.

## Technical architecture

- **Application:** Next.js App Router, React and TypeScript.
- **Model assistance:** Gemini supports structured request extraction and response drafting through the model adapter. The server validates outputs and retains final policy control. Google Search grounding is optional and separately configured.
- **Policy and safety:** Versioned deterministic rules handle risk, missing facts, authority and routing. Retrieval uses the application knowledge base; source and answer checks run before guidance is shown.
- **Persistence:** MongoDB stores support requests, events, incident groups, Verify runs and Identity records. Support and Identity can use separate configured databases.
- **Employee access:** Applicants submit a name and Gmail address. When email is approved and SMTP is configured, a fixed bilingual notification links to the Admin-only request list; an authenticated Admin explicitly approves or rejects the request. On approval, the server uses Gmail as the login ID, generates a random five-digit demo password, stores only its bcrypt hash and activates the account after the mail operation succeeds. Sessions use opaque tokens stored as hashes, an eight-hour server expiry and HttpOnly cookies; logout revokes the session. With `SUPPORT_ACCESS_MODE=public-demo`, authenticated requester accounts can explore Support review, audit and Verify; Identity request data and decisions remain Admin-only. This public reviewer mode must use synthetic support data. The public demo account is `guest01 / 12345`.
- **Requester tracking:** The server derives a stable HMAC token from a dedicated secret and request ID; MongoDB stores only its hash. At submission, the browser also supplies a random recovery proof whose hash is stored separately. That proof is used only by the receipt-recovery endpoint after an ambiguous submission; tracking and follow-up routes require the token. Support reviewer access requires an authenticated account in public-demo mode; identity request APIs remain Admin-only.
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
  A[Admin login] -->|Admin session| Q[Identity requests and decisions]
  Q --> DB
  U[ID/password login] --> ID[Requester or Admin session]
  O[Owner notification email] -->|Open private list| Q
  Q -->|Explicit approve/reject| E[Credential or decision email]
  ID --> DI[(MongoDB Identity)]
```

### Competition test cases

The challenge brief requires at least 15 test scenarios. The Verify page exposes five synthetic packs:

| Pack | Cases | Purpose |
| --- | ---: | --- |
| Judge dataset | 15 | Challenge scenarios covering missing information, out-of-policy requests, authority, security and mixed inputs. |
| Problem A / VNG | 5 | Three routine cases for automated guidance and two cases that must be escalated. |
| General | 4 | Shared challenge checks for routine guidance, missing information, scoped access and a public RDP risk. |
| Cache | 42 | Repeated and paraphrased FAQ requests plus controls to check cache hit, miss and bypass behavior. |
| Expansion | 30 | IT, HR and Commercial examples covering routine guidance, missing facts and human escalation. |

The 15-case judge dataset and five-case VNG pack satisfy the competition’s scenario and verification requirements. The remaining packs support general regression, cache and cross-department checks. All are synthetic application tests, not an independent benchmark of live model quality. See the [challenge brief](challenge/mlai-2026/CHALLENGE-BRIEF.md) and [MLAI dataset notes](challenge/mlai-2026/README.md).

## Interface walkthrough

The screenshots below were captured from the [official live deployment](https://nsclub-support-desk.vercel.app), not from another repository.

### Role selection and language

![Official Vietnamese homepage with sign-in, registration and role entry points](docs/images/official-home.png)

The home page routes requesters and Admin reviewers to their sign-in flow and includes account registration and a persistent language switch.

![Official English homepage](docs/images/official-home-en.png)

The English view translates the same entry points and help content.

### Sign-in and account requests

![Employee ID and password sign-in on the official website](docs/images/official-login.png)

Employees sign in with an issued ID or email and password. The public `guest01 / 12345` account can explore the Support review workspace in `public-demo` mode; that environment must contain synthetic data only.

![New account request form on the official website](docs/images/official-registration.png)

The request form collects a full name and Gmail address. The owner notification opens the private Admin list. After an Admin explicitly approves the request, the system emails a random five-digit demo password; Gmail becomes the employee login ID. The account is activated only after the mail operation succeeds.

![English account request form](docs/images/official-registration-en.png)

The same account request is available in English from the language switch.

### Requester workflow

![Requester usage guide on the official website](docs/images/official-employee-guide.png)

The guide explains how to sign in, describe a support issue, inspect the AI and policy preview, confirm the request, and continue from its tracking link. Previewing alone does not create a saved case.

![Requester guide in English](docs/images/official-employee-guide-en.png)

The system can provide routine guidance, request missing facts, or route a case for human review when evidence, policy, authority, or model availability does not support an automatic response.

### Admin review and audit

![Admin usage guide on the official website](docs/images/official-admin-guide.png)

The Admin guide covers queue triage, evidence review, allowed actions, incident updates, audit history and Verify. In `public-demo` mode, authenticated requester accounts can also explore Support review; only synthetic support data belongs in that environment. The identity request list and approval APIs remain Admin-only.

![Admin guide in English](docs/images/official-admin-guide-en.png)

The owner-only identity request list supports explicit approval and rejection. The notification email only opens the list; an authenticated Admin must choose an action. Approval emails a random five-digit demo password and uses the applicant’s Gmail address as the login ID. Applicant Gmail is not independently verified. This demo is not a substitute for an organization’s IAM or HR verification process.

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
- [Gemini configuration and key handling](docs/AI-CONFIGURATION.md) · [Employee login and account setup](docs/IDENTITY-SETUP.md)
- [MLAI 2026 judge testing guide](docs/JUDGE-ONBOARDING.md)
- [MLAI 2026 challenge workspace and datasets](challenge/mlai-2026/README.md)
- [Documentation index](docs/README.md)

## Demo scope

This is a demonstration system, not organization-wide IAM. Account applications collect a user-supplied name and Gmail address; the address is not independently verified before issuance. Identity requests and decisions are Admin-only. In `public-demo` mode, any authenticated requester account can use the Support review workspace, so that deployment must contain synthetic support data only. The public requester demo uses `guest01 / 12345`; five-digit passwords are for demonstration only. Do not submit real support cases or company-confidential data.

## Original competition repository

The team repository submitted to the competition is [dakiemdarktharr/nosleepclub-support-desk](https://github.com/dakiemdarktharr/nosleepclub-support-desk).

---

## Phần tiếng Việt

**Nội dung:** [Đóng góp](#đóng-góp-của-tôi) · [Quy trình](#quy-trình-sản-phẩm) · [Kiến trúc](#kiến-trúc-kỹ-thuật) · [Luồng giao diện](#một-số-luồng-giao-diện) · [Chạy local](#chạy-local)

> **MLAI Hackathon 2026:** Giải Nhất track VNG · Giải Ba chung cuộc. [Thông báo kết quả](https://www.facebook.com/hutechuniversity/posts/pfbid02aDmtNL88SKFYwZUSW7gRMWut1BLRCKFEPxb2ZkhA3j2vRQx8P5epe2AaP63dhZ82l) · [Trang cuộc thi](https://ai-network.hcmut.edu.vn/mlai2026)

NoSleepClub Support Desk là hệ thống hỗ trợ ứng dụng AI, được xây dựng cho đề bài **The Escalation Referee** của VNG tại MLAI Hackathon 2026. Sản phẩm chuyển yêu cầu ngôn ngữ tự nhiên thành quy trình có thể kiểm tra: tự xử lý trường hợp thường quy khi policy và bằng chứng cho phép, hỏi bổ sung thông tin còn thiếu, hoặc chuyển trường hợp có rủi ro hay yêu cầu thẩm quyền cho người phụ trách.

## Đóng góp của tôi

### Policy phân loại yêu cầu

Tôi thiết kế policy runtime chuyển dữ kiện yêu cầu có cấu trúc thành quyết định có thể giải thích. Mô hình trích xuất dữ kiện ứng viên theo hợp đồng đã được kiểm tra; các quy tắc phía máy chủ, được phiên bản hóa, đánh giá tín hiệu rủi ro, thẩm quyền, thông tin bắt buộc và điều kiện xử lý thường quy. Yêu cầu được phân loại thành **ROUTINE**, **MISSING_INFO**, **BEYOND_AUTHORITY** hoặc **SECURITY_RISK**. Trường hợp chưa thể kết luận có nhãn bất định như **MISSING_FACTS**, **OUT_OF_POLICY** hoặc **AUTHORITY_REQUIRED**, kèm lý do và đơn vị phụ trách; câu hỏi cụ thể cho người gửi hoặc reviewer được bổ sung khi phù hợp. Mô hình không đưa ra quyết định policy cuối cùng hay cấp phép thao tác bên ngoài. Cách tách này giúp kiểm thử riêng phần trích xuất có hỗ trợ mô hình, quyết định xác định và bước chuyển người xử lý. Các nhánh policy được đối chiếu với bộ 15 tình huống dành cho giám khảo, bộ Verify 5 tình huống và các kiểm thử hồi quy; đây là kiểm thử theo yêu cầu cuộc thi, không phải benchmark chất lượng model trực tiếp. Xem [`policy-source.ts`](src/domain/policy-source.ts), [`policy.ts`](src/domain/policy.ts), [bộ case giám khảo](challenge/mlai-2026/data/verify/judge-15.json) và [bộ VNG Verify](challenge/mlai-2026/data/verify/support-v3.json).

### Luồng người gửi và người xử lý

Tôi hỗ trợ thiết kế UI/UX cho các bước gửi, xem trước và xác nhận yêu cầu, hỏi tiếp và theo dõi hồ sơ; đồng thời cho không gian Admin tìm kiếm yêu cầu, kiểm tra bằng chứng và ghi nhận thao tác. Giao diện người gửi tập trung vào hướng dẫn và trạng thái; lý do policy và bằng chứng audit dành cho người xử lý nằm trong luồng review. Hướng dẫn trong sản phẩm được tổ chức theo tác vụ và vai trò. Một số module đại diện: [`support-workspace.tsx`](src/components/support-workspace.tsx), [`request-detail.tsx`](src/components/request-detail.tsx) và [`support-history.tsx`](src/components/support-history.tsx).

### Hệ thống ID nhân viên và vòng đời tài khoản

Tôi xây dựng luồng tài khoản demo gồm: người dùng gửi họ tên và Gmail; server lưu đơn chờ trong MongoDB. Khi mẫu email song ngữ được duyệt và SMTP cấu hình xong, server gửi thông báo cho chủ hệ thống. Nếu gửi thông báo thất bại, đơn vẫn được lưu và xuất hiện trong danh sách Admin với trạng thái lỗi gửi. Link trong email chỉ mở danh sách riêng; Admin phải đăng nhập rồi chủ động xác nhận hoặc từ chối. Khi xác nhận, server dùng Gmail làm ID, tạo mật khẩu demo ngẫu nhiên năm chữ số, lưu hash bcrypt, gửi thông tin đăng nhập và chỉ kích hoạt tài khoản sau khi thao tác gửi email thành công. Quyết định, lỗi gửi và lần thử lại được ghi audit. Phiên dùng token ngẫu nhiên phía server, lưu hash, hết hạn sau tám giờ và được thu hồi khi đăng xuất. Đây là luồng minh họa, không thay thế IAM hay xác minh danh tính doanh nghiệp. Xem [`account-requests.ts`](src/services/account-requests.ts), [`identity-auth.ts`](src/lib/identity-auth.ts) và [hướng dẫn thiết lập](docs/IDENTITY-SETUP.md).

### Support API và hệ thống tạo phản hồi

Tôi xây dựng luồng API xử lý yêu cầu từ đầu đến cuối. API preview kiểm tra và che dữ liệu đầu vào, dùng adapter Gemini để trích xuất dữ kiện và soạn phản hồi, sau đó áp policy xác định có phiên bản và truy xuất tri thức đã duyệt. Kết quả có thể là hướng dẫn thường quy, câu hỏi làm rõ hoặc chuyển cho người phụ trách; mô hình không thể ghi đè policy hay tự cấp quyền thao tác bên ngoài. Người gửi xem trước rồi xác nhận trước khi Support API lưu hồ sơ và audit vào MongoDB. Các API tiếp diễn giữ riêng hội thoại từng hồ sơ; token giới hạn quyền theo dõi và bổ sung thông tin của hồ sơ đó. Xem [`preview/route.ts`](src/app/api/support/preview/route.ts), [`support.ts`](src/services/support.ts), [`policy.ts`](src/domain/policy.ts) và [`conversation-model.ts`](src/lib/conversation-model.ts).

### Gom nhóm yêu cầu liên quan có kiểm soát

Các yêu cầu đủ điều kiện được gom theo chủ đề FAQ đã nhận diện hoặc sự cố gắn với một địa điểm. Mỗi người gửi vẫn có hồ sơ riêng và token theo dõi riêng cho hồ sơ đó. Với nhóm đủ điều kiện nhận phản hồi chung, Admin có thể gửi một nội dung cho các thành viên hiện tại; hệ thống che dữ liệu nhạy cảm, kiểm tra lại membership trước khi lưu và hiển thị phản hồi trên từng hồ sơ thành viên. Riêng nhóm sự cố nhận các cập nhật tiến độ theo trạng thái và hoạt động tối đa 24 giờ. Các luồng này không gộp hồ sơ cá nhân. Đây là phần mở rộng sản phẩm ngoài brief VNG. Xem [`support-groups.ts`](src/lib/support-groups.ts) và [`support-incidents.ts`](src/lib/support-incidents.ts).

## Quy trình sản phẩm

1. **Gửi yêu cầu:** Người gửi mô tả vấn đề bằng văn bản tự do hoặc chọn danh mục hỗ trợ. Server kiểm tra input, che các dạng dữ liệu nhạy cảm được hỗ trợ và yêu cầu mô hình trích xuất dữ kiện có cấu trúc.
2. **Đánh giá:** Policy xác định kiểm tra dữ kiện, bằng chứng, rủi ro và thẩm quyền. Retrieval cung cấp hướng dẫn hỗ trợ đã duyệt. Nếu thiếu bằng chứng hoặc có rủi ro, hệ thống hỏi bổ sung hoặc chuyển cho người xử lý; lỗi mô hình không được xem là phê duyệt.
3. **Xem trước và xác nhận:** Người gửi đọc phản hồi và bước tiếp theo được đề xuất. Hồ sơ chỉ được lưu sau khi người gửi xác nhận.
4. **Trao đổi tiếp:** Người gửi dùng liên kết có token theo dõi để đọc phản hồi, trả lời câu hỏi xác minh, bổ sung ngữ cảnh hoặc yêu cầu nhân viên hỗ trợ. Mỗi yêu cầu đã lưu giữ hội thoại và lịch sử riêng. Token giới hạn các API dành cho người gửi. Khi `SUPPORT_ACCESS_MODE=public-demo`, requester đã đăng nhập có thể trải nghiệm khu Support review; danh sách cấp ID vẫn chỉ dành cho Admin.
5. **Review và audit:** Admin lọc hàng đợi, mở hồ sơ, đối chiếu bằng chứng và kết quả policy, chọn thao tác phù hợp; lịch sử quyết định được ghi lại để tra cứu. Các hồ sơ liên quan cũng có thể nhận cập nhật chung về sự cố.

## Kiến trúc kỹ thuật

- **Ứng dụng:** Next.js App Router, React và TypeScript.
- **Hỗ trợ bằng mô hình:** Gemini hỗ trợ trích xuất yêu cầu có cấu trúc và soạn phản hồi qua model adapter. Server kiểm tra output và giữ quyền quyết định policy cuối cùng. Google Search grounding là tùy chọn và được cấu hình riêng.
- **Policy và an toàn:** Quy tắc xác định, có phiên bản, xử lý rủi ro, dữ kiện thiếu, thẩm quyền và định tuyến. Retrieval dùng kho tri thức của ứng dụng; nguồn và câu trả lời được kiểm tra trước khi hiển thị.
- **Lưu trữ:** MongoDB lưu yêu cầu, sự kiện, nhóm sự cố, lượt Verify và hồ sơ Identity. Support và Identity có thể dùng database riêng theo cấu hình.
- **Quyền truy cập nhân viên:** Người đăng ký gửi họ tên và Gmail; email thông báo song ngữ mở danh sách Admin riêng. Admin phải đăng nhập và xác nhận hoặc từ chối bằng thao tác rõ ràng. Khi cấp, Gmail là ID; server sinh mật khẩu demo ngẫu nhiên năm chữ số, lưu hash bcrypt và kích hoạt tài khoản sau khi gửi email thành công. Phiên dùng token opaque lưu hash, hết hạn phía server sau tám giờ và bị thu hồi khi đăng xuất. Ở chế độ `public-demo`, requester đã đăng nhập có thể trải nghiệm các trang/API review, audit và Verify; dữ liệu yêu cầu hỗ trợ phải là dữ liệu tổng hợp. Danh sách và thao tác cấp ID luôn chỉ dành cho Admin. Tài khoản mẫu là `guest01 / 12345`.
- **Theo dõi yêu cầu:** Server tạo token HMAC ổn định từ secret riêng và mã yêu cầu; MongoDB chỉ lưu hash token. Khi gửi, trình duyệt cũng cung cấp một proof ngẫu nhiên và hệ thống lưu hash riêng. Proof chỉ dùng ở API khôi phục receipt sau lần gửi không rõ kết quả; các route theo dõi và tiếp diễn chỉ cần token. API Support reviewer dùng phiên requester/Admin theo chế độ triển khai; API Identity review luôn chỉ dành cho Admin.
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
  A[Đăng nhập Admin] -->|Phiên Admin| Q[Hàng đợi, quyết định và audit]
  Q --> DB
  U[Đăng nhập bằng ID/mật khẩu] --> ID[Phiên người gửi hoặc Admin]
  O[Email thông báo Admin] -->|Mở danh sách riêng| Q
  Q -->|Duyệt hoặc từ chối rõ ràng| E[Email kết quả hoặc thông tin tài khoản]
  ID --> DI[(MongoDB Identity)]
```

### Bộ test case của cuộc thi

Brief yêu cầu tối thiểu 15 tình huống kiểm thử. Trang Verify hiện có năm bộ dữ liệu tổng hợp:

| Bộ | Số ca | Mục đích |
| --- | ---: | --- |
| Bộ giám khảo | 15 | Tình huống cuộc thi về thiếu dữ kiện, ngoài policy, thẩm quyền, an toàn và yêu cầu nhiều ý. |
| Đề A / VNG | 5 | Ba ca thường quy để tự động hướng dẫn và hai ca cần chuyển người xử lý. |
| Bộ chung | 4 | Kiểm tra hướng dẫn thường quy, dữ kiện thiếu, quyền truy cập có phạm vi và rủi ro mở RDP public. |
| Cache | 42 | Yêu cầu FAQ lặp lại hoặc diễn đạt khác nhau cùng các ca đối chứng để kiểm tra hit, miss và bypass. |
| Mở rộng | 30 | Tình huống IT, HR và Commercial gồm hướng dẫn thường quy, thiếu dữ kiện và chuyển người xử lý. |

Bộ 15 tình huống giám khảo và bộ VNG 5 ca đáp ứng yêu cầu tình huống và xác minh của cuộc thi. Các bộ còn lại hỗ trợ kiểm tra hồi quy tổng quát, cache và nhiều phòng ban. Tất cả là kiểm thử ứng dụng bằng dữ liệu tổng hợp, không phải benchmark độc lập về chất lượng model trực tiếp. Xem [brief cuộc thi](challenge/mlai-2026/CHALLENGE-BRIEF.md) và [ghi chú dataset MLAI](challenge/mlai-2026/README.md).

## Một số luồng giao diện

Ảnh dưới đây được chụp từ [website chính thức đang triển khai](https://nsclub-support-desk.vercel.app), không lấy từ repo khác.

### Chọn vai trò và ngôn ngữ

![Trang chủ tiếng Việt trên website chính thức với đăng nhập, đăng ký và lối vào theo vai trò](docs/images/official-home.png)

Trang chủ đưa người gửi và Admin đến luồng đăng nhập tương ứng, đồng thời có đăng ký tài khoản và nút đổi ngôn ngữ.

![Trang chủ tiếng Anh trên website chính thức](docs/images/official-home-en.png)

Phiên bản tiếng Anh giữ nguyên các lối vào và hướng dẫn tương ứng.

### Đăng nhập và yêu cầu cấp tài khoản

![Màn hình đăng nhập bằng ID nhân viên và mật khẩu](docs/images/official-login.png)

Nhân viên đăng nhập bằng ID hoặc email đã được cấp và mật khẩu. Tài khoản `guest01 / 12345` chỉ dùng để trải nghiệm với dữ liệu tổng hợp.

![Biểu mẫu yêu cầu cấp tài khoản trên website chính thức](docs/images/official-registration.png)

Biểu mẫu nhận họ tên và Gmail. Email thông báo dẫn tới danh sách Admin riêng; sau khi Admin chủ động xác nhận, hệ thống gửi mật khẩu demo ngẫu nhiên năm chữ số tới Gmail đã đăng ký. Gmail trở thành ID đăng nhập và tài khoản chỉ hoạt động sau khi gửi email thành công.

![Biểu mẫu yêu cầu cấp tài khoản bằng tiếng Anh](docs/images/official-registration-en.png)

Người dùng có thể chuyển biểu mẫu sang tiếng Anh bằng nút đổi ngôn ngữ.

### Luồng nhân viên

![Hướng dẫn sử dụng dành cho nhân viên trên website chính thức](docs/images/official-employee-guide.png)

Hướng dẫn mô tả cách đăng nhập, nêu vấn đề, kiểm tra preview AI và policy, xác nhận gửi rồi tiếp tục qua liên kết theo dõi. Chỉ xem preview chưa tạo hồ sơ đã lưu.

![Hướng dẫn nhân viên bằng tiếng Anh](docs/images/official-employee-guide-en.png)

Hệ thống có thể hướng dẫn tình huống thường quy, hỏi thêm dữ kiện còn thiếu hoặc chuyển hồ sơ cho người xử lý khi bằng chứng, policy, thẩm quyền hay khả năng model chưa đủ để tự trả lời.

### Admin review và audit

![Hướng dẫn sử dụng dành cho Admin trên website chính thức](docs/images/official-admin-guide.png)

Hướng dẫn Admin trình bày cách phân loại hàng đợi, đối chiếu bằng chứng, chọn thao tác được phép, cập nhật sự cố, xem audit và chạy Verify. Trong `public-demo`, requester đã đăng nhập cũng có thể trải nghiệm khu Support review; môi trường này chỉ dùng dữ liệu tổng hợp. Danh sách yêu cầu cấp ID và các thao tác quyết định chỉ dành cho Admin.

![Hướng dẫn Admin bằng tiếng Anh](docs/images/official-admin-guide-en.png)

Danh sách yêu cầu cấp tài khoản chỉ dành cho chủ hệ thống và có thao tác xác nhận hoặc từ chối rõ ràng. Email thông báo chỉ mở danh sách; Admin cần đăng nhập rồi chọn quyết định. Khi xác nhận, hệ thống gửi mật khẩu demo ngẫu nhiên gồm năm chữ số tới Gmail đã đăng ký và dùng Gmail làm ID. Email chưa được xác minh độc lập. Luồng demo này không thay thế IAM hay quy trình xác minh nhân sự của tổ chức.

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
- [Cấu hình Gemini và quản lý API key](docs/AI-CONFIGURATION.md) · [Đăng nhập và cấp tài khoản demo](docs/IDENTITY-SETUP.md)
- [Hướng dẫn kiểm thử dành cho ban giám khảo MLAI 2026](docs/JUDGE-ONBOARDING.md)
- [Workspace và dataset MLAI 2026](challenge/mlai-2026/README.md)
- [Mục lục tài liệu](docs/README.md)

## Phạm vi bản demo

Đây là hệ thống trình diễn, không phải IAM của tổ chức. Đơn cấp tài khoản thu họ tên và Gmail do người dùng cung cấp; Gmail chưa được xác minh độc lập trước khi cấp. Danh sách yêu cầu cấp ID và các quyết định chỉ dành cho Admin. Ở chế độ `public-demo`, requester đã đăng nhập có thể dùng khu Support review, vì vậy môi trường này chỉ được chứa dữ liệu tổng hợp. Tài khoản mẫu là `guest01 / 12345`; mật khẩu năm chữ số chỉ dành cho demo. Không gửi yêu cầu hỗ trợ thật hoặc dữ liệu bảo mật của công ty.

## Repo nhóm tham gia cuộc thi

Repository nhóm đã nộp dự thi: [dakiemdarktharr/nosleepclub-support-desk](https://github.com/dakiemdarktharr/nosleepclub-support-desk).
