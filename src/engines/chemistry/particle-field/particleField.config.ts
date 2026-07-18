/**
 * engines/chemistry/particle-field/particleField.config.ts
 *
 * Config schema for the particle-field engine — Matter Lab.
 *
 * MECHANIC:
 *   A bounded canvas renders N animated particle dots whose speed and
 *   spacing is driven by a temperature slider the student drags.
 *   At each phase-transition threshold the engine pauses particle motion
 *   and surfaces a label-picker: the student taps the physical-action
 *   label that describes what they see. The correct label reveals the
 *   formal chemistry term. No submit button — the label tap IS the answer.
 *
 * WHY LABELS ARE PHYSICAL DESCRIPTIONS, NOT VOCABULARY WORDS:
 *   "Particles breaking free of each other" not "Melting".
 *   The student identifies the event before the word appears.
 *   Tapping a vocabulary word would be a quiz. Tapping a physical
 *   description is reading what the simulation is showing.
 *
 * CURRICULUM VARIANTS:
 *   Surface-text only (substance name, Dr. Adaobi anchor phrase).
 *   Particle behaviour and transition thresholds are curriculum-neutral.
 */

import { z } from "zod";

// ─── Transition definitions ───────────────────────────────────────────────────

/**
 * A single phase transition the engine can fire.
 * correctLabel must match one of the options[] entries exactly.
 */
export const TransitionSchema = z.object({
  /** Unique key — used to track which transitions the student has completed. */
  key: z.string(),
  /**
   * Temperature value (0–100 scale) at which this transition fires.
   * The engine fires it when the slider crosses this value in the
   * correct direction.
   */
  threshold: z.number().min(0).max(100),
  /**
   * Direction the slider must be moving for this transition to fire.
   * "up" = heating (solid→liquid, liquid→gas, solid→gas).
   * "down" = cooling (gas→liquid, liquid→solid).
   */
  direction: z.enum(["up", "down"]),
  /**
   * The formal chemistry name shown AFTER the student picks correctly.
   * Never shown on the label buttons themselves.
   */
  formalName: z.string(),
  /**
   * The physical description that is the CORRECT label.
   * Must exactly match one entry in options[].
   */
  correctLabel: z.string(),
  /**
   * All label options shown in the picker (correct + distractors).
   * 3 on EASY, 4 on MEDIUM, 6 on HARD (difficulty modifier trims/extends).
   */
  options: z.array(z.string()).min(2).max(6),
  /**
   * Dr. Adaobi line narrated AFTER correct label. Specific to this
   * transition — not a generic "well done".
   */
  confirmationNarration: z.string(),
  /**
   * Per-option wrong-answer feedback. Key = the wrong option text.
   * If a wrong option has no entry here, a fallback generic hint fires.
   */
  wrongFeedback: z.record(z.string(), z.string()).optional(),
  /**
   * Whether to show a conservation-of-mass drag-confirm after this
   * transition resolves. Missions 3+ use this.
   */
  showConservationDrag: z.boolean().default(false),
});

export type Transition = z.infer<typeof TransitionSchema>;

// ─── Curriculum variants ─────────────────────────────────────────────────────

export const CurriculumVariantSchema = z.object({
  /** Short real-world anchor dropped into Dr. Adaobi's briefing line. */
  anchor: z.string(),
  /** The substance's display name in this locale. */
  substanceName: z.string(),
});

export type CurriculumVariant = z.infer<typeof CurriculumVariantSchema>;

// ─── Shared config (stored in game.shared_config) ────────────────────────────

