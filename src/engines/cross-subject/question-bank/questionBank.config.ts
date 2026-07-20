/**
 * questionBank.config.ts
 *
 * Cross-subject question-bank engine.
 *
 * WHAT THIS ENGINE DOES:
 *   Delivers structured questions across three difficulty stages:
 *   Practice (20 XP), Challenge (40 XP), and Mastery (100 XP).
 *
 *   Each question is self-contained — it has a stem, 2–4 options,
 *   a correct answer, a Dr. Adaobi hint after a wrong attempt, and a
 *   post-answer explanation shown after the student submits.
 *
 *   The engine sequences questions, tracks score, and presents
 *   Dr. Adaobi's character between questions as a consistent mentor.
 *
 * QUESTION TYPES supported:
 *   mcq          — multiple choice (tap one option)
 *   multi-select — tap all that apply
 *   sequence     — drag items into correct order (rendered as tap-to-rank)
 *   true-false   — two-option MCQ (special layout)
 *
 * STAGE LOGIC:
 *   The mission payload declares the stage ("practice"|"challenge"|"mastery")
 *   and a subset of questions from the game's question pool.
 *   The engine draws from that pool, randomising order within a session.
 *
 * MASTERY:
 *   Mastery questions have `parts` — sub-questions answered in sequence.
 *   Each part must be answered before the next unlocks.
 *   Final mark is the sum of parts correct / total parts.
 *
 * COMPLETION:
 *   Mission completes when all questions in the session are answered.
 *   Outcome includes score, firstTryCount, hintCount, timeSpentSec.
 */

import { z } from "zod";

// ─── Single answer option ─────────────────────────────────────────────────────

export const OptionSchema = z.object({
  /** Unique key within the question — used for correct/wrong tracking. */
  key: z.string(),
  /** Text shown on the tap button. */
  text: z.string(),
  /**
   * Which misconception from the content brief this wrong answer targets.
   * Omit for the correct option.
   */
  misconception: z.string().optional(),
});

export type Option = z.infer<typeof OptionSchema>;

// ─── Single question part (for Mastery structured questions) ──────────────────

export const QuestionPartSchema = z.object({
  /** Part label shown to student, e.g. "(a)", "(b)" */
  label: z.string(),
  /** The part's question text */
  stem: z.string(),
  /** Options for this part */
  options: z.array(OptionSchema).min(2).max(6),
  /** Key of the correct option */
  correctKey: z.string(),
  /**
   * Marks available for this part.
   * Engine shows "X / Y marks" per part in Mastery mode.
   */
  marks: z.number().int().positive().default(1),
  /** Post-answer explanation for this part */
  explanation: z.string(),
});

export type QuestionPart = z.infer<typeof QuestionPartSchema>;

// ─── Question ─────────────────────────────────────────────────────────────────

