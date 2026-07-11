/**
 * stepwise-equation-solver engine — config schema
 *
 * Engine family: the player repeatedly chooses the next algebraic operation
 * to apply to a system of equations. The "moment of truth" is every
 * operation selection — the engine checks whether the chosen operation is
 * mathematically valid AND strategically appropriate for the current
 * equation state.
 *
 * Unlike tile-match (tap a grid) or particle-assembly (add countable units),
 * this engine's interaction shape is fundamentally sequential and strategic:
 * the player must reason about WHERE they are in a multi-step procedure and
 * choose WHAT to do next. No existing engine fits this shape.
 *
 * Generalizes to: linear equations, simultaneous equations, algebraic
 * fractions, quadratic factorization, completing the square, chemical
 * equation balancing — anything where "choosing the next correct operation"
 * IS the learning.
 *
 * Config split (Game / Mission DB tables):
 * - SharedConfig on Game.shared_config — difficulty tiers, entry copy,
 *   feedback lines, hint policy, review template.
 * - MissionPayload on Mission.payload — the specific equation pair,
 *   target variable strategy, and expected solution path for ONE case.
 */

import { z } from "zod";

// ─── sub-schemas ────────────────────────────────────────────────────────────

/**
 * One equation in the system, stored as human-readable strings.
 * The engine renders these directly; it does NOT parse them symbolically.
 * All algebraic evaluation happens through authored `operations` on the
 * mission payload, not a CAS engine.
 */
const EquationSchema = z.object({
  /** Display form, e.g. "2x + y = 7" */
  display: z.string(),
  /** Internal label used in operation references, e.g. "eq1" */
  id: z.string()
});

/**
 * One authored step in the expected solution path.
 * The engine validates the player's choice against these steps in order.
 */
const SolutionStepSchema = z.object({
  /** Human-readable description of what this step does, e.g. "Subtract eq2 from eq1" */
  description: z.string(),
  /**
   * The operation type the player must select. This is what the engine
   * checks — the player's tap must match this value.
   */
  operation: z.enum([
    // ── Simultaneous equations operations ────────────────────────
    "add",              // add eq1 + eq2
    "subtract",         // subtract one equation from the other
    "multiply_eq1",     // multiply equation 1 by a scalar
    "multiply_eq2",     // multiply equation 2 by a scalar
    "solve",            // algebraically solve the single-variable equation
    "substitute",       // substitute known value back into original equation
    // ── Formula rearrangement operations (Nova the Explorer) ─────
    "divide_both",      // divide both sides by a term (remove multiplication)
    "multiply_both",    // multiply both sides by a term (remove division)
    "add_both",         // add a term to both sides (remove subtraction)
    "subtract_both",    // subtract a term from both sides (remove addition)
    "square_root",      // take the square root of both sides (remove square)
    "square_both",      // square both sides (remove square root)
    "cube_root",        // take the cube root of both sides (remove cube)
    "cube_both"         // cube both sides (remove cube root)
  ]),
  /**
   * Resulting equation(s) after this step, displayed as feedback.
   * e.g. ["3x = 9"] or ["x = 3", "2(3) + y = 7"]
   */
  resultDisplay: z.array(z.string()),
  /**
   * Optional scalar factor, used when operation is multiply_eq1 / multiply_eq2.
   * e.g. 2 means "multiply by 2". Displayed in the operation button.
   */
  multiplyFactor: z.number().int().positive().optional(),
  /**
   * True if this is the final step — engine shows "CASE CLOSED" payoff.
   */
  isFinal: z.boolean().default(false).optional(),
  /**
   * Which variable is being isolated/eliminated in this step.
   * Used for feedback copy ("Variable Y has been eliminated.")
   */
  targetVariable: z.string().optional()
});

/**
 * Three-tier difficulty control. Matches the game spec's scaffolding model:
 * Easy = practice (guided, system shows next step), Medium = challenge (student chooses, hints on request), Hard = master (student alone, hints on request only).
 */
const DifficultyTierSchema = z.object({
  tier: z.enum(["easy", "medium", "hard"]),
  label: z.string(),
  xpReward: z.number().int().positive(),
  /**
   * When true, the engine shows the "Eliminate Y" guidance before the player
   * chooses. Removes scaffolding across tiers rather than increasing complexity.
   */
  showTargetVariable: z.boolean().default(false),
  /**
   * When true, the player sees the variable choice step (Eliminate X vs Y).
   * When false (Easy), the engine skips to operation selection directly.
   */
  showVariableChoice: z.boolean().default(true),
  /** After how many wrong attempts to surface a hint. */
  hintAfterAttempts: z.number().int().nonnegative().default(1)
});

// ─── shared config (Game.shared_config) ─────────────────────────────────────

