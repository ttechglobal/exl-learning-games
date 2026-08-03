// FILE: src/app/api/maths-topics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/db/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, level, game_slug, topic_id, curricula, concepts, misconceptions, mergedObjectives } = body;

    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const { data, error } = await supabaseServer()
      .from("maths_topic")
      .insert({
        name,
        level:            level ?? "",
        game_slug:        game_slug ?? "",
        topic_id:         topic_id ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        curricula:        curricula ?? [],
        concepts:         concepts ?? [],
        misconceptions:   misconceptions ?? [],
        merged_objectives: mergedObjectives ?? {},
      })
      .select("id, name")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ topic: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}