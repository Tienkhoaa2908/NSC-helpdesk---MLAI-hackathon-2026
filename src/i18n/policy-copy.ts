import type { Locale } from "./types";

/** Exact, reviewed translations for prose emitted by deterministic policy code.
 * Unknown and model-authored text is returned unchanged. */
const knownEnglishCopy: Record<string, string> = {
  "Entitlement hiện tại không cho phép đúng resource và quyền yêu cầu.": "The current entitlement does not allow the requested resource and permission.",
  "Chưa xác minh được entitlement của người gửi cho đúng resource và quyền yêu cầu.": "The requester's entitlement for the requested resource and permission could not be verified.",
  "AUTH-ENTITLEMENT-001: chỉ nguồn entitlement server-side khớp danh tính và scope mới cho phép AUTO.": "AUTH-ENTITLEMENT-001: only a server-side entitlement source matching the identity and scope can authorize AUTO.",
  "Chờ IAM xác minh entitlement; lời khai trong ticket không thay thế nguồn này.": "Wait for IAM to verify the entitlement; statements in the ticket do not replace this source.",
  "Chưa xác minh được thời hạn truy cập nằm trong policy của service và mức rủi ro.": "The access duration has not been verified against the service policy and risk level.",
  "AUTH-TTL-001: quyền routine chỉ AUTO khi nguồn policy xác nhận TTL; không dùng thời hạn tự khai thay cho policy.": "AUTH-TTL-001: routine access can be AUTO only when a policy source confirms the TTL; a user-provided duration does not replace policy.",
  "IAM hoặc policy owner xác minh TTL trước khi cấp quyền.": "IAM or the policy owner must verify the TTL before access is granted.",
  "Approver không có thẩm quyền đã xác minh cho action và resource này.": "The approver's authority for this action and resource has not been verified.",
  "Yêu cầu approver có thẩm quyền phù hợp; không nhận ủy quyền ngoài hệ thống.": "Request approval from an appropriately authorized approver; do not accept delegation outside the system.",
  "Approval đang chờ quyết định; yêu cầu được giữ lại và chưa thực hiện.": "Approval is pending; the request is on hold and has not been carried out.",
  "AUTH-APPROVAL-PENDING: chờ registry và ITSM cập nhật cùng approval record; đánh giá lại khi trạng thái đổi.": "AUTH-APPROVAL-PENDING: waiting for the registry and ITSM to update the approval record; reevaluate when its status changes.",
  "Giữ request chờ; không thực thi trước khi approval được xác minh.": "Keep the request on hold; do not execute it until approval is verified.",
  "Approval đã bị thu hồi; dừng việc chưa thực hiện.": "Approval has been revoked; stop any work that has not been completed.",
  "Approval đã bị từ chối; request này không được thực hiện.": "Approval was rejected; this request must not be carried out.",
  "Không xác minh được approval hợp lệ cho đúng request.": "Valid approval for this request could not be verified.",
  "Thu hồi quyền/tài nguyên đã cấp nếu hệ thống cho phép; approval mới cần cho request tiếp theo.": "Revoke granted access or resources if the system allows it; the next request requires new approval.",
  "Đóng request hiện tại; request mới cần scope hoặc approval mới.": "Close the current request; a new request needs a new scope or approval.",
  "Chuyển reviewer xác minh nguồn approval; không dùng lời khai hoặc file đính kèm làm thay thế.": "Ask a reviewer to verify the approval source; statements or attachments are not substitutes.",
  "Chưa xác minh được quota và ngân sách hiện có cho nhóm tài nguyên này.": "The available quota and budget for this resource group have not been verified.",
  "Yêu cầu vượt quota hoặc ngân sách hiện có; cần người phụ trách xác nhận ngoại lệ.": "The request exceeds the available quota or budget; an owner must confirm an exception.",
  "Chờ Cloud/Capacity owner hoặc quota service xác minh; không cấp tài nguyên khi chưa có kết quả.": "Wait for the Cloud/Capacity owner or quota service to verify; do not provision resources before then.",
  "Reviewer xử lý ngoại lệ với Cloud/Capacity owner; không cấp vượt quota trước khi được xác minh.": "The reviewer must resolve the exception with the Cloud/Capacity owner; do not provision above quota before verification.",
  "Bổ sung các thông tin bên dưới.": "Provide the information below.",
  "Cần làm rõ yêu cầu để hướng dẫn đúng.": "More detail is needed to provide the right guidance.",
  "Trả lời câu hỏi làm rõ; chưa thực hiện thay đổi hoặc cấp quyền.": "Answer the clarification question; no change or access has been made.",
  "Cần nguồn dữ liệu có thể kiểm chứng trước khi thực hiện công việc.": "A verifiable data source is required before this work can proceed.",
  "INFO-EVIDENCE-001: thiếu artefact hoặc công cụ đọc nguồn; chưa có bản nháp hoàn chỉnh để review.": "INFO-EVIDENCE-001: a source artifact or reader tool is missing; there is no complete draft to review yet.",
  "Trợ lý có thể trả lời câu hỏi này trực tiếp.": "The assistant can answer this question directly.",
  "Đọc câu trả lời hoặc hỏi rõ hơn; chỉ chuyển nhân viên khi bạn yêu cầu.": "Read the answer or ask for clarification; a staff handoff happens only when you request it.",
  "Approval bị từ chối, hết hạn, không xác minh được hoặc sai phạm vi.": "Approval was rejected, expired, could not be verified, or does not match the required scope.",
  "Reviewer yêu cầu approval hợp lệ đúng scope; không nhận secret hoặc ảnh nhạy cảm.": "The reviewer must request valid approval for the correct scope; do not share secrets or sensitive images.",
  "Chưa ánh xạ được request vào service/owner trong policy.": "The request could not be mapped to a service owner in policy.",
  "Classifier/reviewer xác nhận service, owner và scope trước khi xử lý.": "The classifier or reviewer must confirm the service, owner, and scope before processing.",
  "Loại yêu cầu cloud này chưa có contract xử lý an toàn trong policy.": "This cloud request type does not yet have a safe handling contract in policy.",
  "Policy owner xác nhận phạm vi và quy trình tiếp nhận trước khi xử lý.": "The policy owner must confirm the scope and intake process before the request is handled.",
  "Có thể hướng dẫn các bước an toàn để bạn tự thực hiện.": "You can be guided through safe steps to complete this yourself.",
  "Làm theo hướng dẫn; có thể nhờ nhân viên hỗ trợ bất cứ lúc nào.": "Follow the guidance; you can ask support staff for help at any time.",
  "Đủ điều kiện tạo workflow mô phỏng trong phạm vi đã xác minh.": "Eligible to create a simulated workflow within the verified scope.",
  "Đã mô phỏng tiếp nhận; chưa có thao tác hạ tầng hay cấp quyền thật.": "Intake was simulated; no real infrastructure change or access grant was made.",
  "Approval đã xác minh đúng scope và vai trò cho action này.": "Approval has been verified for the scope and role required by this action.",
  "Một approver có thẩm quyền đã duyệt scope khớp; không yêu cầu dual control. Chỉ mô phỏng workflow, không thực thi production.": "An authorized approver approved the matching scope; dual control is not required. This only simulates a workflow and does not execute a production change.",
  "Ghi audit approval và scope; thao tác thật vẫn do hệ thống được cấp quyền thực hiện.": "Record the approval and scope in the audit log; an authorized system must perform any real action.",
  "Team phụ trách kiểm tra phạm vi và tiếp nhận xử lý; chưa có thao tác cấp quyền hoặc hạ tầng thật.": "The assigned team will review the scope and handle the request; no real access or infrastructure change has been made.",
  "Phạm vi này chưa có rule tự xử lý an toàn.": "There is no safe automatic handling rule for this scope.",
  "Chuyển team phụ trách xác nhận owner, scope và phương án an toàn.": "Route the request to the assigned team to confirm the owner, scope, and safe approach.",
  "Sự việc ở vị trí nào? Chỉ nêu khu vực cần hỗ trợ.": "Where did it happen? Provide only the area where support is needed.",
  "Bạn cần hỗ trợ cho khoảng thời gian nào? Không gửi hồ sơ riêng tư.": "What time period do you need help with? Do not send private records.",
  "Bạn muốn người phụ trách hỗ trợ kết quả gì? Chỉ nêu thông tin không nhạy cảm.": "What outcome do you need the owner to help with? Share only non-sensitive information.",
  "Bạn mô tả rõ hơn vấn đề và điều muốn được hướng dẫn được không?": "Could you describe the problem and what you would like guidance on?",
  "Vui lòng gửi từng yêu cầu một.": "Please submit one request at a time.",
  "Các lượt hướng dẫn vừa rồi chưa giúp bạn giải quyết được vấn đề. Mình đã chuyển yêu cầu cùng lịch sử cho nhân viên hỗ trợ.": "The recent guidance did not resolve the issue. The request and its history have been sent to support staff.",
  "Nhân viên hỗ trợ sẽ xem các bước đã thử và trao đổi tiếp tại yêu cầu này.": "Support staff will review the steps you tried and continue the conversation in this request.",
  "Có dấu hiệu nguy hiểm tại nơi làm việc; cần người phụ trách tại chỗ tiếp nhận ngay.": "There are signs of danger at the workplace; an on-site owner must respond immediately.",
  "không chờ bổ sung hoặc dùng hướng dẫn tự sửa.": "do not wait for additional information or use self-repair guidance.",
  "chỉ hướng dẫn chuẩn bị; không xác nhận chính sách, quyền lợi, phê duyệt hoặc thực thi.": "preparation guidance only; it does not confirm policy, benefits, approvals, or execution.",
  "không suy diễn dữ kiện còn thiếu.": "do not infer missing facts.",
  "không dùng quy tắc hạ tầng để duyệt nghiệp vụ công ty.": "do not use infrastructure rules to approve company business processes.",
  "Dừng thao tác, tránh khu vực nguy hiểm theo hướng dẫn an toàn tại chỗ và liên hệ lực lượng phụ trách qua kênh khẩn cấp đã xác minh. Không chờ phản hồi trong ứng dụng.": "Stop the task, stay clear of the hazard according to on-site safety guidance, and contact the responsible emergency team through a verified channel. Do not wait for an in-app response.",
  "Có thể hướng dẫn chuẩn bị yêu cầu và tìm quy trình nội bộ đã xác minh.": "Guidance can help prepare the request and locate a verified internal process.",
  "Làm theo hướng dẫn chuẩn bị; bộ phận có thẩm quyền xác nhận quy trình và kết quả nghiệp vụ.": "Follow the preparation guidance; the authorized department must confirm the process and business outcome.",
  "Cần thêm thông tin để đúng bộ phận tiếp nhận.": "More information is needed to route this to the right department.",
  "Người phụ trách kiểm tra yêu cầu và ghi nhận kết quả; hệ thống chưa thực thi nghiệp vụ bên ngoài.": "The owner will review the request and record the outcome; the system does not execute external business operations.",
  "Nhờ bộ phận phụ trách hỗ trợ trực tiếp qua kênh nội bộ đã xác minh; không gửi dữ liệu nhạy cảm vào kênh chung.": "Ask the responsible department for direct help through a verified internal channel; do not share sensitive data in a shared channel.",
  "Xác định được thông tin cần chuẩn bị và người phụ trách; kết quả nghiệp vụ vẫn cần bộ phận có thẩm quyền xác nhận.": "Identify the required information and owner; the authorized department must still confirm the business outcome.",
  "Không gửi hồ sơ cá nhân, thông tin thanh toán hoặc dữ liệu khách hàng vào kênh chung. Quy trình nội bộ cần được xác minh; ứng dụng chưa thực thi nghiệp vụ bên ngoài.": "Do not share personal records, payment information, or customer data in a shared channel. Verify internal processes with the owner; the app does not execute external business operations.",
  "Bạn cần làm rõ bước chuẩn bị nào hoặc muốn nhờ người phụ trách hỗ trợ trực tiếp?": "Which preparation step would you like clarified, or would you prefer direct help from the owner?",
  "Dừng lặp lại bước chưa hiệu quả và ghi lại phần còn vướng, không gửi dữ liệu cá nhân hoặc thông tin bí mật.": "Stop repeating ineffective steps and record what remains unresolved. Do not share personal or confidential information.",
  "Gửi đề nghị trong đúng phạm vi và chờ người có thẩm quyền xác nhận. Hướng dẫn này chưa duyệt chi phí, quyền lợi hoặc thay đổi hồ sơ.": "Submit the request within the correct scope and wait for an authorized person to confirm it. This guidance does not approve expenses, benefits, or record changes.",
  "Kiểm tra người phụ trách đã tiếp nhận, thời điểm phản hồi và kết quả thực tế; nếu còn vướng, giữ mã yêu cầu để hỏi tiếp.": "Check whether the owner has received the request, when they expect to respond, and the actual outcome. Keep the request ID if you need to follow up.",
  "Chuẩn bị loại thủ tục, mốc thời gian và điều muốn được hỗ trợ; không gửi hồ sơ cá nhân hoặc thông tin sức khỏe vào kênh chung.": "Prepare the type of process, relevant dates, and the help you need. Do not share personal records or health information in a shared channel.",
  "Chỉ nêu loại thắc mắc và kỳ liên quan. Phiếu lương, thuế cá nhân, hồ sơ bảo hiểm và thông tin ngân hàng cần kênh riêng đã xác minh.": "State only the type of question and relevant period. Payslips, personal tax, insurance records, and bank details must use a verified private channel.",
  "Chuẩn bị loại chi phí, kỳ phát sinh và mã chứng từ không nhạy cảm. Chỉ gửi bản chứng từ đầy đủ qua kênh tài chính đã xác minh.": "Prepare the expense type, relevant period, and a non-sensitive voucher reference. Send full documents only through a verified finance channel.",
  "Nêu nhu cầu sử dụng, số lượng dự kiến và thời điểm cần. Báo giá hoặc nhà cung cấp chưa được xác minh không được coi là đã được duyệt.": "State the intended use, estimated quantity, and required date. Unverified quotes or suppliers must not be treated as approved.",
  "Nêu vị trí và hiện tượng quan sát được. Không tự sửa điện, tháo thiết bị hoặc xử lý khu vực có dấu hiệu nguy hiểm.": "State the location and observed issue. Do not repair electrical equipment, dismantle devices, or enter an area that appears hazardous.",
  "Chuẩn bị loại dịch vụ, thời gian và địa điểm cần hỗ trợ; chỉ sử dụng danh bạ hoặc cổng nội bộ đã được tổ chức xác minh.": "Prepare the service type, time, and location where help is needed. Use only directories or internal portals verified by the organization.",
  "Nêu loại hồ sơ và mục tiêu cần rà soát. Nội dung hợp đồng, thông tin đối tác và phản ánh riêng tư cần được trao đổi qua kênh bảo mật của người phụ trách.": "State the document type and review objective. Contracts, partner details, and private reports must be discussed through the owner's secure channel.",
  "Nêu loại hỗ trợ, mốc thời gian và mã tham chiếu được phép chia sẻ; không đăng danh sách khách hàng, giá riêng hoặc dữ liệu hợp đồng lên kênh chung.": "State the type of support, relevant dates, and a shareable reference. Do not post customer lists, confidential pricing, or contract data in a shared channel.",
  "Chuẩn bị mục tiêu, đối tượng, kênh và hạn cần. Nội dung phải qua người có thẩm quyền trước khi phát hành hoặc gửi ra ngoài.": "Prepare the objective, audience, channel, and deadline. Content must be reviewed by an authorized person before publication or external distribution.",
  "Chỉ nêu loại vấn đề và mã hồ sơ không nhạy cảm. Thông tin khách hàng, lịch sử giao dịch và xác minh danh tính cần kênh chuyên trách.": "State only the issue type and a non-sensitive case reference. Customer information, transaction history, and identity verification must use a dedicated channel.",
  "Nêu sản phẩm hoặc dự án, mục tiêu và phạm vi cần phối hợp. Dẫn mã công việc được phép chia sẻ; không suy ra tiến độ khi chưa đọc nguồn thực tế.": "State the product or project, objective, and coordination scope. Share only an approved work reference; do not infer progress without checking the source.",
  "Nêu câu hỏi kinh doanh, kỳ báo cáo và nguồn được phép sử dụng. Quyền dữ liệu và phạm vi chia sẻ phải được chủ sở hữu xác nhận.": "State the business question, reporting period, and approved source. The data owner must confirm access and sharing scope.",
  "Chuẩn bị mục tiêu học, khóa học mong muốn và thời gian dự kiến. Ngân sách hoặc thời gian học cần người phụ trách xác nhận.": "Prepare the learning goal, preferred course, and expected timing. The owner must confirm any budget or time allocation.",
  "Nêu mục đích, địa điểm, thời gian và số người dự kiến. Không tự đặt dịch vụ trả phí hoặc xác nhận chi phí trước phê duyệt.": "State the purpose, location, dates, and expected number of attendees. Do not book paid services or confirm expenses before approval.",
  "Ưu tiên an toàn tại chỗ, nêu vị trí nếu có thể làm an toàn. Không chờ phản hồi của ứng dụng để ứng phó nguy hiểm đang xảy ra.": "Prioritize on-site safety and provide the location if safe to do so. Do not wait for an app response during an active hazard.",
  "Yêu cầu chứa hoặc xin thông tin xác thực; chỉ giữ bằng chứng đã che.": "The request contains or asks for credentials; retain only redacted evidence.",
  "Mở truy cập từ Internet cần Security và Network xem xét.": "Exposing access to the Internet requires review by Security and Network.",
  "Không tự tắt MFA, EDR, audit hoặc kiểm soát bảo mật.": "Do not disable MFA, EDR, auditing, or other security controls.",
  "Không bỏ qua quy trình phê duyệt hoặc change control.": "Do not bypass the approval or change-control process.",
  "Chỉ dẫn trong ticket không có quyền thay đổi policy.": "Instructions in a ticket do not authorize policy changes.",
  "Xuất dữ liệu tới đích chưa kiểm soát cần Security và Data owner.": "Exporting data to an unmanaged destination requires review by Security and the Data Owner.",
  "Phần mềm chưa được duyệt cần kiểm tra an toàn.": "Unapproved software must undergo a security review.",
  "Xóa bảng hoặc dữ liệu trên database production có nguy cơ mất dữ liệu; cần Security/DBA xem xét.": "Deleting tables or data in a production database risks data loss and requires review by Security or a DBA.",
  "Quyền đặc quyền cần reviewer và owner có thẩm quyền.": "Privileged access requires review and an authorized owner.",
  "Truy cập dữ liệu hoặc thay đổi production cần reviewer.": "Production data access or changes require review.",
  "Thay đổi cấu hình, quota hoặc control cần owner xác nhận.": "Configuration, quota, or control changes require owner confirmation.",
  "Các dữ kiện mâu thuẫn; giữ cả hai để reviewer xác nhận.": "The facts conflict; retain both for reviewer confirmation.",
  "Thao tác xóa dữ liệu, wipe hoặc thay thiết bị cần admin.": "Data deletion, wiping, or device replacement requires an administrator.",
  "Incident cần chuyên viên xác định tác động và phương án xử lý.": "An incident specialist must assess the impact and response plan.",
  "Bạn muốn người phụ trách hỗ trợ trực tiếp; lịch sử được giữ cho admin.": "You requested direct help from an owner; the history is retained for the administrator.",
  "Lý do: Trợ lý AI chưa sẵn sàng hoặc chưa kịp phản hồi. Vì vậy, yêu cầu sẽ được chuyển cho người phụ trách xem xét.": "Reason: The AI assistant is unavailable or did not respond in time. The request has been sent to an owner for review.",
  "Model trả dữ liệu không đúng schema hoặc hướng dẫn ngoài phạm vi an toàn.": "The model returned data that did not match the schema or guidance outside the safe scope.",
  "Không xác minh được bằng chứng hoặc phạm vi do model trích xuất.": "The evidence or scope extracted by the model could not be verified.",
  "Đọc hoặc xuất dữ liệu production cần DBA/Data owner xác nhận quyền và phạm vi.": "Reading or exporting production data requires a DBA or Data Owner to confirm access and scope.",
  "Yêu cầu cấp tài nguyên còn thiếu cấu hình hoặc thời hạn; cần team phụ trách kiểm tra trước khi cấp.": "The resource request is missing configuration or duration details; the assigned team must review it before provisioning.",
  "Team Infra/DBA xác nhận cấu hình, thời hạn sử dụng và phê duyệt trước khi cấp tài nguyên.": "The Infra/DBA team must confirm the configuration, duration, and approval before provisioning resources.",
  "Cấp quyền VPN cần Network xác nhận phạm vi và cấu hình trước khi thực hiện.": "Network must confirm the scope and configuration before VPN access is granted.",
  "Cấp database mới cần DBA xác nhận cấu hình và phương án vận hành.": "A DBA must confirm the configuration and operating plan before a new database is provisioned.",
  "Phạm vi quyền nội dung này cần IAM và owner tài nguyên xử lý trước khi cấp.": "IAM and the resource owner must review this content-access scope before access is granted.",
  "Request thuộc Security phải qua security/reviewer flow.": "Security requests must go through the security reviewer workflow.",
  "Cần thêm dữ kiện cụ thể để đánh giá đúng phạm vi.": "More specific facts are needed to evaluate the scope.",
  "Reviewer kiểm tra evidence và phạm vi; hệ thống không thực hiện thay đổi thật.": "The reviewer checks the evidence and scope; the system does not make real changes.",
  "Dừng việc chưa thực hiện; thu hồi quyền/tài nguyên đã cấp khi có thể và yêu cầu approval mới.": "Stop any unfinished work, revoke granted access or resources if possible, and request new approval.",
  "Đóng request này; request mới cần scope hoặc approval mới.": "Close this request; a new request needs a new scope or approval.",
  "Đóng request hiện tại; nếu scope hoặc approval đổi, hãy tạo request mới để xác minh lại.": "Close the current request; if the scope or approval changes, create a new request for verification.",
  "Dừng phần chưa thực hiện và thu hồi quyền/tài nguyên đã cấp khi có thể; approval mới nào cho phép tiếp tục?": "Stop any unfinished work and revoke granted access or resources if possible. What new approval authorizes the next step?",
  "Nếu scope hoặc approval thay đổi, hãy tạo request mới để xác minh lại.": "If the scope or approval changes, create a new request for verification.",
  "Cloud/Capacity owner xác nhận quota và ngân sách còn lại của project/team, gồm tài nguyên đang hoạt động, ở nguồn nào?": "Which source can the Cloud/Capacity owner use to confirm the project's or team's remaining quota and budget, including active resources?",
  "Cloud/Capacity owner có thể duyệt ngoại lệ quota/ngân sách nào cho project/team và thời hạn sử dụng?": "What quota or budget exception can the Cloud/Capacity owner approve for the project or team, and for what duration?",
  "Chủ chính sách xác nhận quy định áp dụng hoặc ngoại lệ nào cho dịch vụ và mục tiêu này? Nhóm nào được giao tiếp nhận?": "Which policy or exception applies to this service and goal, and which team owns the request?",
  "Chủ chính sách có quy định nào áp dụng cho phạm vi này, hay cần xét ngoại lệ? Phương án an toàn được cho phép là gì?": "Which policy applies to this scope, or does it require an exception? What safe approach is permitted?",
  "Người phụ trách an toàn tại chỗ đã được báo và tiếp nhận chưa?": "Has the on-site safety owner been notified and taken over?",
  "Tên, nguồn phát hành, chữ ký và lựa chọn đã được catalog phê duyệt là gì?": "What are the software name, publisher, signature, and approved catalog alternative?",
  "Kiểm soát nào đang gây vướng và phương án chẩn đoán nào giữ nguyên kiểm soát đó?": "Which control is causing the issue, and what diagnostic approach keeps it enabled?",
  "Mục tiêu nghiệp vụ thực tế và approval có thể xác minh, tách khỏi chỉ dẫn trong ticket, là gì?": "What is the actual business goal and verifiable approval, separate from instructions in the ticket?",
  "Dữ kiện nào là đúng cho service, environment, action, resource và quyền yêu cầu?": "Which facts are correct for the service, environment, action, resource, and requested permission?",
  "Asset, thời điểm, tác động và bằng chứng an toàn nào cần chuyển cho incident responder?": "Which asset, timing, impact, and safe evidence should be sent to the incident responder?",
  "Bạn muốn người phụ trách hỗ trợ mục tiêu cụ thể nào trước tiên?": "What specific goal would you like the owner to help with first?",
  "Xem, tạo, bình luận; chỉ sửa và chuyển trạng thái ticket được giao theo workflow được phép, trong project được cấp.": "View, create, and comment; edit and transition only assigned tickets through permitted workflows in the granted project.",
  "Xem hàng đợi được cấp, tạo và bình luận; chỉ sửa và chuyển trạng thái ticket được giao theo workflow được phép.": "View the granted queue, create, and comment; edit and transition only assigned tickets through permitted workflows.",
  "Reviewer có thể phân loại request từ evidence đã redact này không?": "Can a reviewer classify the request from this redacted evidence?",
  "Reviewer xác nhận loại secret đã bị che và kênh xử lý sự cố bảo mật phù hợp nào?": "Can the reviewer confirm the redacted secret type and the appropriate security incident channel?",
  "Source, target, port/protocol và phương án không public an toàn hơn là gì?": "What are the source, target, port or protocol, and a safer non-public alternative?",
  "Approval/change record có thể xác minh cho đúng resource, action và thời hạn là gì?": "Which verifiable approval or change record matches the resource, action, and duration?",
  "Dataset, destination được quản lý, retention và căn cứ cho phép xuất dữ liệu là gì?": "What dataset, managed destination, retention period, and authorization basis apply to this export?",
  "Những bảng và dữ liệu nào sẽ bị xóa? Security/DBA đã duyệt phương án xử lý và kiểm tra khả năng khôi phục từ backup chưa?": "Which tables and data will be deleted? Have Security or a DBA approved the plan and checked recovery from backup?",
  "Quyền tối thiểu thay thế là gì và owner nào phê duyệt đúng scope/thời hạn?": "What is the least-privileged alternative, and which owner can approve the required scope and duration?",
  "Phạm vi production, rollback và approval đúng thẩm quyền có thể xác minh là gì?": "What production scope, rollback plan, and verifiable approval from an authorized approver apply?",
  "Owner, phạm vi thay đổi, rollback và approval reference cụ thể là gì?": "Who is the owner, what is the change scope and rollback plan, and what is the approval reference?",
  "Backup, phạm vi dữ liệu bị ảnh hưởng và người có thẩm quyền phê duyệt là gì?": "What backup, affected data scope, and authorized approver apply?",
  "IAM xác nhận danh tính người gửi, resource, quyền và environment nào đang được entitlement cho phép?": "Which requester identity, resource, permission, and environment does IAM confirm as entitled?",
  "Policy owner xác nhận TTL mặc định theo service và mức rủi ro nào cho quyền này?": "What default TTL does the policy owner confirm for this service and risk level?",
  "Xác minh approver có role mapping cho đúng resource, action và environment không?": "Verify that the approver's role mapping covers the correct resource, action, and environment.",
  "Dừng phần chưa thực hiện và thu hồi quyền đã cấp khi có thể; record mới nào cho phép tiếp tục?": "Stop unfinished work and revoke granted access if possible. Which new record authorizes continuation?",
  "Xác minh record approval trên registry và ITSM, cùng danh tính, scope, environment và purpose.": "Verify the approval record in the registry and ITSM, including identity, scope, environment, and purpose.",
  "DBA/Data owner đã duyệt những bảng nào, mức quyền nào và thời hạn đến khi nào?": "Which tables, permission level, and duration have the DBA or Data Owner approved?",
  "Dữ liệu sẽ được lưu ở đâu và giữ trong bao lâu?": "Where will the data be stored, and for how long?",
  "Infra/DBA đề xuất cấu hình CPU, RAM, dung lượng đĩa và thời hạn sử dụng nào phù hợp với công việc này?": "What CPU, RAM, disk capacity, and duration should Infra or the DBA recommend for this work?",
  "Network đã xác nhận thiết bị, mạng đích, profile VPN và thời điểm thu hồi quyền chưa?": "Has Network confirmed the device, destination network, VPN profile, and access revocation time?",
  "DBA đã xác nhận cấu hình, workload, backup và ngày thu hồi database chưa?": "Has the DBA confirmed the configuration, workload, backup, and database removal date?",
  "Owner đã xác nhận project/space/page, mức quyền tối thiểu và thời điểm thu hồi chưa?": "Has the owner confirmed the project, space, or page, least-privilege access, and revocation time?",
  "Security owner xác nhận asset, evidence, impact và requested action cụ thể nào?": "Which asset, evidence, impact, and requested action does the Security owner confirm?",
  "Có thể dùng VPN hoặc giới hạn địa chỉ nguồn thay vì public không?": "Can you use a VPN or restrict source addresses instead of making this public?",
  "Ai chịu trách nhiệm phê duyệt và đóng kết nối sau thời hạn?": "Who is responsible for approval and closing the connection after the requested period?",
  "Thông tin bí mật đã lộ cần được thu hồi ở hệ thống nào? Không yêu cầu người dùng gửi lại giá trị.": "Which system must revoke the exposed secret? Do not ask the user to resend its value.",
  "Ai có thẩm quyền duyệt hệ thống này? Quyền tối thiểu và thời hạn nào đáp ứng công việc?": "Who is authorized to approve this system? What least-privilege access and duration meet the need?",
  "Mã phê duyệt, phạm vi tài nguyên và kế hoạch khôi phục đã được xác minh chưa?": "Have the approval reference, resource scope, and recovery plan been verified?",
  "Xác nhận phạm vi và người có thẩm quyền xử lý.": "Confirm the scope and the person authorized to handle it.",
  "Job này dự kiến cần bao nhiêu GB RAM? Nếu chưa đo được, bạn có thể gửi thông tin workload để team kiểm tra.": "How much RAM, in GB, is expected for this job? If it is not measured yet, share workload details for the team to review.",
  "Bạn cần bao nhiêu vCPU? Nếu chưa rõ, cho mình biết loại job và tải dự kiến để team Infra chọn cấu hình.": "How many vCPUs do you need? If unsure, describe the job type and expected load so Infra can choose a configuration.",
  "Bạn cần bao nhiêu GB đĩa cho dữ liệu và file tạm?": "How much disk space, in GB, is needed for data and temporary files?",
  "Bạn dự kiến dùng tài nguyên đến khi nào? Có thể ghi số giờ/ngày hoặc ngày thu hồi cụ thể.": "How long do you expect to use the resource? Specify hours, days, or a removal date.",
  "Bạn cần chỉ đọc code hay có quyền đẩy branch lên repo?": "Do you need read-only code access, or permission to push a branch to the repository?",
  "Bạn cần quyền ở project, space hoặc trang nào? Gửi tên hoặc mã tài nguyên, không gửi nội dung nhạy cảm.": "Which project, space, or page needs access? Provide its name or resource ID, not sensitive content.",
  "Bạn cần xem issue, tạo issue hay chuyển trạng thái ticket?": "Do you need to view issues, create issues, or change ticket status?",
  "Bạn cần đọc, bình luận hay sửa nội dung trang?": "Do you need to read, comment on, or edit page content?",
  "Bạn cần xem, tạo ticket hay sửa nội dung trong ứng dụng này?": "Do you need to view or create tickets, or edit content in this application?",
  "Khi kết nối cơ sở dữ liệu, bạn thấy thông báo lỗi gì? Chép mã lỗi, không gửi chuỗi kết nối hoặc mật khẩu.": "What error appears when connecting to the database? Copy the error code, but do not share a connection string or password.",
  "Dữ liệu sẽ được lưu hoặc gửi đến đâu? Nêu khu vực lưu trữ được công ty quản lý, không gửi dữ liệu thật.": "Where will the data be stored or sent? Name a company-managed storage area; do not provide real data.",
  "Nếu thao tác không đạt kết quả, ai phụ trách khôi phục và bản sao lưu nào đã sẵn sàng?": "If the operation fails, who is responsible for recovery, and which backup is ready?",
  "Ứng dụng cần dùng cổng số nào? Nếu chưa biết, nêu tên ứng dụng để nhân viên kiểm tra giúp.": "Which port number does the application need? If you are unsure, provide its name for staff to check.",
  "Thiết bị hoặc mạng nào bắt đầu kết nối? Đây là mạng công ty, VPN hay bên ngoài?": "Which device or network initiates the connection? Is it a company network, VPN, or external network?",
  "Bạn cần kết nối tới ứng dụng hoặc máy chủ nào?": "Which application or server do you need to connect to?",
  "Ứng dụng dùng giao thức nào (ví dụ HTTPS)? Nếu chưa rõ, bạn có thể nói chưa biết.": "Which protocol does the application use (for example, HTTPS)? If unsure, say that you do not know.",
  "Bạn cần hoàn thành công việc nào bằng tài nguyên hoặc phần mềm này?": "What work do you need to complete with this resource or software?",
  "Sandbox này cần tự động xóa sau TTL (ephemeral) hay phải tồn tại lâu dài?": "Should this sandbox be deleted automatically after its TTL, or must it persist?",
  "Sandbox chỉ dùng dữ liệu synthetic/không nhạy cảm chứ? Không đưa dữ liệu khách hàng, secret hoặc dữ liệu regulated vào.": "Will the sandbox use only synthetic or non-sensitive data? Do not add customer data, secrets, or regulated data.",
  "Chỉ bạn gặp lỗi hay đồng nghiệp cũng bị? Công việc nào đang bị gián đoạn?": "Are only you affected, or are colleagues affected too? Which work is interrupted?",
  "Lỗi bắt đầu lúc nào và còn xảy ra liên tục hay thỉnh thoảng?": "When did the issue start, and is it continuous or intermittent?",
  "Bạn muốn làm được việc gì, và hiện đang vướng ở bước nào?": "What are you trying to do, and where are you blocked?",
  "Vấn đề xảy ra trên ứng dụng hoặc thiết bị nào?": "Which application or device is affected?",
  "Bạn muốn khởi động lại (không xóa file) hay khôi phục cài đặt gốc (có thể mất dữ liệu)?": "Do you want to restart without deleting files, or restore factory settings, which may cause data loss?",
  "Bạn cần hỗ trợ hệ thống nào? Ví dụ: PostgreSQL hoặc tên ứng dụng.": "Which system do you need help with? For example, PostgreSQL or an application name.",
  "Bạn cần dùng ứng dụng hoặc hệ thống nào?": "Which application or system do you need to use?",
  "Bạn cần dùng cơ sở dữ liệu, bảng hoặc tài nguyên nào?": "Which database, table, or resource do you need to use?",
  "Đây là hệ thống thử nghiệm hay đang vận hành thật? Nếu chưa rõ, chọn Tôi không biết.": "Is this a test system or a live production system? If unsure, select “I don't know.”",
  "Bạn cần dùng trong bao lâu? Ví dụ: 2 giờ.": "How long do you need access? For example, two hours.",
  "Bạn cần thực hiện công việc gì?": "What work do you need to perform?",
  "Bạn cần chỉ xem hay chỉnh sửa dữ liệu?": "Do you need read-only access or permission to edit data?",
  "Bạn có mã phê duyệt cho yêu cầu này không?": "Do you have an approval reference for this request?",
  "Bạn gặp lỗi gì? Có thông báo nào trên màn hình?": "What issue are you seeing? Is there an on-screen error message?",
  " và giới hạn user nếu được cấu hình": " and the user limit if configured",
  "Approval đã bị thu hồi.": "Approval has been revoked.",
  "Approval đã bị từ chối.": "Approval was rejected.",
  "Làm rõ thông tin còn thiếu trước khi chọn hướng dẫn phù hợp.": "Clarify the missing information before selecting appropriate guidance.",
  "Bạn có mã phê duyệt mới cho đúng hệ thống và thời hạn cần dùng không?": "Do you have a new approval reference for the correct system and required duration?",
  "Xác minh người duyệt, phạm vi tài nguyên, quyền và thời hạn trên hệ thống phê duyệt.": "Verify the approver, resource scope, permission, and duration in the approval system.",
  "Bạn muốn làm được việc gì và vấn đề xảy ra ở ứng dụng nào?": "What are you trying to do, and in which application is the problem occurring?",
  "AUTH-005: classifier/reviewer phải xác định owner; không tự phê duyệt khi chưa rõ owner.": "AUTH-005: the classifier or reviewer must identify the owner; do not approve automatically while ownership is unknown.",
  "Cloud policy owner xác nhận service, owner, facts bắt buộc và giới hạn áp dụng cho loại yêu cầu này?": "Can the cloud policy owner confirm the service, owner, required facts, and limits for this request type?",
  "AUTH-005: không áp dụng quota hoặc AUTO provisioning rule cho cloud intent chưa được cấu hình.": "AUTH-005: do not apply quota or AUTO provisioning rules to an unconfigured cloud intent.",
  "AUTH-005: không có safe execution path; reviewer xác định authority và integration.": "AUTH-005: no safe execution path is defined; a reviewer must determine authority and integration.",
  "Reviewer xác nhận service, intent và scope canonical nào từ evidence?": "Which canonical service, intent, and scope does the reviewer confirm from the evidence?",
  "Reviewer xác nhận fact nào được evidence hỗ trợ trực tiếp?": "Which facts are directly supported by the evidence, according to the reviewer?",
  "Direct database/data access hoặc export production luôn cần Data owner và reviewer.": "Direct production database or data access and exports always require approval from the Data Owner and a reviewer.",
  "Data scope, destination, retention và approval đúng vai trò cho production là gì?": "What are the production data scope, destination, retention period, and role-appropriate approval?",
};