export const StepwiseEquationSolverSharedConfigSchema = z.object({
  entry: z.object({
    title: z.string().default("Math Detective"),
    missionLabel: z.string().default("Active Case")
  }),

  tiers: z.array(DifficultyTierSchema).min(1).default([
    {
      tier: "easy",
      label: "EASY",
      xpReward: 20,
      showTargetVariable: true,
      showVariableChoice: false,
      hintAfterAttempts: 1
    },
    {
      tier: "medium",
      label: "MEDIUM",
      xpReward: 40,
      showTargetVariable: false,
      showVariableChoice: true,
      hintAfterAttempts: 1
    },
    {
      tier: "hard",
      label: "HARD",
      xpReward: 75,
      showTargetVariable: false,
      showVariableChoice: true,
      hintAfterAttempts: 2
    }
  ]),

  /** Feedback copy for each outcome type. */
  feedback: z.object({
    correctStep: z.array(z.string()).min(1).default([
      "Good observation.",
      "Sound reasoning, Detective.",
      "Correct. Proceed."
    ]),
    suboptimalStep: z.string().default(
      "This operation is valid, but there may be a simpler approach. Efficiency reduced."
    ),
    invalidStep: z.string().default(
      "This operation cannot eliminate the selected variable. Try another approach."
    ),
    caseClosedPrimary: z.string().default("CASE CLOSED"),
    caseClosedSecondary: z.string().default("Excellent mathematical reasoning, Detective.")
  }),

  /** Hint copy, keyed by hint level (0-indexed). */
  hints: z.object({
    levels: z.array(z.string()).min(1).default([
      "Consider which variable has matching or opposite coefficients.",
      "Try eliminating the variable with matching coefficients first.",
      "The correct operation is highlighted above."
    ])
  }),

  /** Reflection screen template. */
  review: z.object({
    title: z.string().default("YOUR STRATEGY"),
    efficiencyLabel: z.string().default("Efficiency"),
    successLines: z.array(z.string()).min(1).default([
      "Case solved. File archived.",
      "Another case closed, Detective."
    ])
  }),

  scoring: z.object({
    /** Weight of choosing correct operations (0–1 float, all weights sum to 1). */
    strategyWeight: z.number().default(0.4),
    efficiencyWeight: z.number().default(0.3),
    hintWeight: z.number().default(0.2),
    speedWeight: z.number().default(0.1),
    /** Seconds per mission before speed score starts decaying. */
    speedBaselineSec: z.number().default(90)
  })
});

// ─── mission payload (Mission.payload) ──────────────────────────────────────

export const StepwiseEquationSolverMissionPayloadSchema = z.object({
  /** Case file number shown in the mission brief, e.g. "#0237" */
  caseNumber: z.string(),

  /** The two equations in the system. */
  equations: z.tuple([EquationSchema, EquationSchema]),

  /**
   * The ordered list of correct steps. The engine walks through this list,
   * checking the player's choice against the current step.
   * Suboptimal-but-valid paths are noted in `alternativeSteps`.
   */
  solutionSteps: z.array(SolutionStepSchema).min(2),

  /**
   * Operations the player could choose that are mathematically valid but
   * less efficient than the intended path. These generate the "suboptimal"
   * feedback rather than "invalid."
   */
  alternativeValidOperations: z.array(z.enum([
    "add", "subtract", "multiply_eq1", "multiply_eq2", "solve", "substitute"
  ])).default([]),

  /** The final solved values to display in the "CASE CLOSED" screen. */
  solution: z.object({
    /** e.g. { x: 3, y: 1 } */
    variables: z.record(z.string(), z.number())
  }),

  /** Learning goal shown on the mission brief. */
  learningGoal: z.string(),

  /** Three hint strings, progressively more specific for this particular case. */
  caseHints: z.array(z.string()).min(1).max(3)
});

// ─── runtime config (shared + mission merged) ────────────────────────────────

export interface StepwiseEquationSolverConfig {
  shared: StepwiseEquationSolverSharedConfig;
  /**
   * Matches the actual GameRuntimeMission shape — payload fields are
   * nested under .payload, not merged onto mission directly.
   * The engine casts: const missionPayload = mission.payload as MissionPayload
   */
  mission: {
    id: string;
    missionKey: string;
    title: string;
    xpReward: number;
    topicId: string;
    subtopicId?: string;
    difficulty?: string;
    payload: Record<string, unknown>;
  };
}

// ─── outcome ────────────────────────────────────────────────────────────────

export interface StepwiseEquationSolverOutcome {
  success: true;
  /** 0–1 composite score. */
  score: number;
  /** Raw score (for leaderboard display). */
  finalScore: number;
  /** Number of wrong attempts before success. */
  wrongAttempts: number;
  /** Number of hints used. */
  hintsUsed: number;
  /** Seconds from mission start to case closed. */
  timeSpentSec: number;
  /** 0–1 efficiency rating (steps taken vs. optimal steps). */
  efficiency: number;
  /** Each step taken, in order, with correct/wrong/suboptimal annotation. */
  stepLog: Array<{
    operation: string;
    outcome: "correct" | "suboptimal" | "invalid";
  }>;
  /** Real XP for this session (may differ from flat xpReward in Mission row). */
  xpEarned: number;
}

// ─── inferred types ──────────────────────────────────────────────────────────

export type StepwiseEquationSolverSharedConfig = z.infer<
  typeof StepwiseEquationSolverSharedConfigSchema
>;
export type StepwiseEquationSolverMissionPayload = z.infer<
  typeof StepwiseEquationSolverMissionPayloadSchema
>;
export type SolutionStep = z.infer<typeof SolutionStepSchema>;
export type DifficultyTier = z.infer<typeof DifficultyTierSchema>;