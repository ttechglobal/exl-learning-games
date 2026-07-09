import { getGameById } from "@/lib/db/queries/games";
import { notFound } from "next/navigation";
import Link from "next/link";
import { EngineSpecClient } from "./EngineSpecClient";

export const dynamic = "force-dynamic";

export default async function EngineSpecPage({ params }: { params: { id: string } }) {
  const game = await getGameById(params.id);
  if (!game) notFound();

  return (
    <EngineSpecClient
      game={{
        id:              game.id,
        title:           game.title,
        slug:            game.slug,
        engineType:      game.engine_type,
        enginePending:   game.engine_pending ?? false,
        engineSpec:      game.engine_spec ?? null,
        subject:         game.subject,
        topicId:         game.topic_id,
        sharedConfig:    game.shared_config,
      }}
    />
  );
}