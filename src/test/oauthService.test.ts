import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../../server/src/utils/http";

const mocks = vi.hoisted(() => ({
  upsertGoogleUser: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("../../server/src/config/env.js", () => ({
  env: {
    GOOGLE_CLIENT_ID: "google-client-id",
    GOOGLE_CLIENT_SECRET: "google-client-secret",
    GOOGLE_REDIRECT_URI: "http://localhost:9000/oauth2/callback/google",
  },
}));

vi.mock("../../server/src/services/authService.js", () => ({
  authService: {
    upsertGoogleUser: mocks.upsertGoogleUser,
  },
}));

import { oauthService } from "../../server/src/services/oauthService";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.upsertGoogleUser.mockResolvedValue({ id: "user-id", email: "player@example.test" });
  mocks.fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "google-access-token",
        expires_in: 3600,
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "google-user-id",
        email: "player@example.test",
        name: "Player One",
        picture: "https://example.test/avatar.png",
      }),
    });
});

describe("oauthService", () => {
  it("creates a Google authorization URL with a state token", () => {
    const request = oauthService.createGoogleAuthorizationRequest();
    const url = new URL(request.url);

    expect(request.state).toHaveLength(36);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("google-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:9000/oauth2/callback/google");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe(request.state);
  });

  it("validates matching OAuth state values and rejects mismatches", () => {
    expect(() => oauthService.validateGoogleState("state-123", "state-123")).not.toThrow();

    expect(() => oauthService.validateGoogleState("returned", "cookie")).toThrowError(HttpError);
    expect(() => oauthService.validateGoogleState("returned", undefined)).toThrowError(HttpError);
  });

  it("exchanges a Google callback code and upserts the session user", async () => {
    await expect(oauthService.handleGoogleCallback("auth-code")).resolves.toEqual({
      id: "user-id",
      email: "player@example.test",
    });

    expect(mocks.fetch).toHaveBeenNthCalledWith(
      1,
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({
        method: "POST",
        body: expect.any(URLSearchParams),
      }),
    );
    expect(mocks.fetch).toHaveBeenNthCalledWith(
      2,
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: "Bearer google-access-token",
        },
      },
    );
    expect(mocks.upsertGoogleUser).toHaveBeenCalledWith({
      googleId: "google-user-id",
      email: "player@example.test",
      username: "Player One",
      avatarUrl: "https://example.test/avatar.png",
    });
  });

  it.each([
    [
      "token exchange failure",
      [
        {
          ok: false,
          status: 502,
          json: async () => ({}),
        },
      ],
      502,
      "L'echange du token Google OAuth a echoue.",
    ],
    [
      "userinfo failure",
      [
        {
          ok: true,
          json: async () => ({ access_token: "google-access-token", expires_in: 3600 }),
        },
        {
          ok: false,
          status: 503,
          json: async () => ({}),
        },
      ],
      503,
      "Impossible de recuperer le profil Google.",
    ],
    [
      "missing email",
      [
        {
          ok: true,
          json: async () => ({ access_token: "google-access-token", expires_in: 3600 }),
        },
        {
          ok: true,
          json: async () => ({ id: "google-user-id" }),
        },
      ],
      400,
      "Le compte Google n'a pas renvoye d'adresse email.",
    ],
  ])("rejects callback when %s", async (_label, responses, status, message) => {
    mocks.fetch.mockReset();
    responses.forEach((response) => mocks.fetch.mockResolvedValueOnce(response));

    await expect(oauthService.handleGoogleCallback("auth-code")).rejects.toMatchObject({
      status,
      message,
    } satisfies Partial<HttpError>);
  });
});
