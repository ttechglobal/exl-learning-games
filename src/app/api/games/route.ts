import { NextRequest, NextResponse } from "next/server";
import { listGames } from "@/lib/db/queries/games";
import { validateGameInput } from "@/lib/validation/gameConfig.schema";
import { supabaseServer } from "@/lib/db/supabase";

export async function GET(request: NextRequest) {
  const subject = request.nextUrl.searchParams.get("subject") ?? undefined;
  const topicId = request.nextUrl.searchParams.get("topicId") ?? undefined;

  try {
    const games = await listGames({ subject, topicId });
    return NextResponse.json({ games });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * Admin-only in production (auth not wired up yet — see architecture doc's
 * open items). Creates a Game row plus its Mission rows from one payload,
 * validated against the matching engine's Zod schema before any write.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const validation = validateGameInput(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const input = validation.data;

  const { data: game, error: gameError } = await supabaseServer()
    .from("game")
    .insert({
      slug: input.slug,
      title: input.title,
      engine_type: input.engineType,
      subject: input.subject,
      topic_id: input.topicId,
      subtopic_id: input.subtopicId ?? null,
      shared_config: input.sharedConfig,
      snapshot: input.snapshot
    })
    .select("*")
    .single();

  if (gameError) {
    return NextResponse.json({ error: gameError.message }, { status: 500 });
  }

  const missionRows = input.missions.map((m) => ({
    game_id: game.id,
    mission_key: m.missionKey,
    title: m.title,
    difficulty: m.difficulty,
    sequence_index: m.sequenceIndex,
    xp_reward: m.xpReward,
    topic_id: m.topicId,
    subtopic_id: m.subtopicId ?? null,
    payload: m.payload
  }));

  const { error: missionsError } = await supabaseServer().from("mission").insert(missionRows);
  if (missionsError) {
    return NextResponse.json({ error: missionsError.message }, { status: 500 });
  }

  return NextResponse.json({ game }, { status: 201 });
}
