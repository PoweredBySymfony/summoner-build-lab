import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { puzzleRepository } from "../repositories/puzzleRepository.js";
import { env } from "../config/env.js";
import { getMongoHealth } from "../lib/mongo.js";
import { attachUser, requireAuth, requireSyncAccess } from "../middleware/authMiddleware.js";
import { appService } from "../services/appService.js";
import { authService } from "../services/authService.js";
import { dailyChallengeService } from "../services/dailyChallengeService.js";
import { GOOGLE_OAUTH_STATE_COOKIE, GOOGLE_OAUTH_STATE_TTL_MS, oauthService } from "../services/oauthService.js";
import { itemExplanationService } from "../services/itemExplanationService.js";
import { progressService } from "../services/progressService.js";
import { puzzleGenerationService } from "../services/puzzleGenerationService.js";
import { riotSyncService } from "../services/riotSyncService.js";
import { clearSessionCookie, setSessionCookie } from "../lib/session.js";
import { asyncRoute } from "../utils/asyncRoute.js";
import { HttpError } from "../utils/http.js";

const router = Router();
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});
const playerSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});
const itemExplanationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de demandes de preuve item. Patientez quelques secondes puis relancez l'analyse." },
});

router.use(attachUser);

router.get("/health", asyncRoute(async (_request, response) => {
  const mongo = await getMongoHealth();
  response.json({ ok: true, mongo });
}));

router.get("/auth/me", asyncRoute(async (request, response) => {
  if (!request.user) {
    response.json({ user: null });
    return;
  }

  const user = await authService.getUser(request.user.id);
  response.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      isAdmin: user.isAdmin,
      avatarUrl: user.avatarUrl,
      authProvider: user.authProvider.toLowerCase(),
      hasPassword: Boolean(user.passwordHash),
      linkedGoogle: Boolean(user.googleId),
    },
  });
}));

router.post("/auth/register", authLimiter, asyncRoute(async (request, response) => {
  const payload = z.object({
    email: z.string().email(),
    username: z.string().min(3).max(24),
    password: z.string().min(8).max(128),
  }).parse(request.body) as { email: string; username: string; password: string };

  const user = await authService.register(payload);
  setSessionCookie(response, user);
  response.status(201).json({ user });
}));

router.post("/auth/login", authLimiter, asyncRoute(async (request, response) => {
  const payload = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
  }).parse(request.body) as { email: string; password: string };

  const user = await authService.login(payload.email, payload.password);
  setSessionCookie(response, user);
  response.json({ user });
}));

router.post("/auth/logout", (_request, response) => {
  clearSessionCookie(response);
  response.status(204).send();
});

router.get("/auth/google/url", authLimiter, asyncRoute((_request, response) => {
  const payload = oauthService.createGoogleAuthorizationRequest();
  response.cookie(GOOGLE_OAUTH_STATE_COOKIE, payload.state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: GOOGLE_OAUTH_STATE_TTL_MS,
    path: "/",
  });
  response.json({ url: payload.url });
}));

