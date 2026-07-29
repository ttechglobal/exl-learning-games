// FILE: src/app/api/content-topics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/db/supabase";

export async function GET() {
  try {
    const { data, error } = await supabaseServer()
      .from("content_topic")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ topics: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subject, name, level, curricula, concepts, misconceptions, mergedObjectives } = body;

    if (!subject || !name) {
      return NextResponse.json({ error: "subject and name are required" }, { status: 400 });
    }

    const { data, error } = await supabaseServer()
      .from("content_topic")
      .insert({
        subject,
        name,
        level: level ?? null,
        curricula: curricula ?? [],
        concepts: concepts ?? [],
        misconceptions: misconceptions ?? [],
        merged_objectives: mergedObjectives ?? {},
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ topic: data });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}