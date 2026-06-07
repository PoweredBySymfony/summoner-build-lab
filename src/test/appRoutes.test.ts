import { beforeEach, describe, expect, it, vi } from "vitest";

type HandlerFn = (req: any, res: any, next?: any) => any;

const captured = vi.hoisted(() => ({
  handlers: {} as Record<string, HandlerFn>,
}));

vi.mock("express", () => {
  const router = {
    use: vi.fn(),
    get: vi.fn((path: string, ...args: any[]) => {
      captured.handlers[`GET ${path}`] = args[args.length - 1];
    }),
    post: vi.fn((path: string, ...args: any[]) => {
      captured.handlers[`POST ${path}`] = args[args.length - 1];
    }),
    patch: vi.fn((path: string, ...args: any[]) => {
      captured.handlers[`PATCH ${path}`] = args[args.length - 1];
    }),
    delete: vi.fn((path: string, ...args: any[]) => {
      captured.handlers[`DELETE ${path}`] = args[args.length - 1];
    }),
  };
  return { Router: () => router };
});

vi.mock("express-rate-limit", () => ({ default: vi.fn(() => vi.fn()) }));

vi.mock("../../server/src/utils/asyncRoute.js", () => ({
  asyncRoute: (fn: HandlerFn) => fn,
}));

