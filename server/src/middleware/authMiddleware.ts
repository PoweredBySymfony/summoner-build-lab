import { timingSafeEqual } from "crypto";
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
    request.user = user ? { id: user.id, email: user.email, username: user.username, isAdmin: user.isAdmin } : null;
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

export const requireAdmin = (request: Request, _response: Response, next: NextFunction) => {
  if (!request.user) {
    next(new HttpError(401, "Authentification requise."));
    return;
  }

  if (!request.user.isAdmin) {
    next(new HttpError(403, "Acces administrateur requis."));
    return;
  }

  next();
};

const isLocalRequest = (request: Request) => {
  const forwardedFor = request.headers["x-forwarded-for"];
  const firstForwarded = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(",")[0]?.trim();
  const remoteAddress = firstForwarded ?? request.ip ?? request.socket.remoteAddress ?? "";

  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].some((value) => remoteAddress.includes(value));
};

const hasValidSyncToken = (request: Request) => {
  if (!env.SYNC_ADMIN_TOKEN) {
    return false;
  }

  const bearer = request.headers.authorization?.startsWith("Bearer ")
    ? request.headers.authorization.slice("Bearer ".length).trim()
    : null;
  const candidate = bearer ?? String(request.headers["x-sync-token"] ?? "").trim();

  if (!candidate) {
    return false;
  }

  const expected = Buffer.from(env.SYNC_ADMIN_TOKEN);
  const received = Buffer.from(candidate);

  return expected.length === received.length && timingSafeEqual(expected, received);
};

export const requireSyncAccess = (request: Request, _response: Response, next: NextFunction) => {
  if (process.env.NODE_ENV !== "production" && isLocalRequest(request)) {
    next();
    return;
  }

  if (hasValidSyncToken(request)) {
    next();
    return;
  }

  next(new HttpError(403, "Sync access denied."));
};
