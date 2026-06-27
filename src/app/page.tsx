import { listGames } from "@/lib/db/queries/games";
import { HomePage } from "@/app/HomePage";
import type { GameRow } from "@/types/db";

// Needs a live DB connection per-request; not meaningful to prerender at build time.
export const dynamic = "force-dynamic";

const FEATURED_SLUGS = ["atom-forge", "element-hunter"];

/**
 * The real front door — see HomePage.tsx for the design rationale. /worlds
 * remains the practical, no-frills subject-browse grid this page links
 * into via "Start Playing" / "Browse Subjects" / the World cards.
 */
export default async function RootPage() {
  const games = await listGames();

  const gamesBySubject = games.reduce<Record<string, GameRow[]>>((acc, game) => {
    (acc[game.subject] ??= []).push(game);
    return acc;
  }, {});

  const featuredGames = FEATURED_SLUGS.map((slug) => games.find((g) => g.slug === slug)).filter(
    (g): g is GameRow => Boolean(g)
  );

  return <HomePage gamesBySubject={gamesBySubject} featuredGames={featuredGames} />;
}
