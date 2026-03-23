import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { catalogRepository } from "../repositories/catalogRepository.js";
import { puzzleRepository } from "../repositories/puzzleRepository.js";
import { appService } from "../services/appService.js";
import { HttpError } from "../utils/http.js";
import { riotSyncService } from "../services/riotSyncService.js";

const router = Router();

router.get("/health", (_request, response) => {
  response.json({ ok: true });
});

router.get("/bootstrap", async (_request, response, next) => {
  try {
    response.json(await appService.getBootstrap());
  } catch (error) {
    next(error);
  }
});

router.get("/modules", async (_request, response, next) => {
  try {
    response.json(await appService.getModules());
  } catch (error) {
    next(error);
  }
});

router.get("/puzzles", async (_request, response, next) => {
  try {
    response.json(await appService.getPuzzleList());
  } catch (error) {
    next(error);
  }
});

router.get("/puzzles/:slug", async (request, response, next) => {
  try {
    const puzzle = await appService.getPuzzleDetail(request.params.slug);

    if (!puzzle) {
      throw new HttpError(404, "Puzzle not found.");
    }

    response.json(puzzle);
  } catch (error) {
    next(error);
  }
});

router.post("/puzzles/:slug/attempts", async (request, response, next) => {
  try {
    const payload = z.object({ selectedChoiceId: z.string().min(1) }).parse(request.body);
    const puzzle = await puzzleRepository.findBySlug(request.params.slug);

    if (!puzzle) {
      throw new HttpError(404, "Puzzle not found.");
    }

    const choice = puzzle.choices.find((entry) => entry.id === payload.selectedChoiceId);
    if (!choice) {
      throw new HttpError(400, "Selected choice does not belong to this puzzle.");
    }

    const user = await catalogRepository.findDemoUser(env.DEMO_USER_USERNAME);
    if (!user) {
      throw new HttpError(500, "Demo user is missing. Run the seed first.");
    }

    const createdAttempt = await puzzleRepository.createAttempt({
      userId: user.id,
      puzzleId: puzzle.id,
      selectedChoiceId: choice.id,
      isCorrect: choice.isCorrect,
    });

    response.status(201).json({
      id: createdAttempt.id,
      isCorrect: choice.isCorrect,
      correctChoiceId: puzzle.choices.find((entry) => entry.isCorrect)?.id ?? null,
      explanation: choice.explanation,
      globalExplanation: puzzle.explanation,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard", async (_request, response, next) => {
  try {
    response.json(await appService.getDashboard(env.DEMO_USER_USERNAME));
  } catch (error) {
    next(error);
  }
});

router.get("/profile", async (_request, response, next) => {
  try {
    response.json(await appService.getDashboard(env.DEMO_USER_USERNAME));
  } catch (error) {
    next(error);
  }
});

router.get("/riot/account/:gameName/:tagLine", async (request, response, next) => {
  try {
    response.json(await riotSyncService.getAccountProfile(request.params.gameName, request.params.tagLine));
  } catch (error) {
    next(error);
  }
});

export { router as appRoutes };
