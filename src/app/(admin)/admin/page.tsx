import {
  getPlatformSummary,
  getGameStats,
  getDailyActivity,
} from "@/lib/db/queries/analytics";
import { listAllGames as listGames } from "@/lib/db/queries/games";
import { getMissionsForGames } from "@/lib/db/queries/games";
import Link from "next/link";
import styles from "./dashboard.module.css";

export const dynamic = "force-dynamic";

function pct(n: number) { return `${Math.round(n * 100)}%`; }

const SUBJECT_META: Record<string, { colour: string; label: string; emoji: string; gradient: string }> = {
  mathematics: { colour: "#059669", label: "Mathematics", emoji: "📐", gradient: "linear-gradient(135deg, #064e3b 0%, #065f46 40%, #0d9488 100%)" },
  chemistry:   { colour: "#0284c7", label: "Chemistry",   emoji: "⚗️",  gradient: "linear-gradient(135deg, #0c4a6e 0%, #075985 40%, #0369a1 100%)" },
  physics:     { colour: "#7c3aed", label: "Physics",     emoji: "⚡",  gradient: "linear-gradient(135deg, #2e1065 0%, #4c1d95 40%, #6d28d9 100%)" },
  biology:     { colour: "#b45309", label: "Biology",     emoji: "🧬",  gradient: "linear-gradient(135deg, #431407 0%, #7c2d12 40%, #92400e 100%)" },
};

const DIFF_COLOUR: Record<string, string> = { EASY: "#22c55e", MEDIUM: "#f59e0b", HARD: "#ef4444" };

