export type GuildDifficulty = 'normal' | 'wildscape' | 'primal';

export type GuildDifficultyTier = {
  difficulty: GuildDifficulty;
  minimumLevel: number;
  maximumLevel: number | null;
  points: number;
};

export const DEFAULT_GUILD_DIFFICULTY_TIERS: readonly GuildDifficultyTier[] = [
  { difficulty: 'normal', minimumLevel: 0, maximumLevel: 149, points: 150 },
  { difficulty: 'wildscape', minimumLevel: 150, maximumLevel: 349, points: 300 },
  { difficulty: 'primal', minimumLevel: 350, maximumLevel: null, points: 600 },
];

export type GuildDifficultyAllocation = Record<GuildDifficulty, number>;

export type GuildDifficultyPolicy = 'current' | 'previous' | 'review';

export type GuildDifficultyConfidence = 'estimated' | 'exact' | 'manual';

export type GuildDifficultyTransition = {
  from: GuildDifficulty;
  to: GuildDifficulty;
};

export type GuildDifficultyEstimate = {
  allocation: GuildDifficultyAllocation;
  confidence: GuildDifficultyConfidence;
  transition: GuildDifficultyTransition | null;
};

export function emptyGuildDifficultyAllocation(): GuildDifficultyAllocation {
  return { normal: 0, wildscape: 0, primal: 0 };
}

export function getGuildDifficultyForLevel(
  level: number | null | undefined,
  tiers: readonly GuildDifficultyTier[] = DEFAULT_GUILD_DIFFICULTY_TIERS,
): GuildDifficultyTier | null {
  if (level === null || level === undefined || !Number.isFinite(level) || level < 0) {
    return null;
  }
  return (
    tiers.find(
      (tier) =>
        level >= tier.minimumLevel && (tier.maximumLevel === null || level <= tier.maximumLevel),
    ) ?? null
  );
}

export function sumGuildDifficultyAllocation(allocation: GuildDifficultyAllocation): number {
  return allocation.normal + allocation.wildscape + allocation.primal;
}

export function pointsForGuildDifficultyAllocation(
  allocation: GuildDifficultyAllocation,
  tiers: readonly GuildDifficultyTier[] = DEFAULT_GUILD_DIFFICULTY_TIERS,
): number {
  return (Object.keys(allocation) as GuildDifficulty[]).reduce((total, difficulty) => {
    const tier = tiers.find((candidate) => candidate.difficulty === difficulty);
    return total + allocation[difficulty] * (tier?.points ?? 0);
  }, 0);
}

export function isValidGuildDifficultyAllocation(
  allocation: GuildDifficultyAllocation | null | undefined,
  expectedDailies: number,
): allocation is GuildDifficultyAllocation {
  return Boolean(
    allocation &&
    (['normal', 'wildscape', 'primal'] as GuildDifficulty[]).every(
      (difficulty) => Number.isInteger(allocation[difficulty]) && allocation[difficulty] >= 0,
    ) &&
    sumGuildDifficultyAllocation(allocation) === expectedDailies,
  );
}

export function estimateGuildDifficultyAllocation(
  dailies: number,
  currentLevel: number | null | undefined,
  previousLevel: number | null | undefined,
  policy: GuildDifficultyPolicy = 'current',
  tiers: readonly GuildDifficultyTier[] = DEFAULT_GUILD_DIFFICULTY_TIERS,
): GuildDifficultyEstimate {
  const allocation = emptyGuildDifficultyAllocation();
  const currentTier = getGuildDifficultyForLevel(currentLevel, tiers);
  const previousTier = getGuildDifficultyForLevel(previousLevel, tiers);
  const transition =
    currentTier && previousTier && currentTier.difficulty !== previousTier.difficulty
      ? { from: previousTier.difficulty, to: currentTier.difficulty }
      : null;

  const selectedTier =
    transition && policy === 'previous' ? previousTier : (currentTier ?? previousTier);

  if (selectedTier && dailies > 0) allocation[selectedTier.difficulty] = dailies;

  return {
    allocation,
    confidence: transition || !previousLevel ? 'estimated' : 'exact',
    transition,
  };
}
