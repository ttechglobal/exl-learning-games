import { supabaseServer } from "@/lib/db/supabase";
import { DEFAULT_DISPLAY_NAME } from "@/lib/db/queries/students";

export type LeaderboardPeriod = "weekly" | "monthly" | "allTime";

export interface LeaderboardEntry {
  studentId: string;
  displayName: string;
  xpTotal: number;
  gamesPlayed: number;
  /** Optional — only set if the student filled it in via their profile
   *  (see app/profile/ProfileClient.tsx). Surfaced on the leaderboard
   *  row per direct discussion: school adds a lightweight community/
   *  "see yourself and people you know" signal without requiring
   *  accounts or grouping — see this file's other comments for the
   *  full reasoning. */
  school: string | null;
  rank: number;
}

/**
 * lib/db/queries/leaderboard.ts
 *
 * THE ONE COMPETITIVE RANKING SURFACE IN THE APP. Per direct decision,
 * the old per-game, score-based leaderboard (getGameLeaderboard, which
 * used to live in this file) is RETIRED — it only ever worked for
 * engines that emit a numeric `finalScore` (tile-match, bond-match's
 * factory mode), so three of the four engines could never appear on it
 * at all, and it competed for attention with this cross-game one. See
 * lib/content/personalBest.ts for what replaced its "did I beat my own
 * best on this game" half — a quiet personal stat, not a leaderboard.
 *
 * Everything here is XP-based and cross-game: any mission in any engine
 * contributes the same way, via attempt.xp_awarded. Three periods, one
 * shared implementation (getLeaderboard) parameterized by a cutoff date:
 *
 *   - "weekly": sums xp_awarded for attempts since Monday 00:00
 *     (server-local) — see getStartOfWeekIso. Resets every Monday,
 *     which is what makes a "Weekly Champion" card keep feeling alive
 *     rather than getting dominated permanently by whoever played most
 *     in week one.
 *   - "monthly": sums xp_awarded for attempts since the 1st of the
 *     current month — see getStartOfMonthIso. Same shape, different
 *     cutoff, longer-running competition than weekly.
 *   - "allTime": reads student.xp_total directly rather than summing
 *     attempt rows — that column already IS the lifetime running total
 *     (see lib/db/queries/progress.ts's addXpToStudent, the only writer
 *     of it), so re-deriving it from a full, unbounded scan of attempt
 *     would be strictly more expensive for an identical number. This is
 *     the "Total XP" view explicitly asked for alongside weekly/monthly,
 *     not a third variant of the same summing query.
 *
 * GENUINELY PERIOD-SCOPED, not all-time pretending otherwise:
 * student.xp_total is a lifetime total, so using it for weekly/monthly
 * would make a "Weekly Champion" badge a lie for anyone who simply
 * played the most over their account's whole lifetime, not this week —
 * exactly the bug the original getWeeklyLeaderboard was written to
 * avoid. weekly/monthly still compute fresh from attempt on every call
 * rather than being cached or denormalized anywhere — the right
 * tradeoff at this scale; revisit with a materialized view or scheduled
 * aggregation only if query volume ever makes the live join too slow.
 *
 * "gamesPlayed" means attempts completed IN THAT PERIOD for
 * weekly/monthly (matching what a player would read "Games" as on a
 * weekly/monthly champion card), and lifetime attempt count for
 * allTime.
 *
 * No avatarEmoji in the return type — there's no such column on
 * `student`. HomePage.tsx's LeaderboardEntry already treats avatarEmoji
 * as optional with a UI-level fallback emoji, so simply not supplying it
 * here is correct, not a gap to paper over with a fake value.
 */
