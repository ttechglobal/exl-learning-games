import { listGames } from "@/lib/db/queries/games";

// Needs a live DB connection per-request; not meaningful to prerender at build time.
export const dynamic = "force-dynamic";

/**
 * Minimal admin listing — intentionally bare. Per the architecture doc, the
 * admin module's job is content authoring, not analytics/dashboards (that's
 * the main platform's job). No auth gate yet either — see open items.
 */
export default async function AdminGamesPage() {
  const games = await listGames();

  return (
    <div style={{ minHeight: "100vh", padding: "40px 24px", maxWidth: 920, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--eg-font-display)", fontSize: "1.6rem", marginBottom: 24 }}>Games</h1>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--eg-glass-border)" }}>
            <th style={{ padding: 8 }}>Title</th>
            <th style={{ padding: 8 }}>Subject</th>
            <th style={{ padding: 8 }}>Engine</th>
            <th style={{ padding: 8 }}>Active</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game) => (
            <tr key={game.id} style={{ borderBottom: "1px solid var(--eg-glass-border)" }}>
              <td style={{ padding: 8 }}>
                <a href={`/admin/games/${game.id}`} style={{ color: "var(--eg-subject-chemistry)" }}>
                  {game.title}
                </a>
              </td>
              <td style={{ padding: 8 }}>{game.subject}</td>
              <td style={{ padding: 8 }}>{game.engine_type}</td>
              <td style={{ padding: 8 }}>{game.is_active ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
