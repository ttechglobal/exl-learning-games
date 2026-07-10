import { z } from "zod";
import { getEngineDefinition } from "@/engines/registry";

export const DifficultySchema = z.enum(["EASY", "MEDIUM", "HARD"]);

export const MissionInputSchema = z.object({
  missionKey:       z.string(),
  title:            z.string(),
  difficulty:       DifficultySchema,
  sequenceIndex:    z.number().int(),
  xpReward:         z.number().int().positive(),
  topicId:          z.string(),
  subtopicId:       z.string().optional(),
  learningGoal:     z.string().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  payload:          z.record(z.string(), z.unknown()),
});

export const GameInputSchema = z.object({
  slug:             z.string(),
  title:            z.string(),
  engineType:       z.string(),
  subject:          z.string(),
  topicId:          z.string(),
  subtopicId:       z.string().optional(),
  progressionMode:  z.enum(["linear", "levelSelect", "trackMap"]).optional(),
  sharedConfig:     z.record(z.string(), z.unknown()).optional().default({}),
  snapshot:         z.object({
    cards: z.array(z.object({ title: z.string(), body: z.string() })).min(0),
  }).optional().default({ cards: [] }),
  /** Optional engine spec from Claude — stored as developer build ticket.
   *  Claude outputs this in the __engineSpec field of the JSON. */
  engineSpec: z.record(z.string(), z.unknown()).optional(),
  // ── New theme + content fields (0002 migration) ──────────────────────────
  card_art_url:       z.string().nullish(),
  card_description:   z.string().nullish(),
  pre_game_gradient:  z.string().nullish(),
  game_gradient:      z.string().nullish(),
  accent_colour:      z.string().nullish(),
  env_desktop_url:    z.string().nullish(),
  env_mobile_url:     z.string().nullish(),
  mission_briefing:   z.string().nullish(),
  mission_objectives: z.object({
    brief: z.string(),
    items: z.array(z.string()),
  }).optional(),
  missions: z.array(MissionInputSchema).optional().default([]),
});

// Patch schema — for adding missions to an existing game
export const GamePatchSchema = z.object({
  missions:    z.array(MissionInputSchema).optional(),
  title:       z.string().optional(),
  is_active:   z.boolean().optional(),
  card_art_url:       z.string().nullish(),
  card_description:   z.string().nullish(),
  pre_game_gradient:  z.string().nullish(),
  game_gradient:      z.string().nullish(),
  accent_colour:      z.string().nullish(),
  env_desktop_url:    z.string().nullish(),
  env_mobile_url:     z.string().nullish(),
  mission_briefing:   z.string().nullish(),
  mission_objectives: z.object({ brief: z.string(), items: z.array(z.string()) }).optional(),
  shared_config:      z.record(z.string(), z.unknown()).optional(),
  snapshot:           z.object({ cards: z.array(z.object({ title: z.string(), body: z.string() })) }).optional(),
});

export type GameInput = z.infer<typeof GameInputSchema>;
export type GamePatch = z.infer<typeof GamePatchSchema>;

export function validateGameInput(raw: unknown): { success: true; data: GameInput; enginePending?: boolean } | { success: false; error: string } {
  const topLevel = GameInputSchema.safeParse(raw);
  if (!topLevel.success) return { success: false, error: topLevel.error.message };

  const engineDef = getEngineDefinition(topLevel.data.engineType);

  // Unknown engine — save the game as a draft so the spec isn't lost.
  // The dev registers the engine component later; missions still upload fine.
  if (!engineDef) {
    return { success: true, data: topLevel.data, enginePending: true };
  }

  const gameLevelResult = engineDef.configSchema.safeParse(topLevel.data.sharedConfig);
  if (gameLevelResult.success) return { success: true, data: topLevel.data };

  const missionLevelResults = topLevel.data.missions.map(m => engineDef.configSchema.safeParse(m.payload));
  if (topLevel.data.missions.length === 0 || missionLevelResults.every(r => r.success)) {
    return { success: true, data: topLevel.data };
  }

  return { success: false, error: `sharedConfig invalid for engine "${topLevel.data.engineType}": ${JSON.stringify(gameLevelResult.error.issues)}` };
}