import { listGames } from "@/lib/db/queries/games";
import { getWeeklyLeaderboard } from "@/lib/db/queries/leaderboard";
import { HomePage } from "@/app/HomePage";
import type { GameRow } from "@/types/db";

// Needs a live DB connection per-request; not meaningful to prerender at build time.
export const dynamic = "force-dynamic";

const FEATURED_SLUGS = ["atom-forge", "element-hunter"];

/**
 * The real front door — see HomePage.tsx for the design rationale. /worlds
 * remains the practical, no-frills subject-browse grid this page links
 * into via "Start Playing" / "Browse Subjects" / the World cards.
 *
 * leaderboard wired up to the real getWeeklyLeaderboard query — this part
 * is untouched by the later scope correction below and still renders
 * normally (it doesn't depend on per-device identity at all; it's a
 * cross-game ranking by whatever student_id attempts were recorded
 * under).
 *
 * currentStudentXp is intentionally NOT wired here anymore. An earlier
 * round called resolveCurrentStudent() (lib/identity/deviceId.ts) to fill
 * it in, but that function only READS an eg_device_id cookie — nothing
 * currently MINTS that cookie (IdentityBootstrap, the component that
 * used to call /api/identity to create it, was unmounted from
 * app/layout.tsx per a later scope correction: focus on local per-game
 * high scores, not server-side cross-device identity, for now). Calling
 * resolveCurrentStudent() here today would always silently resolve to
 * null — dead code that LOOKS like it does something. Left out
 * entirely rather than kept as a call that can never succeed; reconnect
 * it (the function itself still works) once IdentityBootstrap or an
 * equivalent is remounted as part of a real account/cross-device push.
 */
export default async function RootPage() {
  const games = await listGames();
  const leaderboard = await getWeeklyLeaderboard(10).catch(() => undefined); // honest empty state on failure, not a crashed homepage

  const gamesBySubject = games.reduce<Record<string, GameRow[]>>((acc, game) => {
    (acc[game.subject] ??= []).push(game);
    return acc;
  }, {});

  const featuredGames = FEATURED_SLUGS.map((slug) => games.find((g) => g.slug === slug)).filter(
    (g): g is GameRow => Boolean(g)
  );

  return <HomePage gamesBySubject={gamesBySubject} featuredGames={featuredGames} leaderboard={leaderboard} />;
}