export async function getLeaderboard(period: LeaderboardPeriod, limit = 10): Promise<LeaderboardEntry[]> {
  if (period === "allTime") return getAllTimeLeaderboard(limit);

  const sinceIso = period === "weekly" ? getStartOfWeekIso() : getStartOfMonthIso();

  const { data, error } = await supabaseServer()
    .from("attempt")
    .select("student_id, xp_awarded, student:student_id(display_name, school)")
    .gte("completed_at", sinceIso);

  if (error) throw error;

  const totals = new Map<string, { displayName: string; xpTotal: number; gamesPlayed: number; school: string | null }>();
  for (const row of (data ?? []) as Array<{
    student_id: string;
    xp_awarded: number | null;
    student: { display_name: string; school: string | null } | { display_name: string; school: string | null }[] | null;
  }>) {
    // Supabase's PostgREST returns a related row as an object for a
    // to-one foreign key, but typings (and some PostgREST versions) can
    // surface it as a one-element array depending on the relationship
    // inference — handling both rather than assuming one shape.
    const studentRecord = Array.isArray(row.student) ? row.student[0] : row.student;
    const displayName = studentRecord?.display_name ?? "Anonymous";
    const school = studentRecord?.school ?? null;
    const xp = row.xp_awarded ?? 0;

    const existing = totals.get(row.student_id);
    if (existing) {
      existing.xpTotal += xp;
      existing.gamesPlayed += 1;
    } else {
      totals.set(row.student_id, { displayName, xpTotal: xp, gamesPlayed: 1, school });
    }
  }

  return rankAndSlice(totals, limit);
}

/**
 * allTime reads student.xp_total straight off the student table instead
 * of summing attempt rows — see this file's header for why that's the
 * correct (and cheaper) source for a lifetime figure. gamesPlayed here
 * is a real lifetime attempt count (a second, lightweight query), kept
 * separate from xp_total so a student with a long history but few
 * recent plays still shows an honest "games played" number rather than
 * something derived from xp_total/missionReward guesswork — no longer
 * RENDERED anywhere per direct feedback ("remove number of games
 * played"), but left on the data model since it's a real, cheap-to-keep
 * stat that could resurface later (e.g. a future profile insight),
 * rather than ripping out a working query for a UI-only ask.
 */
