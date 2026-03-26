import type { Response } from "express";
import jwt from "jsonwebtoken";
import { env, isProduction } from "../config/env.js";

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  username: string;
  isAdmin: boolean;
};

type SessionPayload = {
  sub: string;
  email: string | null;
  username: string;
  isAdmin: boolean;
};

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;

export const signSessionToken = (user: AuthenticatedUser) =>
  jwt.sign(
    {
      sub: user.id,
      email: user.email,
      username: user.username,
      isAdmin: user.isAdmin,
    } satisfies SessionPayload,
    env.AUTH_SECRET,
    { expiresIn: SESSION_DURATION_SECONDS },
  );

export const readSessionToken = (token: string) => jwt.verify(token, env.AUTH_SECRET) as SessionPayload;

export const setSessionCookie = (response: Response, user: AuthenticatedUser) => {
  response.cookie(env.SESSION_COOKIE_NAME, signSessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: SESSION_DURATION_SECONDS * 1000,
    path: "/",
  });
};

export const clearSessionCookie = (response: Response) => {
  response.clearCookie(env.SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
  });
};
