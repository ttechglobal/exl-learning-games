import { listGames } from "@/lib/db/queries/games";
import { getLeaderboard } from "@/lib/db/queries/leaderboard";
import { resolveCurrentStudent } from "@/lib/identity/deviceId";
import { HomePage } from "@/app/HomePage";
import type { GameRow } from "@/types/db";

// Needs a live DB connection per-request; not meaningful to prerender at build time.
export const dynamic = "force-dynamic";

const FEATURED_SLUGS = ["atom-forge", "element-hunter"];

/** Homepage shows the top 5 (1 champion + 4 more) — per direct decision,
 *  trimmed down from the previous top 10 now that a full /leaderboard
 *  page exists as the "see more" destination (top 20 + your rank). The
 *  homepage's job is a teaser, not the full board. */
const HOMEPAGE_LEADERBOARD_SIZE = 5;

/**
 * The real front door — see HomePage.tsx for the design rationale. /worlds
 * remains the practical, no-frills subject-browse grid this page links
 * into via "Start Playing" / "Browse Subjects" / the World cards.
 *
 * leaderboard wired up to the real getLeaderboard("weekly", ...) query —
 * a cross-game ranking by whatever student_id attempts were recorded
 * under, unaffected by the identity reconnection below either way. See
 * lib/db/queries/leaderboard.ts's header for why this is the ONE
 * competitive ranking surface in the app now (the old per-game
 * leaderboard is retired) and for the monthly/all-time variants surfaced
 * on /leaderboard, not here.
 *
 * currentStudentXp — RECONNECTED. Two rounds ago this was deliberately
 * removed (IdentityBootstrap was unmounted, so resolveCurrentStudent()
 * would always have resolved to null — dead code that looked like it
 * did something). Per direct decision, IdentityBootstrap is remounted
 * in app/layout.tsx again now, specifically so a real per-device XP
 * total can show here — `addXpToStudent` (lib/db/queries/progress.ts)
 * already existed and worked correctly; it only needed a real identity
 * to attach to.
 */
export default async function RootPage() {
  const games = await listGames();
  const [leaderboard, student] = await Promise.all([
    getLeaderboard("weekly", HOMEPAGE_LEADERBOARD_SIZE).catch(() => undefined), // honest empty state on failure, not a crashed homepage
    resolveCurrentStudent()
  ]);

  const gamesBySubject = games.reduce<Record<string, GameRow[]>>((acc, game) => {
    (acc[game.subject] ??= []).push(game);
    return acc;
  }, {});

  const featuredGames = FEATURED_SLUGS.map((slug) => games.find((g) => g.slug === slug)).filter(
    (g): g is GameRow => Boolean(g)
  );

  return (
    <HomePage
      gamesBySubject={gamesBySubject}
      featuredGames={featuredGames}
      leaderboard={leaderboard}
      currentStudentXp={student?.xp_total}
    />
  );
}
