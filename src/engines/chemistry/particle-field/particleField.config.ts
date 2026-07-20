/**
 * particleField.config.ts — Matter Lab engine config
 *
 * NEW IN THIS VERSION:
 *
 * NarrationStop — a temperature waypoint where the slider auto-pauses and
 *   Dr. Adaobi delivers a specific line BEFORE the student continues dragging.
 *   This enables the Guided Learning interaction model from the content brief:
 *   concept demonstrated at each stop, question only after all stops passed.
 *
 * SurfaceEscape — a separate visual layer for Mission 4 (evaporation).
 *   Instead of triggering a full-canvas phase transition, individual particles
 *   in the top 15% of the canvas drift upward and escape one at a time.
 *   This makes the visual distinction between evaporation and boiling clear.
 *
 * interactionMode:
 *   "guided"  — narration stops active; slider auto-locks at each waypoint;
 *               no question fires until all stops are passed. Guided Learning.
 *   "free"    — original behaviour: student drags freely, transitions fire.
 *               Practice, Challenge, Mastery missions.
 *
 * missionContext — the real-world anchor sentence shown above Dr. Adaobi's
 *   bubble at mission start. Makes the science feel relevant before it begins.
 */

import { z } from "zod";

// ─── Narration stop ───────────────────────────────────────────────────────────

export const NarrationStopSchema = z.object({
  /**
   * Temperature at which the slider auto-pauses. The engine locks the slider,
   * shows Dr. Adaobi's line, waits for the student to tap "Continue", then
   * unlocks. Multiple stops can be defined per mission.
   */
  temp: z.number().min(0).max(100),
  /** Dr. Adaobi's line at this stop. One sentence. Narrates what is visible. */
  line: z.string(),
  /**
   * Optional system instruction shown below the line, e.g. "Drag the slider
   * to 15° now". Not shown in free mode.
   */
  instruction: z.string().optional(),
  /**
   * If true, a visual highlight annotation appears on the canvas at this stop.
   * E.g. an arrow pointing to the grid, or a circle around surface particles.
   */
  highlight: z.enum(["grid", "surface", "none"]).default("none"),
});

export type NarrationStop = z.infer<typeof NarrationStopSchema>;

// ─── Surface escape config (evaporation mission) ──────────────────────────────

export const SurfaceEscapeSchema = z.object({
  /**
   * Temperature at which surface escape begins. Below this, no escape occurs.
   * Typically set 10° below the transition threshold.
   */
  startTemp: z.number(),
  /**
   * Fraction of canvas height (from top) that counts as the "surface layer".
   * Default 0.18 = top 18% of canvas.
   */
  surfaceFraction: z.number().min(0.05).max(0.4).default(0.18),
  /**
   * How many particles per second can escape from the surface.
   * Scales with temperature above startTemp.
   */
  escapeRateBase: z.number().positive().default(0.8),
});

export type SurfaceEscape = z.infer<typeof SurfaceEscapeSchema>;

// ─── Transition ───────────────────────────────────────────────────────────────

export const TransitionSchema = z.object({
  key: z.string(),
  threshold: z.number().min(0).max(100),
  direction: z.enum(["up", "down"]),
  formalName: z.string(),
  correctLabel: z.string(),
  options: z.array(z.string()).min(2).max(6),
  confirmationNarration: z.string(),
  wrongFeedback: z.record(z.string(), z.string()).optional(),
  showConservationDrag: z.boolean().default(false),
  /**
   * In guided mode: Dr. Adaobi's line shown BEFORE the label picker appears,
   * after the slow-motion pause. Tells the student what just happened in plain
   * language before they are asked to name it.
   */
  guidedPrePickerLine: z.string().optional(),
});

export type Transition = z.infer<typeof TransitionSchema>;

// ─── Curriculum variants ──────────────────────────────────────────────────────

export const CurriculumVariantSchema = z.object({
  anchor: z.string(),
  substanceName: z.string(),
});

export type CurriculumVariant = z.infer<typeof CurriculumVariantSchema>;

// ─── Shared config ────────────────────────────────────────────────────────────