const knownPolicyFragments = Object.entries(knownEnglishCopy)
  .filter(([vi]) => vi.length >= 18)
  .sort(([a], [b]) => b.length - a.length);

const companyTeams: Record<string, string> = {
  "Nhân sự": "Human Resources",
  "Lương & phúc lợi": "Payroll & Benefits",
  "Tài chính / Kế toán": "Finance / Accounting",
  "Mua sắm": "Procurement",
  "Cơ sở vật chất": "Workplace Facilities",
  "Hành chính": "Corporate Administration",
  "Pháp chế / Tuân thủ": "Legal / Compliance",
  "Kinh doanh / Đối tác": "Business / Partnerships",
  "Marketing / Truyền thông": "Marketing / Communications",
  "Chăm sóc khách hàng / Vận hành": "Customer Operations",
  "Sản phẩm / Quản lý dự án": "Product / Project Management",
  "Phân tích dữ liệu / Chủ sở hữu dữ liệu": "Data Analytics / Data Owner",
  "Đào tạo / Phát triển nhân sự": "Learning & Development",
  "Công tác / Sự kiện": "Travel / Events",
  "An toàn / An ninh cơ sở": "Workplace Safety / Site Security",
};

const companyTopicNamesEnglish: Record<string, string> = {
  "Phản ánh quan hệ lao động": "workplace relations concern",
  "Nghỉ phép": "leave request",
  "Chấm công & giờ làm": "attendance and working hours",
  "Giấy xác nhận & hồ sơ nhân sự": "employment documents and records",
  "Nhận việc & nghỉ việc": "onboarding and offboarding",
  "Tuyển dụng & giới thiệu ứng viên": "recruiting and candidate referrals",
  "Thay đổi thông tin nhận lương": "payroll bank details change",
  "Phiếu lương & chênh lệch lương": "payslip or payroll discrepancy",
  "Bảo hiểm & chế độ": "insurance and benefits",
  "Chứng từ & quyết toán thuế cá nhân": "personal tax documents and filing",
  "Phúc lợi & quyền lợi": "employee benefits",
  "Hoàn ứng & thanh toán chi phí": "expense reimbursement and payment",
  "Hóa đơn & chứng từ": "invoices and accounting documents",
  "Theo dõi thanh toán & công nợ": "payment status and accounts receivable or payable",
  "Ngân sách & mã chi phí": "budgets and cost centers",
  "Thuế & đối soát doanh nghiệp": "corporate tax and reconciliation",
  "Đề nghị mua hàng & thiết bị": "purchase and equipment requests",
  "Đăng ký & đánh giá nhà cung cấp": "vendor registration and review",
  "Báo giá & lựa chọn nhà cung cấp": "quotes and vendor selection",
  "Đơn mua hàng & giao nhận": "purchase orders and delivery",
  "Gia hạn dịch vụ & hợp đồng mua": "service and procurement contract renewal",
  "Điều hòa, điện, nước & sửa chữa": "air conditioning, electrical, plumbing, and repairs",
  "Phòng họp & không gian làm việc": "meeting rooms and workspace",
  "Vệ sinh & môi trường làm việc": "cleaning and workplace environment",
  "Gửi xe & thẻ ra vào": "parking and building access cards",
  "Chỗ ngồi & chuyển văn phòng": "seating and office moves",
  "Bưu phẩm & chuyển phát": "mail and courier",
  "Khách đến văn phòng": "office visitors",
  "Văn phòng phẩm & dịch vụ dùng chung": "office supplies and shared services",
  "Đóng dấu & văn thư": "company seals and records management",
  "Suất ăn & dịch vụ nhân viên": "meals and employee services",
  "Đạo đức, gian lận & phản ánh bảo mật": "ethics, fraud, and confidential reports",
  "Dữ liệu cá nhân & quyền riêng tư": "personal data and privacy",
  "Rà soát hợp đồng & NDA": "contract and NDA review",
  "Sở hữu trí tuệ & bản quyền nội dung": "intellectual property and content copyright",
  "Tra cứu quy định & tuân thủ": "policy and compliance inquiries",
  "Hồ sơ CRM & dữ liệu cơ hội": "CRM records and opportunity data",
  "Đề xuất thương mại & báo giá bán": "commercial proposals and sales quotes",
  "Đối tác & bàn giao kinh doanh": "partner support and sales handover",
  "Đơn bán hàng & thông tin sản phẩm": "sales orders and product information",
  "Chiến dịch & yêu cầu marketing": "campaigns and marketing requests",
  "Nhận diện thương hiệu & thiết kế": "brand identity and design",
  "Nội dung & duyệt truyền thông": "content and communications review",
  "Báo chí & thông tin công bố": "press and public announcements",
  "Truyền thông nội bộ": "internal communications",
  "Hoàn tiền & tranh chấp giao dịch": "refunds and transaction disputes",
  "Khiếu nại & chất lượng dịch vụ": "complaints and service quality",
  "Tài khoản khách hàng": "customer accounts",
  "Quy trình vận hành & bàn giao ca": "operations procedures and shift handover",
  "Kiểm soát chất lượng & lỗi nghiệp vụ": "quality assurance and operational errors",
  "Điều phối & phụ thuộc dự án": "project coordination and dependencies",
  "Góp ý sản phẩm & yêu cầu tính năng": "product feedback and feature requests",
  "Tiến độ & thông tin dự án": "project status and updates",
  "Phối hợp phát hành sản phẩm": "product release coordination",
  "Đề nghị báo cáo & dashboard": "report and dashboard requests",
  "Định nghĩa chỉ số & cách đọc báo cáo": "metric definitions and report interpretation",
  "Sai lệch & chất lượng dữ liệu": "data discrepancies and quality",
  "Phạm vi & quyền sử dụng dữ liệu": "data usage scope and permissions",
  "Đăng ký khóa học": "course enrollment",
  "Kế hoạch & nhu cầu đào tạo": "learning and training plans",
  "Chứng nhận & kết quả đào tạo": "training certificates and results",
  "Mentor & phát triển nghề nghiệp": "mentoring and career development",
  "Đi công tác & đặt dịch vụ": "business travel and bookings",
  "Giấy tờ công tác & thị thực": "business travel documents and visas",
  "Tổ chức sự kiện & hội thảo": "event and conference planning",
  "Hoạt động đội nhóm": "team activities",
  "Nguy hiểm đang xảy ra": "active hazards",
  "Nguy cơ mất an toàn": "safety hazards",
  "An ninh tại cơ sở": "site security",
  "Thất lạc tài sản cá nhân": "lost personal property",
};

