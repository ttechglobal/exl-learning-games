import { supabaseServer } from "@/lib/db/supabase";
import type { AttemptRow } from "@/types/db";
import type { AttemptResult } from "@/types/result";

/**
 * Writes one Attempt row from a normalized AttemptResult.
 * Does NOT update TopicProgress or Student.xpTotal — callers (the /api/attempts
 * route handler) are responsible for orchestrating that via lib/scoring/masteryFormula.ts
 * so this function stays a simple, testable single-table write.
 */
export async function insertAttempt(result: AttemptResult, xpAwarded: number): Promise<AttemptRow> {
  const { data, error } = await supabaseServer()
    .from("attempt")
    .insert({
      student_id: result.studentId,
      game_id: result.gameId,
      mission_id: result.missionId ?? null,
      topic_id: result.topicId,
      subtopic_id: result.subtopicId ?? null,
      success: result.success ?? null,
      score: result.score ?? null,
      time_spent_sec: result.timeSpentSec ?? null,
      attempts_before_success: result.attemptsBeforeSuccess ?? null,
      xp_awarded: xpAwarded,
      raw_outcome: result.rawOutcome,
      completed_at: result.completedAt
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as AttemptRow;
}

export async function listAttemptsForStudent(studentId: string, topicId?: string): Promise<AttemptRow[]> {
  let query = supabaseServer().from("attempt").select("*").eq("student_id", studentId);
  if (topicId) query = query.eq("topic_id", topicId);

  const { data, error } = await query.order("completed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AttemptRow[];
}

/**
 * Returns the set of mission_ids this student has at least one
 * SUCCESSFUL attempt against, scoped to one game — the actual data the
 * "trackMap" progression mode (see GameRow.progression_mode) needs to
 * decide which missions are unlocked. A mission with only failed
 * attempts (success === false) does NOT count as completed and stays
 * locked — finishing a mission means succeeding at it, not just
 * attempting it.
 *
 * Returns a Set (not an array) since every call site only ever needs
 * membership checks (`completedMissionIds.has(mission.id)`), and a Set
 * makes that an O(1) lookup per mission when rendering a track of
 * potentially many missions, rather than an O(n) `.includes()` per
 * mission rendered.
 */
export async function listCompletedMissionIdsForStudent(studentId: string, gameId: string): Promise<Set<string>> {
  const { data, error } = await supabaseServer()
    .from("attempt")
    .select("mission_id")
    .eq("student_id", studentId)
    .eq("game_id", gameId)
    .eq("success", true);

  if (error) throw error;
  const rows = (data ?? []) as { mission_id: string | null }[];
  const ids = rows.map((row) => row.mission_id).filter((id): id is string => Boolean(id));
  return new Set(ids);
}
