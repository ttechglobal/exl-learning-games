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

export async function DELETE(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug query param required" }, { status: 400 });

  const { data: existing } = await supabaseServer().from("game").select("id").eq("slug", slug).single();
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await supabaseServer().from("mission").delete().eq("game_id", existing.id);
  const { error } = await supabaseServer().from("game").delete().eq("id", existing.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: slug });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const validation = validateGameInput(body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
  const input = validation.data;

  // Check for duplicate slug
  const { data: existing } = await supabaseServer().from("game").select("id").eq("slug", input.slug).maybeSingle();
  if (existing) return NextResponse.json({ error: `A game with slug "${input.slug}" already exists. Use PATCH to update it.` }, { status: 409 });

  const { data: game, error: gameError } = await supabaseServer()
    .from("game")
    .insert({
      slug:                input.slug,
      title:               input.title,
      engine_type:         input.engineType,
      subject:             input.subject,
      topic_id:            input.topicId,
      subtopic_id:         input.subtopicId ?? null,
      progression_mode:    input.progressionMode ?? null,
      shared_config:       input.sharedConfig ?? {},
      snapshot:            input.snapshot ?? { cards: [] },
      // Theme + content fields
      card_art_url:        input.card_art_url ?? null,
      card_description:    input.card_description ?? null,
      pre_game_gradient:   input.pre_game_gradient ?? null,
      game_gradient:       input.game_gradient ?? null,
      accent_colour:       input.accent_colour ?? null,
      env_desktop_url:     input.env_desktop_url ?? null,
      env_mobile_url:      input.env_mobile_url ?? null,
      mission_briefing:    input.mission_briefing ?? null,
      mission_objectives:  input.mission_objectives ?? null,
    })
    .select("*")
    .single();

  if (gameError) return NextResponse.json({ error: gameError.message }, { status: 500 });

  if (input.missions.length > 0) {
    const rows = input.missions.map((m, idx) => ({
      game_id:         game.id,
      mission_key:     m.missionKey,
      title:           m.title,
      difficulty:      m.difficulty,
      sequence_index:  m.sequenceIndex ?? idx + 1,
      xp_reward:       m.xpReward,
      topic_id:        m.topicId,
      subtopic_id:     m.subtopicId ?? null,
      learning_goal:   m.learningGoal ?? null,
      estimated_minutes: m.estimatedMinutes ?? null,
      payload:         m.payload,
    }));

    const { error: missionsError } = await supabaseServer().from("mission").insert(rows);
    if (missionsError) return NextResponse.json({ error: missionsError.message }, { status: 500 });
  }

  return NextResponse.json({ game }, { status: 201 });
}
