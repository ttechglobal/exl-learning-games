import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { activeExportAdapter } from "@/lib/export";

/**
 * This is the data-contract enforcement point (architecture doc Section 5).
 * Whatever engine produced the attempt, by the time it reaches here it must
 * already be in AttemptResult shape — GameRuntime is responsible for that
 * normalization before calling this endpoint.
 */
const AttemptInputSchema = z
  .object({
    studentId: z.string(),
    gameId: z.string(),
    missionId: z.string().optional(),
    topicId: z.string(),
    subtopicId: z.string().optional(),
    success: z.boolean().optional(),
    score: z.number().min(0).max(1).optional(),
    timeSpentSec: z.number().int().nonnegative().optional(),
    attemptsBeforeSuccess: z.number().int().nonnegative().optional(),
    rawOutcome: z.record(z.string(), z.unknown()),
    completedAt: z.string()
  })
  .refine((data) => data.success !== undefined || data.score !== undefined, {
    message: "Either success or score must be present"
  });

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = AttemptInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    await activeExportAdapter.reportAttempt(parsed.data);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
