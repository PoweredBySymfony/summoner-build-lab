import { PuzzleDifficulty, PuzzleMode, Role } from "@prisma/client";
import { z } from "zod";

export const adminChampionUpdateSchema = z.object({
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
}).strict();

export const adminItemUpdateSchema = z.object({
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
}).strict();

export const adminPuzzleUpdateSchema = z.object({
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
}).strict();

export type AdminChampionUpdatePayload = z.infer<typeof adminChampionUpdateSchema>;
export type AdminItemUpdatePayload = z.infer<typeof adminItemUpdateSchema>;
export type AdminPuzzleUpdatePayload = z.infer<typeof adminPuzzleUpdateSchema>;
