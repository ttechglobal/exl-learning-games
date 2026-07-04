/**
 * formula-excavation engine — config schema
 *
 * Engine family: the player helps Nova uncover a hidden variable inside a
 * formula by removing mathematical obstacles one at a time. Each obstacle
 * is removed by choosing its inverse operation.
 *
 * The "moment of truth" is every operation card tap:
 *   Given the current formula state, which inverse operation removes the
 *   obstacle that is directly protecting the target variable?
 *
 * This is fundamentally different from stepwise-equation-solver:
 *   - stepwise-equation-solver: two equations, player combines/subtracts
 *     entire rows to cancel a variable. The algebra happens to the system.
 *   - formula-excavation: one formula, one target variable, player removes
 *     layers one at a time. The algebra happens to the formula itself.
 *     The cognitive model is inverse operations, not elimination.
 *
 * Generalises to: any formula rearrangement topic — kinematics, area/volume,
 * Ohm's law, gas laws, quadratic rearrangements, logarithm manipulation.
 */

import { z } from "zod";

// ─── sub-schemas ─────────────────────────────────────────────────────────────

/**
 * One authored excavation step — one layer of obstacle to remove.
 * Corresponds to one inverse operation applied to both sides of the formula.
 */
const ExcavationStepSchema = z.object({
  /**
   * Human-readable description of what this step does.
   * e.g. "Divide both sides by π"
   * Used in the Expedition Log replay at the end.
   */
  description: z.string(),

  /**
   * The operation the player must choose. This is the engine's check.
   * Grouped by what they REMOVE (not what they do):
   *
   * Removes multiplication:   divide_both
   * Removes division:         multiply_both
   * Removes addition:         subtract_both
   * Removes subtraction:      add_both
   * Removes a square:         square_root
   * Removes a square root:    square_both
   * Removes a cube:           cube_root
   * Removes a cube root:      cube_both
   */
  operation: z.enum([
    "divide_both",
    "multiply_both",
    "subtract_both",
    "add_both",
    "square_root",
    "square_both",
    "cube_root",
    "cube_both"
  ]),

  /**
   * The formula's new form after this step, shown in the Expedition Log.
   * e.g. ["A/π = r²"]
   * Array because some steps show two lines (intermediate + simplified).
   */
  resultDisplay: z.array(z.string()),

  /**
   * Human-readable label for what this step removes — shown in the
   * layer stack visual as the "active obstacle".
   * e.g. "π shield" | "square lock" | "4/3 fraction"
   */
  obstacleLabel: z.string(),

  /** True if this is the last step — shows the Discovery Complete screen. */
  isFinal: z.boolean().default(false).optional()
});

/**
 * Three wrong-answer options shown alongside the correct operation.
 * Each distractor should represent a real student misconception:
 *   - Wrong direction (multiply instead of divide)
 *   - Wrong layer (attacking a different obstacle)
 *   - Category error (square instead of sqrt)
 */
const DistractorSchema = z.object({
  operation: z.enum([
    "divide_both", "multiply_both", "subtract_both", "add_both",
    "square_root", "square_both", "cube_root", "cube_both"
  ]),
  /** Display label for this distractor button. e.g. "Multiply both sides" */
  label: z.string()
});

/**
 * Difficulty tier — controls scaffolding level, not content difficulty.
 * Content difficulty is controlled by which formula is assigned to the mission.
 */
const ExcavationTierSchema = z.object({
  tier: z.enum(["easy", "medium", "hard"]),
  label: z.string(),
  xpReward: z.number().int().positive(),
  /** Auto-surface hints after this many wrong attempts on a single step. */
  hintAfterAttempts: z.number().int().nonnegative().default(1)
});

// ─── shared config (Game.shared_config) ──────────────────────────────────────