export const QuestionSchema = z.object({
  /** Unique identifier — used to avoid repeating questions in a session. */
  key: z.string(),

  /** Question type */
  type: z.enum(["mcq", "multi-select", "sequence", "true-false"]).default("mcq"),

  /**
   * The question exactly as shown to the student.
   * May reference the game context: "You drag the slider past 70°C…"
   */
  stem: z.string(),

  /**
   * Optional scenario context shown above the stem in a coloured box.
   * Used for questions that describe a simulation state: "The canvas shows
   * particles in a tight regular grid, completely still."
   */
  scenario: z.string().optional(),

  /**
   * Optional diagram type — the engine renders a built-in SVG illustration.
   * "heating-curve" renders a labelled temperature vs time graph.
   * "particle-state" renders a small particle canvas snapshot.
   * "none" (default) — no diagram.
   */
  diagram: z.enum(["heating-curve", "particle-state", "none"]).default("none"),

  /** Answer options (2–6). For sequence type, these are the items to order. */
  options: z.array(OptionSchema).min(2).max(6).optional(),

  /**
   * For "mcq" and "true-false": key of the single correct option.
   * For "multi-select": use correctKeys instead.
   */
  correctKey: z.string().optional(),

  /** For multi-select: all keys that must be selected for full credit. */
  correctKeys: z.array(z.string()).optional(),

  /**
   * For "sequence": the correct order of option keys from first to last.
   */
  correctOrder: z.array(z.string()).optional(),

  /**
   * Dr. Adaobi's hint — shown after the FIRST wrong attempt.
   * One sentence. Teaches the concept behind the answer without giving it.
   */
  hint: z.string(),

  /**
   * Explanation shown AFTER the student answers (correct or wrong).
   * 2–4 sentences. The reasoning path from the content brief.
   */
  explanation: z.string(),

  /**
   * Which Guided Learning mission introduced the concept this question tests.
   * Used for adaptive feedback ("You saw this in Mission 2").
   */
  guidedMissionRef: z.string().optional(),

  /**
   * Which curriculum objective this maps to (from content brief Section 2).
   */
  curriculumObjective: z.string().optional(),

  /**
   * For Mastery structured questions: sub-parts answered in sequence.
   * When parts is present, stem is the overall question context,
   * and individual parts replace options/correctKey.
   */
  parts: z.array(QuestionPartSchema).optional(),

  /** XP awarded for a correct first-attempt answer. */
  xpValue: z.number().int().positive().default(20),
});

export type Question = z.infer<typeof QuestionSchema>;

// ─── Shared config ────────────────────────────────────────────────────────────

export const QuestionBankSharedConfigSchema = z.object({
  /**
   * The subject — used to select Dr. Adaobi vs Prof. Emeka etc.
   * and to set the environment colour.
   */
  subject: z.string().default("chemistry"),

  /**
   * The complete pool of questions for this game across all stages.
   * The mission payload selects a subset by key for each session.
   */
  questions: z.array(QuestionSchema),

  /**
   * How many wrong attempts before the engine forces a reveal.
   */
  maxWrongBeforeReveal: z.number().int().positive().default(2),

  /**
   * Whether to show the explanation after every answer (correct AND wrong)
   * or only after wrong answers.
   * "always"    — student always sees the reasoning (recommended for Practice)
   * "wrong-only"— only shown when student got it wrong (Challenge/Mastery)
   */
  showExplanation: z.enum(["always", "wrong-only"]).default("always"),
});

export type QuestionBankSharedConfig = z.infer<typeof QuestionBankSharedConfigSchema>;

// ─── Mission payload ──────────────────────────────────────────────────────────

export interface QuestionBankMissionPayload {
  /**
   * Which stage this mission belongs to.
   * Controls XP per question, explanation visibility, and UI framing.
   */
  stage: "practice" | "challenge" | "mastery";

  /**
   * Keys of questions from sharedConfig.questions to include in this session.
   * Order is randomised each session.
   */
  questionKeys: string[];

  /**
   * Number of questions to draw from questionKeys per session.
   * If undefined, all questions in questionKeys are used.
   * Enables large pools with shorter sessions.
   */
  sessionSize?: number;

  /**
   * Dr. Adaobi's opening line for this session.
   */
  openingLine: string;

  /**
   * Pass mark as fraction (0–1). Default 0.7 (70%).
   * If student scores below this, engine shows retry prompt.
   */
  passMark?: number;
}

// ─── Full engine config ───────────────────────────────────────────────────────

export interface QuestionBankConfig {
  shared: QuestionBankSharedConfig;
  mission: {
    id: string;
    title: string;
    xp_reward: number;
    payload: QuestionBankMissionPayload;
  };
}

// ─── Outcome ──────────────────────────────────────────────────────────────────

export interface QuestionBankOutcome {
  success: boolean;
  questionsTotal: number;
  questionsCorrect: number;
  firstTryCorrect: number;
  hintsUsed: number;
  timeSpentSec: number;
  /** Whether the student met the pass mark */
  passed: boolean;
  scorePct: number;
}
