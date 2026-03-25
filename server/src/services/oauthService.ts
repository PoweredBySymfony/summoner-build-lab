import { randomUUID } from "crypto";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http.js";
import { authService } from "./authService.js";

const stateStore = new Map<string, { createdAt: number }>();
const STATE_TTL_MS = 10 * 60 * 1000;

function createState() {
  const state = randomUUID();
  stateStore.set(state, { createdAt: Date.now() });
  return state;
}

function consumeState(state: string) {
  const entry = stateStore.get(state);
  stateStore.delete(state);

  if (!entry || Date.now() - entry.createdAt > STATE_TTL_MS) {
    throw new HttpError(400, "OAuth state is invalid or expired.");
  }
}

async function postForm<T>(url: string, body: URLSearchParams): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new HttpError(response.status, "Google OAuth token exchange failed.");
  }

  return (await response.json()) as T;
}

export const oauthService = {
  getGoogleAuthorizationUrl() {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
      throw new HttpError(503, "Google OAuth is not configured.");
    }

    const state = createState();
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", env.GOOGLE_REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    return url.toString();
  },

  async handleGoogleCallback(code: string, state: string) {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
      throw new HttpError(503, "Google OAuth is not configured.");
    }

    consumeState(state);

    const token = await postForm<{
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    }>(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    );

    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      throw new HttpError(userInfoResponse.status, "Unable to retrieve Google user profile.");
    }

    const userInfo = (await userInfoResponse.json()) as {
      id: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    if (!userInfo.email) {
      throw new HttpError(400, "Google account did not return an email address.");
    }

    return authService.upsertGoogleUser({
      googleId: userInfo.id,
      email: userInfo.email,
      username: userInfo.name,
      avatarUrl: userInfo.picture,
    });
  },
};
