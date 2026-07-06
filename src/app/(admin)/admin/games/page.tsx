import { listGames } from "@/lib/db/queries/games";
import { getMissionsForGames } from "@/lib/db/queries/games";
import Link from "next/link";
import styles from "./games.module.css";

export const dynamic = "force-dynamic";

const SUBJECT_META: Record<string, { colour: string; label: string; emoji: string }> = {
  mathematics: { colour: "#3ecf8e", label: "Mathematics", emoji: "📐" },
  chemistry:   { colour: "#00d4ff", label: "Chemistry",   emoji: "⚗️" },
  physics:     { colour: "#4488ff", label: "Physics",     emoji: "⚡" },
  biology:     { colour: "#7ecf3e", label: "Biology",     emoji: "🧬" },
};

export default async function GamesPage() {
  const games = await listGames();
  const missionsByGame = await getMissionsForGames(games.map(g => g.id));

  const bySubject: Record<string, typeof games> = {};
  for (const g of games) (bySubject[g.subject] ??= []).push(g);

  const totalMissions = Object.values(missionsByGame).reduce((sum, ms) => sum + ms.length, 0);

  return (
    <div className={styles.page}>

      {/* Page header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Game Library</h1>
          <p className={styles.sub}>
            {games.length} game{games.length !== 1 ? "s" : ""} · {totalMissions} missions · {Object.keys(bySubject).length} subjects
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/admin/games/upload" className={styles.btnUpload}>
            <span>↑</span> Upload JSON
          </Link>
          <Link href="/admin/games/new" className={styles.btnPrimary}>
            + New Game
          </Link>
        </div>
      </div>

      {/* Subject sections */}
      {Object.entries(bySubject).map(([subject, subjectGames]) => {
        const meta = SUBJECT_META[subject] ?? { colour: "#64748b", label: subject, emoji: "📖" };
        return (
          <div key={subject} className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionDot} style={{ background: meta.colour }}/>
              <span className={styles.sectionLabel}>{meta.emoji} {meta.label}</span>
              <span className={styles.sectionCount}>{subjectGames.length} game{subjectGames.length !== 1 ? "s" : ""}</span>
            </div>

            <div className={styles.grid}>
              {subjectGames.map(game => {
                const missions = missionsByGame[game.id] ?? [];
                const accent = game.accent_colour ?? meta.colour;
                const easy = missions.filter(m => m.difficulty === "EASY").length;
                const medium = missions.filter(m => m.difficulty === "MEDIUM").length;
                const hard = missions.filter(m => m.difficulty === "HARD").length;

                return (
                  <div key={game.id} className={styles.card}>
                    {/* Top accent bar */}
                    <div className={styles.cardBar} style={{ background: accent }}/>

                    {/* Card art + status */}
                    <div className={styles.cardTop}>
                      <div className={styles.cardArtWrap}>
                        {game.card_art_url ? (
                          <img src={game.card_art_url} alt="" className={styles.cardArt}/>
                        ) : (
                          <div className={styles.cardArtFallback} style={{ background: `${accent}18` }}>
                            <span style={{ fontSize: "1.6rem" }}>{meta.emoji}</span>
                          </div>
                        )}
                      </div>
                      <div className={styles.cardStatus}>
                        <div
                          className={styles.statusPip}
                          style={{ background: game.is_active ? "#22c55e" : "#475569" }}
                          title={game.is_active ? "Active" : "Inactive"}
                        />
                        <span className={styles.statusLabel}>
                          {game.is_active ? "Live" : "Draft"}
                        </span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className={styles.cardBody}>
                      <div className={styles.cardTitle}>{game.title}</div>
                      <div className={styles.cardSlug}>{game.slug}</div>

                      {game.card_description && (
                        <p className={styles.cardDesc}>{game.card_description}</p>
                      )}

                      {/* Tags */}
                      <div className={styles.tags}>
                        <span className={styles.tag}>{game.engine_type}</span>
                        <span className={styles.tag}>{game.progression_mode ?? "linear"}</span>
                      </div>

                      {/* Mission difficulty bar */}
                      {missions.length > 0 && (
                        <div className={styles.missionRow}>
                          <span className={styles.missionCount}>{missions.length} missions</span>
                          <div className={styles.diffBar}>
                            {easy > 0 && (
                              <div className={`${styles.diffSegment} ${styles.diffEasy}`}
                                style={{ flex: easy }} title={`${easy} Easy`}/>
                            )}
                            {medium > 0 && (
                              <div className={`${styles.diffSegment} ${styles.diffMedium}`}
                                style={{ flex: medium }} title={`${medium} Medium`}/>
                            )}
                            {hard > 0 && (
                              <div className={`${styles.diffSegment} ${styles.diffHard}`}
                                style={{ flex: hard }} title={`${hard} Hard`}/>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className={styles.cardActions}>
                      <Link href={`/admin/games/${game.id}/missions`} className={styles.actionBtn}>
                        Missions
                      </Link>
                      <Link href={`/admin/games/${game.id}/edit`} className={styles.actionBtn}>
                        Edit
                      </Link>
                      <Link href={`/play/${game.slug}`} target="_blank" className={styles.actionBtnGhost}>
                        Play ↗
                      </Link>
                    </div>
                  </div>
                );
              })}

              {/* Add game card */}
              <Link href="/admin/games/new" className={styles.addCard}>
                <div className={styles.addIcon}>+</div>
                <div className={styles.addLabel}>New {meta.label} Game</div>
              </Link>
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {games.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🎮</div>
          <div className={styles.emptyTitle}>No games yet</div>
          <div className={styles.emptySub}>Upload a game JSON or create one manually to get started.</div>
          <div className={styles.emptyActions}>
            <Link href="/admin/games/upload" className={styles.btnUpload}>↑ Upload JSON</Link>
            <Link href="/admin/games/new" className={styles.btnPrimary}>+ New Game</Link>
          </div>
        </div>
      )}
    </div>
  );
}
