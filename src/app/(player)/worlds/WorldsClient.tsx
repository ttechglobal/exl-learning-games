"use client";

import { useState } from "react";
import Link from "next/link";
import { DepthBackdrop } from "@/motion/DepthBackdrop";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { useTheme } from "@/components/ui/ThemeProvider";
import { subjectMeta } from "@/lib/content/subjects";
import { GAME_CARD_DESC } from "@/lib/content/gameCardMeta";
import { GameCardArt } from "@/components/ui/GameCardArt";
import { topicsForSubject, topicLabel } from "@/lib/content/gameTopics";
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
 * TOPIC TAGS + FILTERS added per direct feedback: each game card now
 * shows a topic chip ("Periodic Table", "Chemical Bonding", etc) and
 * each subject section gets a row of filter tabs so players can drill
 * down within Chemistry to just "Hydrocarbons" games etc. The taxonomy
 * lives in lib/content/gameTopics.ts — add new topics there and the
 * filter tabs appear automatically. Per direct feedback: as the game
 * library grows, players need to be able to navigate to a specific
 * topic rather than scrolling through everything.
 *
 * CARD SIMPLIFICATION per direct feedback: removed missions count, XP
 * range, difficulty dots — too much info that doesn't help a player
 * decide whether to tap. Kept: art, game title, topic tag. Clean, like
 * the homepage's Popular Games cards.
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

export function WorldsClient({ bySubject }: WorldsClientProps) {
  const { theme, toggleTheme } = useTheme();
  // One active topic filter per subject — null means "All"
  const [activeTopics, setActiveTopics] = useState<Record<string, string | null>>({});

  const subjects = Object.entries(bySubject).filter(([, games]) => games.length > 0);
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

          // Build the topic filter list: only topics that have at least
          // one game in this subject's current game set, in topic order.
          const topicsInSubject = topicsForSubject(subject).filter((t) =>
            subjectGames.some((s) => s.game.topic_id === t.id)
          );
          const activeTopic = activeTopics[subject] ?? null;
          const visibleGames = activeTopic
            ? subjectGames.filter((s) => s.game.topic_id === activeTopic)
            : subjectGames;

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

              {/* Topic filter tabs — only render when there are 2+ distinct
                  topics in this subject, since a single-topic subject has
                  nothing to filter on. */}
              {topicsInSubject.length >= 2 && (
                <div className={styles.topicTabs} style={{ "--c": meta.color, "--c-tint": meta.tint } as React.CSSProperties}>
                  <button
                    className={`${styles.topicTab} ${activeTopic === null ? styles.topicTabActive : ""}`}
                    onClick={() => setActiveTopics((s) => ({ ...s, [subject]: null }))}
                  >
                    All
                  </button>
                  {topicsInSubject.map((t) => (
                    <button
                      key={t.id}
                      className={`${styles.topicTab} ${activeTopic === t.id ? styles.topicTabActive : ""}`}
                      onClick={() => setActiveTopics((s) => ({ ...s, [subject]: t.id }))}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}

              <div className={styles.gameGrid}>
                {visibleGames.map(({ game }) => {
                  const tag = topicLabel(game.topic_id);
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
                      </div>
                      <div className={styles.gameCardBody}>
                        <div className={styles.gameCardTag}>{tag}</div>
                        <div className={styles.gameCardTitle}>{game.title}</div>
                        {desc && <p className={styles.gameCardDesc}>{desc}</p>}
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
