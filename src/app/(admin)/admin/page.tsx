import { getPlatformSummary, getGameStats, getTopicStats, getDailyActivity } from "@/lib/db/queries/analytics";
import styles from "./dashboard.module.css";

export const dynamic = "force-dynamic";

function pct(n: number) { return `${Math.round(n * 100)}%`; }

const SUBJECT_META: Record<string, { colour: string }> = {
  mathematics: { colour: "#3ecf8e" },
  chemistry:   { colour: "#00d4ff" },
  physics:     { colour: "#4488ff" },
  biology:     { colour: "#7ecf3e" },
};

export default async function DashboardPage() {
  const [summary, games, topics, daily] = await Promise.all([
    getPlatformSummary().catch(() => null),
    getGameStats().catch(() => []),
    getTopicStats().catch(() => []),
    getDailyActivity().catch(() => []),
  ]);

  const maxDailyAttempts = Math.max(...daily.map(d => d.attempts), 1);

  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <h1 className={styles.heading}>Dashboard</h1>
        <p className={styles.sub}>Platform activity and performance overview.</p>
      </div>

      {/* KPI row */}
      {summary && (
        <div className={styles.kpiRow}>
          {[
            { label: "Students",     value: summary.totalStudents.toLocaleString(),   sub: `+${summary.newStudentsLast7Days} this week`,    colour: "#7c3aed" },
            { label: "Attempts",     value: summary.totalAttempts.toLocaleString(),   sub: `${summary.attemptsLast7Days} this week`,        colour: "#3ecf8e" },
            { label: "Success Rate", value: pct(summary.successRate),                 sub: "across all games",                             colour: "#f59e0b" },
            { label: "XP Earned",    value: summary.totalXpAwarded.toLocaleString(),  sub: "total by all students",                        colour: "#4488ff" },
          ].map(item => (
            <div key={item.label} className={styles.kpiCard}>
              <div className={styles.kpiBar} style={{ background: item.colour }}/>
              <div className={styles.kpiLabel}>{item.label}</div>
              <div className={styles.kpiValue} style={{ color: item.colour }}>{item.value}</div>
              <div className={styles.kpiSub}>{item.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Activity chart */}
      {daily.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Daily Activity — Last 14 Days</div>
          <div className={styles.chart}>
            {daily.map(d => (
              <div key={d.date} className={styles.chartBar}>
                <div
                  className={styles.chartBarInner}
                  title={`${d.date}: ${d.attempts} attempts`}
                  style={{ height: `${Math.max(4, Math.round((d.attempts / maxDailyAttempts) * 100))}%` }}
                />
                <div className={styles.chartBarDate}>{d.date.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.twoCol}>

        {/* Per-game stats */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>Games</div>
          {games.length === 0 && <div className={styles.empty}>No game data yet.</div>}
          {games.map(g => {
            const sr = g.successRate;
            const colour = sr >= 0.7 ? "#22c55e" : sr >= 0.4 ? "#f59e0b" : "#ef4444";
            return (
              <div key={g.gameId} className={styles.statRow}>
                <div className={styles.statName}>{g.gameTitle}</div>
                <div className={styles.statMeta}>{pct(sr)} · {g.totalAttempts} plays · {g.uniquePlayers} students</div>
                <div className={styles.statBar}>
                  <div className={styles.statBarFill} style={{ width: `${Math.max(2, sr * 100)}%`, background: colour }}/>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hardest topics */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>Hardest Topics</div>
          <div className={styles.cardSub}>Where students struggle most — key signal for curriculum focus.</div>
          {topics.length === 0 && <div className={styles.empty}>No topic data yet.</div>}
          {topics.map(t => {
            const sr = t.successRate;
            const colour = sr >= 0.7 ? "#22c55e" : sr >= 0.4 ? "#f59e0b" : "#ef4444";
            return (
              <div key={t.topicId} className={styles.statRow}>
                <div className={styles.statName}>{t.topicId.replace(/-/g, " ")}</div>
                <div className={styles.statMeta}>{pct(sr)} · {t.totalAttempts} attempts · {t.avgAttemptsBeforeSuccess.toFixed(1)} avg tries</div>
                <div className={styles.statBar}>
                  <div className={styles.statBarFill} style={{ width: `${Math.max(2, sr * 100)}%`, background: colour }}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick actions */}
      <div className={styles.actions}>
        <div className={styles.actionsTitle}>Quick Actions</div>
        <div className={styles.actionRow}>
          {[
            { href: "/admin/games/upload", icon: "↑", label: "Upload Game JSON", sub: "Paste content from Claude" },
            { href: "/admin/games/new",    icon: "+", label: "New Game",          sub: "Build a game manually"    },
            { href: "/admin/games",        icon: "▦", label: "View All Games",   sub: "Browse the game library"  },
          ].map(a => (
            <a key={a.href} href={a.href} className={styles.actionCard}>
              <div className={styles.actionIcon}>{a.icon}</div>
              <div>
                <div className={styles.actionLabel}>{a.label}</div>
                <div className={styles.actionSub}>{a.sub}</div>
              </div>
            </a>
          ))}
        </div>
      </div>

    </div>
  );
}
