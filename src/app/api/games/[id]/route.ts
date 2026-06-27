import { NextRequest, NextResponse } from "next/server";
import { getGameById, getMissionsForGame } from "@/lib/db/queries/games";
import { supabaseServer } from "@/lib/db/supabase";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const game = await getGameById(params.id);
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    const missions = await getMissionsForGame(params.id);
    return NextResponse.json({ game, missions });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/** Admin-only. Partial update of a Game's top-level fields (not its missions — that's separate). */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();

  const updatable: Record<string, unknown> = {};
  if (body.title) updatable.title = body.title;
  if (body.sharedConfig) updatable.shared_config = body.sharedConfig;
  if (body.snapshot) updatable.snapshot = body.snapshot;
  if (typeof body.isActive === "boolean") updatable.is_active = body.isActive;

  const { data, error } = await supabaseServer().from("game").update(updatable).eq("id", params.id).select("*").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ game: data });
}
