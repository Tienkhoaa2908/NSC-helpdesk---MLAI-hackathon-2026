# Cấu hình Gemini và API key

Ứng dụng gọi Gemini ở server thông qua adapter tương thích OpenAI. API key chỉ được đọc từ biến môi trường server; không đưa key vào trình duyệt, commit, issue hoặc cuộc trò chuyện.

## Tạo và lưu khóa

1. Mở [Google AI Studio API keys](https://aistudio.google.com/api-keys) và tạo key riêng cho ứng dụng. Google hiện tạo key dạng authorization mặc định; nếu đang dùng key Standard cũ, kiểm tra loại key và giới hạn Gemini API theo [hướng dẫn bảo mật key](https://ai.google.dev/gemini-api/docs/api-key).
2. Lưu khóa trong password manager. Không gửi khóa vào chat hoặc ghi vào file theo dõi.
3. Khi chạy local, sao chép mẫu rồi đặt giá trị thật chỉ trong file `.env.local`:

   ```powershell
   Copy-Item .env.example .env.local
   ```

   `.env.local` bị Git ignore. Nếu xóa thư mục local, file này cũng mất; hãy giữ bản khôi phục trong password manager. Bản Production giữ cấu hình riêng trong Vercel.

## Cấu hình ứng dụng

Đặt các biến sau ở `.env.local` cho local, hoặc trong **Vercel → Project Settings → Environment Variables** cho môi trường Production:

```dotenv
AI_PROVIDER="gemini"
AI_MODEL="gemini-3.8-flash"
GEMINI_API_KEY=""
AI_WEB_SEARCH="false"
```

Nhập khóa thật vào `GEMINI_API_KEY` trực tiếp trong secret store, không đưa giá trị vào Git. `AI_CONVERSATION_MODEL` và `AI_WEB_MODEL` có thể để trống để kế thừa `AI_MODEL`. Sau khi đổi biến Vercel, tạo deployment mới để cấu hình có hiệu lực.

## Model và tra cứu web

Tại **18/11/2026**, Google liệt kê `gemini-3.8-flash` là model ổn định và là Flash model mạnh nhất hiện được giới thiệu cho tác vụ phức tạp. Bảng giá hiện niêm yết token đầu vào/đầu ra Standard ở Free Tier là miễn phí; quota và tốc độ bị giới hạn theo project và có thể thay đổi. Đây là lựa chọn khởi đầu phù hợp hơn cho luồng cần giữ chất lượng mà chưa bật billing. Chạy bộ test policy và Verify trước khi dùng với dữ liệu ngoài.

Google Search grounding vẫn được hỗ trợ trong code nhưng không khả dụng ở Free Tier; Paid Tier hiện có 5.000 truy vấn miễn phí mỗi tháng dùng chung cho các model Gemini 3 trở lên, sau đó tính phí theo lượng tìm kiếm. Giữ `AI_WEB_SEARCH="false"` nếu cần dùng thuần Free Tier. Chỉ bật sau khi kiểm tra hạn mức và billing trong AI Studio.

Google ghi nhận prompt ở Free Tier có thể được dùng để cải thiện sản phẩm. Chỉ gửi dữ liệu tổng hợp hoặc đã ẩn danh; không đưa yêu cầu nhân viên, thông tin nhận dạng, bí mật hay dữ liệu nội bộ vào model Free Tier.

## Vận hành an toàn

- Kiểm tra mức sử dụng trong AI Studio sau khi triển khai; quota có thể thay đổi theo model, dự án và thời điểm.
- Không đưa API key vào client-side code hoặc biến có tiền tố `NEXT_PUBLIC_`.
- Hạn chế quyền và phạm vi của key, bật cảnh báo sử dụng nếu khả dụng, và không mở tra cứu web mặc định.
- Nếu nghi ngờ khóa bị lộ, tạo key thay thế, cập nhật secret store, triển khai lại rồi thu hồi key cũ.
- Giữ lại test fixture và dữ liệu tổng hợp; không dùng dữ liệu thật để thử model miễn phí.

Tài liệu chính thức: [Gemini models](https://ai.google.dev/gemini-api/docs/models), [pricing](https://ai.google.dev/gemini-api/docs/pricing), [API key security](https://ai.google.dev/gemini-api/docs/api-key), [OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai), [Google Search grounding](https://ai.google.dev/gemini-api/docs/google-search).
