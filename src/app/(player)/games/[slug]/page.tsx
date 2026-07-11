/**
 * app/(player)/games/[slug]/page.tsx
 *
 * Route for standalone arcade games — games that are NOT tied to a DB
 * game row or curriculum missions. These live in src/games/{slug}/ and
 * are registered in src/games/index.ts.
 *
 * This is intentionally separate from /play/[gameSlug], which requires a
 * DB row, missions, a student identity, and a full pre-play shell.
 * Standalone games launch directly with no setup screens.
 *
 * Folder: src/app/(player)/games/[slug]/page.tsx
 */

import { notFound } from "next/navigation";
import { STANDALONE_GAMES } from "@/games/index";
import { ArcadeGameClient } from "./ArcadeGameClient";

export default function ArcadeGamePage({ params }: { params: { slug: string } }) {
  const game = STANDALONE_GAMES.find(g => g.slug === params.slug);

  if (!game || !game.isReady) {
    notFound();
  }

  return <ArcadeGameClient slug={params.slug} title={game.title} />;
}

// Generate static params for all ready games so they pre-render at build time
export function generateStaticParams() {
  return STANDALONE_GAMES
    .filter(g => g.isReady)
    .map(g => ({ slug: g.slug }));
}