export default async function DashboardPage() {
  const [summary, gameStats, daily, games] = await Promise.all([
    getPlatformSummary().catch(() => null),
    getGameStats().catch(() => []),
    getDailyActivity().catch(() => []),
    listGames().catch(() => []),
  ]);

  const missionsByGame = games.length > 0
    ? await getMissionsForGames(games.map(g => g.id)).catch(() => ({}))
    : {};

  const bySubject: Record<string, typeof games> = {};
  for (const g of games) (bySubject[g.subject] ??= []).push(g);

  const statsMap = new Map(gameStats.map(gs => [gs.gameId, gs]));
  const maxDailyAttempts = Math.max(...daily.map(d => d.attempts), 1);
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className={styles.page}>

      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <div>
          <div className={styles.greeting}>{greeting}</div>
          <h1 className={styles.heading}>Game Library</h1>
        </div>
        <div className={styles.topActions}>
          <Link href="/admin/games/upload" className={styles.btnSecondary}>↑ Upload JSON</Link>
          <Link href="/admin/games/new" className={styles.btnPrimary}>+ New Game</Link>
        </div>
      </div>

      {/* ── KPI strip ── */}
      {summary && (
        <div className={styles.kpiStrip}>
          {[
            { label: "Students",     value: summary.totalStudents.toLocaleString(),  badge: `+${summary.newStudentsLast7Days} this week`, colour: "#a78bfa" },
            { label: "Attempts",     value: summary.totalAttempts.toLocaleString(),  badge: `${summary.attemptsLast7Days} this week`,     colour: "#34d399" },
            { label: "Success Rate", value: pct(summary.successRate),                badge: "across all games",                           colour: "#fbbf24" },
            { label: "XP Earned",    value: summary.totalXpAwarded.toLocaleString(), badge: "lifetime total",                             colour: "#60a5fa" },
          ].map(k => (
            <div key={k.label} className={styles.kpi} style={{ "--kpi-colour": k.colour } as React.CSSProperties}>
              <div className={styles.kpiLabel}>{k.label}</div>
              <div className={styles.kpiValue}>{k.value}</div>
              <div className={styles.kpiBadge}>{k.badge}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Main content ── */}
      <div className={styles.content}>

        {/* Activity sidebar */}
        {daily.length > 0 && (
          <div className={styles.sidebar}>
            <div className={styles.sideCard}>
              <div className={styles.sideCardTitle}>Activity · 14 days</div>
              <div className={styles.chart}>
                {daily.map(d => (
                  <div key={d.date} className={styles.barWrap}>
                    <div className={styles.bar}
                      title={`${d.date}: ${d.attempts}`}
                      style={{ height: `${Math.max(4, Math.round((d.attempts / maxDailyAttempts) * 100))}%` }}
                    />
                    <div className={styles.barLabel}>{d.date.slice(5)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.sideCard}>
              <div className={styles.sideCardTitle}>Quick Actions</div>
              <div className={styles.quickLinks}>
                {[
                  { href: "/admin/games",       icon: "▦", label: "All Games",    sub: `${games.length} total` },
                  { href: "/admin/students",     icon: "◎", label: "Students",     sub: summary ? `${summary.totalStudents} enrolled` : "" },
                  { href: "/admin/missions",     icon: "◈", label: "Missions",     sub: "Browse all" },
                  { href: "/admin/games/upload", icon: "↑", label: "Upload JSON",  sub: "Add from Claude" },
                ].map(a => (
                  <Link key={a.href} href={a.href} className={styles.quickLink}>
                    <span className={styles.quickLinkIcon}>{a.icon}</span>
                    <span>
                      <div className={styles.quickLinkLabel}>{a.label}</div>
                      {a.sub && <div className={styles.quickLinkSub}>{a.sub}</div>}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Game library */}
        <div className={styles.library}>
          {games.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🎮</div>
              <div className={styles.emptyTitle}>No games yet</div>
              <div className={styles.emptySub}>Upload a JSON or create a game to get started.</div>
              <div className={styles.emptyActions}>
                <Link href="/admin/games/upload" className={styles.btnSecondary}>↑ Upload JSON</Link>
                <Link href="/admin/games/new" className={styles.btnPrimary}>+ New Game</Link>
              </div>
            </div>
          ) : (
            Object.entries(bySubject).map(([subject, subjectGames]) => {
              const meta = SUBJECT_META[subject] ?? { colour: "#64748b", label: subject, emoji: "📖", gradient: "linear-gradient(135deg,#0d1520,#1e2535)" };
              return (
                <div key={subject} className={styles.subjectSection}>
                  <div className={styles.subjectHeader}>
                    <div className={styles.subjectDot} style={{ background: meta.colour }} />
                    <span className={styles.subjectLabel}>{meta.emoji} {meta.label}</span>
                    <span className={styles.subjectCount}>{subjectGames.length} game{subjectGames.length !== 1 ? "s" : ""}</span>
                  </div>

                  <div className={styles.gameGrid}>
                    {subjectGames.map(game => {
                      const missions = missionsByGame[game.id] ?? [];
                      const gs = statsMap.get(game.id);
                      const accent = game.accent_colour ?? meta.colour;
                      const sr = gs?.successRate ?? null;
                      const srColour = sr === null ? "#475569" : sr >= 0.7 ? "#22c55e" : sr >= 0.4 ? "#f59e0b" : "#ef4444";
                      const easy   = missions.filter(m => m.difficulty === "EASY").length;
                      const medium = missions.filter(m => m.difficulty === "MEDIUM").length;
                      const hard   = missions.filter(m => m.difficulty === "HARD").length;

                      return (
                        <div key={game.id} className={styles.gameCard} style={{ "--accent": accent, "--subject-gradient": meta.gradient } as React.CSSProperties}>
                          {/* Card art area */}
                          <div className={styles.gameCardArt}>
                            {game.card_art_url ? (
                              <img src={game.card_art_url} alt="" className={styles.gameCardImg} />
                            ) : (
                              <div className={styles.gameCardArtFallback}>
                                <span className={styles.gameCardEmoji}>{meta.emoji}</span>
                              </div>
                            )}
                            {/* Status badge overlaid on art */}
                            <div className={styles.gameCardStatus} data-active={game.is_active}>
                              {game.is_active ? "● Live" : "○ Draft"}
                            </div>
                            {/* Accent strip at bottom of art */}
                            <div className={styles.gameCardArtAccent} />
                          </div>

                          {/* Card body */}
                          <div className={styles.gameCardBody}>
                            <div className={styles.gameCardTitle}>{game.title}</div>
                            {game.card_description && (
                              <div className={styles.gameCardDesc}>{game.card_description}</div>
                            )}

                            {/* Stats */}
                            {gs ? (
                              <div className={styles.gameCardStats}>
                                <span style={{ color: srColour, fontWeight: 700 }}>{pct(gs.successRate)}</span>
                                <span className={styles.dot}>·</span>
                                <span>{gs.totalAttempts} plays</span>
                                <span className={styles.dot}>·</span>
                                <span>{gs.uniquePlayers} students</span>
                              </div>
                            ) : (
                              <div className={styles.gameCardStats} style={{ color: "#334155" }}>No plays yet</div>
                            )}

                            {/* Difficulty bar */}
                            {missions.length > 0 && (
                              <div className={styles.gameCardDiffRow}>
                                <span className={styles.gameCardMissionCount}>{missions.length} missions</span>
                                <div className={styles.diffBar}>
                                  {easy   > 0 && <div className={`${styles.diffSeg} ${styles.diffE}`} style={{ flex: easy }}   title={`${easy} Easy`}/>}
                                  {medium > 0 && <div className={`${styles.diffSeg} ${styles.diffM}`} style={{ flex: medium }} title={`${medium} Medium`}/>}
                                  {hard   > 0 && <div className={`${styles.diffSeg} ${styles.diffH}`} style={{ flex: hard }}   title={`${hard} Hard`}/>}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Card footer actions */}
                          <div className={styles.gameCardFooter}>
                            <Link href={`/admin/games/${game.id}/missions`} className={styles.footerBtn}>Missions</Link>
                            <Link href={`/admin/games/${game.id}/edit`}     className={styles.footerBtn}>Edit</Link>
                            <Link href={`/play/${game.slug}`} target="_blank" className={styles.footerBtnGhost}>Play ↗</Link>
                          </div>
                        </div>
                      );
                    })}

                    {/* Add game tile */}
                    <Link href="/admin/games/new" className={styles.addGameCard} style={{ "--accent": meta.colour } as React.CSSProperties}>
                      <div className={styles.addGameIcon}>+</div>
                      <div className={styles.addGameLabel}>New {meta.label} game</div>
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}