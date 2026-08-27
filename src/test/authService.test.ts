import { UserAuthProvider } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../../server/src/utils/http";

const mocks = vi.hoisted(() => ({
  findByEmail: vi.fn(),
  findByUsername: vi.fn(),
  findById: vi.fn(),
  findByGoogleId: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  promoteToAdmin: vi.fn(),
  ensureUserScaffolding: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("../../server/src/config/env.js", () => ({
  adminEmails: new Set(["admin@example.com"]),
}));

vi.mock("../../server/src/lib/password.js", () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: mocks.verifyPassword,
}));

vi.mock("../../server/src/repositories/userRepository.js", () => ({
  userRepository: {
    findByEmail: mocks.findByEmail,
    findByUsername: mocks.findByUsername,
    findById: mocks.findById,
    findByGoogleId: mocks.findByGoogleId,
    createUser: mocks.createUser,
    updateUser: mocks.updateUser,
    promoteToAdmin: mocks.promoteToAdmin,
    ensureUserScaffolding: mocks.ensureUserScaffolding,
  },
}));

import { authService } from "../../server/src/services/authService";

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-id",
    email: "player@example.com",
    username: "PlayerOne",
    passwordHash: "hash",
    googleId: null,
    avatarUrl: null,
    isAdmin: false,
    authProvider: UserAuthProvider.EMAIL,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hashPassword.mockResolvedValue("hashed-password");
  mocks.verifyPassword.mockResolvedValue(true);
  mocks.ensureUserScaffolding.mockResolvedValue(undefined);
  mocks.findByEmail.mockResolvedValue(null);
  mocks.findByUsername.mockResolvedValue(null);
  mocks.findById.mockResolvedValue(user());
  mocks.findByGoogleId.mockResolvedValue(null);
  mocks.createUser.mockImplementation(async (data: Record<string, unknown>) =>
    user({
      id: "created-user",
      email: data.email,
      username: data.username,
      passwordHash: data.passwordHash ?? null,
      googleId: data.googleId ?? null,
      avatarUrl: data.avatarUrl ?? null,
      isAdmin: data.isAdmin,
      authProvider: data.authProvider,
    }),
  );
  mocks.updateUser.mockImplementation(async (id: string, data: Record<string, unknown>) =>
    user({
      id,
      ...data,
    }),
  );
  mocks.promoteToAdmin.mockImplementation(async (id: string) => user({ id, isAdmin: true }));
});

