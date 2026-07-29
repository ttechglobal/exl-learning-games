import { z } from "zod";
import type { EngineDefinition } from "@/engines/engine-types";

// ─── Mathematics ──────────────────────────────────────────────────────────────
import StepwiseSolverEngine from "@/engines/mathematics/stepwise-solver/StepwiseSolverEngine";

// ─── Chemistry ────────────────────────────────────────────────────────────────
import { PhaseChamberEngine }            from "@/engines/chemistry/phase-chamber/PhaseChamberEngine";
import { PhaseChamberSharedConfigSchemaFull } from "@/engines/chemistry/phase-chamber/phaseChamber.config";
import { TileMatchEngine }               from "@/engines/chemistry/tile-match/TileMatchEngine";
import { TileMatchSharedConfigSchema }   from "@/engines/chemistry/tile-match/tileMatch.config";
import { BondMatchEngine }               from "@/engines/chemistry/bond-match/BondMatchEngine";
import { BondMatchSharedConfigSchema }   from "@/engines/chemistry/bond-match/bondMatch.config";
import { MoleculeBuilderEngine }         from "@/engines/chemistry/molecule-builder/MoleculeBuilderEngine";
import { MoleculeBuilderSharedConfigSchema } from "@/engines/chemistry/molecule-builder/moleculeBuilder.config";
import { ScenarioScannerEngine }           from "@/engines/chemistry/scenario-scanner/ScenarioScannerEngine";
import { ScenarioScannerSharedConfigSchemaFull } from "@/engines/chemistry/scenario-scanner/scenarioScanner.config";

// ─── Physics ──────────────────────────────────────────────────────────────────
import { OpticsExperimentEngine }        from "@/engines/physics/optics-experiment/OpticsExperimentEngine";
import { OpticsSharedConfigSchema }      from "@/engines/physics/optics-experiment/opticsExperiment.config";
import { LayerPeelEngine }               from "@/engines/physics/layer-peel/LayerPeelEngine";
import { LayerPeelSharedConfigSchema }   from "@/engines/physics/layer-peel/layer-peel.config";

// ─── Cross-subject (generic engines reusable across subjects) ─────────────────
import { QuestionBankEngine }            from "@/engines/cross-subject/question-bank/QuestionBankEngine";
import { QuestionBankSharedConfigSchema } from "@/engines/cross-subject/question-bank/questionBank.config";
import { GuidedLessonEngine }            from "@/engines/cross-subject/guided-lesson/GuidedLessonEngine";
import { MCQEngine }                     from "@/engines/cross-subject/mcq/MCQEngine";

/**
 * registry.ts — Single source of truth for all game engines.
 *
 * STRUCTURE: engines are grouped by subject in both the file system
 * (src/engines/<subject>/<engine-name>/) and here in the registry imports.
 * When adding a new engine:
 *   1. Create src/engines/<subject>/<engine-name>/
 *   2. Add the import block in the right subject section above
 *   3. Add the definition + registry entry in the right section below
 *   4. No other files need to change
 *
 * ENGINE SUBJECTS:
 *   mathematics/    — algebra, formulae, equations, geometry, statistics
 *   chemistry/      — periodic table, bonding, molecules, reactions
 *   physics/        — optics, forces, waves, electricity
 *   biology/        — (no engines yet — folder ready)
 *   cross-subject/  — generic engines that work across subjects (formula drills,
 *                     flashcard match, multiple-choice quiz, etc.)
 */

// ─── MATHEMATICS ─────────────────────────────────────────────────────────────

const stepwiseSolverDefinition: EngineDefinition = {
  engineType: "stepwise-solver",
  configSchema: z.object({}).passthrough() as z.ZodSchema<unknown>,
  Component: StepwiseSolverEngine as unknown as EngineDefinition["Component"],
};



// ─── CHEMISTRY ────────────────────────────────────────────────────────────────

