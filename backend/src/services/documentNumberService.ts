import type { DocumentCodeRepository, DocumentPrefix } from "../repo/documentCodeRepo";

const HO_CHI_MINH_TIME_ZONE = "Asia/Ho_Chi_Minh";

export class DocumentNumberService {
  constructor(private readonly codeRepository: DocumentCodeRepository) {}

  async nextReceiptCode(createdAt: Date): Promise<string> {
    return this.nextCode("PN", createdAt);
  }

  async nextIssueCode(createdAt: Date): Promise<string> {
    return this.nextCode("PX", createdAt);
  }

  private async nextCode(prefix: DocumentPrefix, createdAt: Date): Promise<string> {
    const date = formatHoChiMinhDate(createdAt);
    const sequence = await this.codeRepository.reserveNextSequence(prefix, date);

    return `${prefix}-${date}-${String(sequence).padStart(3, "0")}`;
  }
}

export function formatHoChiMinhDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: HO_CHI_MINH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;

  return `${value("year")}${value("month")}${value("day")}`;
}
