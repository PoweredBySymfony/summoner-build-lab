import { beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  use: vi.fn(),
  set: vi.fn(),
}));

vi.mock("express", () => {
  const app = { set: mocks.set, use: mocks.use };
  const expressFn = () => app;
  expressFn.json = vi.fn(() => vi.fn());
  expressFn.Router = vi.fn(() => ({ get: vi.fn(), post: vi.fn(), use: vi.fn() }));
  return { default: expressFn, Router: expressFn.Router };
});

vi.mock("cookie-parser", () => ({ default: vi.fn(() => vi.fn()) }));
vi.mock("cors", () => ({ default: vi.fn(() => vi.fn()) }));
vi.mock("helmet", () => ({ default: vi.fn(() => vi.fn()) }));
vi.mock("express-rate-limit", () => ({ default: vi.fn(() => vi.fn()) }));

vi.mock("../../server/src/config/env.js", () => ({
  env: { CLIENT_URL: "http://localhost:3000", SESSION_COOKIE_NAME: "session", SYNC_ADMIN_TOKEN: "" },
}));

vi.mock("../../server/src/routes/appRoutes.js", () => ({ appRoutes: vi.fn() }));
vi.mock("../../server/src/routes/adminRoutes.js", () => ({ adminRoutes: vi.fn() }));
vi.mock("../../server/src/utils/http.js", () => ({
  HttpError: class HttpError extends Error {
    status: number;
    details?: unknown;
    constructor(status: number, message: string, details?: unknown) {
      super(message);
      this.status = status;
      this.details = details;
    }
  },
}));

type ErrorHandler = (err: unknown, req: unknown, res: Record<string, unknown>, next: () => void) => void;

let appModule: { app: unknown };
let errorHandler: ErrorHandler | undefined;

beforeAll(async () => {
  appModule = await import("../../server/src/app.js");
  errorHandler = mocks.use.mock.calls.find(
    (call: unknown[]) => typeof call[0] === "function" && (call[0] as (...a: unknown[]) => void).length === 4,
  )?.[0] as ErrorHandler | undefined;
});

describe("app.ts", () => {
  it("exports the express app", () => {
    expect(appModule.app).toBeDefined();
  });

  it("configures trust proxy", () => {
    expect(mocks.set).toHaveBeenCalledWith("trust proxy", 1);
  });

  it("registers cors, helmet, cookie-parser, json, routes (use called multiple times)", () => {
    expect(mocks.use.mock.calls.length).toBeGreaterThan(3);
  });

  it("error handler is registered with 4 params", () => {
    expect(errorHandler).toBeDefined();
  });

  it("error handler returns 400 for HttpError", async () => {
    if (!errorHandler) return;
    const { HttpError } = await import("../../server/src/utils/http.js");
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const err = new HttpError(400, "Bad request", { field: "x" });
    errorHandler(err, {}, { status, json }, vi.fn());
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: "Bad request" }));
  });

  it("error handler returns 500 with message for generic Error in dev", () => {
    if (!errorHandler) return;
    const savedEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    errorHandler(new Error("boom"), {}, { status, json }, vi.fn());
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: "boom" }));
    process.env.NODE_ENV = savedEnv;
  });

  it("error handler returns generic message for unknown error", () => {
    if (!errorHandler) return;
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    errorHandler("some-string-error", {}, { status, json }, vi.fn());
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: "Unexpected server error." });
  });
});
