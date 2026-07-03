"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { DepthBackdrop } from "@/motion/DepthBackdrop";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { useTheme } from "@/components/ui/ThemeProvider";
import { subjectMeta } from "@/lib/content/subjects";
import { GAME_CARD_DESC } from "@/lib/content/gameCardMeta";
import { GameCardArt } from "@/components/ui/GameCardArt";
import type { GameRow, Difficulty } from "@/types/db";
import styles from "@/app/(player)/worlds/WorldsClient.module.css";

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
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [activeTopicFilter, setActiveTopicFilter] = useState<string>("all");
  const [activeSubjectFilter, setActiveSubjectFilter] = useState<string>("all");

  const allSubjects = Object.entries(bySubject).filter(([, g]) => g.length > 0);
  const subjects = activeSubjectFilter === "all"
    ? allSubjects
    : allSubjects.filter(([key]) => key === activeSubjectFilter);
  const totalGames = allSubjects.reduce((s, [, g]) => s + g.length, 0);
  const primaryAccent = allSubjects.length > 0
    ? subjectMeta(allSubjects[0][0]).color
    : "var(--eg-brand)";

  // ALL hooks at the top — never inside a conditional branch
  const expandedGames = useMemo(
    () => (expandedSubject ? (bySubject[expandedSubject] ?? []) : []),
    [expandedSubject, bySubject]
  );

  const expandedTopics = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const { game } of expandedGames) {
      if (!seen.has(game.topic_id)) {
        seen.add(game.topic_id);
        out.push(game.topic_id);
      }
    }
    return out;
  }, [expandedGames]);

  const filteredGames = useMemo(
    () =>
      activeTopicFilter === "all"
        ? expandedGames
        : expandedGames.filter(({ game }) => game.topic_id === activeTopicFilter),
    [expandedGames, activeTopicFilter]
  );

  // ── Expanded view ─────────────────────────────────────────────────────────
  if (expandedSubject) {
    const meta = subjectMeta(expandedSubject);
    const showTabs = expandedTopics.length > 1;

    return (
      <div className={styles.page} data-theme={theme}>
        <SiteHeader theme={theme} onToggleTheme={toggleTheme} active="games" />

        <div className={styles.titleRow}>
          <DepthBackdrop accentColor={meta.color} />
          <div className={styles.container}>
            <button
              className={styles.backBtn}
              onClick={() => { setExpandedSubject(null); setActiveTopicFilter("all"); }}
            >
              ← All Worlds
            </button>
            <h1 className={styles.pageTitle}>{meta.emoji} {meta.name}</h1>
            <p className={styles.pageSubtitle}>
              {expandedGames.length} game{expandedGames.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {showTabs && (
          <div className={styles.tabsWrap}>
            <div className={styles.tabsScroll}>
              <button
                className={`${styles.tab} ${activeTopicFilter === "all" ? styles.tabActive : ""}`}
                style={activeTopicFilter === "all" ? { borderColor: meta.color, color: meta.color } : {}}
                onClick={() => setActiveTopicFilter("all")}
              >
                All
              </button>
              {expandedTopics.map((t) => (
                <button
                  key={t}
                  className={`${styles.tab} ${activeTopicFilter === t ? styles.tabActive : ""}`}
                  style={activeTopicFilter === t ? { borderColor: meta.color, color: meta.color } : {}}
                  onClick={() => setActiveTopicFilter(t)}
                >
                  {topicLabel(t)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={styles.container}>
          <div className={styles.gameGrid}>
            {filteredGames.length === 0 && (
              <p className={styles.emptyText}>No games for this topic yet.</p>
            )}
            {filteredGames.map(({ game }) => (
              <Link key={game.id} href={`/play/${game.slug}`} className={styles.gameCard}>
                <div className={styles.gameCardArt}>
                  <GameCardArt gameSlug={game.slug} emoji={meta.emoji} color={meta.color} tint={meta.tint} />
                </div>
                <div className={styles.gameCardBody}>
                  <div className={styles.gameCardTag} style={{ color: meta.color, background: meta.tint }}>
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

  // ── Overview rows ─────────────────────────────────────────────────────────
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

      {/* Subject filter pills */}
      {allSubjects.length > 1 && (
        <div className={styles.subjectFilterRow}>
          <button
            className={`${styles.subjectPill} ${activeSubjectFilter === "all" ? styles.subjectPillActive : ""}`}
            onClick={() => setActiveSubjectFilter("all")}
          >
            🌍 All
          </button>
          {allSubjects.map(([key]) => {
            const m = subjectMeta(key);
            return (
              <button
                key={key}
                className={`${styles.subjectPill} ${activeSubjectFilter === key ? styles.subjectPillActive : ""}`}
                style={activeSubjectFilter === key ? { borderColor: m.color, color: m.color, background: m.tint } as React.CSSProperties : {}}
                onClick={() => setActiveSubjectFilter(activeSubjectFilter === key ? "all" : key)}
              >
                {m.emoji} {m.name}
              </button>
            );
          })}
        </div>
      )}

      <div className={styles.overviewWrap}>
        {subjects.length === 0 && (
          <p className={styles.emptyText}>No games yet — check back soon.</p>
        )}
        {subjects.map(([subject, games]) => {
          const meta = subjectMeta(subject);
          return (
            <section key={subject} className={styles.subjectSection}>
              <div className={styles.sectionHead}>
                <span className={styles.sectionEmoji}>{meta.emoji}</span>
                <h2 className={styles.sectionName}>{meta.name}</h2>
                <span className={styles.sectionCount}>{games.length}</span>
                <button className={styles.viewAllBtn} onClick={() => setExpandedSubject(subject)}>
                  View All →
                </button>
              </div>
              <div className={styles.scrollRow}>
                {games.map(({ game }) => (
                  <Link key={game.id} href={`/play/${game.slug}`} className={styles.miniCard}>
                    <div className={styles.miniCardArt} style={{ background: meta.tint }}>
                      <GameCardArt gameSlug={game.slug} emoji={meta.emoji} color={meta.color} tint={meta.tint} />
                    </div>
                    <div className={styles.miniCardBody}>
                      <div className={styles.miniCardTag} style={{ color: meta.color, background: meta.tint }}>
                        {topicLabel(game.topic_id)}
                      </div>
                      <div className={styles.miniCardTitle}>{game.title}</div>
                      {GAME_CARD_DESC[game.slug] && (
                        <p className={styles.miniCardDesc}>{GAME_CARD_DESC[game.slug]}</p>
                      )}
                    </div>
                  </Link>
                ))}
                <button className={styles.seeAllTile} onClick={() => setExpandedSubject(subject)}>
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