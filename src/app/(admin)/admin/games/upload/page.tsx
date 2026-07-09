import { listAllGames as listGames } from "@/lib/db/queries/games";
import UploadClient from "./UploadClient";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const games = await listGames();
  const existingGames = games.map(g => ({ id: g.id, slug: g.slug, title: g.title }));
  return <UploadClient existingGames={existingGames} />;
}