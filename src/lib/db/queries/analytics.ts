import { supabaseServer } from "@/lib/db/supabase";

/**
 * lib/db/queries/analytics.ts
 *
 * Server-side aggregate queries powering the admin analytics dashboard
 * at /admin. All queries use JS-side aggregation for anything beyond a
 * basic filter — same proven pattern getLeaderboard() uses.
 */

export interface PlatformSummary {
  totalStudents: number;
  totalAttempts: number;
  totalXpAwarded: number;
  successRate: number;
  attemptsLast7Days: number;
  newStudentsLast7Days: number;
}

export async function getPlatformSummary(): Promise<PlatformSummary> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [students, attempts, recentAttempts, recentStudents] = await Promise.all([
    supabaseServer().from("student").select("id", { count: "exact", head: true }),
    supabaseServer().from("attempt").select("success, xp_awarded"),
    supabaseServer().from("attempt").select("id", { count: "exact", head: true }).gte("completed_at", sevenDaysAgo),
    supabaseServer().from("student").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo)
  ]);

  const rows = (attempts.data ?? []) as Array<{ success: boolean | null; xp_awarded: number }>;
  const totalXp = rows.reduce((sum, r) => sum + (r.xp_awarded ?? 0), 0);
  const withOutcome = rows.filter((r) => r.success !== null);
  const successCount = withOutcome.filter((r) => r.success === true).length;

  return {
    totalStudents: students.count ?? 0,
    totalAttempts: rows.length,
    totalXpAwarded: totalXp,
    successRate: withOutcome.length > 0 ? successCount / withOutcome.length : 0,
    attemptsLast7Days: recentAttempts.count ?? 0,
    newStudentsLast7Days: recentStudents.count ?? 0
  };
}

export interface GameStats {
  gameId: string;
  gameTitle: string;
  totalAttempts: number;
  successRate: number;
  avgAttemptsBeforeSuccess: number;
  uniquePlayers: number;
}

export async function getGameStats(): Promise<GameStats[]> {
  const [gamesRes, attemptsRes] = await Promise.all([
    supabaseServer().from("game").select("id, title").eq("is_active", true),
    supabaseServer().from("attempt").select("game_id, student_id, success, attempts_before_success")
  ]);

  const games = (gamesRes.data ?? []) as Array<{ id: string; title: string }>;
  const attempts = (attemptsRes.data ?? []) as Array<{
    game_id: string;
    student_id: string;
    success: boolean | null;
    attempts_before_success: number | null;
  }>;

  const gameMap = new Map(games.map((g) => [g.id, g.title]));
  const stats = new Map<string, { total: number; success: number; withOutcome: number; attemptsSum: number; attemptsCount: number; players: Set<string> }>();

  for (const row of attempts) {
    if (!stats.has(row.game_id)) stats.set(row.game_id, { total: 0, success: 0, withOutcome: 0, attemptsSum: 0, attemptsCount: 0, players: new Set() });
    const s = stats.get(row.game_id)!;
    s.total += 1;
    s.players.add(row.student_id);
    if (row.success !== null) { s.withOutcome += 1; if (row.success) s.success += 1; }
    if (typeof row.attempts_before_success === "number") { s.attemptsSum += row.attempts_before_success; s.attemptsCount += 1; }
  }

  return Array.from(stats.entries())
    .filter(([gameId]) => gameMap.has(gameId))
    .map(([gameId, s]) => ({
      gameId,
      gameTitle: gameMap.get(gameId) ?? gameId,
      totalAttempts: s.total,
      successRate: s.withOutcome > 0 ? s.success / s.withOutcome : 0,
      avgAttemptsBeforeSuccess: s.attemptsCount > 0 ? s.attemptsSum / s.attemptsCount : 0,
      uniquePlayers: s.players.size
    }))
    .sort((a, b) => b.totalAttempts - a.totalAttempts);
}

export interface TopicStats {
  topicId: string;
  totalAttempts: number;
  successRate: number;
  avgAttemptsBeforeSuccess: number;
}

export async function getTopicStats(limit = 15): Promise<TopicStats[]> {
  const { data, error } = await supabaseServer()
    .from("attempt")
    .select("topic_id, success, attempts_before_success")
    .not("topic_id", "is", null);

  if (error) throw error;

  const rows = (data ?? []) as Array<{ topic_id: string; success: boolean | null; attempts_before_success: number | null }>;
  const stats = new Map<string, { total: number; success: number; withOutcome: number; attemptsSum: number; attemptsCount: number }>();

  for (const row of rows) {
    if (!row.topic_id) continue;
    if (!stats.has(row.topic_id)) stats.set(row.topic_id, { total: 0, success: 0, withOutcome: 0, attemptsSum: 0, attemptsCount: 0 });
    const s = stats.get(row.topic_id)!;
    s.total += 1;
    if (row.success !== null) { s.withOutcome += 1; if (row.success) s.success += 1; }
    if (typeof row.attempts_before_success === "number") { s.attemptsSum += row.attempts_before_success; s.attemptsCount += 1; }
  }

  return Array.from(stats.entries())
    .map(([topicId, s]) => ({
      topicId,
      totalAttempts: s.total,
      successRate: s.withOutcome > 0 ? s.success / s.withOutcome : 0,
      avgAttemptsBeforeSuccess: s.attemptsCount > 0 ? s.attemptsSum / s.attemptsCount : 0
    }))
    .sort((a, b) => a.successRate - b.successRate)
    .slice(0, limit);
}

export interface DailyActivity {
  date: string;
  attempts: number;
  successes: number;
}

export async function getDailyActivity(): Promise<DailyActivity[]> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseServer()
    .from("attempt")
    .select("success, completed_at")
    .gte("completed_at", since)
    .order("completed_at", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as Array<{ success: boolean | null; completed_at: string }>;
  const byDate = new Map<string, { attempts: number; successes: number }>();

  for (const row of rows) {
    const date = row.completed_at.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, { attempts: 0, successes: 0 });
    const d = byDate.get(date)!;
    d.attempts += 1;
    if (row.success === true) d.successes += 1;
  }

  return Array.from(byDate.entries())
    .map(([date, d]) => ({ date, ...d }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
