import { AppError } from "../common/errors";
import { buildPageResponse, type PageResponse } from "../common/response";
import type {
  LowStockItem,
  ProductHistoryQuery,
  StockHistoryItem,
} from "../contracts/inventory/inventory.contract";
import { inventoryRepository, type InventoryRepository } from "../repo/inventoryRepo";

export class InventoryService {
  constructor(
    private readonly repo: Pick<
      InventoryRepository,
      "findLowStock" | "productExists" | "findProductHistory"
    >,
  ) {}

  getLowStock(): Promise<LowStockItem[]> {
    return this.repo.findLowStock();
  }

  async getProductHistory(
    productId: number,
    query: ProductHistoryQuery,
  ): Promise<PageResponse<StockHistoryItem>> {
    if (!(await this.repo.productExists(productId))) {
      throw AppError.notFound("Không tìm thấy sản phẩm");
    }
    const { items, totalItems } = await this.repo.findProductHistory(
      productId,
      query.page,
      query.pageSize,
    );
    return buildPageResponse(items, query.page, query.pageSize, totalItems);
  }
}

export const inventoryService = new InventoryService(inventoryRepository);
