import { resolveCurrentStudent } from "@/lib/identity/deviceId";
import { listAttemptsForStudent } from "@/lib/db/queries/attempts";
import { listGames } from "@/lib/db/queries/games";
import { ProfileClient } from "@/app/profile/ProfileClient";
import type { GameRow } from "@/types/db";

// Needs a live DB connection + the request's own identity cookie; not statically prerenderable.
export const dynamic = "force-dynamic";

/**
 * app/profile/page.tsx
 *
 * NEW route — per direct decision ("should we have a profile for each
 * user, but the user does not need to create an account, just a user,
 * per device"). The actual link to this page (the 👤 avatar button)
 * already existed in SiteHeader.tsx, pointing at /profile — it was a
 * dead link until this page existed; confirmed by checking, not
 * assumed.
 *
 * Built entirely on infrastructure that already existed and already
 * worked correctly before this page did: resolveCurrentStudent() (the
 * reconnected device-identity system) for who this is,
 * listAttemptsForStudent() for what they've actually done.
 * `addXpToStudent` (called from lib/export/LocalDbAdapter.ts on every
 * completed attempt) is what made student.xp_total real and correct
 * the whole time — this page is the first place that total actually
 * gets shown back to the player as part of an identity, not just a
 * number in a header pill.
 *
 * No account, no password, no login form — resolveCurrentStudent()
 * either resolves this device's existing identity or this renders the
 * "we don't recognize this device yet" state below; there is no other
 * path into this page, by design, matching the same "one identity per
 * device, no login" shape already used for local high scores.
 */
export default async function ProfilePage() {
  const student = await resolveCurrentStudent();

  if (!student) {
    // Genuinely possible (not just a defensive placeholder): a request
    // can reach this page before IdentityBootstrap's client-side
    // round-trip to /api/identity has had a chance to mint the
    // eg_device_id cookie — see lib/identity/deviceId.ts's
    // resolveCurrentStudent() comment for why a Server Component can't
    // mint that cookie itself. Honest empty state, not a crash.
    return (
      <ProfileClient
        student={null}
        attemptsBySubject={{}}
        totalMissionsCompleted={0}
        games={[]}
      />
    );
  }

  const [attempts, games] = await Promise.all([listAttemptsForStudent(student.id), listGames()]);

  const successfulAttempts = attempts.filter((a) => a.success === true);
  const totalMissionsCompleted = successfulAttempts.length;

  const gameById = new Map(games.map((g) => [g.id, g]));
  const attemptsBySubject: Record<string, number> = {};
  for (const attempt of successfulAttempts) {
    const game = gameById.get(attempt.game_id);
    const subject = game?.subject ?? "other";
    attemptsBySubject[subject] = (attemptsBySubject[subject] ?? 0) + 1;
  }

  return (
    <ProfileClient
      student={student}
      attemptsBySubject={attemptsBySubject}
      totalMissionsCompleted={totalMissionsCompleted}
      games={games as GameRow[]}
    />
  );
}