const phaseChamberDefinition: EngineDefinition = {
  engineType: "phase-chamber",
  configSchema: PhaseChamberSharedConfigSchemaFull as unknown as z.ZodSchema<unknown>,
  Component: PhaseChamberEngine as unknown as EngineDefinition["Component"],
};

const tileMatchDefinition: EngineDefinition = {
  engineType: "tile-match",
  configSchema: TileMatchSharedConfigSchema as unknown as z.ZodSchema<unknown>,
  Component: TileMatchEngine as unknown as EngineDefinition["Component"],
};

const bondMatchDefinition: EngineDefinition = {
  engineType: "bond-match",
  configSchema: BondMatchSharedConfigSchema as unknown as z.ZodSchema<unknown>,
  Component: BondMatchEngine as unknown as EngineDefinition["Component"],
};

const scenarioScannerDefinition: EngineDefinition = {
  engineType: "scenario-scanner",
  configSchema: ScenarioScannerSharedConfigSchemaFull as unknown as z.ZodSchema<unknown>,
  Component: ScenarioScannerEngine as unknown as EngineDefinition["Component"],
};

const moleculeBuilderDefinition: EngineDefinition = {
  engineType: "molecule-builder",
  configSchema: MoleculeBuilderSharedConfigSchema as unknown as z.ZodSchema<unknown>,
  Component: MoleculeBuilderEngine as unknown as EngineDefinition["Component"],
};

// ─── PHYSICS ──────────────────────────────────────────────────────────────────

const opticsExperimentDefinition: EngineDefinition = {
  engineType: "optics-experiment",
  configSchema: OpticsSharedConfigSchema as unknown as z.ZodSchema<unknown>,
  Component: OpticsExperimentEngine as unknown as EngineDefinition["Component"],
};

const layerPeelDefinition: EngineDefinition = {
  engineType: "layer-peel",
  configSchema: LayerPeelSharedConfigSchema as unknown as z.ZodSchema<unknown>,
  Component: LayerPeelEngine as unknown as EngineDefinition["Component"],
};

// ─── CROSS-SUBJECT ────────────────────────────────────────────────────────────


const mcqDefinition: EngineDefinition = {
  engineType: "mcq",
  configSchema: z.object({}).passthrough() as z.ZodSchema<unknown>,
  Component: MCQEngine as unknown as EngineDefinition["Component"],
};

const guidedLessonDefinition: EngineDefinition = {
  engineType: "guided_lesson",
  configSchema: z.object({}).passthrough() as z.ZodSchema<unknown>,
  Component: GuidedLessonEngine as unknown as EngineDefinition["Component"],
};

const questionBankDefinition: EngineDefinition = {
  engineType: "question-bank",
  configSchema: QuestionBankSharedConfigSchema as unknown as z.ZodSchema<unknown>,
  Component: QuestionBankEngine as unknown as EngineDefinition["Component"],
};

// ─── REGISTRY ─────────────────────────────────────────────────────────────────

const registry: Record<string, EngineDefinition> = {
  // Mathematics
    // Mathematics — Stepwise Solver (Change of Subject, Simultaneous Equations,
  // Equations of Motion, Quadratic Equations, any calculation topic)
  "stepwise-solver":          stepwiseSolverDefinition,
  
  // Chemistry
  "phase-chamber":             phaseChamberDefinition,
  "tile-match":                tileMatchDefinition,
  "bond-match":                bondMatchDefinition,
  "molecule-builder":          moleculeBuilderDefinition,
  "scenario-scanner":          scenarioScannerDefinition,

  // Physics
  "optics-experiment":         opticsExperimentDefinition,
  "layer-peel":                layerPeelDefinition,

  // Cross-subject
  "mcq":                       mcqDefinition,
  "guided_lesson":             guidedLessonDefinition,
  "question-bank":             questionBankDefinition,
};

export function getEngineDefinition(engineType: string): EngineDefinition | undefined {
  return registry[engineType];
}