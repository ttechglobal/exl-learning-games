import { getLeaderboard, getStudentRank, type LeaderboardPeriod } from "@/lib/db/queries/leaderboard";
import { resolveCurrentStudent } from "@/lib/identity/deviceId";
import { LeaderboardClient } from "@/app/leaderboard/LeaderboardClient";

// force-dynamic is needed because resolveCurrentStudent reads a cookie.
// The DB query is still fast — this just prevents full static export.
export const dynamic = "force-dynamic";

const FULL_LEADERBOARD_SIZE = 20;
const DEFAULT_PERIOD: LeaderboardPeriod = "weekly";

export default async function LeaderboardPage() {
  // Resolve student identity first — if no cookie, null student means
  // we skip the rank query entirely (saves one DB round-trip on first visit).
  const student = await resolveCurrentStudent();

  // Run both queries in parallel when we have a student, otherwise
  // only fetch the leaderboard list.
  const [entries, myRank] = await Promise.all([
    getLeaderboard(DEFAULT_PERIOD, FULL_LEADERBOARD_SIZE).catch(() => []),
    student
      ? getStudentRank(student.id, DEFAULT_PERIOD).catch(() => null)
      : Promise.resolve(null),
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