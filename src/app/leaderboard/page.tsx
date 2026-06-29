import { getLeaderboard, getStudentRank, type LeaderboardPeriod } from "@/lib/db/queries/leaderboard";
import { resolveCurrentStudent } from "@/lib/identity/deviceId";
import { LeaderboardClient } from "@/app/leaderboard/LeaderboardClient";

// Needs a live DB connection + the request's own identity cookie; not statically prerenderable.
export const dynamic = "force-dynamic";

const FULL_LEADERBOARD_SIZE = 20;
const DEFAULT_PERIOD: LeaderboardPeriod = "weekly";

/**
 * app/leaderboard/page.tsx
 *
 * NEW route — the "See full leaderboard" destination from HomePage.tsx's
 * top-5 preview. Per direct decision: top 20 (not just the homepage's 5),
 * plus the viewing student's own rank even when they're outside that
 * top 20 — "where do I actually stand" matters just as much as "who's
 * winning" for a board that's meant to keep students coming back.
 *
 * Only the DEFAULT period's data is fetched server-side; switching tabs
 * (Weekly/Monthly/All-Time) re-fetches client-side via /api/leaderboard
 * — see LeaderboardClient.tsx. This keeps the initial page load to one
 * query pair (leaderboard + rank) instead of three, and means tab
 * switches don't need a full page navigation.
 */
export default async function LeaderboardPage() {
  const student = await resolveCurrentStudent();

  const [entries, myRank] = await Promise.all([
    getLeaderboard(DEFAULT_PERIOD, FULL_LEADERBOARD_SIZE).catch(() => []),
    student ? getStudentRank(student.id, DEFAULT_PERIOD).catch(() => null) : Promise.resolve(null)
  ]);

  return (
    <LeaderboardClient
      initialPeriod={DEFAULT_PERIOD}
      initialEntries={entries}
      initialMyRank={myRank}
      currentStudentId={student?.id}
      currentStudentXp={student?.xp_total}
    />
  );
}
