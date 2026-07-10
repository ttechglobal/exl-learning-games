import { listGames, getMissionsForGames } from "@/lib/db/queries/games";
import { resolveCurrentStudent } from "@/lib/identity/deviceId";
import { WorldsClient, type GameSummary } from "@/app/(player)/worlds/WorldsClient";
import type { MissionRow, Difficulty } from "@/types/db";

// Needs a live DB connection per-request; not meaningful to prerender at build time.
export const dynamic = "force-dynamic";

const DIFFICULTY_ORDER: Record<Difficulty, number> = { EASY: 0, MEDIUM: 1, HARD: 2 };

function summarizeMissions(missions: MissionRow[]): Omit<GameSummary, "game"> {
  const xpValues = missions.map((m) => m.xp_reward);
  const difficulties = missions.map((m) => m.difficulty);
  const minutesValues = missions.map((m) => m.estimated_minutes).filter((m): m is number => m != null);
  const sortedDifficulties = [...difficulties].sort((a, b) => DIFFICULTY_ORDER[a] - DIFFICULTY_ORDER[b]);
  return {
    missionCount: missions.length,
    xpMin: xpValues.length > 0 ? Math.min(...xpValues) : 0,
    xpMax: xpValues.length > 0 ? Math.max(...xpValues) : 0,
    difficultyMin: sortedDifficulties[0] ?? null,
    difficultyMax: sortedDifficulties[sortedDifficulties.length - 1] ?? null,
    totalEstimatedMinutes: minutesValues.length > 0 ? minutesValues.reduce((a, b) => a + b, 0) : null,
  };
}

export default async function WorldsPage() {
  const [games, student] = await Promise.all([
    listGames(),
    resolveCurrentStudent().catch(() => null),
  ]);

  const missionsByGame = await getMissionsForGames(games.map((g) => g.id));

  const summaries: GameSummary[] = games.map((game) => ({
    game,
    ...summarizeMissions(missionsByGame[game.id] ?? []),
  }));

  const bySubject = summaries.reduce<Record<string, GameSummary[]>>((acc, summary) => {
    (acc[summary.game.subject] ??= []).push(summary);
    return acc;
  }, {});

  return (
    <WorldsClient
      bySubject={bySubject}
      currentStudentXp={student?.xp_total ?? 0}
      studentName={student?.display_name ?? undefined}
    />
  );
}