vi.mock("../../server/src/utils/http.js", () => ({
  HttpError: class HttpError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));

vi.mock("../../server/src/middleware/authMiddleware.js", () => ({
  attachUser: vi.fn(),
  requireAuth: vi.fn(),
  requireSyncAccess: vi.fn(),
}));

vi.mock("../../server/src/lib/session.js", () => ({
  setSessionCookie: vi.fn(),
  clearSessionCookie: vi.fn(),
}));

vi.mock("../../server/src/lib/mongo.js", () => ({
  getMongoHealth: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("../../server/src/config/env.js", () => ({
  env: { APP_URL: "http://localhost:5173" },
}));

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  register: vi.fn(),
  login: vi.fn(),
  getBootstrap: vi.fn(),
  getCatalog: vi.fn(),
  getPuzzles: vi.fn(),
  getPuzzleDetail: vi.fn(),
  getDashboard: vi.fn(),
  getDailyChallengeDetail: vi.fn(),
  getChampionLearning: vi.fn(),
  getGeneratedPuzzleDraftByRequestId: vi.fn(),
  getGeneratedPuzzleRequestById: vi.fn(),
  getOverview: vi.fn(),
  getProgressOverview: vi.fn(),
  recordAttempt: vi.fn(),
  completeDailyChallenge: vi.fn(),
  getOrCreateToday: vi.fn(),
  generateChampionPuzzleSeries: vi.fn(),
  generateMatchBasedPuzzle: vi.fn(),
  buildExplanation: vi.fn(),
  getAccountProfile: vi.fn(),
  getPublicPlayerProfile: vi.fn(),
  getPlayerAutocomplete: vi.fn(),
  importRecentMatches: vi.fn(),
  syncChampions: vi.fn(),
  syncItems: vi.fn(),
  syncAssets: vi.fn(),
  createGoogleAuthorizationRequest: vi.fn(),
  validateGoogleState: vi.fn(),
  handleGoogleCallback: vi.fn(),
  findBySlug: vi.fn(),
  getMongoHealth: vi.fn(),
}));

vi.mock("../../server/src/services/authService.js", () => ({
  authService: {
    getUser: mocks.getUser,
    register: mocks.register,
    login: mocks.login,
  },
}));

vi.mock("../../server/src/services/appService.js", () => ({
  appService: {
    getBootstrap: mocks.getBootstrap,
    getCatalog: mocks.getCatalog,
    getPuzzles: mocks.getPuzzles,
    getPuzzleDetail: mocks.getPuzzleDetail,
    getDashboard: mocks.getDashboard,
    getDailyChallengeDetail: mocks.getDailyChallengeDetail,
    getChampionLearning: mocks.getChampionLearning,
    getGeneratedPuzzleDraftByRequestId: mocks.getGeneratedPuzzleDraftByRequestId,
    getGeneratedPuzzleRequestById: mocks.getGeneratedPuzzleRequestById,
  },
}));

vi.mock("../../server/src/services/progressService.js", () => ({
  progressService: {
    getOverview: mocks.getProgressOverview,
    recordAttempt: mocks.recordAttempt,
    completeDailyChallenge: mocks.completeDailyChallenge,
  },
}));

vi.mock("../../server/src/services/dailyChallengeService.js", () => ({
  dailyChallengeService: { getOrCreateToday: mocks.getOrCreateToday },
}));

vi.mock("../../server/src/services/puzzleGenerationService.js", () => ({
  puzzleGenerationService: {
    generateChampionPuzzleSeries: mocks.generateChampionPuzzleSeries,
    generateMatchBasedPuzzle: mocks.generateMatchBasedPuzzle,
  },
}));

vi.mock("../../server/src/services/itemExplanationService.js", () => ({
  itemExplanationService: { buildExplanation: mocks.buildExplanation },
}));

vi.mock("../../server/src/services/riotSyncService.js", () => ({
  riotSyncService: {
    getAccountProfile: mocks.getAccountProfile,
    getPublicPlayerProfile: mocks.getPublicPlayerProfile,
    getPlayerAutocomplete: mocks.getPlayerAutocomplete,
    importRecentMatches: mocks.importRecentMatches,
    syncChampions: mocks.syncChampions,
    syncItems: mocks.syncItems,
    syncAssets: mocks.syncAssets,
  },
}));

vi.mock("../../server/src/services/oauthService.js", () => ({
  GOOGLE_OAUTH_STATE_COOKIE: "google_oauth_state",
  GOOGLE_OAUTH_STATE_TTL_MS: 600000,
  oauthService: {
    createGoogleAuthorizationRequest: mocks.createGoogleAuthorizationRequest,
    validateGoogleState: mocks.validateGoogleState,
    handleGoogleCallback: mocks.handleGoogleCallback,
  },
}));

vi.mock("../../server/src/repositories/puzzleRepository.js", () => ({
  puzzleRepository: { findBySlug: mocks.findBySlug },
}));

import "../../server/src/routes/appRoutes.js";

const req = (overrides: Record<string, any> = {}) => ({
  params: {},
  body: {},
  query: {},
  cookies: {},
  user: null,
  ...overrides,
});

const res = () => {
  const r: any = {
    json: vi.fn(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
    redirect: vi.fn(),
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  };
  return r;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("appRoutes", () => {
  describe("GET /health", () => {
    it("returns health status", async () => {
      mocks.getMongoHealth.mockResolvedValue({ ok: true });
      const response = res();
      await captured.handlers["GET /health"](req(), response);
      expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });
  });

  describe("GET /auth/me", () => {
    it("returns null user when not authenticated", async () => {
      const response = res();
      await captured.handlers["GET /auth/me"](req({ user: null }), response);
      expect(response.json).toHaveBeenCalledWith({ user: null });
    });

    it("returns user data when authenticated", async () => {
      mocks.getUser.mockResolvedValue({
        id: "u1",
        email: "a@b.com",
        username: "johndoe",
        isAdmin: false,
        avatarUrl: null,
        authProvider: "LOCAL",
        passwordHash: "hash",
        googleId: null,
      });
      const response = res();
      await captured.handlers["GET /auth/me"](req({ user: { id: "u1" } }), response);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ user: expect.objectContaining({ username: "johndoe" }) }),
      );
    });
  });

  describe("POST /auth/register", () => {
    it("registers user and sets session cookie", async () => {
      mocks.register.mockResolvedValue({ id: "u1", username: "johndoe" });
      const response = res();
      await captured.handlers["POST /auth/register"](
        req({ body: { email: "a@b.com", username: "johndoe", password: "password123" } }),
        response,
      );
      expect(mocks.register).toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(201);
    });
  });

  describe("POST /auth/login", () => {
    it("logs in user and returns user data", async () => {
      mocks.login.mockResolvedValue({ id: "u1", username: "johndoe" });
      const response = res();
      await captured.handlers["POST /auth/login"](
        req({ body: { email: "a@b.com", password: "password123" } }),
        response,
      );
      expect(mocks.login).toHaveBeenCalledWith("a@b.com", "password123");
      expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ user: expect.any(Object) }));
    });
  });

  describe("POST /auth/logout", () => {
    it("clears session cookie and sends 204", () => {
      const response = res();
      captured.handlers["POST /auth/logout"](req(), response);
      expect(response.status).toHaveBeenCalledWith(204);
    });
  });

  describe("GET /auth/google/url", () => {
    it("returns google auth url and sets state cookie", async () => {
      mocks.createGoogleAuthorizationRequest.mockReturnValue({ url: "https://accounts.google.com/...", state: "abc123" });
      const response = res();
      await captured.handlers["GET /auth/google/url"](req(), response);
      expect(response.cookie).toHaveBeenCalled();
      expect(response.json).toHaveBeenCalledWith({ url: "https://accounts.google.com/..." });
    });
  });

  describe("GET /auth/google/callback", () => {
    it("handles google callback and redirects", async () => {
      mocks.handleGoogleCallback.mockResolvedValue({ id: "u1" });
      const response = res();
      await captured.handlers["GET /auth/google/callback"](
        req({ query: { code: "auth-code", state: "state-val" }, cookies: { google_oauth_state: "state-val" } }),
        response,
      );
      expect(mocks.handleGoogleCallback).toHaveBeenCalledWith("auth-code");
      expect(response.redirect).toHaveBeenCalledWith("http://localhost:5173/dashboard");
    });
  });

  describe("GET /bootstrap", () => {
    it("returns bootstrap data", async () => {
      mocks.getBootstrap.mockResolvedValue({ catalog: {} });
      const response = res();
      await captured.handlers["GET /bootstrap"](req({ user: { id: "u1" } }), response);
      expect(response.json).toHaveBeenCalledWith({ catalog: {} });
    });
  });

  describe("GET /catalog", () => {
    it("returns catalog", async () => {
      mocks.getCatalog.mockResolvedValue({ champions: [], items: [] });
      const response = res();
      await captured.handlers["GET /catalog"](req(), response);
      expect(response.json).toHaveBeenCalledWith({ champions: [], items: [] });
    });
  });

  describe("GET /puzzles", () => {
    it("returns puzzle list", async () => {
      mocks.getPuzzles.mockResolvedValue([{ slug: "test" }]);
      const response = res();
      await captured.handlers["GET /puzzles"](req({ query: {} }), response);
      expect(response.json).toHaveBeenCalledWith([{ slug: "test" }]);
    });
  });

  describe("GET /puzzles/:slug", () => {
    it("returns puzzle detail when found", async () => {
      mocks.getPuzzleDetail.mockResolvedValue({ slug: "test-puzzle" });
      const response = res();
      await captured.handlers["GET /puzzles/:slug"](req({ params: { slug: "test-puzzle" } }), response);
      expect(response.json).toHaveBeenCalledWith({ slug: "test-puzzle" });
    });

    it("throws 404 when puzzle not found", async () => {
      mocks.getPuzzleDetail.mockResolvedValue(null);
      const response = res();
      await expect(
        captured.handlers["GET /puzzles/:slug"](req({ params: { slug: "missing" } }), response),
      ).rejects.toThrow("Puzzle introuvable.");
    });
  });

  describe("POST /puzzles/:slug/attempts", () => {
    const puzzle = {
      id: "p1",
      choices: [
        { id: "c1", isCorrect: true, explanation: "Correct!" },
        { id: "c2", isCorrect: false, explanation: "Wrong" },
      ],
      explanation: "Global explanation",
    };

    it("records attempt for authenticated user and returns result", async () => {
      mocks.findBySlug.mockResolvedValue(puzzle);
      mocks.recordAttempt.mockResolvedValue(undefined);
      const response = res();
      await captured.handlers["POST /puzzles/:slug/attempts"](
        req({
          params: { slug: "test" },
          body: { selectedChoiceId: "c1", responseTimeMs: 1200 },
          user: { id: "u1" },
        }),
        response,
      );
      expect(mocks.recordAttempt).toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(201);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ isCorrect: true, saved: true }),
      );
    });

    it("returns result without recording for unauthenticated user", async () => {
      mocks.findBySlug.mockResolvedValue(puzzle);
      const response = res();
      await captured.handlers["POST /puzzles/:slug/attempts"](
        req({ params: { slug: "test" }, body: { selectedChoiceId: "c1" }, user: null }),
        response,
      );
      expect(mocks.recordAttempt).not.toHaveBeenCalled();
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ saved: false, requiresAuth: true }),
      );
    });

    it("throws 404 when puzzle not found", async () => {
      mocks.findBySlug.mockResolvedValue(null);
      await expect(
        captured.handlers["POST /puzzles/:slug/attempts"](
          req({ params: { slug: "missing" }, body: { selectedChoiceId: "c1" } }),
          res(),
        ),
      ).rejects.toThrow("Puzzle introuvable.");
    });

    it("throws 400 when choice not in puzzle", async () => {
      mocks.findBySlug.mockResolvedValue(puzzle);
      await expect(
        captured.handlers["POST /puzzles/:slug/attempts"](
          req({ params: { slug: "test" }, body: { selectedChoiceId: "bad-id" } }),
          res(),
        ),
      ).rejects.toThrow("Le choix selectionne");
    });
  });

  describe("GET /dashboard", () => {
    it("returns dashboard for authenticated user", async () => {
      mocks.getDashboard.mockResolvedValue({ stats: {} });
      const response = res();
      await captured.handlers["GET /dashboard"](req({ user: { id: "u1" } }), response);
      expect(response.json).toHaveBeenCalledWith({ stats: {} });
    });
  });

  describe("GET /progress", () => {
    it("returns progress overview", async () => {
      mocks.getProgressOverview.mockResolvedValue({ total: 5 });
      const response = res();
      await captured.handlers["GET /progress"](req({ user: { id: "u1" } }), response);
      expect(response.json).toHaveBeenCalledWith({ total: 5 });
    });
  });

  describe("GET /daily-challenge", () => {
    it("returns daily challenge detail", async () => {
      mocks.getDailyChallengeDetail.mockResolvedValue({ id: "dc1" });
      const response = res();
      await captured.handlers["GET /daily-challenge"](req(), response);
      expect(response.json).toHaveBeenCalledWith({ id: "dc1" });
    });
  });

  describe("POST /daily-challenge/complete", () => {
    it("completes daily challenge for user", async () => {
      mocks.getOrCreateToday.mockResolvedValue({ id: "dc1" });
      mocks.completeDailyChallenge.mockResolvedValue({ completed: true });
      const response = res();
      await captured.handlers["POST /daily-challenge/complete"](
        req({ body: { isCorrect: true }, user: { id: "u1" } }),
        response,
      );
      expect(mocks.completeDailyChallenge).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "u1", isCorrect: true }),
      );
      expect(response.status).toHaveBeenCalledWith(201);
    });
  });

  describe("GET /champions/:slug", () => {
    it("returns champion learning data", async () => {
      mocks.getChampionLearning.mockResolvedValue({ slug: "jinx" });
      const response = res();
      await captured.handlers["GET /champions/:slug"](req({ params: { slug: "jinx" } }), response);
      expect(response.json).toHaveBeenCalledWith({ slug: "jinx" });
    });

    it("throws 404 when champion not found", async () => {
      mocks.getChampionLearning.mockResolvedValue(null);
      await expect(
        captured.handlers["GET /champions/:slug"](req({ params: { slug: "unknown" } }), res()),
      ).rejects.toThrow("Champion not found.");
    });
  });

  describe("POST /generated-puzzles/champion", () => {
    it("generates champion puzzle series", async () => {
      mocks.generateChampionPuzzleSeries.mockResolvedValue({ requestId: "r1" });
      const response = res();
      await captured.handlers["POST /generated-puzzles/champion"](
        req({ body: { championId: "c1" }, user: { id: "u1" } }),
        response,
      );
      expect(mocks.generateChampionPuzzleSeries).toHaveBeenCalledWith("c1", "u1");
      expect(response.status).toHaveBeenCalledWith(201);
    });
  });

  describe("POST /generated-puzzles/match", () => {
    it("generates match-based puzzle for standard user", async () => {
      mocks.generateMatchBasedPuzzle.mockResolvedValue({ requestId: "r2" });
      const response = res();
      await captured.handlers["POST /generated-puzzles/match"](
        req({ body: { importedMatchId: "m1" }, user: { id: "u1", isAdmin: false } }),
        response,
      );
      expect(mocks.generateMatchBasedPuzzle).toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(201);
    });

    it("throws 403 when non-admin uses forceDraftOnLowConfidence", async () => {
      await expect(
        captured.handlers["POST /generated-puzzles/match"](
          req({
            body: { importedMatchId: "m1", forceDraftOnLowConfidence: true },
            user: { id: "u1", isAdmin: false },
          }),
          res(),
        ),
      ).rejects.toThrow("reserve aux administrateurs");
    });
  });

  describe("POST /generated-puzzles/item-explanation", () => {
    it("builds item explanation", async () => {
      mocks.buildExplanation.mockResolvedValue({ explanation: "..." });
      const response = res();
      await captured.handlers["POST /generated-puzzles/item-explanation"](
        req({ body: { puzzleSlug: "test", selectedChoiceId: "c1" }, user: null }),
        response,
      );
      expect(mocks.buildExplanation).toHaveBeenCalledWith(
        expect.objectContaining({ puzzleSlug: "test", currentUserId: null }),
      );
      expect(response.status).toHaveBeenCalledWith(200);
    });
  });

  describe("GET /generated-puzzles/requests/:requestId/draft", () => {
    it("returns generated puzzle draft", async () => {
      mocks.getGeneratedPuzzleDraftByRequestId.mockResolvedValue({ draft: true });
      const response = res();
      await captured.handlers["GET /generated-puzzles/requests/:requestId/draft"](
        req({ params: { requestId: "r1" }, user: { id: "u1" } }),
        response,
      );
      expect(response.json).toHaveBeenCalledWith({ draft: true });
    });
  });

  describe("GET /generated-puzzles/requests/:requestId", () => {
    it("returns generated puzzle request", async () => {
      mocks.getGeneratedPuzzleRequestById.mockResolvedValue({ status: "done" });
      const response = res();
      await captured.handlers["GET /generated-puzzles/requests/:requestId"](
        req({ params: { requestId: "r1" }, user: { id: "u1" } }),
        response,
      );
      expect(response.json).toHaveBeenCalledWith({ status: "done" });
    });
  });

  describe("GET /riot/account/:gameName/:tagLine", () => {
    it("returns riot account profile", async () => {
      mocks.getAccountProfile.mockResolvedValue({ puuid: "abc" });
      const response = res();
      await captured.handlers["GET /riot/account/:gameName/:tagLine"](
        req({ params: { gameName: "Faker", tagLine: "T1" } }),
        response,
      );
      expect(mocks.getAccountProfile).toHaveBeenCalledWith("Faker", "T1");
    });
  });

  describe("GET /players/search", () => {
    it("searches players by riot id", async () => {
      mocks.getPublicPlayerProfile.mockResolvedValue({ profile: {} });
      const response = res();
      await captured.handlers["GET /players/search"](
        req({ query: { riotId: "Faker#T1", count: "5" } }),
        response,
      );
      expect(mocks.getPublicPlayerProfile).toHaveBeenCalledWith("Faker", "T1", 5);
    });
  });

  describe("GET /players/suggestions", () => {
    it("returns player autocomplete suggestions", async () => {
      mocks.getPlayerAutocomplete.mockResolvedValue([{ username: "Faker" }]);
      const response = res();
      await captured.handlers["GET /players/suggestions"](
        req({ query: { q: "Fak", count: "8" } }),
        response,
      );
      expect(mocks.getPlayerAutocomplete).toHaveBeenCalledWith("Fak", 8);
    });
  });

  describe("POST /riot/import-matches", () => {
    it("imports recent matches for user", async () => {
      mocks.importRecentMatches.mockResolvedValue({ imported: 3 });
      const response = res();
      await captured.handlers["POST /riot/import-matches"](
        req({ body: { puuid: "abc-def", count: 5 }, user: { id: "u1" } }),
        response,
      );
      expect(mocks.importRecentMatches).toHaveBeenCalledWith("u1", "abc-def", 5);
      expect(response.status).toHaveBeenCalledWith(201);
    });
  });

  describe("POST /sync/champions", () => {
    it("syncs champions", async () => {
      mocks.syncChampions.mockResolvedValue({ synced: 150 });
      const response = res();
      await captured.handlers["POST /sync/champions"](req(), response);
      expect(response.json).toHaveBeenCalledWith({ synced: 150 });
    });
  });

  describe("POST /sync/items", () => {
    it("syncs items", async () => {
      mocks.syncItems.mockResolvedValue({ synced: 200 });
      const response = res();
      await captured.handlers["POST /sync/items"](req(), response);
      expect(response.json).toHaveBeenCalledWith({ synced: 200 });
    });
  });

  describe("POST /sync/assets", () => {
    it("syncs assets", async () => {
      mocks.syncAssets.mockResolvedValue({ synced: 50 });
      const response = res();
      await captured.handlers["POST /sync/assets"](req(), response);
      expect(response.json).toHaveBeenCalledWith({ synced: 50 });
    });
  });
});
