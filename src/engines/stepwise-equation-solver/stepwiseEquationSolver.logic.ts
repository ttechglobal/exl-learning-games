/**
 * stepwiseEquationSolver.logic.ts
 *
 * Pure logic for the stepwise-equation-solver engine.
 * No React imports — all functions here are testable in isolation.
 *
 * Responsibilities:
 * - Validate a player's operation choice against the current solution step
 * - Compute efficiency score from the step log
 * - Compute the composite 0–1 score from all scoring factors
 * - Build the operation button set for the current step
 * - Determine which hint level to surface
 */

import type {
  SolutionStep,
  StepwiseEquationSolverSharedConfig,
  StepwiseEquationSolverMissionPayload
} from "./stepwiseEquationSolver.config";

// ─── types ───────────────────────────────────────────────────────────────────

export type OperationType =
  | "add"
  | "subtract"
  | "multiply_eq1"
  | "multiply_eq2"
  | "solve"
  | "substitute";

export type StepOutcome = "correct" | "suboptimal" | "invalid";

export interface StepValidation {
  outcome: StepOutcome;
  /** Human-readable label for the feedback line (substituted into shared.feedback). */
  targetVariable?: string;
  /** For correct steps, the result lines to display in the animation panel. */
  resultDisplay?: string[];
  /** True if this was the final step in the solution path. */
  isFinal: boolean;
}

export interface OperationButton {
  id: OperationType;
  label: string;
  /** Secondary label, e.g. "× 2" for a multiply operation. */
  sublabel?: string;
  /** True if this button should visually pulse as the hint highlight. */
  highlighted?: boolean;
}

export interface ScoringInput {
  wrongAttempts: number;
  hintsUsed: number;
  suboptimalSteps: number;
  totalSteps: number;
  optimalSteps: number;
  timeSpentSec: number;
  config: StepwiseEquationSolverSharedConfig;
}

// ─── validation ──────────────────────────────────────────────────────────────

/**
 * Validate the player's chosen operation against the current solution step
 * and the list of alternative valid operations.
 *
 * The engine walks through `solutionSteps` in order. On each player action:
 *   1. If the chosen operation matches `currentStep.operation` → "correct"
 *   2. If the chosen operation is in `alternativeValidOperations` → "suboptimal"
 *   3. Otherwise → "invalid"
 *
 * "Suboptimal" consumes a step (the player's reasoning was valid) but reduces
 * the efficiency score. "Invalid" does NOT consume a step — the player tries again.
 */
export function validateStep(
  chosenOperation: OperationType,
  currentStep: SolutionStep,
  alternativeValidOperations: OperationType[]
): StepValidation {
  if (chosenOperation === currentStep.operation) {
    return {
      outcome: "correct",
      targetVariable: currentStep.targetVariable,
      resultDisplay: currentStep.resultDisplay,
      isFinal: currentStep.isFinal ?? false
    };
  }

  if (alternativeValidOperations.includes(chosenOperation)) {
    return {
      outcome: "suboptimal",
      resultDisplay: undefined,
      isFinal: false
    };
  }

  return {
    outcome: "invalid",
    isFinal: false
  };
}

// ─── operation buttons ───────────────────────────────────────────────────────

/**
 * Build the operation button set for the current step.
 *
 * The available operations are always the same set (this keeps the UI
 * predictable and prevents "spot the missing button" as a shortcut strategy).
 * The `highlighted` flag is set only when hint level 3 is active (direct
 * reveal of the correct button), matching the game spec's hint system.
 */
export function buildOperationButtons(
  currentStep: SolutionStep,
  showHintHighlight: boolean,
  mission?: StepwiseEquationSolverMissionPayload
): OperationButton[] {
  // Find if any upcoming step needs a multiply factor for display purposes
  const eq1Factor = mission?.solutionSteps.find(
    (s) => s.operation === "multiply_eq1"
  )?.multiplyFactor;
  const eq2Factor = mission?.solutionSteps.find(
    (s) => s.operation === "multiply_eq2"
  )?.multiplyFactor;

  const buttons: OperationButton[] = [
    {
      id: "add",
      label: "ADD",
      sublabel: "eq1 + eq2",
      highlighted: showHintHighlight && currentStep.operation === "add"
    },
    {
      id: "subtract",
      label: "SUBTRACT",
      sublabel: "eq1 − eq2",
      highlighted: showHintHighlight && currentStep.operation === "subtract"
    },
    {
      id: "multiply_eq1",
      label: "MULTIPLY EQ 1",
      sublabel: eq1Factor ? `× ${eq1Factor}` : "× scalar",
      highlighted: showHintHighlight && currentStep.operation === "multiply_eq1"
    },
    {
      id: "multiply_eq2",
      label: "MULTIPLY EQ 2",
      sublabel: eq2Factor ? `× ${eq2Factor}` : "× scalar",
      highlighted: showHintHighlight && currentStep.operation === "multiply_eq2"
    }
  ];

  // The final two operations only appear once the system is reduced to
  // one variable — the engine reveals them progressively per step index.
  // For simplicity, always show all 6 so the UI shape never changes;
  // the player learns which are contextually appropriate through feedback.
  buttons.push(
    {
      id: "solve",
      label: "SOLVE",
      sublabel: "isolate variable",
      highlighted: showHintHighlight && currentStep.operation === "solve"
    },
    {
      id: "substitute",
      label: "SUBSTITUTE",
      sublabel: "back-substitute",
      highlighted: showHintHighlight && currentStep.operation === "substitute"
    }
  );

  return buttons;
}

