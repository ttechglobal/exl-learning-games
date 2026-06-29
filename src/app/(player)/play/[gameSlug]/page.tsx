import { getGameBySlug, getMissionsForGame } from "@/lib/db/queries/games";
import { listCompletedMissionIdsForStudent } from "@/lib/db/queries/attempts";
import { fixedOrderPolicy } from "@/lib/difficulty/fixedOrderPolicy";
import { resolveCurrentStudent } from "@/lib/identity/deviceId";
import { PlayClient } from "@/app/(player)/play/[gameSlug]/PlayClient";

/**
 * Server component: loads the game + picks the first mission via the active
 * difficulty policy, then hands off to a client component (PlayClient) which
 * owns the actual GameRuntime mounting + "next mission" advancement, since
 * that needs client-side state (which mission index we're on).
 *
 * IDENTITY — RECONNECTED. Two rounds ago this used a hardcoded
 * PLACEHOLDER_STUDENT_ID, having paused the server-side device-identity
 * system in favor of local-only high scores. Reconnected now, per direct
 * decision, specifically to power a real per-device XP total/profile —
 * `addXpToStudent` (lib/db/queries/progress.ts) already existed and
 * already worked correctly; it only ever needed a real identity to
 * attach to, which is exactly what resolveCurrentStudent() provides.
 *
 * resolveCurrentStudent() reads the eg_device_id cookie (can't MINT one
 * here — this is a plain Server Component render, and Next.js only
 * allows cookies().set(...) from a Route Handler/Server Action; see
 * lib/identity/deviceId.ts). On the very first page a brand-new visitor
 * ever loads, that cookie won't exist yet (IdentityBootstrap's
 * client-side round-trip to /api/identity hasn't had a chance to run),
 * so this falls back to a per-request EPHEMERAL placeholder id rather
 * than crashing — that single render's attempt writes (if any happen
 * before the cookie exists, which is unlikely in practice since
 * reaching a play page at all implies at least one prior render of the
 * app shell) simply won't be attributable to a stable identity. Once
 * the cookie exists (effectively always, after the very first paint),
 * every subsequent load resolves the same real student every time.
 */
const EPHEMERAL_FALLBACK_STUDENT_ID = "00000000-0000-0000-0000-000000000000";

// Needs a live DB connection + per-request difficulty-policy evaluation; not statically prerenderable.
export const dynamic = "force-dynamic";

export default async function PlayPage({ params }: { params: { gameSlug: string } }) {
  const game = await getGameBySlug(params.gameSlug);

  if (!game) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "var(--eg-text-dim)" }}>
        Game not found: {params.gameSlug}
      </div>
    );
  }

  const student = await resolveCurrentStudent();
  const studentId = student?.id ?? EPHEMERAL_FALLBACK_STUDENT_ID;

  const missions = await getMissionsForGame(game.id);
  const firstMission = await fixedOrderPolicy.pickNextMission(studentId, missions);

  if (!firstMission) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "var(--eg-text-dim)" }}>
        This game has no missions configured yet.
      </div>
    );
  }

  // Only the "trackMap" progression mode needs completion data to decide
  // what's locked — every other mode ignores it, so skip the extra query
  // for games that don't need it (avoids an unnecessary DB round trip on
  // every single play-page load for the common case).
  const completedMissionIds =
    game.progression_mode === "trackMap" ? await listCompletedMissionIdsForStudent(studentId, game.id) : new Set<string>();

  return (
    <PlayClient
      studentId={studentId}
      game={game}
      missions={missions}
      initialMissionId={firstMission.id}
      completedMissionIds={completedMissionIds}
    />
  );
}
