/**
 * formulaExcavation.logic.ts
 *
 * Pure logic for the formula-excavation engine. No React imports.
 * All functions are independently testable.
 *
 * Responsibilities:
 * - Validate the player's operation choice against the current excavation step
 * - Build the 4-button operation set (1 correct + 3 distractors)
 * - Determine which hint to surface
 * - Compute the composite 0–1 score
 */

import type {
  ExcavationStep,
  FormulaExcavationSharedConfig,
  FormulaExcavationMissionPayload,
  OperationType
} from "./formulaExcavation.config";

// ─── types ────────────────────────────────────────────────────────────────────

export type StepOutcome = "correct" | "invalid";

export interface StepValidation {
  outcome: StepOutcome;
  resultDisplay?: string[];
  isFinal: boolean;
}

export interface OperationButton {
  id: OperationType;
  label: string;
  sublabel: string;
  highlighted?: boolean;
}

export interface ScoringInput {
  wrongAttempts: number;
  hintsUsed: number;
  totalSteps: number;
  optimalSteps: number;
  timeSpentSec: number;
  config: FormulaExcavationSharedConfig;
}

// ─── operation metadata ───────────────────────────────────────────────────────

/**
 * Human-readable labels for every operation type.
 * "label" is shown on the card. "sublabel" explains what it removes.
 */
export const OPERATION_META: Record<OperationType, { label: string; sublabel: string }> = {
  divide_both:   { label: "Divide both sides",        sublabel: "removes multiplication" },
  multiply_both: { label: "Multiply both sides",      sublabel: "removes division" },
  subtract_both: { label: "Subtract from both sides", sublabel: "removes addition" },
  add_both:      { label: "Add to both sides",        sublabel: "removes subtraction" },
  square_root:   { label: "Square root both sides",   sublabel: "removes a square" },
  square_both:   { label: "Square both sides",        sublabel: "removes a square root" },
  cube_root:     { label: "Cube root both sides",     sublabel: "removes a cube" },
  cube_both:     { label: "Cube both sides",          sublabel: "removes a cube root" }
};

/**
 * Default distractor pool for each correct operation.
 * Each entry is [wrong-direction, wrong-category, plausible-but-wrong].
 * These represent the three most common student misconceptions for that step.
 */
const DEFAULT_DISTRACTORS: Record<OperationType, [OperationType, OperationType, OperationType]> = {
  divide_both:   ["multiply_both", "subtract_both", "square_root"],
  multiply_both: ["divide_both",   "add_both",      "square_both"],
  subtract_both: ["add_both",      "divide_both",   "multiply_both"],
  add_both:      ["subtract_both", "multiply_both", "divide_both"],
  square_root:   ["square_both",   "divide_both",   "cube_root"],
  square_both:   ["square_root",   "multiply_both", "cube_both"],
  cube_root:     ["cube_both",     "square_root",   "divide_both"],
  cube_both:     ["cube_root",     "multiply_both", "square_both"]
};

// ─── validation ───────────────────────────────────────────────────────────────

/**
 * Check whether the player's chosen operation is correct for this step.
 *
 * Unlike stepwise-equation-solver there is no "suboptimal" outcome here:
 * change of subject has one correct inverse operation per obstacle.
 * Any other choice is simply wrong — the student tries again.
 */
export function validateStep(
  chosen: OperationType,
  currentStep: ExcavationStep
): StepValidation {
  if (chosen === currentStep.operation) {
    return {
      outcome: "correct",
      resultDisplay: currentStep.resultDisplay,
      isFinal: currentStep.isFinal ?? false
    };
  }
  return { outcome: "invalid", isFinal: false };
}

// ─── operation buttons ────────────────────────────────────────────────────────

/**
 * Build the 4-button set for the current step:
 * 1 correct operation + 3 distractors, shuffled.
 *
 * Uses authored stepDistractors from mission payload when available;
 * falls back to DEFAULT_DISTRACTORS.
 * The highlighted flag is set when hintLevel >= 2 (reveal-the-answer hint).
 */
