import { NextRequest, NextResponse } from "next/server";
import { getMissionsForGame } from "@/lib/db/queries/games";
import { fixedOrderPolicy } from "@/lib/difficulty/fixedOrderPolicy";

/**
 * The one place that decides which DifficultyPolicy is active — mirrors the
 * pattern used for ExportAdapter (lib/export/index.ts). Swap this single
 * line to switch to adaptivePolicy later; no engine or content change needed.
 */
const activeDifficultyPolicy = fixedOrderPolicy;

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const gameId = request.nextUrl.searchParams.get("gameId");
  if (!gameId) {
    return NextResponse.json({ error: "gameId query param is required" }, { status: 400 });
  }

  try {
    const missions = await getMissionsForGame(gameId);
    const nextMission = await activeDifficultyPolicy.pickNextMission(params.id, missions);

    if (!nextMission) {
      return NextResponse.json({ error: "No missions available for this game" }, { status: 404 });
    }

    return NextResponse.json({ mission: nextMission });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
