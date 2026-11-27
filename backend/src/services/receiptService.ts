import type { AuthenticatedUser } from "../contracts/common/enums.contract";
import type { DocumentFilters } from "../contracts/common/documentFilters.contract";
import type { Receipt, ReceiptRequest } from "../contracts/receipts/receipt.contract";
import type { ReceiptRepository, ReceiptTransaction } from "../repo/receiptRepo";
import { AppError } from "../common/errors";
import { DocumentNumberService } from "./documentNumberService";

export class ReceiptService {
  constructor(
    private readonly receiptRepository: ReceiptRepository,
    private readonly documentNumberService: DocumentNumberService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(input: ReceiptRequest, actor: AuthenticatedUser): Promise<Receipt> {
    await this.ensureSupplierAndProducts(input);
    const createdAt = this.now();
    const code = await this.documentNumberService.nextReceiptCode(createdAt);
    return this.receiptRepository.createDraft({ ...input, code, createdBy: actor.id, createdAt });
  }

  async getById(id: number): Promise<Receipt> {
    return this.requireReceipt(id);
  }

  async list(filters: DocumentFilters): Promise<Receipt[]> {
    return this.receiptRepository.findAll(filters);
  }

  async update(id: number, input: ReceiptRequest, actor: AuthenticatedUser): Promise<Receipt> {
    return this.receiptRepository.transaction(async (tx) => {
      const receipt = await tx.findByIdForUpdate(id);
      if (!receipt) throw notFound("Receipt", id);
      this.assertDraftAndOwner(receipt, actor, "updated");
      await this.ensureSupplierAndProducts(input, tx);
      return tx.replaceDraft(id, input);
    });
  }

  async confirm(id: number, actor: AuthenticatedUser): Promise<Receipt> {
    return this.receiptRepository.transaction(async (tx) => {
      const receipt = await tx.findByIdForUpdate(id);
      if (!receipt) throw notFound("Receipt", id);
      this.assertDraftAndOwner(receipt, actor, "confirmed");

      // Acquire product row locks in the same order for concurrent receipts.
      const sortedItems = [...receipt.items].sort((a, b) => a.productId - b.productId);
      for (const item of sortedItems) {
        await tx.increaseStock(item.productId, item.quantity);
      }

      return tx.finalize(id, "CONFIRMED", actor.id, this.now());
    });
  }

  async cancel(id: number, actor: AuthenticatedUser): Promise<Receipt> {
    return this.receiptRepository.transaction(async (tx) => {
      const receipt = await tx.findByIdForUpdate(id);
      if (!receipt) throw notFound("Receipt", id);
      this.assertDraftAndOwner(receipt, actor, "cancelled");
      return tx.finalize(id, "CANCELLED", actor.id, this.now());
    });
  }

  private async requireReceipt(id: number): Promise<Receipt> {
    const receipt = await this.receiptRepository.findById(id);
    if (!receipt) throw notFound("Receipt", id);
    return receipt;
  }

  private async ensureSupplierAndProducts(input: ReceiptRequest, reader: Pick<ReceiptRepository | ReceiptTransaction, "findSupplierById" | "findProductsByIds"> = this.receiptRepository): Promise<void> {
    const supplier = await reader.findSupplierById(input.supplierId);
    if (!supplier) throw notFound("Supplier", input.supplierId);
    const products = await reader.findProductsByIds(input.items.map((item) => item.productId));
    assertRequestedProductsAreActive(input.items.map((item) => item.productId), products);
  }

  private assertDraftAndOwner(receipt: Receipt, actor: AuthenticatedUser, action: string): void {
    if (receipt.status !== "DRAFT") {
      throw AppError.conflict(`Only DRAFT documents can be ${action}`);
    }

    if (actor.role !== "ADMIN" && receipt.createdBy !== actor.id) {
      throw AppError.forbidden("You can only manage your own documents");
    }
  }
}

function notFound(resource: string, id: number): AppError {
  return AppError.notFound(`${resource} ${id} was not found`);
}

function assertRequestedProductsAreActive(
  requestedIds: number[],
  products: Array<{ id: number; isActive: boolean }>,
): void {
  const byId = new Map(products.map((product) => [product.id, product]));
  const unavailable = requestedIds.find((id) => !byId.get(id)?.isActive);
  if (unavailable !== undefined) throw notFound("Active product", unavailable);
}
