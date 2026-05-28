import { PuzzleSourceType } from "@prisma/client";

import { prisma } from "../server/src/lib/prisma.js";

type CliOptions = {
  limit: number;
  applyQuarantine: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const limitIndex = argv.findIndex((arg) => arg === "--limit");
  return {
    limit: limitIndex === -1 ? 250 : Number(argv[limitIndex + 1] ?? "250"),
    applyQuarantine: argv.includes("--apply-quarantine"),
  };
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((entry) => String(entry)).filter(Boolean) : [];
}

function getPublishabilityFloorGold(playerGold: number) {
  return Math.max(900, Math.round(Math.max(0, playerGold) * 0.35));
}

function isLegitimateBridgeComponent(input: {
  goldTotal: number;
  playerGold: number;
  buildsInto: unknown;
  isLegendary: boolean;
  isBoots: boolean;
  isConsumable: boolean;
  isStarter: boolean;
  isTrinket: boolean;
}) {
  if (
    input.isLegendary
    || input.isBoots
    || input.isConsumable
    || input.isStarter
    || input.isTrinket
  ) {
    return false;
  }

  if (input.goldTotal < Math.max(750, Math.round(input.playerGold * 0.25))) {
    return false;
  }

  return asStringArray(input.buildsInto).length > 0;
}

function getDistractorDecisionBand(goodAnswerGold: number, playerGold: number) {
  const baseline = Math.max(goodAnswerGold, getPublishabilityFloorGold(playerGold));
  return Math.max(750, Math.round(baseline * 0.55));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const requests = await prisma.generatedPuzzleRequest.findMany({
    where: {
      resultPuzzle: {
        sourceType: PuzzleSourceType.AI_GENERATED,
      },
    },
    orderBy: { createdAt: "desc" },
    take: options.limit,
    include: {
      resultPuzzle: {
        include: {
          scenario: true,
          choices: {
            include: {
              item: true,
            },
            orderBy: { displayOrder: "asc" },
          },
        },
      },
    },
  });

  const audited = [];
  let quarantinedCount = 0;

  for (const request of requests) {
    const puzzle = request.resultPuzzle;
    if (!puzzle?.scenario) {
      continue;
    }

    const correctChoice = puzzle.choices.find((choice) => choice.isCorrect);
    const distractorItems = puzzle.choices.filter((choice) => !choice.isCorrect && choice.item).map((choice) => choice.item!);
    const reasons: string[] = [];
    const playerGold = puzzle.scenario.playerGold;

    if (!correctChoice?.item) {
      reasons.push("missing-correct-item");
    } else {
      const goodAnswer = correctChoice.item;
      const floorGold = getPublishabilityFloorGold(playerGold);
      const legitimateComponent = isLegitimateBridgeComponent({
        goldTotal: goodAnswer.goldTotal,
        playerGold,
        buildsInto: goodAnswer.buildsInto,
        isLegendary: goodAnswer.isLegendary,
        isBoots: goodAnswer.isBoots,
        isConsumable: goodAnswer.isConsumable,
        isStarter: goodAnswer.isStarter,
        isTrinket: goodAnswer.isTrinket,
      });

      if (goodAnswer.goldTotal < floorGold && !legitimateComponent) {
        reasons.push("trivial-good-answer");
      }

      const decisionBand = getDistractorDecisionBand(goodAnswer.goldTotal, playerGold);
      const credibleDistractors = distractorItems.filter((item) => Math.abs(item.goldTotal - goodAnswer.goldTotal) <= decisionBand);
      if (credibleDistractors.length < 3) {
        reasons.push("insufficient-credible-distractors");
      }
    }

    if (reasons.length === 0) {
      continue;
    }

    const entry = {
      requestId: request.id,
      puzzleId: puzzle.id,
      slug: puzzle.slug,
      title: puzzle.title,
      patch: puzzle.patch,
      playerGold,
      goodAnswer: correctChoice?.item
        ? {
            slug: correctChoice.item.slug,
            goldTotal: correctChoice.item.goldTotal,
          }
        : null,
      reasons,
    };
    audited.push(entry);

    if (options.applyQuarantine) {
      await prisma.puzzle.update({
        where: { id: puzzle.id },
        data: {
          isPublished: false,
          isDailyEligible: false,
        },
      });

      const parameters = asObject(request.parameters);
      await prisma.generatedPuzzleRequest.update({
        where: { id: request.id },
        data: {
          parameters: {
            ...parameters,
            publishabilityAudit: {
              auditedAt: new Date().toISOString(),
              quarantined: true,
              reasons,
            },
          },
        },
      });
      quarantinedCount += 1;
    }
  }

  console.info(JSON.stringify({
    generatedAt: new Date().toISOString(),
    inspectedRequests: requests.length,
    flaggedPuzzles: audited.length,
    quarantinedCount,
    flagged: audited,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("[audit-ai-puzzles] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
