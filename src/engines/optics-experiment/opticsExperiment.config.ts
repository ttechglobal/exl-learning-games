import { z } from "zod";

export const MirrorTypeSchema = z.enum(["concave", "convex"]);
export type MirrorType = z.infer<typeof MirrorTypeSchema>;

/**
 * Win conditions for one mirror-lab mission.
 * All fields are optional — only the ones specified are checked.
 */
export const WinConditionsSchema = z.object({
  targetMirror: MirrorTypeSchema.optional(),
  targetImageType: z.enum(["real", "virtual"]).optional(),
  targetOrientation: z.enum(["inverted", "upright"]).optional(),
  targetMagnificationMin: z.number().optional(),
  targetMagnificationMax: z.number().optional(),
  /** Formula challenge: student must enter correct u/v/f values */
  requiresFormulaEntry: z.boolean().optional(),
  /** Linear magnification challenge: student must enter m value */
  requiresMagnificationEntry: z.boolean().optional(),
  /** Acceptable tolerance for numeric entries (default 0.05 = 5%) */
  formulaTolerance: z.number().optional(),
});
export type WinConditions = z.infer<typeof WinConditionsSchema>;

export const OpticsSharedConfigSchema = z.object({
  /** Focal length in physics units (always positive). */
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

export interface MirrorLabPayload {
  winConditions: WinConditions;
  hint?: string;
  mirrorOptions?: MirrorType[];
  /** Scaffold overrides — these are VALID payload keys */
  showFocusLabels?: boolean;
  showCenterLabels?: boolean;
  showRaysToggle?: boolean;
  defaultShowRays?: boolean;
  /** Formula / magnification challenge metadata */
  formulaChallenge?: {
    /** Object distance u provided to student for calculation */
    givenU?: number;
    /** Whether to show worked solution after success */
    showSolution?: boolean;
  };
}

export interface OpticsExperimentOutcome {
  success: true;
  attempts: number;
  hintsUsed: number;
  timeSpentSec: number;
  xpEarned: number;
}