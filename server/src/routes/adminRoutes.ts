import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  adminChampionUpdateSchema,
  adminItemUpdateSchema,
  adminPuzzleUpdateSchema,
} from "../lib/admin/adminPayloadSchemas.js";
import { attachUser, requireAdmin } from "../middleware/authMiddleware.js";
import { adminService } from "../services/adminService.js";
import { asyncRoute } from "../utils/asyncRoute.js";

const router = Router();

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(attachUser, adminLimiter, requireAdmin);

router.get("/admin/overview", asyncRoute(async (_request, response) => {
  response.json(await adminService.getOverview());
}));

router.get("/admin/champions", asyncRoute(async (_request, response) => {
  response.json(await adminService.listChampions());
}));

router.patch("/admin/champions/:id", asyncRoute(async (request, response) => {
  const payload = adminChampionUpdateSchema.parse(request.body);

  response.json(await adminService.updateChampion(String(request.params.id), payload));
}));

router.delete("/admin/champions/:id", asyncRoute(async (request, response) => {
  response.json(await adminService.deleteChampion(String(request.params.id)));
}));

router.get("/admin/items", asyncRoute(async (_request, response) => {
  response.json(await adminService.listItems());
}));

router.patch("/admin/items/:id", asyncRoute(async (request, response) => {
  const payload = adminItemUpdateSchema.parse(request.body);

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
  const payload = adminPuzzleUpdateSchema.parse(request.body);

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
