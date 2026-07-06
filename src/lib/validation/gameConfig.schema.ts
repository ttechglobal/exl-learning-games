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
  missions:         z.array(MissionInputSchema).min(0),
  // ── New theme + content fields (0002 migration) ──────────────────────────
  card_art_url:       z.string().optional(),
  card_description:   z.string().optional(),
  pre_game_gradient:  z.string().optional(),
  game_gradient:      z.string().optional(),
  accent_colour:      z.string().optional(),
  env_desktop_url:    z.string().optional(),
  env_mobile_url:     z.string().optional(),
  mission_briefing:   z.string().optional(),
  mission_objectives: z.object({
    brief: z.string(),
    items: z.array(z.string()),
  }).optional(),
});

// Patch schema — for adding missions to an existing game
export const GamePatchSchema = z.object({
  missions:    z.array(MissionInputSchema).optional(),
  title:       z.string().optional(),
  is_active:   z.boolean().optional(),
  card_art_url:       z.string().optional(),
  card_description:   z.string().optional(),
  pre_game_gradient:  z.string().optional(),
  game_gradient:      z.string().optional(),
  accent_colour:      z.string().optional(),
  env_desktop_url:    z.string().optional(),
  env_mobile_url:     z.string().optional(),
  mission_briefing:   z.string().optional(),
  mission_objectives: z.object({ brief: z.string(), items: z.array(z.string()) }).optional(),
  shared_config:      z.record(z.string(), z.unknown()).optional(),
  snapshot:           z.object({ cards: z.array(z.object({ title: z.string(), body: z.string() })) }).optional(),
});

export type GameInput = z.infer<typeof GameInputSchema>;
export type GamePatch = z.infer<typeof GamePatchSchema>;

export function validateGameInput(raw: unknown): { success: true; data: GameInput } | { success: false; error: string } {
  const topLevel = GameInputSchema.safeParse(raw);
  if (!topLevel.success) return { success: false, error: topLevel.error.message };

  const engineDef = getEngineDefinition(topLevel.data.engineType);
  if (!engineDef) return { success: false, error: `Unknown engineType "${topLevel.data.engineType}" — check src/engines/registry.ts` };

  const gameLevelResult = engineDef.configSchema.safeParse(topLevel.data.sharedConfig);
  if (gameLevelResult.success) return { success: true, data: topLevel.data };

  const missionLevelResults = topLevel.data.missions.map(m => engineDef.configSchema.safeParse(m.payload));
  if (topLevel.data.missions.length === 0 || missionLevelResults.every(r => r.success)) {
    return { success: true, data: topLevel.data };
  }

  return { success: false, error: `sharedConfig invalid for engine "${topLevel.data.engineType}": ${gameLevelResult.error.message}` };
}
