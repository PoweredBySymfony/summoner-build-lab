import { PuzzleDifficulty, PuzzleMode, Role } from "@prisma/client";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { attachUser, requireAdmin } from "../middleware/authMiddleware.js";
import { adminService } from "../services/adminService.js";

const router = Router();

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(attachUser, adminLimiter, requireAdmin);

router.get("/admin/overview", async (_request, response, next) => {
  try {
    response.json(await adminService.getOverview());
  } catch (error) {
    next(error);
  }
});

router.get("/admin/champions", async (_request, response, next) => {
  try {
    response.json(await adminService.listChampions());
  } catch (error) {
    next(error);
  }
});

router.patch("/admin/champions/:id", async (request, response, next) => {
  try {
    const payload = z.object({
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
      stats: z.record(z.any()).optional(),
    }).parse(request.body) as Parameters<typeof adminService.updateChampion>[1];

    response.json(await adminService.updateChampion(request.params.id, payload));
  } catch (error) {
    next(error);
  }
});

router.get("/admin/items", async (_request, response, next) => {
  try {
    response.json(await adminService.listItems());
  } catch (error) {
    next(error);
  }
});

router.patch("/admin/items/:id", async (request, response, next) => {
  try {
    const payload = z.object({
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
      stats: z.record(z.any()).optional(),
      buildsFrom: z.array(z.string()).optional(),
      buildsInto: z.array(z.string()).optional(),
    }).parse(request.body) as Parameters<typeof adminService.updateItem>[1];

    response.json(await adminService.updateItem(request.params.id, payload));
  } catch (error) {
    next(error);
  }
});

router.get("/admin/puzzles", async (_request, response, next) => {
  try {
    response.json(await adminService.listPuzzles());
  } catch (error) {
    next(error);
  }
});

router.get("/admin/puzzles/:id", async (request, response, next) => {
  try {
    response.json(await adminService.getPuzzleDetail(request.params.id));
  } catch (error) {
    next(error);
  }
});

router.patch("/admin/puzzles/:id", async (request, response, next) => {
  try {
    const payload = z.object({
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
    }).parse(request.body) as Parameters<typeof adminService.updatePuzzle>[1];

    response.json(await adminService.updatePuzzle(request.params.id, payload));
  } catch (error) {
    next(error);
  }
});

router.get("/admin/patch-status", async (_request, response, next) => {
  try {
    response.json(await adminService.getPatchStatus());
  } catch (error) {
    next(error);
  }
});

router.post("/admin/patch-sync", async (request, response, next) => {
  try {
    const payload = z.object({
      version: z.string().optional(),
    }).parse(request.body ?? {});

    response.json(await adminService.syncPatch(payload.version));
  } catch (error) {
    next(error);
  }
});

export { router as adminRoutes };
