import type { AuthenticatedUser } from "../contracts/common/enums.contract";
import type { DocumentFilters } from "../contracts/common/documentFilters.contract";
import type { ConfirmIssueData, Issue, IssueRequest, StockShortage } from "../contracts/issues/issue.contract";
import type { IssueRepository, StockProduct } from "../repo/issueRepo";
import { AppError } from "../common/errors";
import { DocumentNumberService } from "./documentNumberService";

export class IssueService {
  constructor(
    private readonly issueRepository: IssueRepository,
    private readonly documentNumberService: DocumentNumberService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(input: IssueRequest, actor: AuthenticatedUser): Promise<Issue> {
    await this.ensureProductsAreActive(input);
    const createdAt = this.now();
    const code = await this.documentNumberService.nextIssueCode(createdAt);
    return this.issueRepository.createDraft({ ...input, code, createdBy: actor.id, createdAt });
  }

  async getById(id: number): Promise<Issue> {
    return this.requireIssue(id);
  }

  async list(filters: DocumentFilters): Promise<Issue[]> {
    return this.issueRepository.findAll(filters);
  }

  async update(id: number, input: IssueRequest, actor: AuthenticatedUser): Promise<Issue> {
    const issue = await this.requireIssue(id);
    this.assertDraftAndOwner(issue, actor, "updated");
    await this.ensureProductsAreActive(input);
    return this.issueRepository.replaceDraft(id, input);
  }

  async confirm(id: number, actor: AuthenticatedUser): Promise<ConfirmIssueData> {
    return this.issueRepository.transaction(async (tx) => {
      const issue = await tx.findByIdForUpdate(id);
      if (!issue) throw notFound("Issue", id);
      this.assertDraftAndOwner(issue, actor, "confirmed");

      if (issue.reason === "DAMAGED" && actor.role !== "ADMIN") {
        throw AppError.forbidden("Only ADMIN can confirm DAMAGED issues");
      }

      const productIds = issue.items.map((item) => item.productId).sort((a, b) => a - b);
      const products = await tx.lockProductsByIds(productIds);
      const shortages = findShortages(issue.items, products);

      if (shortages.length > 0) {
        throw AppError.conflict("Insufficient stock", { shortages });
      }

      for (const item of issue.items) {
        await tx.decreaseStock(item.productId, item.quantity);
      }

      const confirmedIssue = await tx.finalize(id, "CONFIRMED", actor.id, this.now());
      const lowStockProducts = await tx.findLowStockByIds(productIds);
      return { issue: confirmedIssue, lowStockProducts };
    });
  }

  async cancel(id: number, actor: AuthenticatedUser): Promise<Issue> {
    return this.issueRepository.transaction(async (tx) => {
      const issue = await tx.findByIdForUpdate(id);
      if (!issue) throw notFound("Issue", id);
      this.assertDraftAndOwner(issue, actor, "cancelled");
      return tx.finalize(id, "CANCELLED", actor.id, this.now());
    });
  }

  private async requireIssue(id: number): Promise<Issue> {
    const issue = await this.issueRepository.findById(id);
    if (!issue) throw notFound("Issue", id);
    return issue;
  }

  private async ensureProductsAreActive(input: IssueRequest): Promise<void> {
    const products = await this.issueRepository.findProductsByIds(input.items.map((item) => item.productId));
    const byId = new Map(products.map((product) => [product.id, product]));
    const unavailable = input.items.map((item) => item.productId).find((id) => !byId.get(id)?.isActive);
    if (unavailable !== undefined) throw notFound("Active product", unavailable);
  }

  private assertDraftAndOwner(issue: Issue, actor: AuthenticatedUser, action: string): void {
    if (issue.status !== "DRAFT") {
      throw AppError.conflict(`Only DRAFT documents can be ${action}`);
    }

    if (actor.role !== "ADMIN" && issue.createdBy !== actor.id) {
      throw AppError.forbidden("You can only manage your own documents");
    }
  }
}

function findShortages(
  items: Array<{ productId: number; quantity: number }>,
  products: StockProduct[],
): StockShortage[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  return items.flatMap((item) => {
    const product = byId.get(item.productId);
    if (product && product.quantityInStock >= item.quantity) return [];
    return [{
      productId: item.productId,
      productName: product?.name ?? "Unknown product",
      requested: item.quantity,
      available: product?.quantityInStock ?? 0,
    }];
  });
}

function notFound(resource: string, id: number): AppError {
  return AppError.notFound(`${resource} ${id} was not found`);
}
