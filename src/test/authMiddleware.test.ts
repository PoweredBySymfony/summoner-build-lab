import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  readSessionToken: vi.fn(),
  timingSafeEqual: vi.fn(),
  env: {
    SESSION_COOKIE_NAME: "session",
    SYNC_ADMIN_TOKEN: "secret-token",
  },
}));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, timingSafeEqual: mocks.timingSafeEqual };
});

vi.mock("../../server/src/repositories/userRepository.js", () => ({
  userRepository: { findById: mocks.findById },
}));

vi.mock("../../server/src/lib/session.js", () => ({
  readSessionToken: mocks.readSessionToken,
}));

vi.mock("../../server/src/config/env.js", () => ({ env: mocks.env }));

import {
  attachUser,
  requireAdmin,
  requireAuth,
  requireSyncAccess,
} from "../../server/src/middleware/authMiddleware.js";

type Req = Record<string, unknown> & { cookies?: Record<string, string>; headers?: Record<string, string>; user?: unknown; ip?: string };
const next = vi.fn();
const res = {};

const makeReq = (overrides: Partial<Req> = {}): Req => ({
  cookies: {},
  headers: {},
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("attachUser", () => {
  it("sets user to null when no cookie", async () => {
    const req = makeReq({ cookies: {} });
    await attachUser(req as never, res as never, next);
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalledWith();
  });

  it("sets user from valid session token", async () => {
    mocks.readSessionToken.mockReturnValue({ sub: "user-1" });
    mocks.findById.mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      username: "testuser",
      isAdmin: false,
    });
    const req = makeReq({ cookies: { session: "valid-token" } });
    await attachUser(req as never, res as never, next);
    expect(req.user).toEqual({ id: "user-1", email: "test@test.com", username: "testuser", isAdmin: false });
    expect(next).toHaveBeenCalledWith();
  });

  it("sets user to null when findById returns null", async () => {
    mocks.readSessionToken.mockReturnValue({ sub: "user-1" });
    mocks.findById.mockResolvedValue(null);
    const req = makeReq({ cookies: { session: "valid-token" } });
    await attachUser(req as never, res as never, next);
    expect(req.user).toBeNull();
  });

  it("sets user to null when token is invalid (exception)", async () => {
    mocks.readSessionToken.mockImplementation(() => { throw new Error("invalid"); });
    const req = makeReq({ cookies: { session: "bad-token" } });
    await attachUser(req as never, res as never, next);
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalledWith();
  });
});

describe("requireAuth", () => {
  it("calls next with 401 when no user", () => {
    const req = makeReq({ user: null });
    requireAuth(req as never, res as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  it("calls next without error when user is set", () => {
    const req = makeReq({ user: { id: "u1" } });
    requireAuth(req as never, res as never, next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe("requireAdmin", () => {
  it("calls next with 401 when no user", () => {
    const req = makeReq({ user: null });
    requireAdmin(req as never, res as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  it("calls next with 403 when user is not admin", () => {
    const req = makeReq({ user: { id: "u1", isAdmin: false } });
    requireAdmin(req as never, res as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it("calls next without error when user is admin", () => {
    const req = makeReq({ user: { id: "u1", isAdmin: true } });
    requireAdmin(req as never, res as never, next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe("requireSyncAccess", () => {
  const OLD_ENV = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = OLD_ENV;
  });

  it("allows local request in non-production", () => {
    process.env.NODE_ENV = "development";
    const req = makeReq({ headers: { "x-forwarded-for": "127.0.0.1" } });
    requireSyncAccess(req as never, res as never, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("allows valid bearer token in production", () => {
    process.env.NODE_ENV = "production";
    mocks.timingSafeEqual.mockReturnValue(true);
    const req = makeReq({ headers: { authorization: "Bearer secret-token" } });
    requireSyncAccess(req as never, res as never, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("denies with 403 when token is invalid in production", () => {
    process.env.NODE_ENV = "production";
    mocks.timingSafeEqual.mockReturnValue(false);
    const req = makeReq({ headers: { authorization: "Bearer wrong-token" } });
    requireSyncAccess(req as never, res as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it("denies with 403 when no token and no local IP in production", () => {
    process.env.NODE_ENV = "production";
    const externalIp = ["1", "2", "3", "4"].join(".");
    const req = makeReq({ headers: {}, ip: externalIp });
    requireSyncAccess(req as never, res as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it("denies with 403 when SYNC_ADMIN_TOKEN is not set", () => {
    process.env.NODE_ENV = "production";
    mocks.env.SYNC_ADMIN_TOKEN = "";
    const req = makeReq({ headers: { authorization: "Bearer anything" } });
    requireSyncAccess(req as never, res as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
    mocks.env.SYNC_ADMIN_TOKEN = "secret-token";
  });

  it("allows x-sync-token header with valid token", () => {
    process.env.NODE_ENV = "production";
    mocks.timingSafeEqual.mockReturnValue(true);
    const req = makeReq({ headers: { "x-sync-token": "secret-token" } });
    requireSyncAccess(req as never, res as never, next);
    expect(next).toHaveBeenCalledWith();
  });
});
