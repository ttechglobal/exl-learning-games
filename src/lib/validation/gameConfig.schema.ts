import { z } from "zod";
import { getEngineDefinition } from "@/engines/registry";

export const DifficultySchema = z.enum(["EASY", "MEDIUM", "HARD"]);

export const MissionInputSchema = z.object({
  missionKey: z.string(),
  title: z.string(),
  difficulty: DifficultySchema,
  sequenceIndex: z.number().int(),
  xpReward: z.number().int().positive(),
  topicId: z.string(),
  subtopicId: z.string().optional(),
  /** Shown on the Mission Briefing as "Learning Goal" — see MissionRow.learning_goal for the migration caveat. */
  learningGoal: z.string().optional(),
  /** Minutes, shown on the Mission Briefing — see MissionRow.estimated_minutes for the migration caveat. */
  estimatedMinutes: z.number().int().positive().optional(),
  payload: z.record(z.string(), z.unknown())
});

export const GameInputSchema = z.object({
  slug: z.string(),
  title: z.string(),
  engineType: z.string(),
  subject: z.string(),
  topicId: z.string(),
  subtopicId: z.string().optional(),
  /** Optional — when omitted the runtime infers from mission difficulty mix.
   *  Set explicitly to "trackMap" for sequential-unlock games like Mirror Lab
   *  and Carbon Builder, so the inference logic is never load-bearing. */
  progressionMode: z.enum(["linear", "levelSelect", "trackMap"]).optional(),
  sharedConfig: z.record(z.string(), z.unknown()),
  snapshot: z.object({
    cards: z
      .array(
        z.object({
          title: z.string(),
          body: z.string()
        })
      )
      .min(1)
  }),
  missions: z.array(MissionInputSchema).min(1)
});

export type GameInput = z.infer<typeof GameInputSchema>;

/**
 * Validates a full game payload: top-level shape via GameInputSchema, then
 * sharedConfig against whichever engine's own schema matches engineType.
 * Used by the admin create/update routes before any DB write.
 *
 * Two valid shapes for where an engine's real shared config lives, mirrored
 * from how the runtime resolves it (see BondMatchEngine.tsx's
 * resolveSharedConfig for the canonical example):
 * - GAME-LEVEL: Game.sharedConfig itself satisfies the engine's schema —
 *   the shape used by particle-assembly and tile-match, where one config
 *   applies uniformly across the whole game's mission list.
 * - MISSION-LEVEL: Game.sharedConfig is empty/minimal, and EVERY mission's
 *   payload independently satisfies the engine's schema instead — the
 *   shape Atom Forge needs ("one game, several self-contained levels," each
 *   with its own element pool and mission-list-or-factory config that a
 *   single top-level config can't represent for more than one level).
 *
 * A payload is invalid only if NEITHER shape validates — this is what lets
 * the same validator support both engine styles without each engine having
 * to special-case its own input-validation path.
 */
export function validateGameInput(raw: unknown): { success: true; data: GameInput } | { success: false; error: string } {
  const topLevel = GameInputSchema.safeParse(raw);
  if (!topLevel.success) {
    return { success: false, error: topLevel.error.message };
  }

  const engineDef = getEngineDefinition(topLevel.data.engineType);
  if (!engineDef) {
    return { success: false, error: `Unknown engineType "${topLevel.data.engineType}" — check src/engines/registry.ts` };
  }

  const gameLevelResult = engineDef.configSchema.safeParse(topLevel.data.sharedConfig);
  if (gameLevelResult.success) {
    return { success: true, data: topLevel.data };
  }

  // Game-level config didn't satisfy the schema — check whether EVERY
  // mission's payload independently does, before failing the whole payload.
  const missionLevelResults = topLevel.data.missions.map((m) => engineDef.configSchema.safeParse(m.payload));
  const allMissionsValid = missionLevelResults.every((r) => r.success);

  if (allMissionsValid) {
    return { success: true, data: topLevel.data };
  }

  const firstMissionError = missionLevelResults.find((r) => !r.success);
  return {
    success: false,
    error:
      `sharedConfig invalid for engine "${topLevel.data.engineType}" at the game level (${gameLevelResult.error.message}), ` +
      `and at least one mission's payload also failed the same schema` +
      (firstMissionError && !firstMissionError.success ? `: ${firstMissionError.error.message}` : "")
  };
}