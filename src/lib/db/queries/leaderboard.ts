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