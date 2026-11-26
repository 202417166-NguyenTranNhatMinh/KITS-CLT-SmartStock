import type { LlmProductOption, LlmSupplierOption } from "../../contracts/llm/receiptParse.contract";

/** Prompt v1 dùng cho POST /api/receipts/parse — tách riêng file .ts để dễ bảo trì và tối ưu độc lập. */
export const RECEIPT_PARSE_PROMPT_V1 = `Bạn là trợ lý trích xuất dữ liệu hóa đơn nhập kho cho SmartStock (FreshMart).
Mục đích: đọc văn bản hóa đơn và trả về gợi ý phiếu nhập dạng JSON để nhân viên kiểm tra trước khi lưu.

Quy tắc bắt buộc:
- Chỉ dùng productId và supplierId từ danh sách bên dưới, tuyệt đối không tự bịa ID hay tự tạo sản phẩm mới.
- Sản phẩm không có trong danh sách thì đưa đoạn mô tả gốc vào mảng unmatched.
- Chuẩn hóa giá viết tắt (vd: 20k = 20000), số lượng phải là số nguyên dương.

Định dạng JSON đầu ra:
{
  "supplierId": number | null,
  "items": [{ "productId": number, "quantity": number, "unitPrice": number | null, "rawText": string }],
  "unmatched": string[]
}

Danh sách nhà cung cấp:
{{SUPPLIERS}}

Danh sách sản phẩm active:
{{PRODUCTS}}`;

export function buildReceiptParsePrompt(
  products: LlmProductOption[],
  suppliers: LlmSupplierOption[],
  template = RECEIPT_PARSE_PROMPT_V1,
): string {
  return template
    .replace("{{SUPPLIERS}}", JSON.stringify(suppliers))
    .replace("{{PRODUCTS}}", JSON.stringify(products));
}
