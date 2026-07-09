import { getGameById } from "@/lib/db/queries/games";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * /admin/games/[id]
 *
 * Guard: if id is "new", redirect to /admin/games/new.
 * Next.js prefers static routes over dynamic ones, but only when the
 * static route folder exists. During development before the /new folder
 * is created, [id] catches "new" and getGameById("new") crashes with
 * Postgres error 22P02 (invalid uuid syntax). This guard makes it safe.
 */
export default async function AdminGameDetailPage({
  params,
}: {
  params: { id: string };
}) {
  if (params.id === "new") redirect("/admin/games/new");

  // Validate it looks like a UUID before hitting the DB
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(params.id)) notFound();

  const game = await getGameById(params.id);
  if (!game) notFound();

  // Redirect to edit page — the [id] root is just a detail view,
  // no UI lives directly here anymore
  redirect(`/admin/games/${params.id}/edit`);
}