export const FormulaExcavationSharedConfigSchema = z.object({
  entry: z.object({
    title: z.string().default("Nova the Explorer"),
    missionLabel: z.string().default("Active Expedition")
  }),

  tiers: z.array(ExcavationTierSchema).min(1).default([
    { tier: "easy",   label: "GUIDED",   xpReward: 20, hintAfterAttempts: 1 },
    { tier: "medium", label: "EXPLORER", xpReward: 40, hintAfterAttempts: 1 },
    { tier: "hard",   label: "MASTER",   xpReward: 75, hintAfterAttempts: 2 }
  ]),

  feedback: z.object({
    /** Shown on correct step — randomly selected from array. */
    correctStep: z.array(z.string()).min(1).default([
      "Layer removed!",
      "Obstacle cleared. Nova pushes through!",
      "Excellent — the path is opening.",
      "Correct inverse operation!"
    ]),
    /** Shown when chosen operation is mathematically wrong for this step. */
    invalidStep: z.string().default(
      "That tool cannot remove this obstacle. Try another approach."
    ),
    /** Discovery complete — primary badge. */
    discoveryPrimary: z.string().default("DISCOVERY MADE"),
    /** Discovery complete — secondary line. */
    discoverySecondary: z.string().default(
      "Ancient formula recovered. Variable restored to the Archive."
    )
  }),

  hints: z.object({
    /**
     * Three hint strings, progressively more specific.
     * The mission's own caseHints override these at step level.
     * These are the fallback for missions that don't author per-step hints.
     */
    levels: z.array(z.string()).min(1).default([
      "What operation is currently attached to the target variable?",
      "Think about the inverse: what undoes the operation protecting it?",
      "The correct operation is highlighted."
    ])
  }),

  review: z.object({
    title: z.string().default("EXPEDITION ROUTE"),
    efficiencyLabel: z.string().default("Efficiency"),
    successLines: z.array(z.string()).min(1).default([
      "Discovery logged. Formula archived.",
      "Another variable uncovered, Explorer.",
      "The Formula Archive grows stronger."
    ])
  }),

  scoring: z.object({
    strategyWeight: z.number().default(0.4),
    efficiencyWeight: z.number().default(0.3),
    hintWeight: z.number().default(0.2),
    speedWeight: z.number().default(0.1),
    speedBaselineSec: z.number().default(120)
  })
});

// ─── mission payload (Mission.payload) ───────────────────────────────────────

export const FormulaExcavationMissionPayloadSchema = z.object({
  /**
   * The original formula as written, displayed at the top of the tablet.
   * e.g. "A = πr²"
   * Rendered as plain text — no CAS parsing.
   */
  formula: z.string(),

  /**
   * The variable Nova is trying to uncover.
   * e.g. "r"
   */
  targetVariable: z.string(),

  /**
   * The world this formula belongs to — shown as a badge on the tablet.
   * e.g. "World 4 — Power Peaks"
   */
  world: z.string().optional(),

  /**
   * The name of the artifact collected when this formula is excavated.
   * e.g. "Area Relic"
   */
  discoveryName: z.string().optional(),

  /**
   * The ordered list of excavation steps, from outermost obstacle to innermost.
   * The engine walks through this list in order, checking the player's operation
   * choice against each step's `operation` field.
   */
  excavationSteps: z.array(ExcavationStepSchema).min(1),

  /**
   * Per-step hint strings — 3 levels per step, indexed by step position.
   * e.g. stepHints[0] = hints for step 1, stepHints[1] = hints for step 2.
   * If a step has no entry here, the engine falls back to shared.hints.levels.
   */
  stepHints: z.array(z.array(z.string()).min(1).max(3)).optional(),

  /**
   * Per-step distractors — 3 wrong options shown alongside the correct
   * operation for each step.
   * If not provided, the engine uses built-in distractor rules.
   */
  stepDistractors: z.array(z.array(DistractorSchema).length(3)).optional(),

  /** Learning goal shown on the mission objectives screen. */
  learningGoal: z.string(),

  /**
   * Pedagogical stage — controls scaffolding level:
   * "guided"      Nova narrates the next step, player taps to confirm.
   * "assisted"    Player chooses from operation cards. Hints auto-surface.
   * "independent" Player chooses freely. Hints only on request.
   */
  stage: z.enum(["guided", "assisted", "independent"]).default("assisted")
});

// ─── runtime config ───────────────────────────────────────────────────────────

export interface FormulaExcavationConfig {
  shared: FormulaExcavationSharedConfig;
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

// ─── outcome ─────────────────────────────────────────────────────────────────

export interface FormulaExcavationOutcome {
  success: true;
  score: number;
  finalScore: number;
  wrongAttempts: number;
  hintsUsed: number;
  timeSpentSec: number;
  efficiency: number;
  stepLog: Array<{
    operation: string;
    outcome: "correct" | "invalid";
  }>;
  xpEarned: number;
}

// ─── inferred types ───────────────────────────────────────────────────────────

export type FormulaExcavationSharedConfig = z.infer<typeof FormulaExcavationSharedConfigSchema>;
export type FormulaExcavationMissionPayload = z.infer<typeof FormulaExcavationMissionPayloadSchema>;
export type ExcavationStep = z.infer<typeof ExcavationStepSchema>;
export type ExcavationTier = z.infer<typeof ExcavationTierSchema>;
export type OperationType = z.infer<typeof ExcavationStepSchema>["operation"];
