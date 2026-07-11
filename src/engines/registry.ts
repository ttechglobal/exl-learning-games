import { z } from "zod";
import type { EngineDefinition } from "@/engines/engine-types";

// ─── Mathematics ──────────────────────────────────────────────────────────────
import { ChangeOfSubjectEngine }         from "@/engines/mathematics/change-of-subject/ChangeOfSubjectEngine";
import { ChangeOfSubjectSharedConfigSchema } from "@/engines/mathematics/change-of-subject/changeOfSubject.config";
import { SimultaneousEquationsEngine }   from "@/engines/mathematics/simultaneous-equations/SimultaneousEquationsEngine";
import { StepwiseEquationSolverEngine }  from "@/engines/mathematics/stepwise-equation-solver/StepwiseEquationSolverEngine";
import { StepwiseEquationSolverSharedConfigSchema } from "@/engines/mathematics/stepwise-equation-solver/stepwiseEquationSolver.config";

// ─── Chemistry ────────────────────────────────────────────────────────────────
import { TileMatchEngine }               from "@/engines/chemistry/tile-match/TileMatchEngine";
import { TileMatchSharedConfigSchema }   from "@/engines/chemistry/tile-match/tileMatch.config";
import { BondMatchEngine }               from "@/engines/chemistry/bond-match/BondMatchEngine";
import { BondMatchSharedConfigSchema }   from "@/engines/chemistry/bond-match/bondMatch.config";
import { MoleculeBuilderEngine }         from "@/engines/chemistry/molecule-builder/MoleculeBuilderEngine";
import { MoleculeBuilderSharedConfigSchema } from "@/engines/chemistry/molecule-builder/moleculeBuilder.config";
import { ParticleAssemblyEngine }        from "@/engines/chemistry/particle-assembly/ParticleAssemblyEngine";
import { ParticleAssemblySharedConfigSchema } from "@/engines/chemistry/particle-assembly/particleAssembly.config";

// ─── Physics ──────────────────────────────────────────────────────────────────
import { OpticsExperimentEngine }        from "@/engines/physics/optics-experiment/OpticsExperimentEngine";
import { OpticsSharedConfigSchema }      from "@/engines/physics/optics-experiment/opticsExperiment.config";
import { LayerPeelEngine }               from "@/engines/physics/layer-peel/LayerPeelEngine";
import { LayerPeelSharedConfigSchema }   from "@/engines/physics/layer-peel/layer-peel.config";

// ─── Cross-subject (generic engines reusable across subjects) ─────────────────
import { FormulaExcavationEngine }       from "@/engines/cross-subject/formula-excavation/FormulaExcavationEngine";
import { FormulaExcavationSharedConfigSchema } from "@/engines/cross-subject/formula-excavation/formulaExcavation.config";

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

const changeOfSubjectDefinition: EngineDefinition = {
  engineType: "change-of-subject",
  configSchema: ChangeOfSubjectSharedConfigSchema as unknown as z.ZodSchema<unknown>,
  Component: ChangeOfSubjectEngine as unknown as EngineDefinition["Component"],
};

const simultaneousEquationsDefinition: EngineDefinition = {
  engineType: "simultaneous-equations",
  configSchema: z.object({}).passthrough() as z.ZodSchema<unknown>,
  Component: SimultaneousEquationsEngine as unknown as EngineDefinition["Component"],
};

const stepwiseEquationSolverDefinition: EngineDefinition = {
  engineType: "stepwise-equation-solver",
  configSchema: StepwiseEquationSolverSharedConfigSchema as unknown as z.ZodSchema<unknown>,
  Component: StepwiseEquationSolverEngine as unknown as EngineDefinition["Component"],
};

// ─── CHEMISTRY ────────────────────────────────────────────────────────────────

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

const moleculeBuilderDefinition: EngineDefinition = {
  engineType: "molecule-builder",
  configSchema: MoleculeBuilderSharedConfigSchema as unknown as z.ZodSchema<unknown>,
  Component: MoleculeBuilderEngine as unknown as EngineDefinition["Component"],
};

const particleAssemblyDefinition: EngineDefinition = {
  engineType: "particle-assembly",
  configSchema: ParticleAssemblySharedConfigSchema as unknown as z.ZodSchema<unknown>,
  Component: ParticleAssemblyEngine as unknown as EngineDefinition["Component"],
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

const formulaExcavationDefinition: EngineDefinition = {
  engineType: "formula-excavation",
  configSchema: FormulaExcavationSharedConfigSchema as unknown as z.ZodSchema<unknown>,
  Component: FormulaExcavationEngine as unknown as EngineDefinition["Component"],
};

// ─── REGISTRY ─────────────────────────────────────────────────────────────────

const registry: Record<string, EngineDefinition> = {
  // Mathematics
  "change-of-subject":         changeOfSubjectDefinition,
  "simultaneous-equations":    simultaneousEquationsDefinition,
  "stepwise-equation-solver":  stepwiseEquationSolverDefinition,

  // Chemistry
  "tile-match":                tileMatchDefinition,
  "bond-match":                bondMatchDefinition,
  "molecule-builder":          moleculeBuilderDefinition,
  "particle-assembly":         particleAssemblyDefinition,

  // Physics
  "optics-experiment":         opticsExperimentDefinition,
  "layer-peel":                layerPeelDefinition,

  // Cross-subject
  "formula-excavation":        formulaExcavationDefinition,
};

export function getEngineDefinition(engineType: string): EngineDefinition | undefined {
  return registry[engineType];
}