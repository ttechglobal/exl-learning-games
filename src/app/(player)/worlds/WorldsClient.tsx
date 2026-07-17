"use client";

/**
 * WorldsClient.tsx — EXL Learning World Dashboard
 *
 * Changes from previous version:
 * - XP total card removed (unnecessary noise on the browse page)
 * - QuickPlayModal removed — game cards are now direct links to /play/[slug]
 * - GameCardArt prop bug fixed: was passing slug/subject, now passes
 *   gameSlug/emoji/color/tint as the component actually expects
 */

import Link from "next/link";
import { useState } from "react";
import { useTheme } from "@/components/ui/ThemeProvider";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { subjectMeta } from "@/lib/content/subjects";
import { GAME_CARD_DESC } from "@/lib/content/gameCardMeta";
import { GameCardArt } from "@/components/ui/GameCardArt";
import type { GameRow, Difficulty } from "@/types/db";
import styles from "@/app/(player)/worlds/WorldsClient.module.css";

export interface GameSummary {
  game: GameRow;
  missionCount: number;
  xpMin: number;
  xpMax: number;
  difficultyMin: Difficulty | null;
  difficultyMax: Difficulty | null;
  totalEstimatedMinutes: number | null;
}

export interface WorldsClientProps {
  bySubject: Record<string, GameSummary[]>;
  currentStudentXp?: number;
  currentStudentRank?: number;
  studentName?: string;
}

const WORLD_META: Record<string, {
  name: string; tagline: string; glyph: string;
  color: string; tint: string; border: string; darkBg: string;
}> = {
  chemistry: {
    name: "Chemistry World",
    tagline: "Build atoms, break bonds, see matter behave.",
    glyph: "⚗",
    color: "var(--eg-subject-chemistry)",
    tint: "rgba(123,79,203,0.07)",
    border: "rgba(123,79,203,0.18)",
    darkBg: "rgba(123,79,203,0.12)",
  },
  mathematics: {
    name: "Mathematics World",
    tagline: "Solve equations, construct proofs, own the numbers.",
    glyph: "∑",
    color: "var(--eg-subject-mathematics)",
    tint: "rgba(47,155,214,0.07)",
    border: "rgba(47,155,214,0.18)",
    darkBg: "rgba(47,155,214,0.12)",
  },
  physics: {
    name: "Physics World",
    tagline: "Apply forces, trace light, move through space.",
    glyph: "⚡",
    color: "var(--eg-subject-physics)",
    tint: "rgba(255,111,145,0.07)",
    border: "rgba(255,111,145,0.18)",
    darkBg: "rgba(255,111,145,0.12)",
  },
  biology: {
    name: "Biology World",
    tagline: "Study cells, map ecosystems, decode life.",
    glyph: "⬡",
    color: "var(--eg-subject-biology)",
    tint: "rgba(76,175,110,0.07)",
    border: "rgba(76,175,110,0.18)",
    darkBg: "rgba(76,175,110,0.12)",
  },
};

function diffLabel(min: Difficulty | null, max: Difficulty | null) {
  if (!min) return null;
  const L: Record<Difficulty, string> = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };
  return min === max ? L[min] : `${L[min]}–${L[max ?? min]}`;
}

