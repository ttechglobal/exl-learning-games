import { z } from "zod";

export const MirrorTypeSchema = z.enum(["concave", "convex"]);
export type MirrorType = z.infer<typeof MirrorTypeSchema>;

export const WinConditionsSchema = z.object({
  targetMirror: MirrorTypeSchema.optional(),
  targetImageType: z.enum(["real", "virtual"]).optional(),
  targetOrientation: z.enum(["inverted", "upright"]).optional(),
  targetMagnificationMin: z.number().optional(),
  targetMagnificationMax: z.number().optional(),
  requiresFormulaEntry: z.boolean().optional(),
  requiresMagnificationEntry: z.boolean().optional(),
  formulaTolerance: z.number().optional(),
});
export type WinConditions = z.infer<typeof WinConditionsSchema>;

export const OpticsSharedConfigSchema = z.object({
  focalLength: z.number().positive().default(2),
  objectHeightUnits: z.number().positive().default(1),
  mirrorOptions: z.array(MirrorTypeSchema).default(["concave"]),
  showFocusLabels: z.boolean().default(true),
  showCenterLabels: z.boolean().default(true),
  showRaysToggle: z.boolean().default(false),
  defaultShowRays: z.boolean().default(true),
});
export type OpticsSharedConfig = z.infer<typeof OpticsSharedConfigSchema>;

export interface OpticsExperimentConfig {
  shared: OpticsSharedConfig;
  mission: {
    id: string;
    xpReward: number;
    payload?: Record<string, unknown>;
  };
}

/**
 * A prediction prompt shown BEFORE the student drags.
 * They must answer correctly (or after one wrong attempt) before the lab unlocks.
 */
export interface PredictionPrompt {
  question: string;
  options: string[];
  correctIndex: number;
  /** Shown after a wrong answer — teaches the concept before they experiment. */
  explanation: string;
}

export interface MirrorLabPayload {
  winConditions: WinConditions;
  hint?: string;
  mirrorOptions?: MirrorType[];
  showFocusLabels?: boolean;
  showCenterLabels?: boolean;
  showRaysToggle?: boolean;
  defaultShowRays?: boolean;
  formulaChallenge?: {
    showSolution?: boolean;
  };
  /**
   * Tier 2 — Predict before you experiment.
   * When present, the lab shows a prediction quiz before unlocking the drag controls.
   * After the student answers (right or wrong), they see feedback then proceed.
   */
  prediction?: PredictionPrompt;
}

export interface OpticsExperimentOutcome {
  success: true;
  attempts: number;
  hintsUsed: number;
  timeSpentSec: number;
  xpEarned: number;
}