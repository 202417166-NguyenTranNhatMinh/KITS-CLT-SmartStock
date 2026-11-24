// Giá trị enum dùng chung toàn dự án. Khớp CHECK trong db/migration.
export const ROLES = ['ADMIN', 'STAFF'] as const;
export type Role = (typeof ROLES)[number];

export const DOCUMENT_STATUSES = ['DRAFT', 'CONFIRMED', 'CANCELLED'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const ISSUE_REASONS = ['SALE', 'DAMAGED', 'INTERNAL'] as const;
export type IssueReason = (typeof ISSUE_REASONS)[number];
