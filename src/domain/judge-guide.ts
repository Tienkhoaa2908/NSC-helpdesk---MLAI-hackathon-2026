export const GUIDE_SESSION_PREFIX = "vng-guide-v1:";
export type GuideRole = "sender" | "reviewer";
export type GuideStep = {
  target: string;
  title: string;
  text: string;
  titleEn: string;
  textEn: string;
  advanceOn?: "click" | "change" | "input";
};
export const guideStages: Record<string, { role: GuideRole; steps: GuideStep[] }> = {
  "sender-form": {
    role: "sender",
    steps: [
      { target: "sender-mode", title: "1. Chọn cách gửi", text: "Bấm “Mô tả vấn đề” để viết tự do, hoặc “Chọn theo danh mục” để chọn nhu cầu cụ thể.", titleEn: "1. Choose a request type", textEn: "Select Describe the issue to write freely, or Choose a category to select a specific need.", advanceOn: "click" },
      { target: "sender-department", title: "Chọn phòng ban", text: "Chọn phòng ban cho yêu cầu. Mã nhân viên được lấy từ tài khoản đã đăng nhập. Tài khoản demo guest01 dùng chung để trải nghiệm và không xác minh danh tính; chỉ dùng dữ liệu minh họa.", titleEn: "Select your department", textEn: "Select the department for this request. Your employee ID comes from the signed-in account. The shared guest01 demo account is for exploration and does not verify identity; use synthetic data only.", advanceOn: "change" },
      { target: "sender-group", title: "2. Chọn nhóm hỗ trợ", text: "Chọn nhóm phù hợp. Chưa rõ thì giữ “Tôi chưa biết nhóm nào” và bấm Tiếp theo.", titleEn: "2. Choose a support area", textEn: "Select the best matching area. If unsure, keep “I'm not sure which area” and continue.", advanceOn: "change" },
      { target: "sender-intent", title: "3. Chọn nhu cầu", text: "Chọn việc cần hỗ trợ rồi điền các ô xuất hiện bên dưới. Chỉ nhập dữ liệu minh họa, không nhập mật khẩu.", titleEn: "3. Choose a specific need", textEn: "Select the task you need help with and complete the fields below. Use synthetic data and never enter a password.", advanceOn: "change" },
      { target: "sender-fields", title: "Điền thông tin theo danh mục", text: "Điền các ô bạn biết trong khung được chỉ. Không cần bịa thông tin còn thiếu. Khi xong, bấm Tiếp theo để thêm mô tả hoặc gửi yêu cầu.", titleEn: "Complete the relevant details", textEn: "Fill in the fields you know. Do not guess missing details. When finished, continue to add a description or submit the request." },
      { target: "sender-description", title: "4. Mô tả tình huống", text: "Bấm vào ô và nhập vấn đề. Ví dụ: “VPN không kết nối”. Bạn có thể tiếp tục gõ sau khi mũi tên chuyển sang nút Gửi.", titleEn: "4. Describe the issue", textEn: "Describe the problem, for example, “My VPN will not connect.” Continue typing after the guide points to Submit.", advanceOn: "input" },
      { target: "sender-send", title: "5. Gửi để xem phản hồi", text: "Viết xong, bấm Gửi. Trợ lý sẽ trả lời hoặc hiển thị thông tin cần xác nhận; hồ sơ chỉ được lưu ở bước tiếp theo.", titleEn: "5. Submit for a response", textEn: "Select Submit to review the assistant's response or requested details. The request is saved only after the next confirmation step." },
    ],
  },
  "sender-preview": {
    role: "sender",
    steps: [
      { target: "sender-preview", title: "Kiểm tra phản hồi", text: "Đọc thông tin đã hiểu, hướng dẫn và những mục còn thiếu. Nếu chưa đúng, bấm Quay lại sửa. Bấm Tiếp theo để xem cách lưu hồ sơ.", titleEn: "Review the response", textEn: "Check the interpreted request, guidance, and missing details. Select Edit if anything is wrong. Continue to see how to save the request." },
      { target: "sender-confirm", title: "Xác nhận hoặc lưu hội thoại", text: "Bấm nút này để lưu yêu cầu. Bạn sẽ được đưa đến trang theo dõi, có phản hồi và lịch sử riêng.", titleEn: "Confirm or save the conversation", textEn: "Save the request to open its tracking page with a response and request history." },
    ],
  },
  "sender-result": {
    role: "sender",
    steps: [
      { target: "sender-result", title: "Theo dõi kết quả", text: "Xem trạng thái và phản hồi. Nếu cần bổ sung, trả lời đúng mục được hỏi. Nếu đang chờ nhân viên, theo dõi cập nhật tại liên kết này.", titleEn: "Track the result", textEn: "Review the status and response. Answer any follow-up questions. If staff review is pending, check for updates using this link." },
      { target: "sender-feedback", title: "Thử các lựa chọn hỗ trợ", text: "A: đã giải quyết. B: vẫn lỗi. C: giải thích một bước. D: chuyển nhân viên. Chỉ bấm lựa chọn đúng với kết quả bạn muốn kiểm tra.", titleEn: "Choose a follow-up", textEn: "A: resolved. B: still having the issue. C: explain a step. D: ask staff to review. Choose the option that matches your outcome.", advanceOn: "click" },
      { target: "sender-followup", title: "Tiếp tục hỏi hoặc bổ sung", text: "Nhập câu hỏi tiếp theo hoặc thông tin còn thiếu rồi bấm nút gửi bên dưới. Mỗi lần gửi đều được kiểm tra lại.", titleEn: "Ask a follow-up or add details", textEn: "Enter another question or the missing information, then select the button below. Each submission is reviewed again.", advanceOn: "input" },
      { target: "sender-followup-send", title: "Gửi nội dung tiếp theo", text: "Bấm để gửi câu hỏi hoặc phần bổ sung. Nếu có lỗi, nội dung vẫn được giữ để bạn sửa và thử lại.", titleEn: "Send the follow-up", textEn: "Submit your question or details. If an error occurs, your text remains available so you can revise and retry.", advanceOn: "click" },
      { target: "sender-history", title: "Xem lại toàn bộ quá trình", text: "Bấm mở lịch sử để xem hướng dẫn và các lần xử lý. Bạn đã biết luồng người gửi; có thể mở hướng dẫn Admin để biết cách tiếp nhận hồ sơ.", titleEn: "Review the full history", textEn: "Open the history to review guidance and previous actions. The employee guide is complete; the Admin guide explains request review.", advanceOn: "click" },
    ],
  },
  "reviewer-list": {
    role: "reviewer",
    steps: [
      { target: "reviewer-filters", title: "1. Tìm yêu cầu cần xử lý", text: "Dùng bộ lọc trạng thái và nguồn. Tra chính xác mã nhân viên bằng ô riêng; dùng ô nội dung để tìm mã yêu cầu hoặc nội dung ticket. Mục chờ xử lý gồm yêu cầu cần người phụ trách xem xét.", titleEn: "1. Find requests to review", textEn: "Filter by status and source. Search employee IDs in their dedicated field, or search request IDs and text in the main field. Pending requests need staff review.", advanceOn: "change" },
      { target: "reviewer-list", title: "2. Mở một hồ sơ", text: "Bấm một yêu cầu để xem chi tiết. Nếu danh sách trống, bấm Tạo yêu cầu demo, gửi một tình huống rồi quay lại đây.", titleEn: "2. Open a request", textEn: "Select a request to review its details. If the list is empty, create a synthetic request and return here.", advanceOn: "click" },
    ],
  },
  "reviewer-detail": {
    role: "reviewer",
    steps: [
      { target: "reviewer-evidence", title: "3. Đọc yêu cầu", text: "Đọc nguyên văn và bản tóm tắt do trợ lý AI tạo. Bản tóm tắt chỉ giúp đọc nhanh; mở Xem lịch sử & bằng chứng để đối chiếu quy tắc, thông tin còn thiếu và hướng dẫn đã gửi.", titleEn: "3. Review the request", textEn: "Read the original text and AI summary. The summary is for reference; open View history and evidence to check rules, missing details, and guidance sent." },
      { target: "reviewer-reason", title: "4. Tin nhắn trả lời", text: "Chọn một trong hai gợi ý xử lý hoặc nhập tin nhắn. Hỏi thêm thông tin sẽ soạn bản nháp riêng để bạn sửa và gửi. Khi duyệt, bạn có thể bỏ qua ô tin nhắn và bấm Tiếp theo.", titleEn: "4. Write a response", textEn: "Choose a response suggestion or write your own. Asking for information creates a draft you can edit. Approval may not require a message.", advanceOn: "input" },
      { target: "reviewer-actions", title: "5. Chọn quyết định phù hợp", text: "Có thể hỏi thêm, từ chối, dừng hoặc duyệt khi được phép. Nút bị mờ là thao tác chưa đủ điều kiện. Điều chỉnh quyết định cần chọn trạng thái đích trước.", titleEn: "5. Choose an available action", textEn: "Request information, reject, stop, or approve when allowed. Disabled actions do not meet the required conditions. Choose a target status before overriding a decision.", advanceOn: "click" },
      { target: "reviewer-history", title: "6. Kiểm tra nhật ký", text: "Mở Xem lịch sử & bằng chứng, chọn Lịch sử xử lý để xem trạng thái mới, người thao tác và tin nhắn vừa gửi. Hướng dẫn không tự duyệt hay gửi quyết định thay bạn.", titleEn: "6. Check the audit history", textEn: "Open View history and evidence, then select Activity history to review the status, actor, and message. The guide does not approve requests or act on your behalf." },
    ],
  },
};
