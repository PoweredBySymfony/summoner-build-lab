import { PuzzleDifficulty, PuzzleMode, Role } from "@prisma/client";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { attachUser, requireAdmin } from "../middleware/authMiddleware.js";
import {
  adminService,
  type AdminChampionUpdatePayload,
  type AdminItemUpdatePayload,
  type AdminPuzzleUpdatePayload,
} from "../services/adminService.js";
import { asyncRoute } from "../utils/asyncRoute.js";

const router = Router();

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const championUpdateSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional().nullable(),
  rolePrimary: z.nativeEnum(Role).optional().nullable(),
  roleSecondary: z.nativeEnum(Role).optional().nullable(),
  patch: z.string().min(1),
  isActive: z.boolean(),
  image: z.string().url(),
  iconImage: z.string().url().optional().nullable(),
  splashImage: z.string().url().optional().nullable(),
  tags: z.array(z.string()).optional(),
  stats: z.record(z.unknown()).optional(),
});

const itemUpdateSchema = z.object({
  name: z.string().min(1),
  shortDescription: z.string().optional().nullable(),
  fullDescription: z.string().optional().nullable(),
  image: z.string().url(),
  patch: z.string().min(1),
  category: z.string().optional().nullable(),
  goldTotal: z.number().int().nonnegative(),
  goldBase: z.number().int().nonnegative().optional().nullable(),
  goldSell: z.number().int().nonnegative().optional().nullable(),
  isBoots: z.boolean(),
  isLegendary: z.boolean(),
  isConsumable: z.boolean(),
  isTrinket: z.boolean(),
  isStarter: z.boolean(),
  isActive: z.boolean(),
  activeEffect: z.string().optional().nullable(),
  passiveEffect: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  stats: z.record(z.unknown()).optional(),
  buildsFrom: z.array(z.string()).optional(),
  buildsInto: z.array(z.string()).optional(),
});

const puzzleUpdateSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  mode: z.nativeEnum(PuzzleMode),
  difficulty: z.nativeEnum(PuzzleDifficulty),
  role: z.nativeEnum(Role).optional().nullable(),
  championId: z.string().optional().nullable(),
  patch: z.string().min(1),
  description: z.string().min(1),
  shortPrompt: z.string().min(1),
  situation: z.string().min(1),
  question: z.string().min(1),
  explanation: z.string().min(1),
  isPublished: z.boolean(),
  isDailyEligible: z.boolean(),
});

router.use(attachUser, adminLimiter, requireAdmin);

router.get("/admin/overview", asyncRoute(async (_request, response) => {
  response.json(await adminService.getOverview());
}));

router.get("/admin/champions", asyncRoute(async (_request, response) => {
  response.json(await adminService.listChampions());
}));

router.patch("/admin/champions/:id", asyncRoute(async (request, response) => {
  const payload = championUpdateSchema.parse(request.body) as AdminChampionUpdatePayload;

  response.json(await adminService.updateChampion(String(request.params.id), payload));
}));

router.delete("/admin/champions/:id", asyncRoute(async (request, response) => {
  response.json(await adminService.deleteChampion(String(request.params.id)));
}));

router.get("/admin/items", asyncRoute(async (_request, response) => {
  response.json(await adminService.listItems());
}));

router.patch("/admin/items/:id", asyncRoute(async (request, response) => {
  const payload = itemUpdateSchema.parse(request.body) as AdminItemUpdatePayload;

  response.json(await adminService.updateItem(String(request.params.id), payload));
}));

router.delete("/admin/items/:id", asyncRoute(async (request, response) => {
  response.json(await adminService.deleteItem(String(request.params.id)));
}));

router.get("/admin/puzzles", asyncRoute(async (_request, response) => {
  response.json(await adminService.listPuzzles());
}));

router.get("/admin/puzzles/ai-generated", asyncRoute(async (_request, response) => {
  response.json(await adminService.listAiGeneratedPuzzles());
}));

router.get("/admin/puzzles/:id", asyncRoute(async (request, response) => {
  response.json(await adminService.getPuzzleDetail(String(request.params.id)));
}));

router.patch("/admin/puzzles/:id", asyncRoute(async (request, response) => {
  const payload = puzzleUpdateSchema.parse(request.body) as AdminPuzzleUpdatePayload;

  response.json(await adminService.updatePuzzle(String(request.params.id), payload));
}));

router.post("/admin/puzzles/:id/publish", asyncRoute(async (request, response) => {
  response.json(await adminService.publishPuzzle(String(request.params.id)));
}));

router.delete("/admin/puzzles/:id", asyncRoute(async (request, response) => {
  response.json(await adminService.deletePuzzle(String(request.params.id)));
}));

router.get("/admin/patch-status", asyncRoute(async (_request, response) => {
  response.json(await adminService.getPatchStatus());
}));

router.post("/admin/patch-sync", asyncRoute(async (request, response) => {
  const payload = z.object({
    version: z.string().optional(),
  }).parse(request.body ?? {});

  response.json(await adminService.syncPatch(payload.version));
}));

export { router as adminRoutes };
