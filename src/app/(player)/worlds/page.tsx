/**
 * app/(player)/worlds/page.tsx
 *
 * Server component. Fetches games, missions, student identity,
 * and now also the student's most recently played game (for the
 * "Continue" shortcut in WorldsClient).
 *
 * lastPlayedGameSlug: derived from the most recent attempt row for
 * this student. Passed as a prop — WorldsClient uses it to render
 * the Continue bar if the game is still in bySubject.
 *
 * lastPlayedMissionNumber / lastPlayedMissionTotal: nice-to-have
 * context for the Continue bar ("Mission 3 of 5"). Both can be null
 * without breaking anything — the bar still renders without them.
 */

import { listGames, getMissionsForGames } from "@/lib/db/queries/games";
import { resolveCurrentStudent } from "@/lib/identity/deviceId";
import { listAttemptsForStudent } from "@/lib/db/queries/attempts";
import { WorldsClient, type GameSummary } from "@/app/(player)/worlds/WorldsClient";
import type { MissionRow, Difficulty } from "@/types/db";

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

  // ── Last-played game for the Continue shortcut ──
  // Fetch the most recent attempt for this student (limit 1).
  // Fail gracefully — the Continue bar simply won't render if this is null.
  let lastPlayedGameSlug: string | undefined;
  let lastPlayedMissionNumber: number | undefined;
  let lastPlayedMissionTotal: number | undefined;

  if (student?.id) {
    try {
      const recentAttempts = await listAttemptsForStudent(student.id);
      const mostRecent = recentAttempts[0]; // already ordered by completed_at desc

      if (mostRecent?.game_id) {
        const game = games.find((g) => g.id === mostRecent.game_id);
        if (game) {
          lastPlayedGameSlug = game.slug;

          // Work out which mission number they were on
          if (mostRecent.mission_id) {
            const gameMissions = missionsByGame[game.id] ?? [];
            // Missions are ordered by difficulty then by insertion order —
            // find the 1-indexed position of the last-played mission
            const missionIndex = gameMissions.findIndex((m) => m.id === mostRecent.mission_id);
            if (missionIndex >= 0) {
              lastPlayedMissionNumber = missionIndex + 1;
              lastPlayedMissionTotal = gameMissions.length;
            }
          }
        }
      }
    } catch {
      // Swallow — Continue bar is non-critical
    }
  }

  return (
    <WorldsClient
      bySubject={bySubject}
      currentStudentXp={student?.xp_total ?? 0}
      studentName={student?.display_name ?? undefined}
      lastPlayedGameSlug={lastPlayedGameSlug}
      lastPlayedMissionNumber={lastPlayedMissionNumber}
      lastPlayedMissionTotal={lastPlayedMissionTotal}
    />
  );
}