type LegacyScenarioBackfillTargets = {
  rebuildAllyTeam: boolean;
  rebuildEnemyTeam: boolean;
  rebuildCurrentBuild: boolean;
  shouldUpdate: boolean;
};

export function isLegacyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

export function classifyLegacyScenarioBackfill(input: {
  allyTeam: unknown;
  enemyTeam: unknown;
  currentBuild: unknown;
}): LegacyScenarioBackfillTargets {
  const rebuildAllyTeam = isLegacyStringArray(input.allyTeam);
  const rebuildEnemyTeam = isLegacyStringArray(input.enemyTeam);
  const rebuildCurrentBuild =
    isLegacyStringArray(input.currentBuild) ||
    (Array.isArray(input.currentBuild) && input.currentBuild.length === 0);

  return {
    rebuildAllyTeam,
    rebuildEnemyTeam,
    rebuildCurrentBuild,
    shouldUpdate: rebuildAllyTeam || rebuildEnemyTeam || rebuildCurrentBuild,
  };
}
