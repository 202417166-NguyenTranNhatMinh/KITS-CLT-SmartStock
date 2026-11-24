import type { AuthenticatedUser } from "../contracts/common/enums.contract";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
