"use client";

import Link from "next/link";
import { DepthBackdrop } from "@/motion/DepthBackdrop";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { useTheme } from "@/components/ui/ThemeProvider";
import { subjectMeta } from "@/lib/content/subjects";
import { GAME_CARD_DESC } from "@/lib/content/gameCardMeta";
import { GameCardArt } from "@/components/ui/GameCardArt";
import type { GameRow, Difficulty } from "@/types/db";
import styles from "@/app/(player)/worlds/WorldsClient.module.css";

/**
 * WorldsClient.tsx
 *
 * REVERTED a "Choose Subject" / "Choose Game" two-page split that
 * previously lived here (a /worlds/[subject] route, now deleted) — by
 * direct instruction, back to ONE /worlds page: every subject as its own
 * section, each with its games shown as rich cards directly underneath,
 * no intermediate subject-tile screen.
 *
 * Card visual language (art + difficulty badge + title + one-sentence
 * description + meta row + XP) is carried over from the deleted subject
 * page rather than rebuilt from scratch — same lib/content/gameCardMeta.ts
 * lookups the homepage's Popular Games section uses, so a card looks like
 * the same kind of object everywhere it appears in the app.
 *
 * SiteHeader rendered DIRECTLY here (not via the shared (player)/layout.tsx
 * anymore) — that layout used to render it for every screen under
 * (player)/, including the actual play flow, which is exactly what's
 * being undone: nav should never appear inside gameplay, only on Worlds
 * and Home. See app/(player)/layout.tsx's comment for the full story.
 *
 * Theme still comes from the shared ThemeProvider (app/layout.tsx) — no
 * local useState here.
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

const DIFFICULTY_LABEL: Record<Difficulty, string> = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };
const DIFFICULTY_DOTS: Record<Difficulty, number> = { EASY: 1, MEDIUM: 2, HARD: 3 };

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
  const { theme, toggleTheme } = useTheme();
  const subjects = Object.entries(bySubject);
  const primaryAccent = subjects.length > 0 ? subjectMeta(subjects[0][0]).color : "var(--eg-brand)";
  const totalGames = subjects.reduce((sum, [, games]) => sum + games.length, 0);

  return (
    <div className={styles.page} data-theme={theme}>
      <SiteHeader theme={theme} onToggleTheme={toggleTheme} active="games" />

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
                  const desc = GAME_CARD_DESC[game.slug];

                  return (
                    <Link
                      key={game.id}
                      href={`/play/${game.slug}`}
                      className={styles.gameCard}
                      style={{ "--c": meta.color, "--c-tint": meta.tint } as React.CSSProperties}
                    >
                      <div className={styles.gameCardArt}>
                        <GameCardArt gameSlug={game.slug} emoji={meta.emoji} color={meta.color} tint={meta.tint} />
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
                        {desc && <p className={styles.gameCardDesc}>{desc}</p>}
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