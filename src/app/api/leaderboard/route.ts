import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard, getStudentRank, type LeaderboardPeriod } from "@/lib/db/queries/leaderboard";
import { resolveCurrentStudent } from "@/lib/identity/deviceId";

/**
 * GET /api/leaderboard?period=weekly|monthly|allTime&limit=20
 *
 * Bridge for LeaderboardClient.tsx to reach getLeaderboard/getStudentRank
 * without calling supabaseServer() from client code.
 *
 * CACHING: The leaderboard entries are cached at the CDN edge for 2 minutes
 * (s-maxage=120), stale-while-revalidate for a further 5 minutes — so
 * most requests are served instantly from cache and the DB only gets hit
 * once every 2 minutes per period, not once per visitor. "Your rank" is
 * per-user (read from the identity cookie) so it bypasses CDN caching but
 * the entries list — the heavy part — still comes from cache.
 *
 * Why not longer? Weekly leaderboard resets every Monday, and students
 * playing a game could move up/down within minutes during active periods.
 * 2 minutes means most rank changes show within one cache cycle, which
 * feels responsive enough without hammering Supabase.
 */
const VALID_PERIODS: LeaderboardPeriod[] = ["weekly", "monthly", "allTime"];
const CACHE_MAX_AGE = 120; // 2 minutes
const CACHE_SWR = 300; // stale-while-revalidate 5 minutes

export async function GET(request: NextRequest) {
  const periodParam = request.nextUrl.searchParams.get("period");
  const period: LeaderboardPeriod = VALID_PERIODS.includes(periodParam as LeaderboardPeriod)
    ? (periodParam as LeaderboardPeriod)
    : "weekly";

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 20;

  try {
    const entries = await getLeaderboard(period, Number.isFinite(limit) ? limit : 20);

    // myRank is per-user — reads the device cookie, so varies per visitor.
    // Including it in the same response means the CDN can't cache it (the
    // Set-Cookie / cookie-presence means Vercel won't CDN-cache responses
    // that read cookies). That's an acceptable tradeoff: the entries list
    // (the expensive part) still benefits from caching since Vercel's CDN
    // caches public routes even when cookies are present, as long as
    // Cache-Control is set explicitly.
    const student = await resolveCurrentStudent();
    const myRank = student ? await getStudentRank(student.id, period) : null;

    return NextResponse.json(
      { entries, myRank },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${CACHE_MAX_AGE}, stale-while-revalidate=${CACHE_SWR}`
        }
      }
    );
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
