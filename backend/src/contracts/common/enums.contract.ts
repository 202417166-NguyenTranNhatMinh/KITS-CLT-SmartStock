import { z } from "zod";
import { DOCUMENT_STATUSES, ISSUE_REASONS, ROLES, type DocumentStatus, type IssueReason, type Role } from "../../types/enums";

export const roleSchema = z.enum(ROLES);
export const documentStatusSchema = z.enum(DOCUMENT_STATUSES);
export const issueReasonSchema = z.enum(ISSUE_REASONS);

export type { Role, DocumentStatus, IssueReason };

export type AuthenticatedUser = {
  id: number;
  email: string;
  role: Role;
};
