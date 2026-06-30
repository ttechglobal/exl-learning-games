import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateDeviceIdCookie } from "@/lib/identity/deviceId";
import { getOrCreateStudentByDeviceId, updateStudentProfile } from "@/lib/db/queries/students";

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
 * POST: set/update this device's editable profile fields — display
 * name, school, class. Originally just the write side of the one-time
 * onboarding name prompt; now doubles as the profile edit form's save
 * endpoint (see app/profile/ProfileClient.tsx) now that school/class
 * exist too. Requires the cookie to already exist (calls GET's same
 * resolution path first), since a profile update without an underlying
 * student to attach it to doesn't mean anything.
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

/**
 * displayName stays required (matches the original one-time name
 * prompt's contract — every existing call site already always sends
 * it). school/className are new, both optional and independently
 * nullable: omitting a key leaves that field untouched server-side,
 * sending an empty string clears it. max lengths are generous but
 * bounded (a school name or class label has no real reason to need
 * more than this) to keep the column from becoming a dumping ground.
 */
const UpdateProfileInputSchema = z.object({
  displayName: z.string().min(1).max(20),
  school: z.string().max(80).optional(),
  className: z.string().max(40).optional()
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = UpdateProfileInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const deviceId = await getOrCreateDeviceIdCookie();
    const student = await getOrCreateStudentByDeviceId(deviceId, parsed.data.displayName);
    // getOrCreateStudentByDeviceId only applies displayName at CREATE
    // time (see its doc comment) — if this device already had a student
    // row from an earlier visit, explicitly update the profile here so
    // a returning device editing its name/school/class actually takes
    // effect, not just silently no-op.
    const updated = await updateStudentProfile(student.id, {
      displayName: parsed.data.displayName,
      school: parsed.data.school,
      className: parsed.data.className
    });
    return NextResponse.json({ student: updated }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
