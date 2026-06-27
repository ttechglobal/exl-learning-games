import { listGames, getMissionsForGames } from "@/lib/db/queries/games";
import { WorldsClient, type GameSummary } from "@/app/(player)/worlds/WorldsClient";
import type { MissionRow } from "@/types/db";

// Needs a live DB connection per-request; not meaningful to prerender at build time.
export const dynamic = "force-dynamic";

const DIFFICULTY_ORDER = { EASY: 0, MEDIUM: 1, HARD: 2 } as const;

/**
 * Difficulty/XP/estimated-time all live on MissionRow, not GameRow — a
 * "game" (e.g. Atom Forge) is really a set of missions (Level 1..4), each
 * with its own difficulty and reward. So "per-game metadata" on the
 * catalog page means an aggregate across that game's missions, not a
 * single flat number that doesn't actually exist at the game level.
 *
 * - missionCount: how many active missions this game has
 * - xpRange: min..max XP reward across its missions (often equal, when
 *   every mission pays the same XP — shown as a single number in that case)
 * - difficultyRange: the lowest..highest difficulty among its missions,
 *   using mission order rather than alphabetical (EASY < MEDIUM < HARD)
 * - totalEstimatedMinutes: sum of estimated_minutes across missions, or
 *   null if NONE of them have it set yet (most games predate that column
 *   — see MissionRow.estimated_minutes migration caveat). Partial data
 *   (some missions have it, some don't) still sums what's there rather
 *   than discarding the whole estimate, since an undercount is more
 *   honest than hiding a real number because of one missing field.
 */
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
    totalEstimatedMinutes: minutesValues.length > 0 ? minutesValues.reduce((a, b) => a + b, 0) : null
  };
}

export default async function WorldsPage() {
  const games = await listGames();
  const missionsByGame = await getMissionsForGames(games.map((g) => g.id));

  const summaries: GameSummary[] = games.map((game) => ({
    game,
    ...summarizeMissions(missionsByGame[game.id] ?? [])
  }));

  const bySubject = summaries.reduce<Record<string, GameSummary[]>>((acc, summary) => {
    (acc[summary.game.subject] ??= []).push(summary);
    return acc;
  }, {});

  return <WorldsClient bySubject={bySubject} />;
}