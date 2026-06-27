/**
 * engines/tile-match/tileMatch.config.ts
 *
 * tile-match engine — config schema.
 *
 * Engine family: a clue is shown; the player taps the tile(s) that satisfy
 * it from a grid; correct resolves instantly to the next round; the WHOLE
 * SESSION (not one round) is the unit GameRuntime treats as "one mission" —
 * this engine internally loops many rounds against a session timer and
 * calls onComplete exactly once, at session end, with the aggregate result.
 *
 * Split to match Game/Mission tables: SharedConfig holds things true for
 * every session of this game (clue tiers, timing, hint rules); since this
 * engine has no discrete "missions" in the Build-The-Atom sense, the
 * Mission.payload is intentionally minimal (just xpReward + topic linkage,
 * reused from the standard Mission row shape).
 */

import { z } from "zod";

export const ClueTypeSchema = z.enum(["atomic_number", "group", "valence"]);

export const TierSchema = z.object({
  tier: z.number().int().min(1),
  clueTypes: z.array(ClueTypeSchema).min(1),
  advanceAfterCorrect: z.number().int().positive(),
  advanceAfterSec: z.number().int().positive()
});

export const TileMatchSharedConfigSchema = z.object({
  sessionDurationSec: z.number().int().positive().default(60),
  tileCount: z.number().int().min(4).max(9).default(6),
  tiers: z.array(TierSchema).min(1),
  scoring: z.object({
    baseCorrectPoints: z.number().int().positive().default(10),
    streakBonusPerLevel: z.number().int().nonnegative().default(2),
    streakBonusCap: z.number().int().positive().default(5),
    wrongAnswerTimePenaltySec: z.number().int().nonnegative().default(2),
    hintTimePenaltySec: z.number().int().nonnegative().default(3)
  }),
  hints: z.object({
    enabled: z.boolean().default(true),
    showAfterWrongAttempts: z.number().int().positive().default(1)
  }),
  elementPool: z.array(z.string()).min(6)
});

export type TileMatchSharedConfig = z.infer<typeof TileMatchSharedConfigSchema>;
export type Tier = z.infer<typeof TierSchema>;
export type ClueType = z.infer<typeof ClueTypeSchema>;

export interface TileMatchConfig {
  shared: TileMatchSharedConfig;
  mission: {
    id: string;
    xpReward: number;
  };
}

export interface TileMatchOutcome {
  success: true;
  score: number;
  finalScore: number;
  bestStreak: number;
  roundsAnswered: number;
  roundsCorrect: number;
  highestTierReached: number;
  timeSpentSec: number;
}