async function getAllTimeLeaderboard(limit: number): Promise<LeaderboardEntry[]> {
  const { data: students, error: studentsError } = await supabaseServer()
    .from("student")
    .select("id, display_name, xp_total, school")
    .order("xp_total", { ascending: false })
    .limit(limit);

  if (studentsError) throw studentsError;

  const rows = (students ?? []) as Array<{ id: string; display_name: string; xp_total: number; school: string | null }>;
  if (rows.length === 0) return [];

  const { data: attemptCounts, error: attemptsError } = await supabaseServer()
    .from("attempt")
    .select("student_id")
    .in(
      "student_id",
      rows.map((r) => r.id)
    );

  if (attemptsError) throw attemptsError;

  const countByStudent = new Map<string, number>();
  for (const row of (attemptCounts ?? []) as Array<{ student_id: string }>) {
    countByStudent.set(row.student_id, (countByStudent.get(row.student_id) ?? 0) + 1);
  }

  return rows
    .map((r) => ({
      studentId: r.id,
      displayName: r.display_name,
      xpTotal: r.xp_total,
      gamesPlayed: countByStudent.get(r.id) ?? 0,
      school: r.school
    }))
    .filter(isRealLeaderboardEntry)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

/**
 * Per direct feedback ("remove anonymous users without points"):
 * filters out students who both (a) never set a real display name —
 * still sitting on the DEFAULT_DISPLAY_NAME every new student row gets
 * at creation (see students.ts) — AND (b) have zero XP for the period
 * being shown. Deliberately requires BOTH conditions: a real named
 * player with genuinely 0 XP this week still belongs on the list (they
 * exist, they're just not scoring yet), and an "Anonymous" row that
 * HAS earned points is a real competitor regardless of whether they
 * bothered to set a name. It's specifically the combination — no name
 * AND no points — that means "a student row got created (e.g. just by
 * loading the app) and nothing else ever happened" and is just noise.
 */
function isRealLeaderboardEntry(entry: { displayName: string; xpTotal: number }): boolean {
  return entry.displayName !== DEFAULT_DISPLAY_NAME || entry.xpTotal > 0;
}

function rankAndSlice(
  totals: Map<string, { displayName: string; xpTotal: number; gamesPlayed: number; school: string | null }>,
  limit: number
): LeaderboardEntry[] {
  return Array.from(totals.entries())
    .map(([studentId, t]) => ({ studentId, ...t }))
    .filter(isRealLeaderboardEntry)
    .sort((a, b) => b.xpTotal - a.xpTotal)
    .slice(0, limit)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

/**
 * Where ONE specific student sits in a period's ranking, even when
 * they're outside the top N already fetched via getLeaderboard — the
 * "Your rank: #N" line on /leaderboard for anyone not in the visible
 * top 20. Computes the full ranked list for the period (same query
 * shape as getLeaderboard, just unbounded) rather than trying to derive
 * a rank from a count/comparison query, since ties need a single
 * consistent ordering either way.
 *
 * Returns null if the student has no qualifying activity this period
 * (weekly/monthly: zero attempts since the cutoff; allTime: student row
 * not found) — "not ranked yet" is a real, distinct state from "ranked
 * last," and the UI should be able to tell them apart.
 */
export async function getStudentRank(
  studentId: string,
  period: LeaderboardPeriod
): Promise<{ rank: number; xpTotal: number; totalRanked: number } | null> {
  if (period === "allTime") {
    const { data: student, error } = await supabaseServer().from("student").select("xp_total").eq("id", studentId).maybeSingle();
    if (error) throw error;
    if (!student) return null;

    const { count, error: countError } = await supabaseServer()
      .from("student")
      .select("id", { count: "exact", head: true })
      .gt("xp_total", student.xp_total);
    if (countError) throw countError;

    const { count: totalRanked, error: totalError } = await supabaseServer()
      .from("student")
      .select("id", { count: "exact", head: true })
      .gt("xp_total", 0);
    if (totalError) throw totalError;

    return { rank: (count ?? 0) + 1, xpTotal: student.xp_total, totalRanked: totalRanked ?? 0 };
  }

  const sinceIso = period === "weekly" ? getStartOfWeekIso() : getStartOfMonthIso();
  const { data, error } = await supabaseServer().from("attempt").select("student_id, xp_awarded").gte("completed_at", sinceIso);
  if (error) throw error;

  const totals = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ student_id: string; xp_awarded: number | null }>) {
    totals.set(row.student_id, (totals.get(row.student_id) ?? 0) + (row.xp_awarded ?? 0));
  }

  const myXp = totals.get(studentId);
  if (myXp === undefined) return null;

  const ranked = Array.from(totals.values()).sort((a, b) => b - a);
  const rank = ranked.findIndex((xp) => xp === myXp) + 1;

  return { rank, xpTotal: myXp, totalRanked: ranked.length };
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

/** The 1st of the current month, 00:00:00 server-local — the monthly
 *  leaderboard's reset cutoff, same role as getStartOfWeekIso above but
 *  for the longer period. */
function getStartOfMonthIso(): string {
  // Rolling 30-day window rather than "since the 1st of this month" —
  // a calendar-month reset means the leaderboard goes blank every 1st
  // (all plays from last month vanish instantly) and the first ~3 days
  // of a new month show almost nobody. A rolling window is always a
  // full 30 days of real activity regardless of where you are in the
  // calendar, which makes the monthly tab feel consistently populated
  // rather than alternating between "full" and "empty" once a month.
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);
  return thirtyDaysAgo.toISOString();
}

/**
 * Back-compat named export — getWeeklyLeaderboard(limit) is exactly
 * getLeaderboard("weekly", limit). Kept as a thin wrapper since
 * app/page.tsx (the homepage) already calls it by this name and there's
 * no reason to force every call site to migrate just because the
 * monthly/all-time variants were added alongside it.
 */
export async function getWeeklyLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  return getLeaderboard("weekly", limit);
}
