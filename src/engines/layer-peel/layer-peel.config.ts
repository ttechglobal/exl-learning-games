/**
 * layer-peel engine — config schema
 *
 * Vault Breach: The Shell Chamber
 * The player peels concentric shells from a formula one at a time,
 * applying the correct inverse operation at each layer, until the
 * target variable stands alone at the centre.
 *
 * This engine is visually and thematically distinct from formula-excavation:
 *   - formula-excavation: archaeological dig, operation card tap, Nova world
 *   - layer-peel: vault/breach theme, shells peeling away, capsule metaphor
 *
 * The underlying cognitive operation is identical — inverse operation selection —
 * but the interaction model and visual design are fully independent.
 *
 * Reusable for: Kinematics rearrangement, Ohm's Law, Gas Laws, any
 * formula rearrangement topic that benefits from the shell/vault metaphor.
 */

import { z } from "zod";

// ─── operation enum (same valid set as formula-excavation) ───────────────────

export const LayerPeelOperationEnum = z.enum([
  "divide_both",
  "multiply_both",
  "subtract_both",
  "add_both",
  "square_root",
  "square_both",
  "cube_root",
  "cube_both",
]);

export type LayerPeelOperation = z.infer<typeof LayerPeelOperationEnum>;

// ─── human-readable labels for each operation ────────────────────────────────

export const LAYER_PEEL_OPERATION_META: Record<LayerPeelOperation, { label: string; sublabel: string }> = {
  divide_both:   { label: "Divide both sides",           sublabel: "removes multiplication"  },
  multiply_both: { label: "Multiply both sides",         sublabel: "removes division"         },
  subtract_both: { label: "Subtract from both sides",    sublabel: "removes addition"         },
  add_both:      { label: "Add to both sides",           sublabel: "removes subtraction"      },
  square_root:   { label: "Square root both sides",      sublabel: "removes a square"         },
  square_both:   { label: "Square both sides",           sublabel: "removes a square root"    },
  cube_root:     { label: "Cube root both sides",        sublabel: "removes a cube"           },
  cube_both:     { label: "Cube both sides",             sublabel: "removes a cube root"      },
};

/** Safe accessor — never crashes on unknown operation strings */
export function getLayerPeelOperationMeta(op: string): { label: string; sublabel: string } {
  return LAYER_PEEL_OPERATION_META[op as LayerPeelOperation] ?? { label: op, sublabel: "unknown operation" };
}

/**
 * Maps any operation string Claude might generate to the canonical enum value.
 * Claude sometimes outputs "divide", "multiply", "squareRoot" etc. instead of
 * the canonical "divide_both", "multiply_both", "square_root" values.
 */
export function normaliseOperation(op: string): string {
  if (!op) return op;
  const s = op.toLowerCase().replace(/[\s-]/g, "_");
  const map: Record<string, string> = {
    // divide variants
    divide: "divide_both", divide_both: "divide_both", "÷": "divide_both",
    divides: "divide_both", dividing: "divide_both",
    // multiply variants
    multiply: "multiply_both", multiply_both: "multiply_both", "×": "multiply_both",
    multiplies: "multiply_both", multiplying: "multiply_both",
    // subtract variants
    subtract: "subtract_both", subtract_both: "subtract_both", "−": "subtract_both",
    subtracts: "subtract_both", subtracting: "subtract_both",
    // add variants
    add: "add_both", add_both: "add_both", "+": "add_both",
    adds: "add_both", adding: "add_both",
    // square root variants
    square_root: "square_root", squareroot: "square_root", sqrt: "square_root",
    "√": "square_root", take_square_root: "square_root",
    square_root_both: "square_root", square_root_both_sides: "square_root",
    // square variants
    square: "square_both", square_both: "square_both", squared: "square_both",
    square_both_sides: "square_both",
    // cube root variants
    cube_root: "cube_root", cuberoot: "cube_root", cbrt: "cube_root",
    cube_root_both: "cube_root", cube_root_both_sides: "cube_root",
    // cube variants
    cube: "cube_both", cube_both: "cube_both", cubed: "cube_both",
    cube_both_sides: "cube_both",
  };
  return map[s] ?? op;
}

// ─── sub-schemas ─────────────────────────────────────────────────────────────

const PeelStepSchema = z.object({
  /** The correct inverse operation for this layer */
  operation: LayerPeelOperationEnum,
  /** What is being peeled — shown as the active shell label. e.g. "× 2 shell" */
  obstacleLabel: z.string(),
  /** Human description of this step. e.g. "Divide both sides by 2" */
  description: z.string(),
  /** Formula state after this step — one or two lines */
  resultDisplay: z.array(z.string()).min(1),
  /** True on the final step — triggers the breach complete screen */
  isFinal: z.boolean().default(false).optional(),
});

const DistractorSchema = z.object({
  operation: LayerPeelOperationEnum,
  label: z.string(),
});

const LayerPeelTierSchema = z.object({
  tier: z.enum(["easy", "medium", "hard"]),
  label: z.string().optional(),
  xpReward: z.number().int().positive(),
  hintAfterAttempts: z.number().int().nonnegative().default(2),
});

