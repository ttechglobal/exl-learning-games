import { listAllGames as listGames } from "@/lib/db/queries/games";
import UploadClient from "../../upload/UploadClient";

export const dynamic = "force-dynamic";

/**
 * /admin/games/upload  ← top-level upload route
 *
 * Reuses the same UploadClient as the per-game upload page.
 * This is the route linked from the nav and the Games header button.
 */
export default async function UploadPage() {
  const games = await listGames();
  const existingGames = games.map(g => ({ id: g.id, slug: g.slug, title: g.title }));
  return <UploadClient existingGames={existingGames} />;
}