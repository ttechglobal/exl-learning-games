import { z } from "zod";
import type { EngineDefinition } from "@/engines/engine-types";
import { ParticleAssemblyEngine } from "@/engines/particle-assembly/ParticleAssemblyEngine";
import { ParticleAssemblySharedConfigSchema } from "@/engines/particle-assembly/particleAssembly.config";
import { TileMatchEngine } from "@/engines/tile-match/TileMatchEngine";
import { TileMatchSharedConfigSchema } from "@/engines/tile-match/tileMatch.config";
import { BondMatchEngine } from "@/engines/bond-match/BondMatchEngine";
import { BondMatchSharedConfigSchema } from "@/engines/bond-match/bondMatch.config";
import { MoleculeBuilderEngine } from "@/engines/molecule-builder/MoleculeBuilderEngine";
import { MoleculeBuilderSharedConfigSchema } from "@/engines/molecule-builder/moleculeBuilder.config";
import { OpticsExperimentEngine } from "@/engines/optics-experiment/OpticsExperimentEngine";
import { OpticsSharedConfigSchema } from "@/engines/optics-experiment/opticsExperiment.config";
import { StepwiseEquationSolverEngine } from "@/engines/stepwise-equation-solver/StepwiseEquationSolverEngine";
import { StepwiseEquationSolverSharedConfigSchema } from "@/engines/stepwise-equation-solver/stepwiseEquationSolver.config";
import { LayerPeelEngine } from "@/engines/layer-peel/LayerPeelEngine";
import { LayerPeelSharedConfigSchema } from "@/engines/layer-peel/layer-peel.config";
import { FormulaExcavationEngine } from "@/engines/formula-excavation/FormulaExcavationEngine";
import { FormulaExcavationSharedConfigSchema } from "@/engines/formula-excavation/formulaExcavation.config";
import { ChangeOfSubjectEngine } from "@/engines/change-of-subject/ChangeOfSubjectEngine";
import { ChangeOfSubjectSharedConfigSchema } from "@/engines/change-of-subject/changeOfSubject.config";


/**
 * Single source of truth mapping a Game's `engine_type` string to the
 * matching engine component + config validator. Adding a new engine means
 * adding one new entry here — nothing else changes.
 */
const particleAssemblyDefinition: EngineDefinition = {
  engineType: "particle-assembly",
  configSchema: ParticleAssemblySharedConfigSchema as unknown as z.ZodSchema<unknown>,
  Component: ParticleAssemblyEngine as unknown as EngineDefinition["Component"]
};

const tileMatchDefinition: EngineDefinition = {
  engineType: "tile-match",
  configSchema: TileMatchSharedConfigSchema as unknown as z.ZodSchema<unknown>,
  Component: TileMatchEngine as unknown as EngineDefinition["Component"]
};

const bondMatchDefinition: EngineDefinition = {
  engineType: "bond-match",
  configSchema: BondMatchSharedConfigSchema as unknown as z.ZodSchema<unknown>,
  Component: BondMatchEngine as unknown as EngineDefinition["Component"]
};

const moleculeBuilderDefinition: EngineDefinition = {
  engineType: "molecule-builder",
  configSchema: MoleculeBuilderSharedConfigSchema as unknown as z.ZodSchema<unknown>,
  Component: MoleculeBuilderEngine as unknown as EngineDefinition["Component"]
};

const opticsExperimentDefinition: EngineDefinition = {
  engineType: "optics-experiment",
  configSchema: OpticsSharedConfigSchema as unknown as z.ZodSchema<unknown>,
  Component: OpticsExperimentEngine as unknown as EngineDefinition["Component"]
};

const stepwiseEquationSolverDefinition: EngineDefinition = {
  engineType: "stepwise-equation-solver",
  configSchema: StepwiseEquationSolverSharedConfigSchema as unknown as z.ZodSchema<unknown>,
  Component: StepwiseEquationSolverEngine as unknown as EngineDefinition["Component"]
};

const layerPeelDefinition: EngineDefinition = {
  engineType: "layer-peel",
  configSchema: LayerPeelSharedConfigSchema as unknown as z.ZodSchema<unknown>,
  Component: LayerPeelEngine as unknown as EngineDefinition["Component"],
};

const formulaExcavationDefinition: EngineDefinition = {
  engineType: "formula-excavation",
  configSchema: FormulaExcavationSharedConfigSchema as unknown as z.ZodSchema<unknown>,
  Component: FormulaExcavationEngine as unknown as EngineDefinition["Component"]
};


const changeOfSubjectDefinition: EngineDefinition = {
  engineType: "change-of-subject",
  configSchema: ChangeOfSubjectSharedConfigSchema as unknown as z.ZodSchema<unknown>,
  Component: ChangeOfSubjectEngine as unknown as EngineDefinition["Component"],
};

const registry: Record<string, EngineDefinition> = {
  "particle-assembly":         particleAssemblyDefinition,
  "tile-match":                tileMatchDefinition,
  "bond-match":                bondMatchDefinition,
  "molecule-builder":          moleculeBuilderDefinition,
  "optics-experiment":         opticsExperimentDefinition,
  "stepwise-equation-solver":  stepwiseEquationSolverDefinition,
  "formula-excavation":        formulaExcavationDefinition,
  "layer-peel":                layerPeelDefinition,
  "change-of-subject":         changeOfSubjectDefinition,
};

export function getEngineDefinition(engineType: string): EngineDefinition | undefined {
  return registry[engineType];
}