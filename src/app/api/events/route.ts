import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { insertEvent } from "@/lib/db/queries/events";

const EPHEMERAL_FALLBACK = "00000000-0000-0000-0000-000000000000";

const EventInputSchema = z.object({
  name: z.enum([
    "mission_viewed",
    "mission_started",
    "mission_completed",
    "mission_abandoned",
    "hint_used",
  ]),
  studentId: z.string(),
  gameId: z.string(),
  missionId: z.string().optional(),
  topicId: z.string().optional(),
  subtopicId: z.string().optional(),
  detail: z.record(z.string(), z.unknown()).optional(),
  occurredAt: z.string(),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = EventInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  // Drop events from ephemeral/fallback student IDs silently.
  // These fire when IdentityBootstrap hasn't yet run (brand-new visitor
  // on their very first page load before the device-id cookie exists).
  // Writing them would fail on the student FK constraint anyway since
  // the ephemeral row doesn't exist — and they carry no useful signal
  // (no real student behind them). Silent 200 so the client doesn't
  // queue these for retry, which would fill up the offline queue with
  // events that will never succeed.
  if (
    parsed.data.studentId === EPHEMERAL_FALLBACK ||
    parsed.data.studentId === "new" ||
    !parsed.data.studentId
  ) {
    return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
  }

  // Also validate it's a real UUID before hitting the DB
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(parsed.data.studentId)) {
    return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
  }

  try {
    await insertEvent(parsed.data);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const msg = (error as Error).message;
    // FK violation means the student row doesn't exist yet — same
    // ephemeral case, drop silently
    if (msg.includes("violates foreign key") || msg.includes("23503")) {
      return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