function translateCompanyPolicyCode(text: string): string | undefined {
  const match = /^(COMPANY-[A-Z_]+-(?:URGENT|GUIDE|INFO|REVIEW): )(.+)$/.exec(text);
  if (!match) return undefined;
  const translated = knownEnglishCopy[match[2]];
  return translated ? `${match[1]}${translated}` : undefined;
}

function translateKnownCompanyTemplate(text: string): string | undefined {
  const summary = /^Chuẩn bị yêu cầu (.+)\.$/.exec(text);
  if (summary) {
    const label = Object.keys(companyTopicNamesEnglish).find((candidate) => candidate.toLocaleLowerCase("vi") === summary[1]);
    if (label) return `Prepare for ${companyTopicNamesEnglish[label]}.`;
  }
  const privateMessage = /^Trao đổi riêng với (.+) qua kênh nội bộ đã xác minh; không gửi hồ sơ cá nhân, dữ liệu khách hàng hoặc thông tin thanh toán vào kênh chung\.$/.exec(text);
  if (privateMessage && companyTeams[privateMessage[1]]) {
    return `Use a private, verified internal channel to contact ${companyTeams[privateMessage[1]]}; do not share personal records, customer data, or payment information in a shared channel.`;
  }
  const assigned = /^Yêu cầu cần (.+) xác nhận và xử lý\.$/.exec(text);
  if (assigned && companyTeams[assigned[1]]) {
    return `The request needs confirmation and handling by ${companyTeams[assigned[1]]}.`;
  }
  const reviewerCheck = /^(.+) đã xác nhận phạm vi, người phụ trách và quy trình áp dụng chưa\?$/.exec(text);
  if (reviewerCheck && companyTeams[reviewerCheck[1]]) {
    return `Has ${companyTeams[reviewerCheck[1]]} confirmed the scope, owner, and applicable process?`;
  }
  const secondRound = /^Nhờ (.+) hỗ trợ trực tiếp qua kênh nội bộ đã xác minh và giữ mã yêu cầu để theo dõi\.$/.exec(text);
  if (secondRound && companyTeams[secondRound[1]]) {
    return `Contact ${companyTeams[secondRound[1]]} through a verified internal channel and keep the request ID for follow-up.`;
  }
  const directory = /^Mở danh bạ hoặc cổng nội bộ đã xác minh để tìm quy trình hiện hành của (.+); nếu chưa có nguồn, hỏi người phụ trách trước\.$/.exec(text);
  if (directory && companyTeams[directory[1]]) {
    return `Use the verified directory or internal portal to find the current process for ${companyTeams[directory[1]]}. If no source is available, ask the owner first.`;
  }
  const dynamicSystem = /^Trong (.+), bạn cần dùng cơ sở dữ liệu hoặc bảng nào\? Chỉ nêu tên, không gửi nội dung dữ liệu\.$/.exec(text);
  if (dynamicSystem) {
    return `In ${dynamicSystem[1]}, which database or table do you need? Provide only its name; do not send data content.`;
  }
  const incompleteFields = /^((?:[A-Z][A-Z0-9-]*: )*)Thiếu hoặc mơ hồ: (.+)\. Không suy diễn scope\/approval\.$/.exec(text);
  if (incompleteFields) {
    return `${incompleteFields[1]}Missing or ambiguous: ${incompleteFields[2]}. Do not infer scope or approval.`;
  }
  const interactionHandoff = /^([A-Z][A-Z0-9-]*: )(\d+) lượt báo còn vướng sau hướng dẫn; không dùng nhãn sentiment làm quyền quyết định\.$/.exec(text);
  if (interactionHandoff) {
    return `${interactionHandoff[1]}${interactionHandoff[2]} reports remain unresolved after guidance; sentiment labels do not determine authorization.`;
  }
  return undefined;
}

/** Translate only reviewed phrases. In composed policy explanations, known
 * clauses can be translated while IDs, values, and unrecognized text remain. */
export function localizeKnownPolicyCopy(
  value: string,
  locale: Locale,
  composedPolicy = false,
): string {
  if (locale !== "en" || !value) return value;
  const exact = knownEnglishCopy[value];
  if (exact) return exact;
  const multiRequest = /^Ticket có (\d+) yêu cầu con; áp dụng kết quả ưu tiên cao nhất\. (.+)$/.exec(value);
  if (multiRequest) {
    return `This ticket has ${multiRequest[1]} child requests; the highest-priority result applies. ${localizeKnownPolicyCopy(multiRequest[2], locale)}`;
  }
  const companyCoded = translateCompanyPolicyCode(value);
  if (companyCoded) return companyCoded;
  const companyTemplate = translateKnownCompanyTemplate(value);
  if (companyTemplate) return companyTemplate;
  if (!composedPolicy) return value;

  let translated = value;
  for (const [vi, en] of knownPolicyFragments) {
    if (translated.includes(vi)) translated = translated.replaceAll(vi, en);
  }
  return translated;
}