// ─── hint system ─────────────────────────────────────────────────────────────

/**
 * Determine which hint level to show (0-indexed).
 * Returns -1 if no hint should be shown.
 *
 * Hint progression:
 *   After hintAfterAttempts wrong tries   → level 0 (vague strategic hint)
 *   After hintAfterAttempts + 1 tries     → level 1 (more specific)
 *   After hintAfterAttempts + 2 tries     → level 2 (exact button highlight)
 */
export function resolveHintLevel(
  wrongAttemptsOnCurrentStep: number,
  hintAfterAttempts: number
): number {
  const hintOffset = wrongAttemptsOnCurrentStep - hintAfterAttempts;
  if (hintOffset < 0) return -1;
  return Math.min(hintOffset, 2); // cap at level 2
}

/**
 * Returns the hint string for the current step + hint level.
 * Prefers the mission-specific caseHints, falls back to shared generic hints.
 */
export function resolveHintText(
  hintLevel: number,
  caseHints: string[],
  sharedHints: string[]
): string {
  // Mission case hints take priority — they're authored specifically for
  // the current equation pair and will be more useful than generic hints.
  const missionHint = caseHints[hintLevel];
  if (missionHint) return missionHint;
  return sharedHints[Math.min(hintLevel, sharedHints.length - 1)] ?? "";
}

// ─── scoring ─────────────────────────────────────────────────────────────────

/**
 * Compute efficiency as the ratio of optimal steps to total steps taken.
 * Suboptimal steps count as taken (they advance the solution) but inflate
 * the denominator. Invalid steps do NOT count (the player re-tries without
 * advancing).
 */
export function computeEfficiency(
  optimalSteps: number,
  totalStepsActuallyTaken: number
): number {
  if (totalStepsActuallyTaken === 0) return 1;
  return Math.max(0, Math.min(1, optimalSteps / totalStepsActuallyTaken));
}

/**
 * Compute the composite 0–1 score for a completed mission.
 *
 * Factors and weights (from game spec):
 *   Correct strategy:  40%
 *   Efficiency:        30%
 *   Hint usage:        20%
 *   Speed:             10%
 */
export function computeScore(input: ScoringInput): number {
  const { wrongAttempts, hintsUsed, suboptimalSteps, totalSteps,
    optimalSteps, timeSpentSec, config } = input;
  const { strategyWeight, efficiencyWeight, hintWeight, speedWeight,
    speedBaselineSec } = config.scoring;

  // Strategy: penalise wrong attempts relative to optimal step count
  const strategyPenalty = Math.min(wrongAttempts / Math.max(optimalSteps, 1), 1);
  const strategyScore = Math.max(0, 1 - strategyPenalty * 0.5);

  // Efficiency: ratio of optimal to total steps taken
  const efficiencyScore = computeEfficiency(optimalSteps, totalSteps);

  // Hints: each hint used knocks a proportional amount off the hint score
  const hintPenalty = Math.min(hintsUsed / Math.max(optimalSteps, 1), 1);
  const hintScore = Math.max(0, 1 - hintPenalty);

  // Speed: linear decay past the baseline, floored at 0
  const speedScore = Math.max(0, 1 - Math.max(0, timeSpentSec - speedBaselineSec) / speedBaselineSec);

  const composite =
    strategyScore * strategyWeight +
    efficiencyScore * efficiencyWeight +
    hintScore * hintWeight +
    speedScore * speedWeight;

  return Math.max(0, Math.min(1, composite));
}

/**
 * Format the efficiency percentage for the Reflection screen.
 * e.g. 0.92 → "92%"
 */
export function formatEfficiency(efficiency: number): string {
  return `${Math.round(efficiency * 100)}%`;
}

/**
 * Build the step log entry label shown in the Reflection screen.
 * e.g. "Subtract equations" or "Solve for x"
 */
export function stepLabel(step: SolutionStep): string {
  return step.description;
}

// ─── variable extraction ──────────────────────────────────────────────────────

/**
 * Extract variable names from the solution record for the "CASE CLOSED" display.
 * Returns sorted array, alphabetically, so x always appears before y.
 */
export function getSolutionLines(
  variables: Record<string, number>
): Array<{ variable: string; value: number }> {
  return Object.entries(variables)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([variable, value]) => ({ variable, value }));
}