// ─── shared config ────────────────────────────────────────────────────────────

export const LayerPeelSharedConfigSchema = z.object({
  entry: z.object({
    title:        z.string().default("Vault Breach"),
    missionLabel: z.string().default("Capsule"),
  }),

  tiers: z.array(LayerPeelTierSchema).min(1).default([
    { tier: "easy",   xpReward: 20, hintAfterAttempts: 2 },
    { tier: "medium", xpReward: 40, hintAfterAttempts: 2 },
    { tier: "hard",   xpReward: 75, hintAfterAttempts: 1 },
  ]),

  feedback: z.object({
    correct: z.array(z.string()).min(1).default([
      "Shell breached. The capsule feels lighter.",
      "Clean peel. Next shell exposed.",
      "Pressure equalised. Moving inward.",
    ]),
    invalid: z.string().default(
      "That shell isn't reacting — check what's actually holding it in place."
    ),
    blocked: z.string().default(
      "Locked. That shell is sealed until the one outside it is gone."
    ),
    success: z.string().default("Capsule breached. The variable stands alone."),
  }),

  /** Optional hint strings. Falls back to built-in progressive hints if absent. */
  hints: z.object({
    levels: z.array(z.string()).min(1).default([
      "What operation is wrapped around the target variable at this layer?",
      "Think about the inverse: what undoes the operation on this shell?",
      "The correct operation to breach this shell is highlighted.",
    ]),
  }).optional(),

  shellVisuals: z.object({
    activeColor:  z.string().default("#38bdf8"),
    lockedColor:  z.string().default("#1e293b"),
    peelDuration: z.number().int().positive().default(600),
  }).optional(),

  review: z.object({
    title:          z.string().default("BREACH LOG"),
    successLines:   z.array(z.string()).min(1).default([
      "Vault breached. Variable extracted.",
      "Shell sequence complete, Agent.",
      "The capsule yields its secret.",
    ]),
  }).optional(),

  scoring: z.object({
    baseXp:       z.number().default(20),
    hintPenalty:  z.number().default(5),
    perfectBonus: z.number().default(10),
    // Extended scoring weights (compatible with formula-excavation's scorer)
    strategyWeight:  z.number().default(0.4),
    efficiencyWeight:z.number().default(0.3),
    hintWeight:      z.number().default(0.2),
    speedWeight:     z.number().default(0.1),
    speedBaselineSec:z.number().default(120),
  }).optional(),
});

// ─── mission payload ──────────────────────────────────────────────────────────

export const LayerPeelMissionPayloadSchema = z.object({
  /** The starting formula. e.g. "v = u + at" */
  formula: z.string(),
  /** The variable to isolate. e.g. "u" */
  targetVariable: z.string(),
  /** World label shown on the mission badge. e.g. "World 1 — The Outer Vault" */
  world: z.string().optional(),
  /** Name of what was extracted on success. e.g. "Velocity Secret" */
  discoveryName: z.string().optional(),
  /** Ordered peel steps, outermost shell first */
  /** Ordered peel steps, outermost shell first.
   *  Accepts "excavationSteps", "peelSteps", or "steps" — Claude may use any of these. */
  excavationSteps: z.array(PeelStepSchema).min(1).optional(),
  steps:           z.array(PeelStepSchema).min(1).optional(),
  /** Per-step hints — 3 levels per step. Falls back to shared.hints.levels */
  stepHints: z.array(z.array(z.string()).min(1).max(3)).optional(),
  /** Per-step distractors — 3 wrong options per step */
  stepDistractors: z.array(z.array(DistractorSchema).length(3)).optional(),
  /** What skill this mission builds */
  learningGoal: z.string(),
  /**
   * Scaffolding stage:
   * "practice"  → fully guided, system narrates each step
   * "challenge" → student-led, hints on request after wrong attempt
   * "master"    → student alone, hints on request only
   */
  stage: z.enum(["practice", "challenge", "master"]).default("practice"),
});

// ─── runtime config type ─────────────────────────────────────────────────────

export interface LayerPeelConfig {
  shared: LayerPeelSharedConfig;
  mission: {
    id: string;
    missionKey: string;
    title: string;
    xpReward: number;
    topicId: string;
    difficulty?: string;
    payload: Record<string, unknown>;
  };
}

// ─── outcome type ─────────────────────────────────────────────────────────────

export interface LayerPeelOutcome {
  success: true;
  score: number;
  finalScore: number;
  wrongAttempts: number;
  hintsUsed: number;
  timeSpentSec: number;
  xpEarned: number;
  stepLog: Array<{ operation: string; outcome: "correct" | "invalid" }>;
}

// ─── inferred types ───────────────────────────────────────────────────────────

export type LayerPeelSharedConfig  = z.infer<typeof LayerPeelSharedConfigSchema>;
export type LayerPeelMissionPayload = z.infer<typeof LayerPeelMissionPayloadSchema>;
export type PeelStep               = z.infer<typeof PeelStepSchema>;