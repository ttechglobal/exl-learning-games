import { z } from "zod";

// ─── Shared (game-wide) config ────────────────────────────────────────────────

/**
 * Values that do not change across missions — physics constants,
 * particle system limits, timing. Validated once when the game loads.
 */
export const PhaseChamberSharedConfigSchema = z.object({
  /** How many particles to render. Capped at 80 for low-end Android. */
  particleCount: z.number().int().min(20).max(80).default(48),

  /** Canvas background hex — matches --eg-* token. */
  backgroundColour: z.string().default("#030a14"),

  /** Milliseconds of slow-motion before a state-change event fires. */
  transitionPauseMs: z.number().int().default(800),

  /** How many wrong picks before the correct answer is revealed. */
  maxWrongBeforeReveal: z.number().int().default(3),

  /** Temperature thresholds that define solid/liquid/gas zones.
   *  Used across heat-control, pressure-chamber, and boundary-drag configs. */
  phases: z.object({
    solid:  z.object({ tempRange: z.tuple([z.number(), z.number()]) }),
    liquid: z.object({ tempRange: z.tuple([z.number(), z.number()]) }),
    gas:    z.object({ tempRange: z.tuple([z.number(), z.number()]) }),
  }).default({
    solid:  { tempRange: [0, 30] },
    liquid: { tempRange: [30, 70] },
    gas:    { tempRange: [70, 100] },
  }),

  /** Particle colours per state — hex strings. */
  particleColors: z.object({
    solid:  z.string().default("#b0c8f0"),
    liquid: z.string().default("#9b7ae0"),
    gas:    z.string().default("#c4aff0"),
  }).default({}),
});

// ─── Mode-specific mission payload schemas ────────────────────────────────────

/**
 * boundary-drag — Interaction 1: State & Arrangement
 * Wall position (0–100) drives the state. No temperature. No heat slider.
 */
export const BoundaryDragPayloadSchema = z.object({
  mode: z.literal("boundary-drag"),

  /** Substance shown in the macro illustration panel. */
  substanceName: z.string(),

  /** Asset paths for the three macro illustrations (top panel). */
  macroIllustrations: z.object({
    solid:  z.string(),
    liquid: z.string(),
    gas:    z.string(),
  }).optional(),

  /**
   * Wall position thresholds (0–100 normalised) that define zone boundaries.
   * solid: wall < solidMax, liquid: solidMax–gasMin, gas: wall > gasMin.
   */
  stateZones: z.object({
    solidMax: z.number().min(0).max(100).default(35),
    gasMin:   z.number().min(0).max(100).default(65),
  }).default({}),

  /** Starting wall position (0–100). */
  startWall: z.number().min(0).max(100).default(15),

  /** Which Guided steps to show. Omit for Practice/Challenge/Mastery. */
  guidedSteps: z.array(z.object({
    /** Wall must be in this zone before step advances. */
    targetZone: z.enum(["solid", "liquid", "gas"]).optional(),
    /** Wall must be held in targetZone for this many ms before step advances. */
    holdMs: z.number().int().default(2000),
    /** Bond tap required to advance this step. */
    requiresBondTap: z.boolean().default(false),
    /** Dr. Adaobi's line for this step. */
    narration: z.string(),
    /** Instruction text overlaid on canvas. */
    instruction: z.string().optional(),
  })).optional(),

  /** Whether bond-tap is enabled for this mission. */
  bondTapEnabled: z.boolean().default(true),

  /** Difficulty — affects what's shown (labels, density indicator). */
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("EASY"),

  /**
   * What the student must do to complete this mission.
   * "demonstrate-all-states" — wall held in each zone for holdMs.
   * "identify-state" — student taps the correct state chip.
   * "set-state" — student drags to target zone and confirms.
   */
  completionType: z.enum([
    "demonstrate-all-states",
    "identify-state",
    "set-state",
  ]).default("demonstrate-all-states"),

  /** For "identify-state": which state the student must identify. */
  targetState: z.enum(["solid", "liquid", "gas"]).optional(),

  /** Opening Dr. Adaobi line (shown before student interacts). */
  missionContext: z.string().optional(),
});

/**
 * heat-control — Interaction 2: Change of State & Energy Flow
 * Vertical heat slider drives temperature; heating curve plots live.
 */