router.get("/auth/google/callback", authLimiter, asyncRoute(async (request, response) => {
  const payload = z.object({
    code: z.string().min(1),
    state: z.string().min(1),
  }).parse(request.query) as { code: string; state: string };

  oauthService.validateGoogleState(payload.state, request.cookies?.[GOOGLE_OAUTH_STATE_COOKIE]);
  response.clearCookie(GOOGLE_OAUTH_STATE_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  const user = await oauthService.handleGoogleCallback(payload.code);
  setSessionCookie(response, user);
  response.redirect(`${env.APP_URL}/dashboard`);
}));

router.get("/bootstrap", asyncRoute(async (request, response) => {
  response.json(await appService.getBootstrap(request.user?.id));
}));

router.get("/catalog", asyncRoute(async (_request, response) => {
  response.json(await appService.getCatalog());
}));

router.get("/puzzles", asyncRoute(async (request, response) => {
  const query = z.object({
    championSlug: z.string().optional(),
    mode: z.string().optional(),
    limit: z.coerce.number().optional(),
  }).parse(request.query);

  response.json(await appService.getPuzzles(query));
}));

router.get("/puzzles/:slug", asyncRoute(async (request, response) => {
  const puzzle = await appService.getPuzzleDetail(String(request.params.slug), request.user);
  if (!puzzle) {
    throw new HttpError(404, "Puzzle introuvable.");
  }

  response.json(puzzle);
}));

router.post("/puzzles/:slug/attempts", asyncRoute(async (request, response) => {
  const payload = z.object({
    selectedChoiceId: z.string().min(1),
    responseTimeMs: z.number().int().positive().optional(),
  }).parse(request.body);

  const puzzle = await puzzleRepository.findBySlug(String(request.params.slug));
  if (!puzzle) {
    throw new HttpError(404, "Puzzle introuvable.");
  }

  const choice = puzzle.choices.find((entry) => entry.id === payload.selectedChoiceId);
  if (!choice) {
    throw new HttpError(400, "Le choix selectionne n'appartient pas a ce puzzle.");
  }

  if (request.user) {
    await progressService.recordAttempt({
      userId: request.user.id,
      puzzleId: puzzle.id,
      selectedChoiceId: choice.id,
      isCorrect: choice.isCorrect,
      responseTimeMs: payload.responseTimeMs,
    });
  }

  response.status(201).json({
    saved: Boolean(request.user),
    isCorrect: choice.isCorrect,
    correctChoiceId: puzzle.choices.find((entry) => entry.isCorrect)?.id ?? null,
    explanation: choice.explanation,
    globalExplanation: puzzle.explanation,
    requiresAuth: !request.user,
  });
}));

router.get("/dashboard", requireAuth, asyncRoute(async (request, response) => {
  response.json(await appService.getDashboard(request.user!.id));
}));

router.get("/progress", requireAuth, asyncRoute(async (request, response) => {
  response.json(await progressService.getOverview(request.user!.id));
}));

router.get("/daily-challenge", asyncRoute(async (_request, response) => {
  response.json(await appService.getDailyChallengeDetail());
}));

router.post("/daily-challenge/complete", requireAuth, asyncRoute(async (request, response) => {
  const payload = z.object({
    isCorrect: z.boolean(),
  }).parse(request.body);
  const challenge = await dailyChallengeService.getOrCreateToday();
  const completion = await progressService.completeDailyChallenge({
    userId: request.user!.id,
    dailyChallengeId: challenge.id,
    isCorrect: payload.isCorrect,
  });

  response.status(201).json(completion);
}));

router.get("/champions/:slug", asyncRoute(async (request, response) => {
  const payload = await appService.getChampionLearning(String(request.params.slug), request.user?.id);
  if (!payload) {
    throw new HttpError(404, "Champion not found.");
  }

  response.json(payload);
}));

router.post("/generated-puzzles/champion", requireAuth, asyncRoute(async (request, response) => {
  const payload = z.object({ championId: z.string().min(1) }).parse(request.body);
  response.status(201).json(await puzzleGenerationService.generateChampionPuzzleSeries(payload.championId, request.user!.id));
}));

router.post("/generated-puzzles/match", requireAuth, asyncRoute(async (request, response) => {
  const payload = z.object({
    importedMatchId: z.string().min(1),
    forceDraftOnLowConfidence: z.boolean().optional(),
  }).parse(request.body);
  if (payload.forceDraftOnLowConfidence && !request.user!.isAdmin) {
    throw new HttpError(403, "Le mode brouillon low-confidence est reserve aux administrateurs.");
  }

  response.status(201).json(
    await puzzleGenerationService.generateMatchBasedPuzzle(payload.importedMatchId, request.user!.id, {
      forceDraftOnLowConfidence: payload.forceDraftOnLowConfidence,
      actorIsAdmin: request.user!.isAdmin,
    }),
  );
}));

router.post("/generated-puzzles/item-explanation", itemExplanationLimiter, asyncRoute(async (request, response) => {
  const payload = z.object({
    puzzleSlug: z.string().min(1),
    selectedChoiceId: z.string().min(1).optional(),
    comparedItemSlug: z.string().min(1).optional(),
  }).parse(request.body);

  response.status(200).json(
    await itemExplanationService.buildExplanation({
      puzzleSlug: payload.puzzleSlug,
      selectedChoiceId: payload.selectedChoiceId,
      comparedItemSlug: payload.comparedItemSlug,
      currentUserId: request.user?.id ?? null,
    }),
  );
}));

router.get("/generated-puzzles/requests/:requestId/draft", requireAuth, asyncRoute(async (request, response) => {
  response.json(
    await appService.getGeneratedPuzzleDraftByRequestId(String(request.params.requestId), request.user!),
  );
}));

router.get("/generated-puzzles/requests/:requestId", requireAuth, asyncRoute(async (request, response) => {
  response.json(
    await appService.getGeneratedPuzzleRequestById(String(request.params.requestId), request.user!),
  );
}));

router.get("/riot/account/:gameName/:tagLine", requireAuth, asyncRoute(async (request, response) => {
  response.json(await riotSyncService.getAccountProfile(String(request.params.gameName), String(request.params.tagLine)));
}));

router.get("/players/search", playerSearchLimiter, asyncRoute(async (request, response) => {
  const payload = z.object({
    riotId: z
      .string()
      .trim()
      .regex(/^[^#]+#[^#]+$/, "Le Riot ID doit respecter le format GameName#TAG"),
    count: z.coerce.number().min(1).max(20).default(5),
  }).parse(request.query);

  const [gameName, tagLine] = payload.riotId.split("#");
  response.json(await riotSyncService.getPublicPlayerProfile(gameName, tagLine, payload.count));
}));

router.get("/players/suggestions", playerSearchLimiter, asyncRoute(async (request, response) => {
  const payload = z.object({
    q: z.string().trim().min(1),
    count: z.coerce.number().min(1).max(10).default(8),
  }).parse(request.query);

  response.json(await riotSyncService.getPlayerAutocomplete(payload.q, payload.count));
}));

router.post("/riot/import-matches", requireAuth, playerSearchLimiter, asyncRoute(async (request, response) => {
  const payload = z.object({
    puuid: z.string().min(1),
    count: z.coerce.number().min(1).max(20).default(5),
  }).parse(request.body);
  response.status(201).json(await riotSyncService.importRecentMatches(request.user!.id, payload.puuid, payload.count));
}));

router.post("/sync/champions", syncLimiter, requireSyncAccess, asyncRoute(async (_request, response) => {
  response.json(await riotSyncService.syncChampions());
}));

router.post("/sync/items", syncLimiter, requireSyncAccess, asyncRoute(async (_request, response) => {
  response.json(await riotSyncService.syncItems());
}));

router.post("/sync/assets", syncLimiter, requireSyncAccess, asyncRoute(async (_request, response) => {
  response.json(await riotSyncService.syncAssets());
}));

export { router as appRoutes };
