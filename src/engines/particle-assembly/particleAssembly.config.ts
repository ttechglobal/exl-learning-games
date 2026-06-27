/**
 * particle-assembly engine — config schema
 *
 * Engine family: player adds discrete "particles" (or any countable unit)
 * from a fixed set of generators into a single construction target. Counters
 * update live as particles are added/removed. A check only fires on explicit
 * submit (not on every add), but the UI gives continuous visual feedback
 * (the assembly visibly forming) the whole time.
 *
 * Split to match the Game/Mission DB tables (architecture doc Section 4):
 * - SharedConfig lives on Game.shared_config — generators, entry/snapshot copy,
 *   feedback rules, review template, achievements: things true for every
 *   mission in this game.
 * - MissionPayload lives on Mission.payload — just the target composition and
 *   result label for ONE mission. difficulty/sequenceIndex/xpReward/topicId
 *   are real Mission columns, not part of this payload (see Section 6).
 */

import { z } from "zod";

const GeneratorSchema = z.object({
  id: z.string(), // e.g. "proton"
  label: z.string(), // e.g. "Proton Generator"
  particleLabel: z.string(), // e.g. "Proton"
  color: z.string(), // CSS color/token
  panel: z.enum(["left", "right", "bottom", "top"])
});

const FeedbackRuleSchema = z.object({
  when: z.enum(["proton_count_mismatch", "any_mismatch"]),
  message: z.string()
});

export const ParticleAssemblySharedConfigSchema = z.object({
  entry: z.object({
    title: z.string(),
    missionLabel: z.string().default("Today's Challenge")
  }),
  generators: z.array(GeneratorSchema).min(1),
  feedbackRules: z.array(FeedbackRuleSchema).default([
    {
      when: "proton_count_mismatch",
      message: "This composition has {protonCount} protons. Hint: {targetElement} has {targetProtonCount}."
    },
    { when: "any_mismatch", message: "Not quite — check your counts against the mission card." }
  ]),
  review: z.object({
    successLines: z.array(z.string()).min(1)
  }),
  achievements: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string()
      })
    )
    .default([]),
  // lookup table used for failure feedback ("you created Nitrogen"); chemistry-specific
  // but kept generic (Record<number,string>) so a non-chemistry particle-assembly
  // game wouldn't need this field shape changed, just left empty.
  elementsByProtonCount: z.record(z.string(), z.string()).default({})
});

export const ParticleAssemblyMissionPayloadSchema = z.object({
  // target counts, keyed by generator id — e.g. { proton: 6, neutron: 8, electron: 6 }
  target: z.record(z.string(), z.number().int().nonnegative()),
  resultLabel: z.string().optional() // e.g. "Carbon-14"
});

export type ParticleAssemblySharedConfig = z.infer<typeof ParticleAssemblySharedConfigSchema>;
export type ParticleAssemblyMissionPayload = z.infer<typeof ParticleAssemblyMissionPayloadSchema>;
export type Generator = z.infer<typeof GeneratorSchema>;

/** Combined shape the engine component actually receives at runtime (shared config + this mission's payload). */
export interface ParticleAssemblyConfig {
  shared: ParticleAssemblySharedConfig;
  mission: ParticleAssemblyMissionPayload & {
    id: string;
    title: string;
    xpReward: number;
  };
}

/** Raw outcome shape this engine hands back to GameRuntime on mission completion. */
export interface ParticleAssemblyOutcome {
  success: true; // this engine has no partial-credit state — a mission is complete or it isn't
  attemptsBeforeSuccess: number;
  timeSpentSec: number;
  finalComposition: Record<string, number>;
}
