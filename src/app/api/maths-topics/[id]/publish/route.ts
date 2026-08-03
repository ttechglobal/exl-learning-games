// FILE: src/app/api/maths-topics/[id]/publish/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/db/supabase";

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { conceptIndex } = await request.json();

    // 1. Load the maths_topic row
    const { data: topic, error: topicErr } = await supabaseServer()
      .from("maths_topic")
      .select("*")
      .eq("id", params.id)
      .single();

    if (topicErr || !topic) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    const concepts = topic.concepts as Array<Record<string, unknown>>;

    // 2. Find or create the game row
    const gameSlug = (topic.game_slug as string | null)?.trim() ||
      slugify(`maths-${topic.name as string}`);

    const { data: existingGame } = await supabaseServer()
      .from("game")
      .select("id")
      .eq("slug", gameSlug)
      .maybeSingle();

    let gameId: string;

    if (existingGame) {
      gameId = existingGame.id;
    } else {
      const { data: newGame, error: gErr } = await supabaseServer()
        .from("game")
        .insert({
          slug:          gameSlug,
          title:         topic.name,
          engine_type:   "stepwise-equation-solver",
          subject:       "mathematics",
          topic_id:      (topic.topic_id as string) || slugify(topic.name as string),
          accent_colour: "#059669",
          shared_config: {
            subject:      "mathematics",
            topicName:    topic.name,
            level:        topic.level,
            coach:        "Ms. Chidera",
            accentColour: "#059669",
          },
        })
        .select("id")
        .single();

      if (gErr || !newGame) {
        return NextResponse.json(
          { error: gErr?.message ?? "Failed to create game" },
          { status: 500 }
        );
      }
      gameId = newGame.id;
    }

    // 3. Determine which concepts to publish
    const toPublish = conceptIndex !== undefined
      ? [{ concept: concepts[conceptIndex], index: conceptIndex as number }]
      : concepts.map((c, i) => ({ concept: c, index: i }));

    // 4. Delete existing missions for the concepts being republished
    if (conceptIndex !== undefined) {
      // Delete missions whose mission_key contains this concept index
      const prefixes = [`gl-${String(conceptIndex + 1).padStart(3, "0")}`, `pr-${String(conceptIndex + 1).padStart(3, "0")}`, `ch-${String(conceptIndex + 1).padStart(3, "0")}`, `ms-${String(conceptIndex + 1).padStart(3, "0")}`];
      for (const prefix of prefixes) {
        await supabaseServer()
          .from("mission")
          .delete()
          .eq("game_id", gameId)
          .like("mission_key", `${prefix}%`);
      }
    } else {
      // Full republish — delete all missions for this game
      await supabaseServer().from("mission").delete().eq("game_id", gameId);
    }

    // 5. Build missions array from the concept questions
    const allMissions: Array<Record<string, unknown>> = [];

    for (const { concept: c } of toPublish) {
      const guided    = (c.guidedQuestions    as Array<Record<string, unknown>>) ?? [];
      const practice  = (c.practiceQuestions  as Array<Record<string, unknown>>) ?? [];
      const challenge = (c.challengeQuestions as Array<Record<string, unknown>>) ?? [];
      const mastery   = (c.masteryQuestions   as Array<Record<string, unknown>>) ?? [];

      for (const m of [...guided, ...practice, ...challenge, ...mastery]) {
        if (!m.missionKey || !m.payload) continue;
        allMissions.push({
          game_id:        gameId,
          mission_key:    m.missionKey,
          title:          m.title ?? m.missionKey,
          difficulty:     m.difficulty ?? "EASY",
          sequence_index: m.sequenceIndex ?? 1,
          xp_reward:      m.xpReward ?? 10,
          topic_id:       m.topicId ?? (topic.topic_id as string) ?? slugify(topic.name as string),
          subtopic_id:    m.subtopicId ?? null,
          learning_goal:  m.learningGoal ?? null,
          payload:        m.payload,
        });
      }

      // 6. Mark concept as approved
      const idx = concepts.indexOf(c);
      if (idx >= 0) concepts[idx] = { ...c, status: "approved", publishedGameId: gameId };
    }

    // 7. Insert missions
    if (allMissions.length > 0) {
      const { error: mErr } = await supabaseServer().from("mission").insert(allMissions);
      if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
    }

    // 8. Update concept statuses
    await supabaseServer().from("maths_topic").update({ concepts }).eq("id", params.id);

    return NextResponse.json({
      published: [{
        topicName:    topic.name,
        gameId,
        gameSlug,
        missionCount: allMissions.length,
      }],
    });

  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}