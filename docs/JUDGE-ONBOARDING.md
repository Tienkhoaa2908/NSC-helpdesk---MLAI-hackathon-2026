# Hướng dẫn kiểm thử dành cho ban giám khảo MLAI 2026

> Khu vực Verify được xây dựng để hoàn thành yêu cầu kiểm thử của đề bài track VNG tại MLAI Hackathon 2026. Các bộ dữ liệu là tình huống tổng hợp dùng để đối chiếu cách hệ thống phân loại yêu cầu, đưa hướng dẫn hoặc chuyển cho người xử lý.

## Chạy bộ kiểm thử

1. Mở trang web, chọn **Dành cho Admin** hoặc **Tôi cần hỗ trợ**, rồi đăng nhập bằng tài khoản trải nghiệm `guest01 / 12345`.
2. Chọn **Kiểm thử** trong thanh điều hướng.
3. Chọn một bộ kiểm thử và bấm **Chạy toàn bộ ca**. Một số ca gọi model đang cấu hình, vì vậy có thể dùng hạn mức API.
4. Đọc nhãn quyết định, kết quả đối chiếu, hồ sơ và audit. Kết quả được lưu vào MongoDB để kiểm tra luồng xử lý.

Tài khoản trải nghiệm chỉ dùng dữ liệu tổng hợp. Các lượt chạy tạo dữ liệu Verify và có thể gọi model, không nhập thông tin cá nhân, mật khẩu hoặc dữ liệu nội bộ.

## Các bộ kiểm thử

| Bộ | Số ca | Phạm vi |
| --- | ---: | --- |
| Đề A — VNG | 5 | Ba yêu cầu thường quy nhận hướng dẫn tự động và hai yêu cầu chuyển tiếp. |
| Bộ chung | 4 | Các trường hợp chuẩn dùng để kiểm tra xử lý yêu cầu. |
| Bộ đối chiếu đề bài | 15 | Tình huống thiếu dữ kiện, ngoài quy định, vượt thẩm quyền, rủi ro bảo mật và input kết hợp. |
| Bộ cache | 42 | Câu hỏi thường gặp và cách diễn đạt tương đương để đối chiếu cache hit, miss và bypass. |
| Bộ mở rộng | 30 | Ví dụ cho IT, Commercial và HR, gồm hướng dẫn thường quy, hỏi bổ sung và chuyển tiếp. |

Bộ 15 tình huống và bộ Đề A phục vụ yêu cầu kiểm thử của cuộc thi. Các bộ còn lại hỗ trợ kiểm tra hồi quy và phần mở rộng sản phẩm. Đây là kiểm thử ứng dụng với dữ liệu tổng hợp, không phải nghiên cứu người dùng hoặc benchmark độc lập chất lượng model.

Xem thêm [đề bài và tiêu chí](../challenge/mlai-2026/CHALLENGE-BRIEF.md), [mô tả dataset](../challenge/mlai-2026/README.md) và [hướng dẫn Admin](ADMIN-GUIDE.md).
