import { getGameById } from "@/lib/db/queries/games";
import { getMissionsForGame } from "@/lib/db/queries/games";
import { notFound } from "next/navigation";
import MissionsClient from "./MissionsClient";

export const dynamic = "force-dynamic";

export default async function MissionsPage({
  params,
}: {
  params: { id: string };
}) {
  const game = await getGameById(params.id);
  if (!game) notFound();

  const missions = await getMissionsForGame(params.id);
  return <MissionsClient game={game} initialMissions={missions} />;
}
