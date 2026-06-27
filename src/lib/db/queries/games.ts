import { supabaseServer } from "@/lib/db/supabase";
import type { GameRow, MissionRow } from "@/types/db";

export async function getGameBySlug(slug: string): Promise<GameRow | null> {
  const { data, error } = await supabaseServer()
    .from("game")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // no rows
    throw error;
  }
  return data as GameRow;
}

export async function getGameById(id: string): Promise<GameRow | null> {
  const { data, error } = await supabaseServer().from("game").select("*").eq("id", id).single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as GameRow;
}

export async function listGames(filters: { subject?: string; topicId?: string } = {}): Promise<GameRow[]> {
  let query = supabaseServer().from("game").select("*").eq("is_active", true);
  if (filters.subject) query = query.eq("subject", filters.subject);
  if (filters.topicId) query = query.eq("topic_id", filters.topicId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as GameRow[];
}

export async function getMissionsForGame(gameId: string): Promise<MissionRow[]> {
  const { data, error } = await supabaseServer()
    .from("mission")
    .select("*")
    .eq("game_id", gameId)
    .eq("is_active", true)
    .order("sequence_index", { ascending: true });

  if (error) throw error;
  return (data ?? []) as MissionRow[];
}

/**
 * Batched version of getMissionsForGame for pages that need mission
 * metadata (difficulty, XP, estimated time) across MANY games at once —
 * e.g. the /worlds catalog, which shows every game grouped by subject and
 * needs per-game aggregates (mission count, XP range, difficulty spread)
 * without issuing one query per game in a loop.
 *
 * Returns a map keyed by game_id so callers can do
 * `missionsByGame[game.id] ?? []` per game rather than re-filtering a flat
 * array themselves.
 */
export async function getMissionsForGames(gameIds: string[]): Promise<Record<string, MissionRow[]>> {
  if (gameIds.length === 0) return {};

  const { data, error } = await supabaseServer()
    .from("mission")
    .select("*")
    .in("game_id", gameIds)
    .eq("is_active", true)
    .order("sequence_index", { ascending: true });

  if (error) throw error;

  const byGame: Record<string, MissionRow[]> = {};
  for (const mission of (data ?? []) as MissionRow[]) {
    (byGame[mission.game_id] ??= []).push(mission);
  }
  return byGame;
}

export async function getMissionById(id: string): Promise<MissionRow | null> {
  const { data, error } = await supabaseServer().from("mission").select("*").eq("id", id).single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as MissionRow;
}