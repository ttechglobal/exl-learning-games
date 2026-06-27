import { getGameBySlug, getMissionsForGame } from "@/lib/db/queries/games";
import { fixedOrderPolicy } from "@/lib/difficulty/fixedOrderPolicy";
import { PlayClient } from "@/app/(player)/play/[gameSlug]/PlayClient";

/**
 * Server component: loads the game + picks the first mission via the active
 * difficulty policy, then hands off to a client component (PlayClient) which
 * owns the actual GameRuntime mounting + "next mission" advancement, since
 * that needs client-side state (which mission index we're on).
 *
 * NOTE: studentId is hardcoded here as a placeholder since auth isn't wired
 * up yet (architecture doc open items). Replace with real session lookup
 * once student auth exists.
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

  return (
    <PlayClient
      studentId={PLACEHOLDER_STUDENT_ID}
      game={game}
      missions={missions}
      initialMissionId={firstMission.id}
    />
  );
}
