import { supabaseServer } from "@/lib/db/supabase";

export interface WeeklyLeaderboardEntry {
  studentId: string;
  displayName: string;
  xpTotal: number;
  gamesPlayed: number;
  rank: number;
}

/**
 * Fills the gap HomePage.tsx's own doc comment calls out by name: "there
 * is no query anywhere in src/lib/db for top-N students by XP... it
 * needs a real getWeeklyLeaderboard() query first." This is that query —
 * HomePage's `leaderboard` prop has had nothing real behind it until now.
 *
 * GENUINELY WEEKLY, not all-time: StudentRow.xp_total is a lifetime
 * running total, not a weekly one — using it directly would make
 * "Weekly Champion" a lie for any student who'd simply played the most
 * over their account's whole lifetime, not this week. Instead this sums
 * attempt.xp_awarded for attempts completed since the start of the
 * current week (Monday 00:00, server-local) and joins back to student
 * for display_name — an actual weekly figure, computed fresh on every
 * call rather than cached or denormalized anywhere. That's the right
 * tradeoff for a homepage teaser at this scale; revisit with a
 * materialized view or scheduled aggregation only if this page's query
 * volume ever makes the live join too slow.
 *
 * "gamesPlayed" here means attempts completed THIS WEEK, matching what a
 * player would read "Games" as on the weekly champion card — not a
 * lifetime count, for the same reason xp_total alone wasn't used above.
 *
 * No avatarEmoji in the return type — there's no such column on
 * `student`. HomePage.tsx's LeaderboardEntry already treats avatarEmoji
 * as optional with a UI-level fallback emoji, so simply not supplying it
 * here is correct, not a gap to paper over with a fake value.
 */
export async function getWeeklyLeaderboard(limit = 10): Promise<WeeklyLeaderboardEntry[]> {
  const startOfWeek = getStartOfWeekIso();

  const { data, error } = await supabaseServer()
    .from("attempt")
    .select("student_id, xp_awarded, student:student_id(display_name)")
    .gte("completed_at", startOfWeek);

  if (error) throw error;

  const totals = new Map<string, { displayName: string; xpTotal: number; gamesPlayed: number }>();
  for (const row of (data ?? []) as Array<{
    student_id: string;
    xp_awarded: number | null;
    student: { display_name: string } | { display_name: string }[] | null;
  }>) {
    // Supabase's PostgREST returns a related row as an object for a
    // to-one foreign key, but typings (and some PostgREST versions) can
    // surface it as a one-element array depending on the relationship
    // inference — handling both rather than assuming one shape.
    const studentRecord = Array.isArray(row.student) ? row.student[0] : row.student;
    const displayName = studentRecord?.display_name ?? "Anonymous";
    const xp = row.xp_awarded ?? 0;

    const existing = totals.get(row.student_id);
    if (existing) {
      existing.xpTotal += xp;
      existing.gamesPlayed += 1;
    } else {
      totals.set(row.student_id, { displayName, xpTotal: xp, gamesPlayed: 1 });
    }
  }

  return Array.from(totals.entries())
    .map(([studentId, t]) => ({ studentId, ...t }))
    .sort((a, b) => b.xpTotal - a.xpTotal)
    .slice(0, limit)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

/** Monday 00:00:00 in server-local time, as an ISO string suitable for a
 *  Postgres timestamp comparison. Monday (not Sunday) since that's the
 *  more common "start of week" convention for a weekly leaderboard reset
 *  cadence aimed at a school/study context. */
function getStartOfWeekIso(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

export interface GameLeaderboardEntry {
  studentId: string;
  displayName: string;
  score: number;
  date: string;
  rank: number;
}

/**
 * Real, per-GAME, all-time, server-backed leaderboard — distinct from
 * getWeeklyLeaderboard above (that one is cross-game, weekly, for the
 * homepage). This is what HighScoreEntry.tsx now shows instead of (or
 * alongside) the old localStorage-only list: a top-N table of the best
 * score anyone has ever recorded on THIS specific game, visible to
 * everyone regardless of whose device set the record.
 *
 * SCORE SOURCE: attempt.score is a normalized 0-1 value (see
 * TileMatchEngine's onComplete — score: Math.min(1, raw/ceiling)), not
 * the actual in-game point total a player would recognize from their
 * own session. The real number (e.g. "740") only exists inside
 * attempt.raw_outcome's `finalScore` key, the same field
 * GameRuntime.tsx already reads client-side
 * (lastResult?.rawOutcome?.finalScore). This query reaches into that
 * jsonb column rather than using the normalized score column, since
 * ranking by the normalized value would show 0.92 instead of the
 * 700-ish numbers players actually recognize from their own session.
 *
 * DELIBERATELY NOT SORTING BY THE JSONB PATH IN POSTGREST: PostgREST/
 * postgrest-js's .order() on a jsonb key has had real, documented
 * quoting/casting issues across versions, and without a live DB to test
 * against in this session there's no way to confirm it behaves
 * correctly here. Instead this pulls a bounded candidate set (most
 * recent CANDIDATE_POOL_SIZE attempts with a numeric finalScore — recent
 * rather than unbounded, so a long-running game's attempt table doesn't
 * force pulling its entire history just to find the top 10) and sorts +
 * ranks entirely in JS, where the behavior is fully predictable and
 * doesn't depend on PostgREST version quirks. If this game accumulates
 * enough volume that "most recent N" stops reliably containing the
 * true all-time top 10, revisit with a proper indexed/generated column
 * for finalScore instead of querying into raw jsonb at all.
 *
 * Only attempts where raw_outcome has a numeric finalScore are
 * considered — engines with no comparable per-session score
 * (particle-assembly's one-shot completion, bond-match's level mode)
 * simply never produce rows with that key, so they're naturally
 * excluded rather than needing a special case here.
 */
const CANDIDATE_POOL_SIZE = 500;

export async function getGameLeaderboard(gameId: string, limit = 10): Promise<GameLeaderboardEntry[]> {
  const { data, error } = await supabaseServer()
    .from("attempt")
    .select("student_id, raw_outcome, completed_at, student:student_id(display_name)")
    .eq("game_id", gameId)
    // ->> (text extraction), not -> (json extraction), on the FINAL key
    // in the path — this is the documented working form for .not(...,
    // "is", null) against a jsonb column. Treated as a soft optimization
    // only, not the source of correctness: the .filter() call below
    // (after the query returns) re-checks "does this row actually have
    // a numeric finalScore" in JS regardless, so even if this DB-side
    // filter behaves differently than expected on a given PostgREST
    // version, rows without a real score still can't leak into the
    // ranked result.
    .not("raw_outcome->>finalScore", "is", null)
    .order("completed_at", { ascending: false })
    .limit(CANDIDATE_POOL_SIZE);

  if (error) throw error;

  return ((data ?? []) as Array<{
    student_id: string;
    raw_outcome: Record<string, unknown>;
    completed_at: string;
    student: { display_name: string } | { display_name: string }[] | null;
  }>)
    .filter((row) => typeof row.raw_outcome?.finalScore === "number")
    .map((row) => {
      const studentRecord = Array.isArray(row.student) ? row.student[0] : row.student;
      return {
        studentId: row.student_id,
        displayName: studentRecord?.display_name ?? "Anonymous",
        score: row.raw_outcome.finalScore as number,
        date: row.completed_at.slice(0, 10)
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}