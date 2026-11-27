import { AppError } from "../../common/errors";
import { env } from "../../config/env";
import {
  llmParsedOutputSchema,
  type ParseReceiptData,
} from "../../contracts/llm/receiptParse.contract";
import { llmCatalogRepository, type LlmCatalogRepository } from "../../repo/llmCatalogRepo";
import { MockLlmService, OpenAiCompatibleLlmService, type ILlmService } from "./llmService";

export function createDefaultLlmService(config = env): ILlmService {
  const provider = config.LLM_PROVIDER.toLowerCase();
  if (provider === "mock" || !config.LLM_API_KEY.trim()) {
    return new MockLlmService();
  }
  return new OpenAiCompatibleLlmService({
    apiKey: config.LLM_API_KEY,
    model: config.LLM_MODEL,
    baseUrl: config.LLM_BASE_URL,
    timeoutMs: config.LLM_TIMEOUT_MS,
  });
}

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

export class ReceiptParseService {
  constructor(
    private readonly llmService: ILlmService,
    private readonly catalogRepo: LlmCatalogRepository,
  ) {}

  async parse(text: string): Promise<ParseReceiptData> {
    const [products, suppliers] = await Promise.all([
      this.catalogRepo.findActiveProducts(),
      this.catalogRepo.findSuppliers(),
    ]);

    const rawOutput = await this.llmService.parseInvoice(text, products, suppliers);

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(stripJsonFences(rawOutput));
    } catch {
      throw AppError.badRequest("LLM trả về JSON không hợp lệ");
    }

    const validated = llmParsedOutputSchema.safeParse(parsedJson);
    if (!validated.success) {
      const errors = validated.error.issues.map((issue) => ({
        field: issue.path.join(".") || "llmOutput",
        message: issue.message,
      }));
      throw AppError.badRequest("Dữ liệu phân tích từ LLM không hợp lệ", errors);
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    const supplierSet = new Set(suppliers.map((s) => s.id));
    const mergedByProduct = new Map<number, ParseReceiptData["items"][number]>();

    for (const item of validated.data.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw AppError.badRequest("LLM tham chiếu sản phẩm không tồn tại hoặc đã ẩn", [
          { field: "items.productId", message: `Không tìm thấy sản phẩm active id=${item.productId}` },
        ]);
      }

      const existing = mergedByProduct.get(product.id);
      if (existing) {
        existing.quantity += item.quantity;
        if (existing.unitPrice === null && item.unitPrice !== null) {
          existing.unitPrice = item.unitPrice;
        }
        if (item.rawText) {
          existing.rawText = existing.rawText ? `${existing.rawText}; ${item.rawText}` : item.rawText;
        }
      } else {
        mergedByProduct.set(product.id, {
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice ?? null,
          rawText: item.rawText,
        });
      }
    }

    const items = Array.from(mergedByProduct.values());

    const supplierId =
      validated.data.supplierId !== null && supplierSet.has(validated.data.supplierId)
        ? validated.data.supplierId
        : null;

    return {
      supplierId,
      items,
      unmatched: validated.data.unmatched,
      isSuggestionOnly: true,
    };
  }
}

export const receiptParseService = new ReceiptParseService(
  createDefaultLlmService(),
  llmCatalogRepository,
);
