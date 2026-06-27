"use client";

import { useState } from "react";
import Link from "next/link";
import { DepthBackdrop } from "@/motion/DepthBackdrop";
import { SiteHeader } from "@/components/ui/SiteHeader";
import type { GameRow, Difficulty } from "@/types/db";
import styles from "@/app/(player)/worlds/WorldsClient.module.css";

/**
 * WorldsClient.tsx
 *
 * Full game catalog, grouped by subject. As of this revision, each card
 * shows real per-game metadata (mission count, XP range, difficulty
 * spread, estimated total time) computed server-side in page.tsx from
 * that game's missions — see summarizeMissions() there for exactly how
 * each field is derived and what it means when data is partial/missing.
 * This component never invents a number; if page.tsx couldn't compute one
 * (e.g. totalEstimatedMinutes is null because no mission has that field
 * yet), the card omits that row instead of showing a placeholder.
 *
 * THEME STATE NOTE: still a local `useState`, same gap noted previously —
 * see HomePage.tsx for the ThemeProvider follow-up this should eventually
 * move to.
 */

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
}

const SUBJECT_META: Record<string, { name: string; emoji: string; color: string; tint: string }> = {
  chemistry: { name: "Chemistry", emoji: "\u{1F9EA}", color: "var(--eg-subject-chemistry)", tint: "color-mix(in srgb, var(--eg-subject-chemistry) 14%, white)" },
  mathematics: { name: "Mathematics", emoji: "\u{1F4D0}", color: "var(--eg-subject-mathematics)", tint: "color-mix(in srgb, var(--eg-subject-mathematics) 14%, white)" },
  physics: { name: "Physics", emoji: "\u26A1", color: "var(--eg-subject-physics)", tint: "color-mix(in srgb, var(--eg-subject-physics) 14%, white)" },
  biology: { name: "Biology", emoji: "\u{1F9EC}", color: "var(--eg-subject-biology)", tint: "color-mix(in srgb, var(--eg-subject-biology) 14%, white)" }
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };
const DIFFICULTY_DOTS: Record<Difficulty, number> = { EASY: 1, MEDIUM: 2, HARD: 3 };

function subjectMeta(key: string) {
  return (
    SUBJECT_META[key] ?? {
      name: key.charAt(0).toUpperCase() + key.slice(1),
      emoji: "\u{1F4D6}",
      color: "var(--eg-brand)",
      tint: "var(--eg-brand-tint)"
    }
  );
}

/** "Easy" when min===max, "Easy–Medium" when a game's missions span a range. */
function difficultyLabel(min: Difficulty | null, max: Difficulty | null): string | null {
  if (!min || !max) return null;
  if (min === max) return DIFFICULTY_LABEL[min];
  return `${DIFFICULTY_LABEL[min]}\u2013${DIFFICULTY_LABEL[max]}`;
}

/** "+150 XP" when xpMin===xpMax (the common case), "120-150 XP" when missions pay differently. */
function xpLabel(min: number, max: number): string {
  return min === max ? `+${min} XP` : `${min}\u2013${max} XP`;
}

export function WorldsClient({ bySubject }: WorldsClientProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const subjects = Object.entries(bySubject);
  const primaryAccent = subjects.length > 0 ? subjectMeta(subjects[0][0]).color : "var(--eg-brand)";
  const totalGames = subjects.reduce((sum, [, games]) => sum + games.length, 0);

  return (
    <div className={styles.page} data-theme={theme}>
      <SiteHeader theme={theme} onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))} active="games" />

      <div className={styles.titleRow}>
        <DepthBackdrop accentColor={primaryAccent} />
        <div className={styles.container}>
          <h1 className={styles.pageTitle}>All Worlds</h1>
          <p className={styles.pageSubtitle}>
            {totalGames} game{totalGames === 1 ? "" : "s"} across {subjects.length} subject{subjects.length === 1 ? "" : "s"}. Pick one and dive in.
          </p>
        </div>
      </div>

      <div className={styles.container}>
        {subjects.map(([subject, subjectGames]) => {
          const meta = subjectMeta(subject);
          return (
            <section key={subject} className={styles.subjectSection} id={subject}>
              <div className={styles.subjectHead}>
                <span className={styles.subjectIcon} style={{ background: meta.tint }}>
                  {meta.emoji}
                </span>
                <h2 className={styles.subjectName} style={{ color: meta.color }}>
                  {meta.name}
                </h2>
                <span className={styles.subjectCount}>
                  {subjectGames.length} game{subjectGames.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className={styles.gameGrid}>
                {subjectGames.map((summary) => {
                  const { game } = summary;
                  const diffLabel = difficultyLabel(summary.difficultyMin, summary.difficultyMax);
                  const dotCount = summary.difficultyMax ? DIFFICULTY_DOTS[summary.difficultyMax] : 0;
                  return (
                    <Link
                      key={game.id}
                      href={`/play/${game.slug}`}
                      className={styles.gameCard}
                      style={{ "--c": meta.color, "--c-tint": meta.tint } as React.CSSProperties}
                    >
                      <div className={styles.gameCardArt}>
                        <span className={styles.gameCardEmoji}>{meta.emoji}</span>
                        {dotCount > 0 && (
                          <span className={styles.difficultyBadge} aria-label={diffLabel ?? undefined}>
                            {Array.from({ length: dotCount }).map((_, i) => (
                              <span key={i} className={styles.difficultyDot} />
                            ))}
                          </span>
                        )}
                      </div>
                      <div className={styles.gameCardBody}>
                        <div className={styles.gameCardSubject}>{meta.name}</div>
                        <div className={styles.gameCardTitle}>{game.title}</div>
                        <div className={styles.gameCardMeta}>
                          <span>
                            {summary.missionCount} mission{summary.missionCount === 1 ? "" : "s"}
                          </span>
                          {diffLabel && <span>{diffLabel}</span>}
                          {summary.totalEstimatedMinutes != null && <span>{"\u23F1"} ~{summary.totalEstimatedMinutes} min</span>}
                        </div>
                        <div className={styles.gameCardXp}>{xpLabel(summary.xpMin, summary.xpMax)}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}

        {subjects.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>{"\u{1F5FA}\uFE0F"}</div>
            <p>No games yet — seed the database to see them here.</p>
          </div>
        )}
      </div>
    </div>
  );
}