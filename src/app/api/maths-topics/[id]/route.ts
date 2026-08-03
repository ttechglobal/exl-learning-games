// FILE: src/app/api/maths-topics/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/db/supabase";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { concepts, ...rest } = body;

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (concepts !== undefined) update.concepts = concepts;
    // Allow patching other fields too
    for (const key of Object.keys(rest)) update[key] = rest[key];

    const { data, error } = await supabaseServer()
      .from("maths_topic")
      .update(update)
      .eq("id", params.id)
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}