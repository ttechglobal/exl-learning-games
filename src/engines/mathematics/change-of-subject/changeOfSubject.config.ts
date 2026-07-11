/**
 * change-of-subject engine — config schema
 *
 * Engine: the player makes a variable the subject of a formula.
 * Three tiers: Learn (guided, owl + explanation), Practice (independent,
 * timer from Q3), Challenge (timer from Q1, no guide, hint costs time+pts).
 *
 * Config split:
 * - SharedConfig on Game.shared_config — tier settings, point values.
 * - MissionPayload on Mission.payload — one question (formula + steps).
 */

import { z } from "zod";

// ─── sub-schemas ─────────────────────────────────────────────────────────────

/**
 * One token in a rendered equation.
 * We store the equation as an array of tokens so the engine can render
 * fractions, square roots, and highlighted blockers without a CAS.
 */
const TokenSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("term"),
    t: z.string(),
    /** Render with coral dashed highlight — marks the blocker term */
    b: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("frac"),
    n: z.string(),
    d: z.string(),
    /** Render with coral dashed highlight */
    b: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("sqrt"),
    /** Array of tokens inside the root, or a plain string */
    inner: z.union([z.array(z.lazy((): z.ZodTypeAny => TokenSchema)), z.string()]),
    b: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("op"),
    t: z.string(),
  }),
]);

export type MathToken = z.infer<typeof TokenSchema>;

/**
 * One step in the solution.
 */
const StepSchema = z.object({
  /** Tokens for the LEFT side of the equation (the droppable target) */
  leftToks: z.array(TokenSchema),
  /** Tokens for the RIGHT side of the equation (the droppable target) */
  rightToks: z.array(TokenSchema),

  /** Instruction shown in Learn tier (owl speech) */
  mascot: z.string(),
  /** Instruction shown in Practice tier (compact, no owl) */
  instPrac: z.string(),
  /** Instruction shown in Challenge tier (just the goal) */
  instChall: z.string(),

  /** One-line hint for Challenge tier (costs time+pts) */
  hint: z.string(),

  /** The correct operation tile label, e.g. "÷ 2" */
  tileOk: z.string(),
  /** Two distractor tile labels */
  tilesNo: z.tuple([z.string(), z.string()]),
  /** Why each wrong tile fails — shown in Learn + Practice */
  whyNot: z.record(z.string(), z.string()),

  /** MCQ question tokens for left side simplification */
  lqT: z.array(TokenSchema),
  /** Correct answer for left MCQ */
  lAns: z.string(),
  /** Two wrong answers for left MCQ */
  lWrong: z.tuple([z.string(), z.string()]),

  /** MCQ question tokens for right side simplification */
  rqT: z.array(TokenSchema),
  /** Correct answer for right MCQ */
  rAns: z.string(),
  /** Two wrong answers for right MCQ */
  rWrong: z.tuple([z.string(), z.string()]),

  /** New left side tokens after step completes */
  newLeft: z.array(TokenSchema),
  /** New right side tokens after step completes */
  newRight: z.array(TokenSchema),
});

export type CosStep = z.infer<typeof StepSchema>;

/**
 * One question in the mission payload.
 */
const QuestionSchema = z.object({
  /** Human-readable goal, e.g. "Make t the subject" */
  qLabel: z.string(),
  /** The original formula, e.g. "v = u + at" */
  formula: z.string(),
  /** Final answer string shown on completion, e.g. "t = (v − u) / a" */
  finalAnswer: z.string(),
  steps: z.array(StepSchema).min(1),
});

export type CosQuestion = z.infer<typeof QuestionSchema>;

// ─── shared config ────────────────────────────────────────────────────────────

export const ChangeOfSubjectSharedConfigSchema = z.object({
  /** Points awarded per completed question (before penalties) */
  pointsPerQuestion: z.number().int().positive().default(20),
  /** Points deducted per timeout retry */
  retryPenalty: z.number().int().nonnegative().default(5),
  /** Points deducted per hint use (Challenge tier) */
  hintPenalty: z.number().int().nonnegative().default(5),
  /** Seconds deducted from timer per hint use */
  hintTimePenalty: z.number().int().nonnegative().default(5),
  /** Base timer seconds for timed tiers */
  baseTimerSecs: z.number().int().positive().default(60),
  /** Seconds deducted from timer per retry */
  retryTimerCut: z.number().int().nonnegative().default(15),
  /** Minimum timer seconds after retries */
  minTimerSecs: z.number().int().positive().default(20),
  /**
   * Practice tier starts timing from this question index (0-based).
   * Default 2 = timer kicks in from Q3.
   */
  practiceTimerFromQ: z.number().int().nonnegative().default(2),
});

export type ChangeOfSubjectSharedConfig = z.infer<typeof ChangeOfSubjectSharedConfigSchema>;

// ─── mission payload ──────────────────────────────────────────────────────────

export const ChangeOfSubjectMissionPayloadSchema = z.object({
  /**
   * Ordered list of questions. The engine walks through them in order.
   * All three tiers share the same question bank; the tier only affects
   * guidance level, scoring, and whether a timer runs.
   */
  questions: z.array(QuestionSchema).min(1),
});

export type ChangeOfSubjectMissionPayload = z.infer<typeof ChangeOfSubjectMissionPayloadSchema>;

// ─── runtime config ───────────────────────────────────────────────────────────

export interface ChangeOfSubjectConfig {
  shared: ChangeOfSubjectSharedConfig;
  mission: {
    id: string;
    missionKey: string;
    title: string;
    xpReward: number;
    topicId: string;
    subtopicId?: string;
    payload: Record<string, unknown>;
  };
}

// ─── outcome ─────────────────────────────────────────────────────────────────

export interface ChangeOfSubjectOutcome {
  success: true;
  score: number;
  finalScore: number;
  timeSpentSec: number;
  hintsUsed: number;
  attemptsBeforeSuccess: number;
  xpEarned: number;
}