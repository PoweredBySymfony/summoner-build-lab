import {
  GeneratedPuzzleRequestStatus,
  Prisma,
  PuzzleChoiceType,
  PuzzleDifficulty,
  PuzzleMode,
  PuzzleSourceType,
  Role,
} from "@prisma/client";
import { prisma } from "../prisma.js";
import { shuffleResolvedChoices } from "./puzzleBusinessRules.js";
import { type PreparedSnapshotAttempt } from "./snapshotAttemptEvaluator.js";
import { resolveItemSlug } from "../itemSlugAliases.js";
import { slugify } from "../slug.js";

export async function getItemsBySlugs(slugs: string[]) {
  const requested = [...new Set(slugs.map((slug) => resolveItemSlug(slug)))];
  const items = await prisma.item.findMany({
    where: {
      slug: { in: requested },
    },
  });
  return new Map(items.map((item) => [item.slug, item]));
}

export async function persistAiGeneratedPuzzle(input: {
  championId: string;
  championName: string;
  championSlug: string;
  attempt: PreparedSnapshotAttempt;
  draft: boolean;
  seriesIndex: number;
  primary: boolean;
}) {
  const choiceSlugs = [
    input.attempt.resolvedChoices.goodAnswer.slug,
    ...input.attempt.resolvedChoices.distractors.map((item) => item.slug),
  ];
  const itemIndex = await getItemsBySlugs(choiceSlugs);
  const orderedChoices = shuffleResolvedChoices(
    input.attempt.resolvedChoices.goodAnswer,
    input.attempt.resolvedChoices.distractors,
    input.attempt.variationSeed,
  );
  const metadataSummary = [
    `lowConfidence=${input.attempt.seed.lowConfidence}`,
    `confidence=${input.attempt.seed.confidenceScore.toFixed(4)}`,
    `gap=${input.attempt.seed.confidenceGap.toFixed(4)}`,
    `candidatePoolSize=${input.attempt.seed.candidatePoolSize}`,
    `snapshotMinute=${input.attempt.snapshot.timestampMinutes.toFixed(2)}`,
    `snapshotIndex=${input.attempt.snapshotIndex}`,
    `qualityScore=${input.attempt.qualityScore.toFixed(2)}`,
    `variationSeed=${input.attempt.variationSeed}`,
    `choiceSignature=${input.attempt.choiceSignature}`,
  ].join(" | ");
  const uniqueSlugSeed = [
    input.championSlug,
    "ai-generated",
    Date.now(),
    process.hrtime.bigint().toString(),
    input.attempt.snapshotIndex,
    input.seriesIndex + 1,
    input.attempt.variationSeed,
  ].join("-");

  let difficulty: PuzzleDifficulty;
  if (input.attempt.seed.difficulty === "easy") {
    difficulty = PuzzleDifficulty.BEGINNER;
  } else if (input.attempt.seed.difficulty === "medium") {
    difficulty = PuzzleDifficulty.INTERMEDIATE;
  } else {
    difficulty = PuzzleDifficulty.ADVANCED;
  }

  return prisma.puzzle.create({
    data: {
      title: `${input.championName} AI item puzzle`,
      slug: slugify(uniqueSlugSeed),
      mode: PuzzleMode.PERSONALIZED,
      sourceType: PuzzleSourceType.AI_GENERATED,
      difficulty,
      patch: input.attempt.snapshot.patch,
      description: input.draft
        ? `Brouillon genere par le service ML pour ${input.championName}, a revoir avant toute publication.`
        : `Puzzle genere par le service ML pour ${input.championName}.`,
      shortPrompt: input.draft
        ? `Brouillon ML faible confiance pour ${input.championName}.`
        : `Le modele propose le prochain item le plus coherent pour ${input.championName}.`,
      situation: `Tu joues ${input.championName} vers ${input.attempt.snapshot.timestampMinutes.toFixed(1)} minutes avec ${input.attempt.snapshot.goldAvailable} gold disponible.`,
      question: "Quel est le meilleur prochain achat dans cette situation ?",
      explanation: `La prediction ML privilegie ${itemIndex.get(resolveItemSlug(input.attempt.resolvedChoices.goodAnswer.slug))?.name ?? input.attempt.resolvedChoices.goodAnswer.slug}.`,
      role: input.attempt.snapshot.role,
      championId: input.championId,
      isPublished: false,
      isDailyEligible: false,
      choices: {
        create: orderedChoices.map(({ item: resolvedItem, isCorrect }, index) => {
          const item = itemIndex.get(resolveItemSlug(resolvedItem.slug))!;
          return {
            label: item.name,
            choiceType: item.isBoots ? PuzzleChoiceType.BOOTS : PuzzleChoiceType.ITEM,
            itemId: item.id,
            explanation: isCorrect
              ? "Choix principal du modele ranking."
              : "Distracteur plausible propose pour revue manuelle.",
            isCorrect,
            displayOrder: index + 1,
          };
        }),
      },
      scenario: {
        create: {
          playerChampionId: input.championId,
          playerRole: input.attempt.snapshot.role ?? Role.FLEX,
          gameMinute: Math.max(1, Math.round(input.attempt.snapshot.timestampMinutes)),
          playerGold: input.attempt.snapshot.goldAvailable,
          playerLevel: input.attempt.snapshot.level,
          kills: input.attempt.snapshot.kills,
          deaths: input.attempt.snapshot.deaths,
          assists: input.attempt.snapshot.assists,
          cs: input.attempt.snapshot.cs,
          currentBuild: input.attempt.scenario.currentBuild as Prisma.InputJsonValue,
          allyTeam: input.attempt.scenario.allyTeam as Prisma.InputJsonValue,
          enemyTeam: input.attempt.scenario.enemyTeam as Prisma.InputJsonValue,
          objectiveState: input.attempt.businessRules.objectiveState as Prisma.InputJsonValue,
          damageProfile: input.attempt.businessRules.damageProfile as Prisma.InputJsonValue,
          mapState: input.attempt.businessRules.mapState as Prisma.InputJsonValue,
          notes: `${input.attempt.businessRules.notes} ${metadataSummary}`,
        },
      },
      tags: {
        create: [
          "ai-generated",
          "ml",
          "next-item",
          "ml-draft",
          "ml-series",
          ...(input.primary ? ["ml-series-primary"] : []),
          ...(input.draft ? ["low-confidence"] : []),
        ].map((tag) => ({
          tag: {
            connectOrCreate: {
              where: { slug: slugify(tag) },
              create: { slug: slugify(tag), name: tag },
            },
          },
        })),
      },
    },
  });
}

export async function updateGeneratedRequest(input: {
  requestId: string;
  status: GeneratedPuzzleRequestStatus;
  parameters: Prisma.InputJsonValue;
  resultPuzzleId?: string;
}) {
  await prisma.generatedPuzzleRequest.update({
    where: { id: input.requestId },
    data: {
      status: input.status,
      parameters: input.parameters,
      resultPuzzleId: input.resultPuzzleId,
    },
  });
}