export const ParticleFieldSharedConfigSchema = z.object({
  /**
   * Number of particle dots rendered in the canvas.
   * 40 is the default — stress-test on low-end Android before changing.
   * Below 30 the solid→liquid transition looks unconvincing (grid too sparse).
   * Above 50 risks frame-rate on Tecno Spark / Infinix Hot class devices.
   */
  particleCount: z.number().int().min(20).max(60).default(40),

  /**
   * How long (ms) the slow-motion freeze lasts when a transition fires
   * before the label picker appears.
   */
  transitionPauseMs: z.number().int().positive().default(1500),

  /**
   * Max wrong attempts on a single transition label before the engine
   * forces a reveal (shows the correct answer highlighted).
   */
  maxWrongBeforeReveal: z.number().int().positive().default(3),

  /**
   * Wrong attempts before the hint unlocks on a given transition.
   */
  hintAfterWrongAttempts: z.number().int().positive().default(2),

  /**
   * Phase regions define particle behaviour at each temperature range.
   * The engine interpolates speed/spacing continuously between regions.
   */
  phases: z.object({
    solid: z.object({
      /** Temperature range this phase spans (0–100 scale). */
      tempRange: z.tuple([z.number(), z.number()]),
      /** Particle speed multiplier (1 = base speed). */
      speedMult: z.number().positive().default(0.15),
      /** Whether particles have fixed-position jitter (true) or free movement (false). */
      fixedPositions: z.boolean().default(true),
      /** Approx spacing between particle centres as fraction of canvas size. */
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
    solid:  { tempRange: [0,  35], speedMult: 0.15, fixedPositions: true,  spacingFraction: 0.075 },
    liquid: { tempRange: [36, 70], speedMult: 0.55, fixedPositions: false, spacingFraction: 0.085 },
    gas:    { tempRange: [71, 100], speedMult: 2.2,  fixedPositions: false, spacingFraction: 0.22  },
  }),

  /** Colour used for particle dots in each state. */
  particleColors: z.object({
    solid:  z.string().default("#7b8fff"),
    liquid: z.string().default("#38c0f0"),
    gas:    z.string().default("#ff9d4a"),
  }).default({ solid: "#7b8fff", liquid: "#38c0f0", gas: "#ff9d4a" }),

  /** Curriculum variant map — resolved at render time from student profile. */
  curriculumVariants: z.object({
    nigeria:   CurriculumVariantSchema,
    cambridge: CurriculumVariantSchema,
    mixed:     CurriculumVariantSchema,
    us:        CurriculumVariantSchema,
  }).optional(),

  /** Topic codes per curriculum for mastery reporting. */
  curriculumTopicCodes: z.object({
    nigeria:   z.array(z.string()),
    cambridge: z.array(z.string()),
    mixed:     z.array(z.string()),
    us:        z.array(z.string()),
  }).optional(),
});

export type ParticleFieldSharedConfig = z.infer<typeof ParticleFieldSharedConfigSchema>;

// ─── Full engine config (what the engine component receives) ──────────────────

export interface ParticleFieldConfig {
  shared: ParticleFieldSharedConfig;
  mission: {
    id: string;
    title: string;
    xp_reward: number;
    payload: {
      /**
       * Starting temperature (0–100). Sets the slider's initial position
       * and therefore the initial particle state.
       * Mission 1: 0 (solid). Mission 2: 95 (gas). Mission 6: 75 (gas).
       */
      startTemp: number;
      /**
       * Narrative substance name — overridable per curriculum via
       * shared.curriculumVariants. Falls back to this value.
       */
      substanceName: string;
      /**
       * All transitions this mission expects the student to find and label,
       * in the order they should appear (lowest threshold first for heating
       * missions, highest first for cooling missions).
       */
      transitions: Transition[];
      /**
       * Difficulty modifier — affects label count and narration timing.
       * Resolved by the engine, not GameRuntime.
       */
      difficulty?: "EASY" | "MEDIUM" | "HARD";
      /**
       * Whether the ghost-hand demonstration plays on first interaction.
       * True only on Mission 1 EASY.
       */
      showGhostHand?: boolean;
      /**
       * Whether Dr. Adaobi narrates the transition BEFORE the label picker
       * appears (EASY) or only after (MEDIUM/HARD).
       */
      narrateBeforePicker?: boolean;
    };
  };
}

// ─── Outcome ─────────────────────────────────────────────────────────────────

export interface ParticleFieldOutcome {
  success: true;
  /** How many transitions the student encountered. */
  transitionsTotal: number;
  /** How many were labelled correctly on first attempt. */
  transitionsFirstTry: number;
  /** Total wrong label attempts across all transitions. */
  totalWrongAttempts: number;
  /** Whether any transition required the forced reveal. */
  anyRevealed: boolean;
  timeSpentSec: number;
}
