import { z } from "zod";

export const MirrorTypeSchema = z.enum(["concave", "convex"]);
export type MirrorType = z.infer<typeof MirrorTypeSchema>;

/**
 * Win conditions for one mirror-lab mission.
 * All fields are optional — only the ones specified are checked.
 * A mission with only `targetImageType: "real"` passes the moment
 * the student produces any real image, regardless of size or
 * orientation. This intentionally keeps Easy missions achievable
 * through experimentation rather than calculation.
 */
export const WinConditionsSchema = z.object({
  targetMirror: MirrorTypeSchema.optional(),
  targetImageType: z.enum(["real", "virtual"]).optional(),
  targetOrientation: z.enum(["inverted", "upright"]).optional(),
  targetMagnificationMin: z.number().optional(),
  targetMagnificationMax: z.number().optional()
});
export type WinConditions = z.infer<typeof WinConditionsSchema>;

export const OpticsSharedConfigSchema = z.object({
  /** Focal length in physics units (always positive — engine applies sign
   *  based on mirror type: positive for concave, negative for convex). */
  focalLength: z.number().positive().default(2),
  objectHeightUnits: z.number().positive().default(1),
  /** Which mirrors the player can choose between. */
  mirrorOptions: z.array(MirrorTypeSchema).default(["concave"]),
  /** Difficulty-controlled: Easy shows both, Hard hides both. */
  showFocusLabels: z.boolean().default(true),
  showCenterLabels: z.boolean().default(true),
  /** If true, a "Show/Hide Rays" button appears. Medium/Hard. */
  showRaysToggle: z.boolean().default(false),
  defaultShowRays: z.boolean().default(true)
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
  /** First-failure hint authored per mission. */
  hint?: string;
  /** Override which mirrors are available for this specific mission. */
  mirrorOptions?: MirrorType[];
}

export interface OpticsExperimentOutcome {
  success: true;
  attempts: number;
  hintsUsed: number;
  timeSpentSec: number;
  xpEarned: number;
}