export const ParticleFieldSharedConfigSchema = z.object({
  particleCount: z.number().int().min(20).max(60).default(40),
  transitionPauseMs: z.number().int().positive().default(1500),
  maxWrongBeforeReveal: z.number().int().positive().default(3),
  hintAfterWrongAttempts: z.number().int().positive().default(2),

  phases: z.object({
    solid: z.object({
      tempRange: z.tuple([z.number(), z.number()]),
      speedMult: z.number().positive().default(0.15),
      fixedPositions: z.boolean().default(true),
      spacingFraction: z.number().positive().default(0.075),
    }),
    liquid: z.object({
      tempRange: z.tuple([z.number(), z.number()]),
      speedMult: z.number().positive().default(0.55),
      fixedPositions: z.boolean().default(false),
      spacingFraction: z.number().positive().default(0.085),
    }),
    gas: z.object({
      tempRange: z.tuple([z.number(), z.number()]),
      speedMult: z.number().positive().default(2.2),
      fixedPositions: z.boolean().default(false),
      spacingFraction: z.number().positive().default(0.22),
    }),
  }).default({
    solid:  { tempRange: [0,  34], speedMult: 0.15, fixedPositions: true,  spacingFraction: 0.075 },
    liquid: { tempRange: [35, 69], speedMult: 0.55, fixedPositions: false, spacingFraction: 0.085 },
    gas:    { tempRange: [70, 100], speedMult: 2.2,  fixedPositions: false, spacingFraction: 0.22  },
  }),

  particleColors: z.object({
    solid:  z.string().default("#7b8fff"),
    liquid: z.string().default("#38c0f0"),
    gas:    z.string().default("#ff9d4a"),
  }).default({ solid: "#7b8fff", liquid: "#38c0f0", gas: "#ff9d4a" }),

  curriculumVariants: z.object({
    nigeria:   CurriculumVariantSchema,
    cambridge: CurriculumVariantSchema,
    mixed:     CurriculumVariantSchema,
    us:        CurriculumVariantSchema,
  }).optional(),

  curriculumTopicCodes: z.object({
    nigeria:   z.array(z.string()),
    cambridge: z.array(z.string()),
    mixed:     z.array(z.string()),
    us:        z.array(z.string()),
  }).optional(),
});

export type ParticleFieldSharedConfig = z.infer<typeof ParticleFieldSharedConfigSchema>;

// ─── Full engine config ───────────────────────────────────────────────────────

export interface ParticleFieldConfig {
  shared: ParticleFieldSharedConfig;
  mission: {
    id: string;
    title: string;
    xp_reward: number;
    payload: {
      startTemp: number;
      substanceName: string;
      /**
       * Real-world anchor sentence shown in Dr. Adaobi's first card.
       * E.g. "An ice sachet is sitting on the lab bench in the Lagos heat."
       */
      missionContext?: string;
      transitions: Transition[];
      difficulty?: "EASY" | "MEDIUM" | "HARD";
      showGhostHand?: boolean;
      /**
       * "guided"  — narration stops active, concept-first teaching.
       *             Slider auto-locks at each NarrationStop.
       *             Dr. Adaobi pre-explains every transition before the picker.
       *             Used for Guided Learning missions.
       *
       * "free"    — student drags freely, transitions fire questions.
       *             Used for Practice / Challenge / Mastery.
       */
      interactionMode?: "guided" | "free";
      /**
       * Scripted waypoints for guided mode.
       * The engine locks the slider at each temperature, shows the line,
       * waits for "Continue" tap, then unlocks for the next segment.
       * Ignored in free mode.
       */
      narrationStops?: NarrationStop[];
      /**
       * If present, enables the surface-escape visual for this mission.
       * Used only in the evaporation mission.
       * In guided mode: surface escape begins after all narration stops
       * are passed. In free mode: escape begins when temp > startTemp.
       */
      surfaceEscape?: SurfaceEscape;
    };
  };
}

// ─── Outcome ──────────────────────────────────────────────────────────────────

export interface ParticleFieldOutcome {
  success: true;
  transitionsTotal: number;
  transitionsFirstTry: number;
  totalWrongAttempts: number;
  anyRevealed: boolean;
  timeSpentSec: number;
}
