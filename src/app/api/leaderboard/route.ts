import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard, getStudentRank, type LeaderboardPeriod } from "@/lib/db/queries/leaderboard";
import { resolveCurrentStudent } from "@/lib/identity/deviceId";

/**
 * GET /api/leaderboard?period=weekly|monthly|allTime&limit=20
 *
 * Bridge for LeaderboardClient.tsx (a "use client" component switching
 * between Weekly/Monthly/All-Time tabs) to reach getLeaderboard/
 * getStudentRank, which call supabaseServer() and so can't be invoked
 * directly from client code — same reasoning as the now-removed
 * /api/games/[id]/leaderboard route had for HighScoreEntry.tsx, just for
 * the surface that replaced it.
 *
 * Plain GET, no auth gate — same "anyone can see the real rankings"
 * stance the old per-game leaderboard route took, now applied to the
 * one cross-game board.
 */
const VALID_PERIODS: LeaderboardPeriod[] = ["weekly", "monthly", "allTime"];

export async function GET(request: NextRequest) {
  const periodParam = request.nextUrl.searchParams.get("period");
  const period: LeaderboardPeriod = VALID_PERIODS.includes(periodParam as LeaderboardPeriod)
    ? (periodParam as LeaderboardPeriod)
    : "weekly";

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 20;

  try {
    const entries = await getLeaderboard(period, Number.isFinite(limit) ? limit : 20);

    const student = await resolveCurrentStudent();
    const myRank = student ? await getStudentRank(student.id, period) : null;

    return NextResponse.json({ entries, myRank });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
