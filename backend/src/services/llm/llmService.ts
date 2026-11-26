import { AppError } from "../../common/errors";
import type { LlmProductOption, LlmSupplierOption } from "../../contracts/llm/receiptParse.contract";
import { buildReceiptParsePrompt } from "./receiptParsePrompt";

export interface ILlmService {
  parseInvoice(
    text: string,
    products: LlmProductOption[],
    suppliers: LlmSupplierOption[],
  ): Promise<string>;
}

function normalizeVi(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePriceToken(raw: string): number | null {
  const kMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*k\b/i);
  if (kMatch) {
    return Math.round(Number(kMatch[1].replace(",", ".")) * 1000);
  }
  const priceAfterX = raw.match(/(?:x|@|gia)\s*(\d[\d.,]*)/i);
  if (priceAfterX) {
    const digits = priceAfterX[1].replace(/[.,](?=\d{3}(?:\D|$))/g, "");
    const value = Number(digits.replace(",", "."));
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  }
  return null;
}

function parseQuantity(segment: string): number | null {
  const withoutPrice = segment.replace(/(?:x|@|gia)\s*\d[\d.,]*\s*k?/gi, "");
  const match = withoutPrice.match(/\b(\d+)\b/);
  if (!match) return null;
  const qty = Number(match[1]);
  return Number.isInteger(qty) && qty > 0 ? qty : null;
}

/** Mock LLM dùng khi chưa có ANTHROPIC_API_KEY hoặc LLM_PROVIDER=mock. */
export class MockLlmService implements ILlmService {
  async parseInvoice(
    text: string,
    products: LlmProductOption[],
    suppliers: LlmSupplierOption[],
  ): Promise<string> {
    const normalizedFull = normalizeVi(text);
    const matchedSupplier = suppliers.find((s) => normalizedFull.includes(normalizeVi(s.name)));

    // Ưu tiên tên dài trước để tránh match nhầm tiền tố ngắn
    const sortedProducts = [...products].sort((a, b) => b.name.length - a.name.length);
    const segments = text
      .split(/\r?\n|;|\.(?=\s|$)/)
      .map((s) => s.trim())
      .filter(Boolean);

    const items: Array<{ productId: number; quantity: number; unitPrice: number | null; rawText: string }> = [];
    const unmatched: string[] = [];

    for (const seg of segments) {
      const normSeg = normalizeVi(seg);
      if (!normSeg || /^(nha cung cap|ncc|hoa don|ngay|tong)\b/.test(normSeg)) {
        if (matchedSupplier && normSeg.includes(normalizeVi(matchedSupplier.name))) continue;
      }

      const product = sortedProducts.find(
        (p) => normSeg.includes(normalizeVi(p.name)) || normSeg.includes(p.sku.toLowerCase()),
      );
      if (!product) {
        if (/\d/.test(seg) && !/^(nha cung cap|ncc)\b/i.test(normSeg)) {
          unmatched.push(seg);
        }
        continue;
      }

      const quantity = parseQuantity(seg);
      if (!quantity) {
        unmatched.push(seg);
        continue;
      }

      items.push({
        productId: product.id,
        quantity,
        unitPrice: parsePriceToken(seg),
        rawText: seg,
      });
    }

    return JSON.stringify({
      supplierId: matchedSupplier?.id ?? null,
      items,
      unmatched,
    });
  }
}

export interface OpenAiCompatibleConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
  baseUrl?: string;
  systemPromptTemplate?: string;
}

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

const RECEIPT_JSON_SCHEMA = {
  name: "extract_receipt",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["supplierId", "items", "unmatched"],
    properties: {
      supplierId: { type: ["integer", "null"] },
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["productId", "quantity", "unitPrice", "rawText"],
          properties: {
            productId: { type: "integer" },
            quantity: { type: "integer" },
            unitPrice: { type: ["number", "null"] },
            rawText: { type: "string" },
          },
        },
      },
      unmatched: { type: "array", items: { type: "string" } },
    },
  },
};

/** Adapter chuẩn OpenAI Chat Completions (/chat/completions), tương thích OpenAI, Gemini, Groq, OpenRouter... */
export class OpenAiCompatibleLlmService implements ILlmService {
  constructor(private readonly config: OpenAiCompatibleConfig) {}

  async parseInvoice(
    text: string,
    products: LlmProductOption[],
    suppliers: LlmSupplierOption[],
  ): Promise<string> {
    const baseUrl = (this.config.baseUrl || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
    const systemPrompt = buildReceiptParsePrompt(products, suppliers, this.config.systemPromptTemplate);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0,
          response_format: { type: "json_schema", json_schema: RECEIPT_JSON_SCHEMA },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text },
          ],
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown network error";
      throw AppError.serviceUnavailable(`Không thể kết nối tới dịch vụ LLM: ${reason}`);
    }

    if (!response.ok) {
      throw AppError.serviceUnavailable(`Dịch vụ LLM trả về lỗi HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim()) return content;

    throw AppError.serviceUnavailable("Dịch vụ LLM không trả về dữ liệu hợp lệ");
  }
}
