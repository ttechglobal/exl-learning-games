import { getGameById, getMissionsForGame } from "@/lib/db/queries/games";

// Needs a live DB connection; not statically prerenderable.
export const dynamic = "force-dynamic";

/**
 * Raw JSON view/edit for now — per the architecture, a real form-based editor
 * is future scope. The important part already in place: any edit submitted
 * here would go through PUT /api/games/[id], which is schema-validated
 * before writing (lib/validation/gameConfig.schema.ts).
 */
export default async function AdminGameDetailPage({ params }: { params: { id: string } }) {
  const game = await getGameById(params.id);
  if (!game) {
    return <div style={{ padding: 40 }}>Game not found.</div>;
  }
  const missions = await getMissionsForGame(params.id);

  return (
    <div style={{ minHeight: "100vh", padding: "40px 24px", maxWidth: 920, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--eg-font-display)", fontSize: "1.6rem", marginBottom: 24 }}>{game.title}</h1>

      <h2 style={{ fontSize: "1rem", marginBottom: 8 }}>Game config</h2>
      <pre style={{ background: "var(--eg-glass)", padding: 16, borderRadius: 10, overflow: "auto", fontSize: "0.8rem" }}>
        {JSON.stringify(game, null, 2)}
      </pre>

      <h2 style={{ fontSize: "1rem", marginTop: 24, marginBottom: 8 }}>
        Missions ({missions.length})
      </h2>
      <pre style={{ background: "var(--eg-glass)", padding: 16, borderRadius: 10, overflow: "auto", fontSize: "0.8rem" }}>
        {JSON.stringify(missions, null, 2)}
      </pre>
    </div>
  );
}
