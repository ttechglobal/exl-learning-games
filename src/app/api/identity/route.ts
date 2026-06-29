import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateDeviceIdCookie } from "@/lib/identity/deviceId";
import { getOrCreateStudentByDeviceId, updateStudentDisplayName } from "@/lib/db/queries/students";

/**
 * app/api/identity/route.ts
 *
 * The Route Handler half of the anonymous-identity system — see
 * lib/identity/deviceId.ts's header comment for why this can't just
 * happen inside a Server Component render. Two jobs:
 *
 * GET: mint the device-id cookie if this is a first-ever visit (no-op,
 * just returns the existing one, if already present), resolve/create
 * the matching student row, and return it. The client calls this once,
 * early (see components/identity/IdentityBootstrap.tsx), specifically
 * so a brand-new visitor's cookie+student row exist BEFORE they reach
 * any point that needs studentId (starting a mission, submitting a
 * score) — not lazily on first attempt, which would mean their very
 * first play session has nothing real to attach to.
 *
 * POST: set/update this device's display name — the write side of the
 * one-time onboarding name prompt. Requires the cookie to already exist
 * (calls GET's same resolution path first), since a name update without
 * an underlying student to attach it to doesn't mean anything.
 */
export async function GET() {
  try {
    const deviceId = await getOrCreateDeviceIdCookie();
    const student = await getOrCreateStudentByDeviceId(deviceId);
    return NextResponse.json({ student }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

const SetNameInputSchema = z.object({
  displayName: z.string().min(1).max(20)
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = SetNameInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const deviceId = await getOrCreateDeviceIdCookie();
    const student = await getOrCreateStudentByDeviceId(deviceId, parsed.data.displayName);
    // getOrCreateStudentByDeviceId only applies displayName at CREATE
    // time (see its doc comment) — if this device already had a student
    // row from an earlier visit, explicitly update the name here so a
    // returning device setting its name for the first time (or changing
    // it) actually takes effect, not just silently no-op.
    const updated = await updateStudentDisplayName(student.id, parsed.data.displayName);
    return NextResponse.json({ student: updated }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