describe("authService", () => {
  it("registers normalized email users and grants admin from configured emails", async () => {
    const registered = await authService.register({
      email: " Admin@Example.com ",
      username: "  AdminUser  ",
      password: "secret-password",
    });

    expect(registered).toMatchObject({
      id: "created-user",
      email: "admin@example.com",
      username: "AdminUser",
      isAdmin: true,
      authProvider: "email",
      hasPassword: true,
      linkedGoogle: false,
    });
    expect(mocks.hashPassword).toHaveBeenCalledWith("secret-password");
    expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({
      email: "admin@example.com",
      username: "AdminUser",
      isAdmin: true,
      authProvider: UserAuthProvider.EMAIL,
    }));
  });

  it.each([
    ["email", { findByEmail: user({ id: "other-user" }) }, "Un compte existe deja pour cet email."],
    ["username", { findByUsername: user({ id: "other-user" }) }, "Ce pseudo est deja utilise."],
  ])("rejects duplicate %s identities", async (_label, repositoryState, message) => {
    mocks.findByEmail.mockResolvedValue(repositoryState.findByEmail ?? null);
    mocks.findByUsername.mockResolvedValue(repositoryState.findByUsername ?? null);

    await expect(
      authService.register({
        email: "player@example.com",
        username: "PlayerOne",
        password: "secret-password",
      }),
    ).rejects.toMatchObject({
      status: 409,
      message,
    } satisfies Partial<HttpError>);
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("logs in email users and promotes configured admins when needed", async () => {
    mocks.findByEmail.mockResolvedValueOnce(user({ email: "admin@example.com", isAdmin: false }));

    await expect(authService.login("ADMIN@example.com", "secret-password")).resolves.toMatchObject({
      isAdmin: true,
      authProvider: "email",
    });
    expect(mocks.verifyPassword).toHaveBeenCalledWith("secret-password", "hash");
    expect(mocks.promoteToAdmin).toHaveBeenCalledWith("user-id");
    expect(mocks.ensureUserScaffolding).toHaveBeenCalledWith("user-id");
  });

  it.each([
    ["missing password hash", user({ passwordHash: null }), true],
    ["invalid password", user(), false],
  ])("rejects login with %s", async (_label, repositoryUser, passwordIsValid) => {
    mocks.findByEmail.mockResolvedValue(repositoryUser);
    mocks.verifyPassword.mockResolvedValue(passwordIsValid);

    await expect(authService.login("player@example.com", "wrong-password")).rejects.toMatchObject({
      status: 401,
      message: "Email ou mot de passe invalide.",
    } satisfies Partial<HttpError>);
  });

  it("returns existing users and rejects invalid sessions", async () => {
    await expect(authService.getUser("user-id")).resolves.toMatchObject({
      id: "user-id",
      email: "player@example.com",
    });
    expect(mocks.ensureUserScaffolding).toHaveBeenCalledWith("user-id");

    mocks.findById.mockResolvedValueOnce(null);
    await expect(authService.getUser("missing-user")).rejects.toMatchObject({
      status: 401,
      message: "La session n'est plus valide.",
    } satisfies Partial<HttpError>);
  });

  it("updates an existing Google identity and returns a session user", async () => {
    mocks.findByGoogleId.mockResolvedValueOnce(user({
      id: "google-user",
      authProvider: UserAuthProvider.GOOGLE,
      googleId: "google-123",
      avatarUrl: "old-avatar.png",
    }));
    mocks.updateUser.mockResolvedValueOnce(user({
      id: "google-user",
      email: "player@example.com",
      authProvider: UserAuthProvider.GOOGLE,
      googleId: "google-123",
      avatarUrl: "new-avatar.png",
    }));

    await expect(authService.upsertGoogleUser({
      googleId: "google-123",
      email: "PLAYER@example.com",
      avatarUrl: "new-avatar.png",
    })).resolves.toMatchObject({
      id: "google-user",
      linkedGoogle: true,
      authProvider: "google",
    });
    expect(mocks.updateUser).toHaveBeenCalledWith("google-user", expect.objectContaining({
      email: "player@example.com",
      avatarUrl: "new-avatar.png",
      authProvider: UserAuthProvider.GOOGLE,
    }));
  });

  it("links Google to an existing email user with both auth providers", async () => {
    mocks.findByEmail.mockResolvedValueOnce(user({
      id: "email-user",
      authProvider: UserAuthProvider.EMAIL,
      passwordHash: "hash",
    }));
    mocks.updateUser.mockResolvedValueOnce(user({
      id: "email-user",
      authProvider: UserAuthProvider.BOTH,
      googleId: "google-123",
      passwordHash: "hash",
    }));

    await expect(authService.upsertGoogleUser({
      googleId: "google-123",
      email: "player@example.com",
    })).resolves.toMatchObject({
      id: "email-user",
      authProvider: "both",
      hasPassword: true,
      linkedGoogle: true,
    });
    expect(mocks.updateUser).toHaveBeenCalledWith("email-user", expect.objectContaining({
      googleId: "google-123",
      authProvider: UserAuthProvider.BOTH,
    }));
  });

  it("creates Google users with a unique slugged username", async () => {
    mocks.findByUsername
      .mockResolvedValueOnce(user({ username: "elite-player" }))
      .mockResolvedValueOnce(user({ username: "elite-player-2" }))
      .mockResolvedValueOnce(null);

    await expect(authService.upsertGoogleUser({
      googleId: "google-456",
      email: "new@example.com",
      username: "Elite Player",
      avatarUrl: "avatar.png",
    })).resolves.toMatchObject({
      id: "created-user",
      username: "elite-player-3",
      linkedGoogle: true,
      authProvider: "google",
    });
    expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({
      email: "new@example.com",
      username: "elite-player-3",
      googleId: "google-456",
      authProvider: UserAuthProvider.GOOGLE,
    }));
  });
});
