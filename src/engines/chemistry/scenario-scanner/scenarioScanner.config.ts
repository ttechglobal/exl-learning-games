import { z } from "zod";

// ─── Evidence icons ───────────────────────────────────────────────────────────

export const EvidenceIconsSchema = z.object({
  temperature:  z.boolean().default(false),
  stateChange:  z.boolean().default(false),
  lightRelease: z.boolean().default(false),
  gasProduced:  z.boolean().default(false),
  colourChange: z.boolean().default(false),
});

// ─── Scenario definition ──────────────────────────────────────────────────────

export const ScenarioSchema = z.object({
  /** Unique scenario id — referenced from missions */
  id: z.string(),

  /** Shown above the scenario frame */
  title: z.string(),

  /**
   * Three SVG-renderable frame descriptions.
   * The engine renders these as inline canvas illustrations —
   * no external asset files required.
   * Each frame is a key that maps to a built-in illustration in
   * ScenarioIllustration.tsx.
   */
  frameKey: z.enum([
    "ice-melting",
    "paper-burning",
    "iron-rusting",
    "sugar-dissolving",
    "glass-shattering",
    "milk-souring",
    "wax-melting",
    "metal-sparks",
    "neutralisation",
    "effervescent-tablet",
  ]),

  /**
   * Entity identity tags at each timeline checkpoint.
   * "reference" = start state (always shown in BEFORE column).
   * "at_50" = mid-event.
   * "at_100" = end state.
   */
  entityTags: z.object({
    reference: z.array(z.string()),
    at_50:     z.array(z.string()),
    at_100:    z.array(z.string()),
  }),

  /** Evidence icons that appear during the event */
  evidenceIcons: EvidenceIconsSchema.default({}),

  /** The correct classification */
  correctClassification: z.enum(["physical", "chemical"]),

  /**
   * Scan budget for this mission.
   * null = unlimited (Guided, Practice).
   * 2 = Challenge. 1 = Mastery.
   */
  scanBudget: z.number().int().nullable().default(null),

  /** Dr. Adaobi lines for this specific scenario */
  narration: z.object({
    onScan:            z.string(),
    onCorrect:         z.string(),
    onIncorrect:       z.string(),
    postAnswer:        z.string(),
  }),
});

// ─── Shared config ────────────────────────────────────────────────────────────

export const ScenarioScannerSharedConfigSchema = z.object({
  maxWrongBeforeReveal: z.number().int().default(3),
  xpPerScenario:        z.number().int().default(20),
});

// ─── Mission payload ──────────────────────────────────────────────────────────

export const ScenarioScannerMissionPayloadSchema = z.object({
  /** Ordered list of scenarios for this mission */
  scenarios: z.array(ScenarioSchema),

  /** Stage determines scan budget default and hint availability */
  stage: z.enum(["guided", "practice", "challenge", "mastery"]).default("guided"),

  /** Dr. Adaobi opening line */
  missionContext: z.string().optional(),
});

// ─── Full engine config ───────────────────────────────────────────────────────

export const ScenarioScannerSharedConfigSchemaFull = ScenarioScannerSharedConfigSchema;

// ─── Outcome ──────────────────────────────────────────────────────────────────

export interface ScenarioScannerOutcome {
  success: boolean;
  scenariosAttempted: number;
  correctOnFirstTry: number;
  scansUsed: number;
  timeSpentSec: number;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScenarioDefinition   = import("zod").infer<typeof ScenarioSchema>;
export type ScenarioScannerPayload = import("zod").infer<typeof ScenarioScannerMissionPayloadSchema>;
export type ScenarioScannerSharedConfig = import("zod").infer<typeof ScenarioScannerSharedConfigSchema>;