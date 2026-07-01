"use client";

import { useState } from "react";
import Link from "next/link";
import { DepthBackdrop } from "@/motion/DepthBackdrop";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { useTheme } from "@/components/ui/ThemeProvider";
import { subjectMeta } from "@/lib/content/subjects";
import { GAME_CARD_DESC } from "@/lib/content/gameCardMeta";
import { GameCardArt } from "@/components/ui/GameCardArt";
import type { GameRow, Difficulty } from "@/types/db";
import styles from "@/app/(player)/worlds/WorldsClient.module.css";

// ─── Inline topic labels — no external file dependency ───────────────────────
const TOPIC_LABELS: Record<string, string> = {
  "periodic-table": "Periodic Table",
  "atomic-structure": "Atomic Structure",
  "chemical-bonding": "Chemical Bonding",
  "molecular-bonding": "Molecular Bonding",
  "hydrocarbons": "Hydrocarbons",
  "reflection-of-light": "Reflection of Light",
  "forces": "Forces",
  "waves": "Waves",
  "electricity": "Electricity",
  "algebra": "Algebra",
  "geometry": "Geometry",
};

function topicLabel(id: string): string {
  return TOPIC_LABELS[id] ?? id.replace(/-/g, " ");
}

// ─── Types ───────────────────────────────────────────────────────────────────
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

// ─── Component ───────────────────────────────────────────────────────────────
export function WorldsClient({ bySubject }: WorldsClientProps) {
  const { theme, toggleTheme } = useTheme();
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

  const subjects = Object.entries(bySubject).filter(([, g]) => g.length > 0);
  const totalGames = subjects.reduce((s, [, g]) => s + g.length, 0);
  const primaryAccent = subjects.length > 0
    ? subjectMeta(subjects[0][0]).color
    : "var(--eg-brand)";

  // ── Expanded view ────────────────────────────────────────────────────────
  if (expandedSubject) {
    const meta = subjectMeta(expandedSubject);
    const games = bySubject[expandedSubject] ?? [];
    return (
      <div className={styles.page} data-theme={theme}>
        <SiteHeader theme={theme} onToggleTheme={toggleTheme} active="games" />
        <div className={styles.titleRow}>
          <DepthBackdrop accentColor={meta.color} />
          <div className={styles.container}>
            <button className={styles.backBtn} onClick={() => setExpandedSubject(null)}>
              ← All Worlds
            </button>
            <h1 className={styles.pageTitle}>{meta.emoji} {meta.name}</h1>
          </div>
        </div>
        <div className={styles.container}>
          <div className={styles.gameGrid}>
            {games.map(({ game }) => (
              <Link key={game.id} href={`/play/${game.slug}`}
                className={styles.gameCard}>
                <div className={styles.gameCardArt}>
                  <GameCardArt gameSlug={game.slug} emoji={meta.emoji}
                    color={meta.color} tint={meta.tint} />
                </div>
                <div className={styles.gameCardBody}>
                  <div className={styles.gameCardTag}
                    style={{ color: meta.color, background: meta.tint }}>
                    {topicLabel(game.topic_id)}
                  </div>
                  <div className={styles.gameCardTitle}>{game.title}</div>
                  {GAME_CARD_DESC[game.slug] && (
                    <p className={styles.gameCardDesc}>{GAME_CARD_DESC[game.slug]}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Overview: horizontal scroll rows ─────────────────────────────────────
  return (
    <div className={styles.page} data-theme={theme}>
      <SiteHeader theme={theme} onToggleTheme={toggleTheme} active="games" />
      <div className={styles.titleRow}>
        <DepthBackdrop accentColor={primaryAccent} />
        <div className={styles.container}>
          <h1 className={styles.pageTitle}>All Worlds</h1>
          <p className={styles.pageSubtitle}>
            {totalGames} game{totalGames === 1 ? "" : "s"} across {subjects.length} subject{subjects.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className={styles.overviewWrap}>
        {subjects.length === 0 && (
          <p className={styles.emptyText}>No games yet — check back soon.</p>
        )}

        {subjects.map(([subject, games]) => {
          const meta = subjectMeta(subject);
          return (
            <section key={subject} className={styles.subjectSection}>

              {/* Section header — plain text, no CSS variable colors */}
              <div className={styles.sectionHead}>
                <span className={styles.sectionEmoji}>{meta.emoji}</span>
                <h2 className={styles.sectionName}>{meta.name}</h2>
                <span className={styles.sectionCount}>{games.length}</span>
                <button className={styles.viewAllBtn}
                  onClick={() => setExpandedSubject(subject)}>
                  View All →
                </button>
              </div>

              {/* Horizontal scroll row */}
              <div className={styles.scrollRow}>
                {games.map(({ game }) => (
                  <Link key={game.id} href={`/play/${game.slug}`}
                    className={styles.miniCard}>
                    <div className={styles.miniCardArt}
                      style={{ background: meta.tint }}>
                      <GameCardArt gameSlug={game.slug} emoji={meta.emoji}
                        color={meta.color} tint={meta.tint} />
                    </div>
                    <div className={styles.miniCardBody}>
                      <div className={styles.miniCardTag}
                        style={{ color: meta.color, background: meta.tint }}>
                        {topicLabel(game.topic_id)}
                      </div>
                      <div className={styles.miniCardTitle}>{game.title}</div>
                    </div>
                  </Link>
                ))}

                <button className={styles.seeAllTile}
                  onClick={() => setExpandedSubject(subject)}>
                  <span>{meta.emoji}</span>
                  <span className={styles.seeAllText}>See all</span>
                  <span>→</span>
                </button>
              </div>

            </section>
          );
        })}
      </div>
    </div>
  );
}