export function WorldsClient({ bySubject, currentStudentRank, studentName }: WorldsClientProps) {
  const { theme, toggleTheme } = useTheme();
  const [activeWorld, setActiveWorld] = useState<string | null>(null);

  const allSubjects = ["chemistry", "mathematics", "physics", "biology"];
  const totalGames = Object.values(bySubject).reduce((s, g) => s + g.length, 0);

  return (
    <div className={styles.page} data-theme={theme}>

      {/* Ambient */}
      <div className={styles.ambient} aria-hidden="true">
        <div className={styles.blob} style={{ width: 600, height: 600, top: "-10%", right: "-15%", background: "radial-gradient(circle, rgba(123,79,203,0.1) 0%, transparent 70%)" }} />
        <div className={styles.blob} style={{ width: 400, height: 400, bottom: "10%", left: "-5%", background: "radial-gradient(circle, rgba(47,155,214,0.08) 0%, transparent 70%)" }} />
      </div>

      <SiteHeader theme={theme} onToggleTheme={toggleTheme} active="games" />

      {/* ── PAGE HEADER ── */}
      <div className={styles.pageHead}>
        <div className={styles.container}>
          <div className={styles.dashRow}>
            <div className={styles.dashLeft}>
              <div className={styles.dashEyebrow}>Your Dashboard</div>
              <h1 className={`${styles.dashTitle} ${styles.fd}`}>
                {studentName ? `${studentName}'s Worlds` : "Learning Worlds"}
              </h1>
              <p className={styles.dashSub}>Choose a world. Every experience builds real understanding.</p>
            </div>

            {/* Compact stat strip — replaces the big XP card */}
            <div className={styles.statStrip}>
              {currentStudentRank && (
                <div className={styles.statPill}>
                  <span className={styles.statPillIcon}>🏆</span>
                  <span className={styles.statPillLabel}>Rank</span>
                  <span className={styles.statPillValue}>#{currentStudentRank}</span>
                </div>
              )}
              <div className={styles.statPill}>
                <span className={styles.statPillIcon}>🎮</span>
                <span className={styles.statPillLabel}>Experiences</span>
                <span className={styles.statPillValue}>{totalGames}</span>
              </div>
            </div>
          </div>

          {/* World selector tabs */}
          <div className={styles.worldTabs}>
            <button
              className={`${styles.worldTab} ${activeWorld === null ? styles.worldTabActive : ""}`}
              onClick={() => setActiveWorld(null)}
            >
              All Worlds
            </button>
            {allSubjects.map(s => {
              const wm = WORLD_META[s];
              const count = (bySubject[s] ?? []).length;
              return (
                <button
                  key={s}
                  className={`${styles.worldTab} ${activeWorld === s ? styles.worldTabActive : ""}`}
                  style={{ "--wc": wm?.color } as React.CSSProperties}
                  onClick={() => setActiveWorld(activeWorld === s ? null : s)}
                >
                  {subjectMeta(s).emoji} {subjectMeta(s).name}
                  {count > 0 && <span className={styles.tabCount}>{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── WORLD SECTIONS ── */}
      <main className={styles.main}>
        <div className={styles.container}>
          {allSubjects
            .filter(s => activeWorld === null || activeWorld === s)
            .map(subject => {
              const summaries = bySubject[subject] ?? [];
              const wm = WORLD_META[subject] ?? {
                name: `${subject} World`, tagline: "", glyph: "○",
                color: "var(--eg-brand)", tint: "rgba(11,19,48,0.06)", border: "rgba(11,19,48,0.15)", darkBg: "rgba(11,19,48,0.2)"
              };
              const meta = subjectMeta(subject);
              const isLive = summaries.length > 0;

              return (
                <section
                  key={subject}
                  className={styles.worldSection}
                  id={`world-${subject}`}
                  style={{ "--wc": wm.color, "--wt": wm.tint, "--wb": wm.border } as React.CSSProperties}
                >
                  {/* World banner */}
                  <div className={styles.worldBanner}>
                    <div className={styles.wbGlyph} aria-hidden="true">{wm.glyph}</div>
                    <div className={styles.wbBody}>
                      <div className={styles.wbSubject}>{meta.emoji} {meta.name}</div>
                      <h2 className={`${styles.wbName} ${styles.fd}`}>{wm.name}</h2>
                      <p className={styles.wbTagline}>{wm.tagline}</p>
                    </div>
                    <div className={styles.wbMeta}>
                      {isLive
                        ? <span className={styles.wbLive}>● {summaries.length} experience{summaries.length !== 1 ? "s" : ""}</span>
                        : <span className={styles.wbSoon}>Coming soon</span>
                      }
                    </div>
                  </div>

                  {/* Game cards — direct links, no modal */}
                  {isLive ? (
                    <div className={styles.gameGrid}>
                      {summaries.map(({ game, missionCount, xpMin, xpMax, difficultyMin, difficultyMax }) => {
                        const desc = GAME_CARD_DESC[game.slug] ?? game.name;
                        const diff = diffLabel(difficultyMin, difficultyMax);

                        return (
                          <Link
                            key={game.id}
                            href={`/play/${game.slug}`}
                            className={styles.gameCard}
                          >
                            {/* Art — now passes the correct props GameCardArt expects */}
                            <div className={styles.gcArt}>
                              <GameCardArt
                                gameSlug={game.slug}
                                emoji={meta.emoji}
                                color={meta.color}
                                tint={meta.tint}
                              />
                              {diff && <span className={styles.gcDiff}>{diff}</span>}
                            </div>

                            {/* Info */}
                            <div className={styles.gcInfo}>
                              <div className={`${styles.gcName} ${styles.fd}`}>{game.name}</div>
                              <div className={styles.gcDesc}>{desc}</div>
                              <div className={styles.gcMeta}>
                                <span className={styles.gcXp}>+{xpMin === xpMax ? xpMin : `${xpMin}–${xpMax}`} XP</span>
                                <span className={styles.gcMissions}>{missionCount} mission{missionCount !== 1 ? "s" : ""}</span>
                              </div>
                              <div className={styles.gcPlay}>
                                Play now →
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={styles.comingSoon}>
                      <div className={styles.csGlyph}>{wm.glyph}</div>
                      <div className={styles.csText}>
                        <strong>{wm.name}</strong> experiences are in development.
                        Keep an eye on this space — they&apos;re coming soon.
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
        </div>
      </main>
    </div>
  );
}