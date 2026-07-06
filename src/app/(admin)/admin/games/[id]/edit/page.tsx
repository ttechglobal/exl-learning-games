import { getGameById } from "@/lib/db/queries/games";
import { notFound } from "next/navigation";
import EditGameClient from "./EditGameClient";

export const dynamic = "force-dynamic";

export default async function EditGamePage({ params }: { params: { id: string } }) {
  const game = await getGameById(params.id);
  if (!game) notFound();
  return <EditGameClient game={game} />;
}
