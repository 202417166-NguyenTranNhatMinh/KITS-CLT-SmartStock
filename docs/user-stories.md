# User Stories – SmartStock (FreshMart)

> Mẫu: **Với vai trò** [vai trò], **tôi muốn** [tính năng] **để** [lợi ích].
> Mỗi story có 2–3 tiêu chí chấp nhận (AC) kiểm thử được. Vai trò: `ADMIN`, `STAFF`.

| ID | Vai trò | Tính năng |
|---|---|---|
| US-01 | ADMIN/STAFF | Đăng nhập bằng JWT |
| US-02 | ADMIN | Quản lý danh mục, sản phẩm, nhà cung cấp |
| US-03 | STAFF | Tạo và xác nhận phiếu nhập |
| US-04 | STAFF | Tạo và xác nhận phiếu xuất, không xuất vượt tồn |
| US-05 | STAFF/ADMIN | Phân quyền thao tác chứng từ |
| US-06 | ADMIN/STAFF | Cảnh báo tồn kho thấp |
| US-07 | ADMIN/STAFF | Truy vết lịch sử nhập/xuất và xem báo cáo |
| US-08 | STAFF | Phân tích hóa đơn văn bản bằng AI |

---

## US-01 – Đăng nhập

**Với vai trò** nhân viên (ADMIN hoặc STAFF), **tôi muốn** đăng nhập bằng email và mật khẩu **để** truy cập hệ thống theo đúng quyền của mình.

**Tiêu chí chấp nhận**
1. Đăng nhập đúng → `200`, nhận access token hết hạn sau 60 phút, chứa claims `sub`, `email`, `role`.
2. Sai email, sai mật khẩu hoặc tài khoản bị khóa → `401` với cùng một thông báo.
3. Gọi API khác mà thiếu, sai hoặc hết hạn token → `401`; phản hồi không bao giờ chứa `PasswordHash`.

---

## US-02 – Quản lý danh mục, sản phẩm, nhà cung cấp

**Với vai trò** ADMIN, **tôi muốn** tạo, sửa và ẩn sản phẩm, danh mục, nhà cung cấp **để** danh mục hàng hóa luôn chính xác.

**Tiêu chí chấp nhận**
1. Tạo sản phẩm với `Sku` trùng → `409`; `Price < 0` hoặc `MinStock < 0` → `400`.
2. Xóa sản phẩm là ẩn (`IsActive = false`); sản phẩm đã ẩn không thể thêm vào chứng từ mới.
3. STAFF gọi API tạo/sửa/ẩn các đối tượng trên → `403`.

---

## US-03 – Tạo và xác nhận phiếu nhập

**Với vai trò** STAFF, **tôi muốn** tạo phiếu nhập nhiều dòng ở trạng thái nháp rồi xác nhận **để** tồn kho được cộng đúng số hàng thực nhận.

**Tiêu chí chấp nhận**
1. Tạo phiếu hợp lệ → `201`, trạng thái `DRAFT`, mã `PN-yyyyMMdd-xxx`, tồn kho chưa đổi. Phiếu không có dòng, `Quantity ≤ 0` hoặc lặp sản phẩm → `400`.
2. Xác nhận phiếu `DRAFT` → `CONFIRMED`, `QuantityInStock` từng dòng tăng đúng `Quantity`, thực hiện trong một transaction (lỗi giữa chừng thì hoàn tác toàn bộ).
3. Sửa, xác nhận hoặc hủy phiếu đã `CONFIRMED`/`CANCELLED` → `409`.

---

## US-04 – Tạo và xác nhận phiếu xuất

**Với vai trò** STAFF, **tôi muốn** tạo và xác nhận phiếu xuất **để** tồn kho giảm đúng và không bao giờ âm.

**Tiêu chí chấp nhận**
1. Xác nhận phiếu xuất hợp lệ → `QuantityInStock` từng dòng giảm đúng `Quantity`; mã phiếu dạng `PX-yyyyMMdd-xxx`.
2. Nếu bất kỳ dòng nào vượt tồn kho → `409` kèm danh sách sản phẩm thiếu và không trừ dòng nào.
3. Kết quả xác nhận liệt kê các sản phẩm vừa giảm xuống `≤ MinStock`.

---

## US-05 – Phân quyền thao tác chứng từ

**Với vai trò** ADMIN, **tôi muốn** STAFF chỉ thao tác được trên chứng từ của chính họ và phiếu hàng hỏng do ADMIN duyệt **để** kiểm soát trách nhiệm và hao hụt.

**Tiêu chí chấp nhận**
1. STAFF sửa/xác nhận/hủy chứng từ do người khác tạo → `403`; người tạo luôn lấy từ token, `userId` do máy khách gửi bị bỏ qua.
2. STAFF xác nhận phiếu xuất có lý do `DAMAGED` → `403`; ADMIN xác nhận được.
3. ADMIN thao tác được trên mọi chứng từ.

---

## US-06 – Cảnh báo tồn kho thấp

**Với vai trò** nhân viên, **tôi muốn** xem danh sách sản phẩm sắp hết **để** nhập hàng kịp thời, không đợi kệ trống.

**Tiêu chí chấp nhận**
1. `GET /api/inventory/low-stock` trả mọi sản phẩm có `QuantityInStock ≤ MinStock`.
2. Sản phẩm vừa nhập đủ để vượt `MinStock` không còn xuất hiện trong danh sách.

---

## US-07 – Truy vết lịch sử và xem báo cáo

**Với vai trò** nhân viên, **tôi muốn** xem lịch sử nhập/xuất của sản phẩm, và **với vai trò** ADMIN xem báo cáo biến động tồn kho theo khoảng ngày, **để** biết ai nhập/xuất hàng lúc nào và đối chiếu số liệu.

**Tiêu chí chấp nhận**
1. `GET /api/products/{id}/history` trả các chứng từ `CONFIRMED` có chứa sản phẩm (loại chứng từ, mã, số lượng, thời điểm, người tạo), mới nhất trước; chứng từ `DRAFT`/`CANCELLED` không xuất hiện.
2. `GET /api/reports/stock-summary?from=&to=` trả tồn đầu kỳ, tổng nhập, tổng xuất, tồn cuối kỳ cho từng sản phẩm; thiếu tham số hoặc `from > to` → `400`.
3. STAFF gọi API báo cáo → `403`.

---

## US-08 – Phân tích hóa đơn bằng AI

**Với vai trò** STAFF, **tôi muốn** dán nội dung hóa đơn dạng văn bản và nhận đề xuất phiếu nhập **để** giảm thời gian nhập liệu thủ công.

**Tiêu chí chấp nhận**
1. `POST /api/receipts/parse` chỉ trả đề xuất các dòng hàng, hệ thống không tự lưu chứng từ.
2. Backend kiểm tra kết quả LLM: `productId` tồn tại, `quantity > 0`; JSON sai định dạng → `400`; không tự tạo sản phẩm mới.
3. Chưa cấu hình API key → dùng mock `ILlmService` và vẫn hoạt động.
