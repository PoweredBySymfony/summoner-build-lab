import type { AuthenticatedUser } from "../lib/session.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser | null;
    }
  }
}

export {};
