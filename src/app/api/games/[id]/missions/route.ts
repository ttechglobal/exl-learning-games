import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/db/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const {
    missionKey, title, difficulty, sequenceIndex,
    xpReward, topicId, subtopicId, learningGoal, estimatedMinutes, payload
  } = body;

  if (!missionKey || !title || !difficulty || !payload) {
    return NextResponse.json(
      { error: "missionKey, title, difficulty, payload required" },
      { status: 400 }
    );
  }

  const { data: mission, error } = await supabaseServer()
    .from("mission")
    .insert({
      game_id:           params.id,
      mission_key:       missionKey,
      title,
      difficulty,
      sequence_index:    sequenceIndex ?? 1,
      xp_reward:         xpReward ?? 20,
      topic_id:          topicId ?? "general",
      subtopic_id:       subtopicId ?? null,
      learning_goal:     learningGoal ?? null,
      estimated_minutes: estimatedMinutes ?? null,
      payload,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ mission }, { status: 201 });
}
