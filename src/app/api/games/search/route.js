import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/db/supabase";
import type { GameRow } from "@/types/db";

/**
 * GET /api/games/search
 *
 * Searches games by title, topic, subject, description.
 * Also supports filtering by year_group, exam_board, subject, term.
 *
 * Query params:
 *   q           — search term (full-text)
 *   subject     — filter by subject
 *   year_group  — filter by year group (array match)
 *   exam_board  — filter by exam board (array match)
 *   term        — filter by curriculum term
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q          = searchParams.get("q")?.trim() ?? "";
  const subject    = searchParams.get("subject") ?? "";
  const yearGroup  = searchParams.get("year_group") ?? "";
  const examBoard  = searchParams.get("exam_board") ?? "";
  const term       = searchParams.get("term") ?? "";

  let query = supabaseServer()
    .from("game")
    .select("id, slug, title, subject, topic_id, card_description, card_art_url, accent_colour, year_groups, exam_boards, curriculum_term, engine_type, is_active")
    .eq("is_active", true);

  // Full-text search using the pre-computed tsvector
  if (q.length > 0) {
    query = query.textSearch("search_vector", q, { type: "websearch" });
  }

  if (subject)   query = query.eq("subject", subject);
  if (term)      query = query.eq("curriculum_term", term);
  if (yearGroup) query = query.contains("year_groups", [yearGroup]);
  if (examBoard) query = query.contains("exam_boards", [examBoard]);

  const { data, error } = await query.order("title").limit(40);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ games: data ?? [], query: q });
}