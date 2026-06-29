import { supabaseServer } from "@/lib/db/supabase";
import type { StudentRow } from "@/types/db";

/**
 * lib/db/queries/students.ts
 *
 * Did not exist before this — every call site in the app was passing
 * around a single hardcoded PLACEHOLDER_STUDENT_ID UUID, meaning every
 * visitor's attempts were written under the exact same fake student row.
 * The two real, server-backed leaderboard queries
 * (getWeeklyLeaderboard/getGameLeaderboard in lib/db/queries/
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

const DEFAULT_DISPLAY_NAME = "Anonymous";

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
 * `updateStudentDisplayName` (below) to actually change an existing
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
 * Updates an existing student's display name — the write side of the
 * one-time onboarding name prompt (see components/identity/
 * NamePrompt.tsx). Deliberately separate from
 * getOrCreateStudentByDeviceId's create-time displayName param: that one
 * only applies ONCE, at creation; this is how a name set later (or
 * changed) actually persists for an existing student.
 */
export async function updateStudentDisplayName(studentId: string, displayName: string): Promise<StudentRow> {
  const trimmed = displayName.trim().slice(0, 20);
  const finalName = trimmed.length > 0 ? trimmed : DEFAULT_DISPLAY_NAME;

  const { data, error } = await supabaseServer()
    .from("student")
    .update({ display_name: finalName })
    .eq("id", studentId)
    .select("*")
    .single();

  if (error) throw error;
  return data as StudentRow;
}

export async function getStudentById(studentId: string): Promise<StudentRow | null> {
  const { data, error } = await supabaseServer().from("student").select("*").eq("id", studentId).maybeSingle();

  if (error) throw error;
  return (data as StudentRow | null) ?? null;
}
