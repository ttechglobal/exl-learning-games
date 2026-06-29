import { supabaseServer } from "@/lib/db/supabase";
import type { AnalyticsEvent } from "@/types/event";

/**
 * lib/db/queries/events.ts
 *
 * Writes one AnalyticsEvent row — same simple, single-table-write shape
 * as lib/db/queries/attempts.ts's insertAttempt, deliberately, so the
 * two storage paths stay easy to reason about side by side: an
 * `attempt` row is the authoritative record of one completed mission
 * (drives XP/mastery), an `event` row is a lightweight signal that may
 * or may not correspond to a completed mission at all.
 */
export async function insertEvent(event: AnalyticsEvent): Promise<void> {
  const { error } = await supabaseServer()
    .from("event")
    .insert({
      name: event.name,
      student_id: event.studentId,
      game_id: event.gameId,
      mission_id: event.missionId ?? null,
      topic_id: event.topicId ?? null,
      subtopic_id: event.subtopicId ?? null,
      detail: event.detail ?? {},
      occurred_at: event.occurredAt
    });

  if (error) throw error;
}

export interface TopicDifficultyBreakdown {
  topicId: string;
  subtopicId: string | null;
  /** Average attemptsBeforeSuccess across every mission_completed event
   *  for this topic/subtopic that reported a numeric value — higher
   *  means students typically need more tries before getting it right. */
  avgAttemptsBeforeSuccess: number;
  sampleSize: number;
}

/**
 * The actual question this feature exists to answer (per
 * Game_Philosophy's stated core strength — "identifying high-frequency
 * exam topics... and helping students master them," now applied to
 * in-game mistakes, not just past-question performance): which
 * topics/subtopics students typically need the most tries to get right,
 * across every student and every game. Built from mission_completed
 * events' `detail.attemptsBeforeSuccess` (see types/event.ts's header
 * for why this aggregate-per-mission count is used instead of a
 * separate per-tap wrong-attempt event — the latter would need
 * identity props threaded into every engine purely for analytics).
 *
 * Intentionally a simple average-and-group rather than a time-windowed
 * or per-student breakdown — this is the first, most basic version of
 * this query; revisit with date filters or per-student drill-down once
 * there's a real admin surface asking for them specifically (see
 * app/(admin)/admin — no analytics dashboard exists there yet; this
 * query is ready for one, not wired into one).
 */
export async function getTopicDifficultyBreakdown(limit = 20): Promise<TopicDifficultyBreakdown[]> {
  const { data, error } = await supabaseServer()
    .from("event")
    .select("topic_id, subtopic_id, detail")
    .eq("name", "mission_completed")
    .not("topic_id", "is", null);

  if (error) throw error;

  const totals = new Map<string, { topicId: string; subtopicId: string | null; sum: number; count: number }>();
  for (const row of (data ?? []) as Array<{
    topic_id: string | null;
    subtopic_id: string | null;
    detail: Record<string, unknown> | null;
  }>) {
    if (!row.topic_id) continue;
    const attempts = row.detail?.attemptsBeforeSuccess;
    if (typeof attempts !== "number") continue;

    const key = `${row.topic_id}|${row.subtopic_id ?? ""}`;
    const existing = totals.get(key);
    if (existing) {
      existing.sum += attempts;
      existing.count += 1;
    } else {
      totals.set(key, { topicId: row.topic_id, subtopicId: row.subtopic_id, sum: attempts, count: 1 });
    }
  }

  return Array.from(totals.values())
    .map((t) => ({
      topicId: t.topicId,
      subtopicId: t.subtopicId,
      avgAttemptsBeforeSuccess: t.sum / t.count,
      sampleSize: t.count
    }))
    .sort((a, b) => b.avgAttemptsBeforeSuccess - a.avgAttemptsBeforeSuccess)
    .slice(0, limit);
}
