import type { NextFunction, Request, Response } from "express";
import { userRepository } from "../repositories/userRepository.js";
import { env } from "../config/env.js";
import { readSessionToken } from "../lib/session.js";
import { HttpError } from "../utils/http.js";

export const attachUser = async (request: Request, _response: Response, next: NextFunction) => {
  const token = request.cookies?.[env.SESSION_COOKIE_NAME];
  if (!token) {
    request.user = null;
    next();
    return;
  }

  try {
    const payload = readSessionToken(token);
    const user = await userRepository.findById(payload.sub);
    request.user = user ? { id: user.id, email: user.email, username: user.username } : null;
  } catch {
    request.user = null;
  }

  next();
};

export const requireAuth = (request: Request, _response: Response, next: NextFunction) => {
  if (!request.user) {
    next(new HttpError(401, "Authentication required."));
    return;
  }

  next();
};