export function buildOperationButtons(
  currentStep: ExcavationStep,
  stepIndex: number,
  payload: FormulaExcavationMissionPayload,
  hintLevel: number
): OperationButton[] {
  const correct = currentStep.operation;

  // Get distractor operation IDs
  let distractorOps: OperationType[];
  const authored = payload.stepDistractors?.[stepIndex];
  if (authored && authored.length === 3) {
    distractorOps = authored.map((d) => d.operation);
  } else {
    distractorOps = [...DEFAULT_DISTRACTORS[correct]];
  }

  const buttons: OperationButton[] = [
    {
      id: correct,
      ...OPERATION_META[correct],
      highlighted: hintLevel >= 2
    },
    ...distractorOps.map((op) => ({
      id: op,
      ...OPERATION_META[op],
      highlighted: false
    }))
  ];

  // Shuffle so correct answer isn't always first
  // Using a deterministic-ish shuffle seeded on stepIndex so it's stable
  // within a session but varies across steps.
  const seed = stepIndex * 7 + 3;
  return buttons.sort((_, __, i = seed) => (i % 3) - 1).sort(() => Math.random() - 0.5);
}

// ─── hints ───────────────────────────────────────────────────────────────────

/**
 * Determine which hint level to surface based on wrong attempts.
 * Returns -1 (no hint), 0, 1, or 2 (most specific / reveal).
 */
export function resolveHintLevel(wrongAttemptsOnStep: number, hintAfterAttempts: number): number {
  if (wrongAttemptsOnStep < hintAfterAttempts) return -1;
  if (wrongAttemptsOnStep < hintAfterAttempts + 1) return 0;
  if (wrongAttemptsOnStep < hintAfterAttempts + 2) return 1;
  return 2;
}

/**
 * Get the hint text for the current step and hint level.
 * Falls back from per-step hints → shared hint levels.
 */
export function resolveHintText(
  hintLevel: number,
  stepIndex: number,
  payload: FormulaExcavationMissionPayload,
  sharedHintLevels: string[]
): string {
  const perStep = payload.stepHints?.[stepIndex];
  if (perStep) {
    return perStep[Math.min(hintLevel, perStep.length - 1)];
  }
  return sharedHintLevels[Math.min(hintLevel, sharedHintLevels.length - 1)];
}

// ─── scoring ─────────────────────────────────────────────────────────────────

/**
 * Compute a 0–1 composite score from:
 * - Strategy: how many wrong attempts were made
 * - Efficiency: steps taken vs optimal (always 1:1 here, so this is purity)
 * - Hints: did the student need hints
 * - Speed: how fast vs a baseline
 */
export function computeScore(input: ScoringInput): number {
  const { wrongAttempts, hintsUsed, totalSteps, optimalSteps, timeSpentSec, config } = input;
  const { strategyWeight, efficiencyWeight, hintWeight, speedWeight, speedBaselineSec } =
    config.scoring;

  // Strategy: perfect = 0 wrong, decays by 15% per wrong attempt
  const strategyScore = Math.max(0, 1 - wrongAttempts * 0.15);

  // Efficiency: always 1 for change of subject (no suboptimal paths)
  const efficiencyScore = optimalSteps > 0 ? Math.min(1, optimalSteps / Math.max(optimalSteps, totalSteps)) : 1;

  // Hints: 0.1 deduction per hint used
  const hintScore = Math.max(0, 1 - hintsUsed * 0.1);

  // Speed
  const speedScore =
    timeSpentSec <= speedBaselineSec
      ? 1
      : Math.max(0, 1 - (timeSpentSec - speedBaselineSec) / speedBaselineSec);

  return (
    strategyScore   * strategyWeight +
    efficiencyScore * efficiencyWeight +
    hintScore       * hintWeight +
    speedScore      * speedWeight
  );
}

export function computeEfficiency(optimalSteps: number, totalSteps: number): number {
  if (optimalSteps <= 0) return 1;
  return Math.min(1, optimalSteps / Math.max(optimalSteps, totalSteps));
}

// ─── guided descriptions ──────────────────────────────────────────────────────

/**
 * In "guided" stage, Nova explains the step before the player taps.
 * Returns a one-sentence explanation of WHY this inverse operation works.
 */
export function getGuidedDescription(op: OperationType, obstacleLabel: string): string {
  switch (op) {
    case "divide_both":
      return `${obstacleLabel} is being multiplied. Dividing both sides removes it.`;
    case "multiply_both":
      return `${obstacleLabel} is dividing the variable. Multiplying both sides removes the fraction.`;
    case "subtract_both":
      return `${obstacleLabel} is being added. Subtracting it from both sides cancels it out.`;
    case "add_both":
      return `${obstacleLabel} is being subtracted. Adding it to both sides brings it across.`;
    case "square_root":
      return `The variable is squared. Taking the square root of both sides removes the square.`;
    case "square_both":
      return `The variable is under a square root. Squaring both sides removes it.`;
    case "cube_root":
      return `The variable is cubed. Taking the cube root of both sides frees it.`;
    case "cube_both":
      return `The variable is under a cube root. Cubing both sides removes it.`;
  }
}
