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
 * DELETE /api/games?slug=mirror-lab
 * Removes a game and its missions (cascade) by slug. Used by the seed
 * scripts' --fresh flag when re-seeding after a schema change.
 */
export async function DELETE(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug query param required" }, { status: 400 });
  }

  // Find the game first so we can return a 404 if it doesn't exist
  const { data: existing } = await supabaseServer()
    .from("game")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Delete missions first (foreign key), then the game row
  await supabaseServer().from("mission").delete().eq("game_id", existing.id);
  const { error } = await supabaseServer().from("game").delete().eq("id", existing.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: slug });
}
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
      progression_mode: input.progressionMode ?? null,
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
