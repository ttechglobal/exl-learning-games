import { getPlatformSummary, getGameStats, getTopicStats, getDailyActivity } from "@/lib/db/queries/analytics";

export const dynamic = "force-dynamic";

const card = (style?: React.CSSProperties): React.CSSProperties => ({
  background: "#131a26",
  border: "1px solid #1e2a3a",
  borderRadius: 12,
  padding: "20px 24px",
  ...style
});

const label: React.CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#64748b",
  marginBottom: 6
};

const bigNumber: React.CSSProperties = {
  fontSize: "2rem",
  fontWeight: 800,
  color: "#f1f5f9",
  lineHeight: 1
};

const subText: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "#64748b",
  marginTop: 4
};

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function bar(ratio: number, color = "#3b82f6") {
  return (
    <div style={{ background: "#1e2a3a", borderRadius: 4, height: 6, marginTop: 6 }}>
      <div style={{ background: color, borderRadius: 4, height: 6, width: `${Math.max(2, Math.round(ratio * 100))}%` }} />
    </div>
  );
}

/**
 * /admin — Platform analytics dashboard.
 *
 * Shows: platform summary cards, 14-day activity sparkline, per-game stats,
 * and the hardest topics (lowest success rate) — the core "which topics do
 * students struggle with" question this platform is built around.
 *
 * All data comes from the `attempt` table (already collecting everything)
 * and the `event` table (added in 0002_event_table.sql migration). Fully
 * server-rendered — no client state needed, data is fresh on every visit
 * since this is force-dynamic.
 */
export default async function AdminDashboardPage() {
  const [summary, games, topics, daily] = await Promise.all([
    getPlatformSummary().catch(() => null),
    getGameStats().catch(() => []),
    getTopicStats().catch(() => []),
    getDailyActivity().catch(() => [])
  ]);

  const maxDailyAttempts = Math.max(...daily.map((d) => d.attempts), 1);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 60px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>
          Analytics Dashboard
        </h1>
        <p style={{ color: "#64748b", fontSize: "0.82rem", marginTop: 4, marginBottom: 0 }}>
          Live data from student activity across all games.
        </p>
      </div>

      {/* Summary cards */}
      {summary && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 14,
            marginBottom: 28
          }}
        >
          {[
            { label: "Total Students", value: summary.totalStudents.toLocaleString(), sub: `+${summary.newStudentsLast7Days} this week` },
            { label: "Total Attempts", value: summary.totalAttempts.toLocaleString(), sub: `${summary.attemptsLast7Days} this week` },
            { label: "Success Rate", value: pct(summary.successRate), sub: "across all games" },
            { label: "Total XP Earned", value: summary.totalXpAwarded.toLocaleString(), sub: "by all students" }
          ].map((item) => (
            <div key={item.label} style={card()}>
              <div style={label}>{item.label}</div>
              <div style={bigNumber}>{item.value}</div>
              <div style={subText}>{item.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* 14-day activity chart */}
      {daily.length > 0 && (
        <div style={{ ...card(), marginBottom: 28 }}>
          <div style={{ ...label, marginBottom: 14 }}>Daily Activity — Last 14 Days</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
            {daily.map((d) => (
              <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <div
                  title={`${d.date}: ${d.attempts} attempts, ${d.successes} successes`}
                  style={{
                    width: "100%",
                    background: "#3b82f6",
                    borderRadius: "3px 3px 0 0",
                    height: `${Math.max(4, Math.round((d.attempts / maxDailyAttempts) * 72))}px`,
                    opacity: 0.85,
                    cursor: "default"
                  }}
                />
                <div style={{ fontSize: "0.5rem", color: "#475569", transform: "rotate(-40deg)", transformOrigin: "right", whiteSpace: "nowrap" }}>
                  {d.date.slice(5)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ ...subText, marginTop: 20 }}>Hover bars for details. Blue = total attempts.</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
        {/* Per-game stats */}
        <div style={card()}>
          <div style={{ ...label, marginBottom: 14 }}>By Game</div>
          {games.length === 0 && <div style={subText}>No game data yet.</div>}
          {games.map((g) => (
            <div key={g.gameId} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#e2e8f0" }}>{g.gameTitle}</div>
                <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{g.totalAttempts} plays</div>
              </div>
              <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: 2 }}>
                {pct(g.successRate)} success · {g.uniquePlayers} players · {g.avgAttemptsBeforeSuccess.toFixed(1)} avg attempts
              </div>
              {bar(g.successRate, g.successRate >= 0.7 ? "#22c55e" : g.successRate >= 0.4 ? "#f59e0b" : "#ef4444")}
            </div>
          ))}
        </div>

        {/* Hardest topics */}
        <div style={card()}>
          <div style={{ ...label, marginBottom: 14 }}>Hardest Topics (lowest success rate)</div>
          <div style={subText}>Topics where students struggle most — key signal for curriculum focus.</div>
          <div style={{ marginTop: 14 }}>
            {topics.length === 0 && <div style={subText}>No topic data yet.</div>}
            {topics.map((t) => (
              <div key={t.topicId} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#e2e8f0" }}>
                    {t.topicId.replace(/-/g, " ")}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{pct(t.successRate)}</div>
                </div>
                <div style={{ fontSize: "0.67rem", color: "#64748b", marginTop: 1 }}>
                  {t.totalAttempts} attempts · {t.avgAttemptsBeforeSuccess.toFixed(1)} avg tries
                </div>
                {bar(t.successRate, t.successRate >= 0.7 ? "#22c55e" : t.successRate >= 0.4 ? "#f59e0b" : "#ef4444")}
              </div>
            ))}
          </div>
        </div>
      </div>

      {daily.length === 0 && games.length === 0 && topics.length === 0 && (
        <div style={{ ...card(), textAlign: "center", padding: 48, color: "#64748b" }}>
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>📊</div>
          <div style={{ fontWeight: 700, color: "#94a3b8", marginBottom: 8 }}>No activity data yet</div>
          <div style={{ fontSize: "0.82rem" }}>
            Data appears here as students play games. Share the app link to get your first players.
          </div>
        </div>
      )}
    </div>
  );
}
