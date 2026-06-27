import { z } from "zod";
import type { EngineDefinition } from "@/engines/engine-types";
import { ParticleAssemblyEngine } from "@/engines/particle-assembly/ParticleAssemblyEngine";
import { ParticleAssemblySharedConfigSchema } from "@/engines/particle-assembly/particleAssembly.config";
import { TileMatchEngine } from "@/engines/tile-match/TileMatchEngine";
import { TileMatchSharedConfigSchema } from "@/engines/tile-match/tileMatch.config";
import { BondMatchEngine } from "@/engines/bond-match/BondMatchEngine";
import { BondMatchSharedConfigSchema } from "@/engines/bond-match/bondMatch.config";

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

const registry: Record<string, EngineDefinition> = {
  "particle-assembly": particleAssemblyDefinition,
  "tile-match": tileMatchDefinition,
  "bond-match": bondMatchDefinition
  // "multi-stage": multiStageDefinition  — add once src/engines/multi-stage is built
};

export function getEngineDefinition(engineType: string): EngineDefinition | undefined {
  return registry[engineType];
}
