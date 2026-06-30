import { supabaseServer } from "@/lib/db/supabase";
import type { StudentRow } from "@/types/db";

/**
 * lib/db/queries/students.ts
 *
 * Did not exist before this — every call site in the app was passing
 * around a single hardcoded PLACEHOLDER_STUDENT_ID UUID, meaning every
 * visitor's attempts were written under the exact same fake student row.
 * The two real, server-backed leaderboard queries
 * (getLeaderboard in lib/db/queries/
 * leaderboard.ts) already work mechanically and are already globally
 * visible with no sign-in required — that part was never broken. What
 * was missing was distinct PLAYER IDENTITY: with everyone sharing one
 * student_id, there was no way for the leaderboard to actually show
 * different people.
 *
 * THE APPROACH — anonymous, cookie-based, no sign-in required:
 *   1. On first visit, the client gets a random UUID written to a
 *      long-lived cookie (`eg_device_id` — see
 *      lib/identity/deviceId.ts for where that cookie is set/read).
 *   2. That UUID is NOT itself the student_id. It's looked up against
 *      `student.external_id` (a column that already existed on
 *      StudentRow, unused everywhere until now — exactly the seam this
 *      was designed for). getOrCreateStudentByDeviceId resolves "this
 *      device's cookie value" -> "this device's real student.id",
 *      creating the row on first sight.
 *   3. Every subsequent attempt/progress write uses that REAL student.id
 *      — not the cookie value directly — so the DB foreign keys
 *      (attempt.student_id, topic_progress.student_id, etc.) stay exactly
 *      as they were designed, untouched by this change.
 *
 * Accepted tradeoff (explicitly confirmed, not a gap to fix later):
 * clearing cookies or switching browsers/devices starts a new anonymous
 * player with no way to recover/merge the old one. No nickname+recovery-
 * code system is being built for this round.
 */

export const DEFAULT_DISPLAY_NAME = "Anonymous";

/**
 * Resolves a device id (from the eg_device_id cookie) to a real,
 * persistent student row — creating one on first sight. Safe to call on
 * every page load; the lookup is a single indexed `eq` on a column that
 * should be unique per device (see the migration note below), so a
 * second call for the same device just returns the same row instead of
 * creating a duplicate.
 *
 * displayName is optional and only used at CREATE time — if the student
 * already exists, whatever display_name they already have is returned
 * untouched, even if a different name is passed in on this call. Use
 * `updateStudentProfile` (below) to actually change an existing
 * student's name later (e.g. via the one-time onboarding prompt).
 *
 * NOT ENFORCED AT THE DB LEVEL IN THIS CHECKOUT: ideally
 * `student.external_id` has a UNIQUE constraint so a race between two
 * near-simultaneous first-ever requests from the same brand-new device
 * (e.g. two tabs opened at once) can't create two rows for one cookie.
 * No supabase/migrations/*.sql exists in this checkout to add that
 * constraint — flagged here as a real follow-up, not silently assumed
 * fixed. Until that constraint exists, such a race is technically
 * possible (rare, and self-correcting in practice since most flows only
 * ever call this once per page load) — see docs/BUILD_LOG.md.
 */
export async function getOrCreateStudentByDeviceId(deviceId: string, displayName?: string): Promise<StudentRow> {
  const existing = await findStudentByDeviceId(deviceId);
  if (existing) return existing;

  const { data, error } = await supabaseServer()
    .from("student")
    .insert({
      external_id: deviceId,
      display_name: displayName?.trim().slice(0, 20) || DEFAULT_DISPLAY_NAME,
      xp_total: 0
    })
    .select("*")
    .single();

  if (error) {
    // If this failed because another request already created the row
    // for this exact device_id a moment ago (the race described above),
    // the right recovery is to just fetch and return that row rather
    // than surfacing an error for what is, from the caller's
    // perspective, a successful identity resolution either way.
    const recovered = await findStudentByDeviceId(deviceId);
    if (recovered) return recovered;
    throw error;
  }

  return data as StudentRow;
}

async function findStudentByDeviceId(deviceId: string): Promise<StudentRow | null> {
  const { data, error } = await supabaseServer().from("student").select("*").eq("external_id", deviceId).maybeSingle();

  if (error) throw error;
  return (data as StudentRow | null) ?? null;
}

/**
 * Updates an existing student's editable profile fields — display name,
 * school, and class — the write side of the profile edit form (see
 * app/profile/ProfileClient.tsx). All three are optional/independent:
 * passing only `school` leaves displayName and className untouched,
 * etc. (`undefined` means "don't touch this field," distinct from an
 * empty string or null, which both mean "clear it").
 *
 * Kept as the one place that writes to `student` outside of creation,
 * superseding the old single-purpose updateStudentDisplayName (which
 * this replaces) now that there's more than one editable field — see
 * api/identity/route.ts for the request shape that calls this.
 */
export async function updateStudentProfile(
  studentId: string,
  fields: { displayName?: string; school?: string | null; className?: string | null }
): Promise<StudentRow> {
  const update: Record<string, unknown> = {};

  if (fields.displayName !== undefined) {
    const trimmed = fields.displayName.trim().slice(0, 20);
    update.display_name = trimmed.length > 0 ? trimmed : DEFAULT_DISPLAY_NAME;
  }
  if (fields.school !== undefined) {
    const trimmed = fields.school?.trim().slice(0, 80) ?? null;
    update.school = trimmed && trimmed.length > 0 ? trimmed : null;
  }
  if (fields.className !== undefined) {
    const trimmed = fields.className?.trim().slice(0, 40) ?? null;
    update.class_name = trimmed && trimmed.length > 0 ? trimmed : null;
  }

  const { data, error } = await supabaseServer().from("student").update(update).eq("id", studentId).select("*").single();

  if (error) throw error;
  return data as StudentRow;
}

export async function getStudentById(studentId: string): Promise<StudentRow | null> {
  const { data, error } = await supabaseServer().from("student").select("*").eq("id", studentId).maybeSingle();

  if (error) throw error;
  return (data as StudentRow | null) ?? null;
}
