import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/db/supabase";
import { GamePatchSchema } from "@/lib/validation/gameConfig.schema";

/** GET /api/games/[id] */
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabaseServer().from("game").select("*").eq("id", params.id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ game: data });
}

/**
 * PATCH /api/games/[id]
 *
 * Two modes:
 *   1. Metadata update — update game fields (title, theme, briefing etc.)
 *   2. Mission merge   — if body includes `missions[]`, adds them to the game
 *      without touching existing missions. Skips any missionKey that already
 *      exists (idempotent). Returns counts of added vs skipped.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const parsed = GamePatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { missions, ...metaFields } = parsed.data;

  // 1. Update game metadata if any meta fields supplied
  const ALLOWED_GAME_FIELDS = [
    "title", "is_active", "card_art_url", "card_description",
    "pre_game_gradient", "game_gradient", "accent_colour",
    "env_desktop_url", "env_mobile_url", "mission_briefing",
    "mission_objectives", "shared_config", "snapshot",
  ];

  const updates: Record<string, unknown> = {};
  for (const key of ALLOWED_GAME_FIELDS) {
    if (key in metaFields) updates[key] = (metaFields as Record<string, unknown>)[key];
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabaseServer().from("game").update(updates).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 2. Merge new missions if supplied
  let added = 0, skipped = 0;
  if (missions && missions.length > 0) {
    // Get existing mission keys for this game
    const { data: existing } = await supabaseServer()
      .from("mission").select("mission_key").eq("game_id", params.id);
    const existingKeys = new Set((existing ?? []).map((m: { mission_key: string }) => m.mission_key));

    // Get current max sequence_index
    const { data: seqData } = await supabaseServer()
      .from("mission").select("sequence_index")
      .eq("game_id", params.id)
      .order("sequence_index", { ascending: false })
      .limit(1);
    let nextSeq = ((seqData?.[0] as { sequence_index: number } | undefined)?.sequence_index ?? 0) + 1;

    const toInsert = [];
    for (const m of missions) {
      if (existingKeys.has(m.missionKey)) { skipped++; continue; }
      toInsert.push({
        game_id:           params.id,
        mission_key:       m.missionKey,
        title:             m.title,
        difficulty:        m.difficulty,
        sequence_index:    m.sequenceIndex ?? nextSeq++,
        xp_reward:         m.xpReward,
        topic_id:          m.topicId,
        subtopic_id:       m.subtopicId ?? null,
        learning_goal:     m.learningGoal ?? null,
        estimated_minutes: m.estimatedMinutes ?? null,
        payload:           m.payload,
      });
      added++;
    }

    if (toInsert.length > 0) {
      const { error } = await supabaseServer().from("mission").insert(toInsert);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, missionsAdded: added, missionsSkipped: skipped });
}
