// FILE: src/app/api/content-topics/[id]/publish/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/db/supabase";

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { conceptIndex } = await request.json();

    const { data: topic, error: topicErr } = await supabaseServer()
      .from("content_topic").select("*").eq("id", params.id).single();

    if (topicErr || !topic) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

    const concepts = topic.concepts as Array<Record<string, unknown>>;

    // One game per TOPIC (not per concept)
    const topicSlug = `${slugify(topic.subject)}-${slugify(topic.name)}`;
    const coachName = topic.subject === "physics" ? "Emeka"
      : topic.subject === "mathematics" ? "Ms. Chidera" : "Adaobi";

    // Check if game already exists
    const { data: existingGame } = await supabaseServer()
      .from("game").select("id").eq("slug", topicSlug).maybeSingle();

    let gameId: string;

    if (existingGame) {
      gameId = existingGame.id;
      // If publishing a specific concept, only delete that concept's missions
      // If publishing all, delete all missions and rebuild
      if (conceptIndex === undefined) {
        await supabaseServer().from("mission").delete().eq("game_id", gameId);
      }
    } else {
      const { data: game, error: gErr } = await supabaseServer().from("game").insert({
        slug: topicSlug,
        title: topic.name,
        engine_type: "guided_lesson",
        subject: topic.subject,
        topic_id: slugify(topic.name),
        accent_colour: topic.subject === "physics" ? "#7c3aed"
          : topic.subject === "mathematics" ? "#059669" : "#0284c7",
        shared_config: {
          subject: topic.subject,
          topicName: topic.name,
          level: topic.level,
          coach: coachName,
          accentColour: topic.subject === "physics" ? "#7c3aed"
            : topic.subject === "mathematics" ? "#059669" : "#0284c7",
        },
      }).select("id").single();

      if (gErr || !game) return NextResponse.json({ error: gErr?.message ?? "Failed to create game" }, { status: 500 });
      gameId = game.id;
    }

    // Determine which concepts to publish
    const toPublish = conceptIndex !== undefined
      ? [{ concept: concepts[conceptIndex], index: conceptIndex as number }]
      : concepts.map((c, i) => ({ concept: c, index: i }));

    // Delete missions for the concepts being republished
    if (conceptIndex !== undefined) {
      // Delete only this concept's missions by mission_key prefix
      const prefix = `${conceptIndex}-${topicSlug}`;
      await supabaseServer().from("mission").delete()
        .eq("game_id", gameId)
        .like("mission_key", `%-${prefix}%`);
    }

    const allMissions: Array<Record<string, unknown>> = [];

    for (const { concept: c, index } of toPublish) {
      const conceptName = c.name as string;
      const gl  = c.guidedLearningMission as Record<string, unknown> | undefined;
      const ref = c.interactionRef as Record<string, unknown> | null | undefined;

      // Sequence: GL first, then practice, then challenge
      // Use index * 100 to leave room for ordering within concept
      const baseSeq = index * 100;

      // 1. Guided Learning mission
      if (gl) {
        const coachCards = (gl.coachBriefing as string[] ?? []).map((text: string, i: number) => ({
          type: "COACH", text, cardIndex: i,
        }));
        const interactStep = ref?.component && ref?.componentExists !== false
          ? [{ type: "INTERACT", component: ref.component, config: ref.config ?? {} }] : [];
        const coachLines = (gl.coachLines as Record<string, string>) ?? {};
        const keyMoment = coachLines.atKeyMoment ? [{ type: "COACH", text: coachLines.atKeyMoment, isKeyMoment: true }] : [];
        const success = coachLines.onSuccess ? [{ type: "SUCCESS", text: coachLines.onSuccess, objectives: gl.objectives ?? [] }] : [];

        allMissions.push({
          game_id: gameId,
          mission_key: `gl-${index}-${topicSlug}`,
          title: (gl.missionName as string) || conceptName,
          difficulty: "EASY",
          sequence_index: baseSeq + 1,
          xp_reward: 0,
          topic_id: slugify(topic.name),
          learning_goal: conceptName,
          payload: {
            type: "guided_lesson",
            conceptName,
            lessonFlow: [...coachCards, ...interactStep, ...keyMoment, ...success],
            objectives: gl.objectives ?? [],
          },
        });
      }

      // 2. Practice questions — individual missions
      const pqs = (c.practiceQuestions as Array<Record<string, unknown>> ?? []).filter((q: Record<string, unknown>) => q.question);
      pqs.forEach((q: Record<string, unknown>, qi: number) => {
        // Build per-answer explanation map (keyed by answer text)
        const answerExplanations: Record<string, string> = {};
        if (q.correctExplanation && q.correctAnswer) {
          answerExplanations[q.correctAnswer as string] = q.correctExplanation as string;
        }
        if (q.wrongAnswer1Explanation && q.wrongAnswer1) {
          answerExplanations[q.wrongAnswer1 as string] = q.wrongAnswer1Explanation as string;
        }
        if (q.wrongAnswer2Explanation && q.wrongAnswer2) {
          answerExplanations[q.wrongAnswer2 as string] = q.wrongAnswer2Explanation as string;
        }
        allMissions.push({
          game_id: gameId,
          mission_key: `pq-${index}-${qi}-${topicSlug}`,
          title: `${conceptName} — Practice ${qi + 1}`,
          difficulty: "MEDIUM",
          sequence_index: baseSeq + 10 + qi,
          xp_reward: 10,
          topic_id: slugify(topic.name),
          learning_goal: conceptName,
          payload: {
            type: "mcq",
            conceptName,
            question: q.question,
            correctAnswer: q.correctAnswer,
            correctExplanation: q.correctExplanation ?? null,
            wrongAnswers: [q.wrongAnswer1, q.wrongAnswer2].filter(Boolean),
            answerExplanations: Object.keys(answerExplanations).length > 0 ? answerExplanations : undefined,
            coachHint: q.coachHint,
            objective: q.objective,
          },
        });
      });

      // 3. Challenge questions
      const cqs = (c.challengeQuestions as Array<Record<string, unknown>> ?? []).filter((q: Record<string, unknown>) => q.question);
      cqs.forEach((q: Record<string, unknown>, qi: number) => {
        // Build per-answer explanation map for challenge questions
        const cAnswerExplanations: Record<string, string> = {};
        if (q.correctExplanation && q.correctAnswer) {
          cAnswerExplanations[q.correctAnswer as string] = q.correctExplanation as string;
        }
        const wrongAnswers = (q.wrongAnswers as string[] ?? []);
        const wrongExps    = (q.wrongAnswerExplanations as string[] ?? []);
        wrongAnswers.forEach((wa: string, wi: number) => {
          if (wa && wrongExps[wi]) cAnswerExplanations[wa] = wrongExps[wi];
        });
        allMissions.push({
          game_id: gameId,
          mission_key: `cq-${index}-${qi}-${topicSlug}`,
          title: `${conceptName} — Challenge ${qi + 1}`,
          difficulty: "HARD",
          sequence_index: baseSeq + 20 + qi,
          xp_reward: 30,
          topic_id: slugify(topic.name),
          learning_goal: conceptName,
          payload: {
            type: "mcq",
            conceptName,
            question: q.question,
            correctAnswer: q.correctAnswer,
            correctExplanation: q.correctExplanation ?? q.reasoningPath ?? null,
            wrongAnswers,
            answerExplanations: Object.keys(cAnswerExplanations).length > 0 ? cAnswerExplanations : undefined,
            reasoningPath: q.reasoningPath,
            objective: q.objective,
          },
        });
      });

      // Mark concept as approved
      concepts[index] = { ...c, status: "approved", publishedGameId: gameId };
    }

    // Insert all missions
    if (allMissions.length > 0) {
      const { error: mErr } = await supabaseServer().from("mission").insert(allMissions);
      if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
    }

    // Update concept statuses
    await supabaseServer().from("content_topic").update({ concepts }).eq("id", params.id);

    return NextResponse.json({
      published: [{
        topicName: topic.name,
        gameId,
        gameSlug: topicSlug,
        missionCount: allMissions.length,
      }],
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}