export const HeatControlPayloadSchema = z.object({
  mode: z.literal("heat-control"),

  substanceName: z.string(),
  meltingPointC: z.number().default(0),
  boilingPointC: z.number().default(100),
  startTempC: z.number().default(-20),
  maxTempC: z.number().default(120),

  /** Whether the surface-escape evaporation visual is active. */
  surfaceEscapeEnabled: z.boolean().default(true),

  /** Whether student can place event flags on the heating curve. */
  flagPlacementEnabled: z.boolean().default(false),

  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("EASY"),
  missionContext: z.string().optional(),

  guidedSteps: z.array(z.object({
    targetTempC: z.number().optional(),
    narration: z.string(),
    instruction: z.string().optional(),
    holdMs: z.number().int().default(2000),
    requiresFlagPlacement: z.boolean().default(false),
  })).optional(),
});

/**
 * pressure-chamber — Interaction 3: Temperature, Pressure & Container
 * Heat + sealed/open toggle; pressure gauge; danger zone; rupture.
 */
export const PressureChamberPayloadSchema = z.object({
  mode: z.literal("pressure-chamber"),

  startTempC: z.number().default(20),
  maxTempC: z.number().default(300),
  startPressureAtm: z.number().default(1.0),
  ruptureThresholdAtm: z.number().default(4.5),
  dangerZoneStartAtm: z.number().default(3.0),

  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("EASY"),
  missionContext: z.string().optional(),

  guidedSteps: z.array(z.object({
    targetPressureAtm: z.number().optional(),
    requiresToggle: z.enum(["sealed", "open"]).optional(),
    narration: z.string(),
    instruction: z.string().optional(),
    holdMs: z.number().int().default(2000),
    forceRupture: z.boolean().default(false),
  })).optional(),
});

/**
 * diffusion — Interaction 4: Diffusion (Guided + Practice only)
 * Temperature pre-set; dye release; concentration heat-map.
 */
export const DiffusionPayloadSchema = z.object({
  mode: z.literal("diffusion"),

  /** Starting temperature in °C (can be adjusted before release). */
  startTempC: z.number().default(20),

  /** Whether split A/B comparison mode is available. */
  splitABEnabled: z.boolean().default(false),

  difficulty: z.enum(["EASY", "MEDIUM"]).default("EASY"),
  missionContext: z.string().optional(),

  guidedSteps: z.array(z.object({
    lockTempC: z.number().optional(),
    narration: z.string(),
    instruction: z.string().optional(),
  })).optional(),
});

// ─── Union payload ────────────────────────────────────────────────────────────

export const PhaseChamberMissionPayloadSchema = z.discriminatedUnion("mode", [
  BoundaryDragPayloadSchema,
  HeatControlPayloadSchema,
  PressureChamberPayloadSchema,
  DiffusionPayloadSchema,
]);

// ─── Full engine config (shared + mission) ────────────────────────────────────

export const PhaseChamberSharedConfigSchemaFull = PhaseChamberSharedConfigSchema;

export interface PhaseChamberConfig {
  shared: z.infer<typeof PhaseChamberSharedConfigSchema>;
  mission: {
    id: string;
    stage: "EASY" | "MEDIUM" | "HARD";
    learningGoal: string;
    payload: z.infer<typeof PhaseChamberMissionPayloadSchema>;
  };
}

// ─── Outcome ──────────────────────────────────────────────────────────────────

export interface PhaseChamberOutcome {
  success: boolean;
  mode: z.infer<typeof PhaseChamberMissionPayloadSchema>["mode"];
  /** Seconds from mission start to completion. */
  timeSpentSec: number;
  /** Total wrong attempts across all tasks in this mission. */
  totalWrongAttempts: number;
  /** Whether any answer was revealed (student ran out of attempts). */
  anyRevealed: boolean;
  /** For identify/set tasks: how many answered correctly on first try. */
  firstTryCount: number;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PhaseChamberSharedConfig = z.infer<typeof PhaseChamberSharedConfigSchema>;
export type BoundaryDragPayload      = z.infer<typeof BoundaryDragPayloadSchema>;
export type HeatControlPayload       = z.infer<typeof HeatControlPayloadSchema>;
export type PressureChamberPayload   = z.infer<typeof PressureChamberPayloadSchema>;
export type DiffusionPayload         = z.infer<typeof DiffusionPayloadSchema>;
export type PhaseChamberPayload      = z.infer<typeof PhaseChamberMissionPayloadSchema>;
