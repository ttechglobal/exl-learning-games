/**
 * Pure mastery-update function. No DB access, no Supabase import — this is
 * deliberately testable in isolation and swappable if the main platform's
 * formula changes, without touching anything in lib/db or the API routes
 * that call it.
 *
 * Mirrors the main platform's weighted-average shape (Project Brief) so that
 * if/when a shared DB or sync job exists, the numbers mean the same thing on
 * both sides.
 */

export interface MasteryUpdateInput {
  previousScore: number; // 0-1
  previousAttemptsCount: number;
  /** This attempt's outcome, normalized to 0-1. For pass/fail mechanics, success=1, fail=0. */
  outcomeScore: number;
  /** How heavily this single attempt should move the running average. 0.2-0.35 is a reasonable range. */
  weight?: number;
}

export interface MasteryUpdateResult {
  newScore: number;
  newAttemptsCount: number;
  isMastered: boolean;
}

const DEFAULT_WEIGHT = 0.3;
const MASTERY_SCORE_THRESHOLD = 0.8;
const MASTERY_MIN_ATTEMPTS = 3;

export function updateMastery(input: MasteryUpdateInput): MasteryUpdateResult {
  const weight = input.weight ?? DEFAULT_WEIGHT;
  const newScore = input.previousScore * (1 - weight) + input.outcomeScore * weight;
  const newAttemptsCount = input.previousAttemptsCount + 1;
  const isMastered = newScore >= MASTERY_SCORE_THRESHOLD && newAttemptsCount >= MASTERY_MIN_ATTEMPTS;

  return { newScore, newAttemptsCount, isMastered };
}

/** Converts an AttemptResult's success/score fields into the single 0-1 outcomeScore the formula needs. */
export function outcomeScoreFromAttempt(success?: boolean, score?: number): number {
  if (typeof score === "number") return Math.max(0, Math.min(1, score));
  if (typeof success === "boolean") return success ? 1 : 0;
  return 0; // shouldn't happen if the API route validates input correctly
}
