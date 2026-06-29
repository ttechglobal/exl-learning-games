import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { insertEvent } from "@/lib/db/queries/events";

/**
 * POST /api/events
 *
 * Same data-contract-enforcement role api/attempts/route.ts plays for
 * AttemptResult, just for the lighter AnalyticsEvent shape (see
 * types/event.ts). Called directly by lib/analytics/track.ts (fast
 * path) and by lib/offline/eventQueue.ts's flushPendingEvents (retry
 * path after a queued failure) — same dual-path shape /api/attempts
 * already has via GameRuntime.tsx + attemptQueue.ts.
 */
const EventInputSchema = z.object({
  name: z.enum(["mission_viewed", "mission_started", "mission_completed", "mission_abandoned", "hint_used"]),
  studentId: z.string(),
  gameId: z.string(),
  missionId: z.string().optional(),
  topicId: z.string().optional(),
  subtopicId: z.string().optional(),
  detail: z.record(z.string(), z.unknown()).optional(),
  occurredAt: z.string()
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = EventInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    await insertEvent(parsed.data);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
