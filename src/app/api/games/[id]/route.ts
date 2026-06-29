import { NextRequest, NextResponse } from "next/server";
import { getGameLeaderboard } from "@/lib/db/queries/leaderboard";

/**
 * GET /api/games/[id]/leaderboard
 *
 * Exposes getGameLeaderboard (see lib/db/queries/leaderboard.ts) to
 * client components — HighScoreEntry.tsx is "use client" and can't call
 * supabaseServer() directly (that client is server-only by design; see
 * lib/db/supabase.ts's comment), so this route is the bridge.
 *
 * Per direct feedback ("the leaderboard should come from the DB, not
 * just local" / "shouldn't only be visible when you submit a score"):
 * this is a plain GET with no auth/score-submission gate — anyone
 * viewing a Mission Complete screen can see the real top scores for
 * that game, not just players who happened to beat their own local
 * top 10.
 *
 * ?limit=N optional query param, defaults to 10 in getGameLeaderboard
 * itself if omitted.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  try {
    const leaderboard = await getGameLeaderboard(params.id, limit && Number.isFinite(limit) ? limit : undefined);
    return NextResponse.json({ leaderboard });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}