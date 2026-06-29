import { getGameBySlug, getMissionsForGame } from "@/lib/db/queries/games";
import { listCompletedMissionIdsForStudent } from "@/lib/db/queries/attempts";
import { fixedOrderPolicy } from "@/lib/difficulty/fixedOrderPolicy";
import { PlayClient } from "@/app/(player)/play/[gameSlug]/PlayClient";

/**
 * Server component: loads the game + picks the first mission via the active
 * difficulty policy, then hands off to a client component (PlayClient) which
 * owns the actual GameRuntime mounting + "next mission" advancement, since
 * that needs client-side state (which mission index we're on).
 *
 * NOTE: studentId is hardcoded here as a placeholder since auth isn't wired
 * up yet. A real server-side anonymous-identity system (cookie-based,
 * get-or-create student row) WAS built — see lib/identity/deviceId.ts and
 * lib/db/queries/students.ts, both still present and tested — but per a
 * later, explicit scope correction, that work is PAUSED, not wired into the
 * active UI right now. The actual near-term need is local, per-device,
 * per-game high scores (lib/content/localHighScores.ts +
 * lib/content/localPlayerName.ts), not server-side cross-device identity.
 * Reconnect resolveCurrentStudent() here (it still works) if/when a real
 * account or cross-device system is actually being built.
 */
const PLACEHOLDER_STUDENT_ID = "00000000-0000-0000-0000-000000000000";

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

  const missions = await getMissionsForGame(game.id);
  const firstMission = await fixedOrderPolicy.pickNextMission(PLACEHOLDER_STUDENT_ID, missions);

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
    game.progression_mode === "trackMap"
      ? await listCompletedMissionIdsForStudent(PLACEHOLDER_STUDENT_ID, game.id)
      : new Set<string>();

  return (
    <PlayClient
      studentId={PLACEHOLDER_STUDENT_ID}
      game={game}
      missions={missions}
      initialMissionId={firstMission.id}
      completedMissionIds={completedMissionIds}
    />
  );
}
