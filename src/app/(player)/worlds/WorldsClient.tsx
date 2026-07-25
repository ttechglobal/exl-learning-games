"use client";

/**
 * WorldsClient.tsx — EXL Learning World (Redesigned v2)
 *
 * Layout (single column, mobile-first):
 *   search bar
 *   subject tabs
 *   subject identity card  ← just tells you "this is Chemistry" — no game inside
 *   game list              ← ALL games for the subject, each with topic tag
 */

import Link from "next/link";
import { useState, useMemo } from "react";
import { useTheme } from "@/components/ui/ThemeProvider";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { subjectMeta } from "@/lib/content/subjects";
import { GAME_CARD_DESC } from "@/lib/content/gameCardMeta";
import { topicLabel } from "@/lib/content/gameTopics";
import { GameCardArt } from "@/components/ui/GameCardArt";
import type { GameRow, Difficulty } from "@/types/db";
import styles from "@/app/(player)/worlds/WorldsClient.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── World metadata ───────────────────────────────────────────────────────────

const WORLD_META: Record<string, {
  name: string;
  tagline: string;
  blurb: string;       // short 1-line shown in identity card
  glyph: string;
  color: string;
  colorRgb: string;
  gradient: string;
}> = {
  chemistry: {
    name: "Chemistry",
    tagline: "Build atoms, break bonds, see matter behave.",
    blurb: "Explore chemical reactions, atomic structure, and the periodic table through hands-on lab games.",
    glyph: "⚗️",
    color: "var(--eg-subject-chemistry)",
    colorRgb: "123,79,203",
    gradient: "linear-gradient(135deg, #1a0840 0%, #2d1260 50%, #180638 100%)",
  },
  mathematics: {
    name: "Mathematics",
    tagline: "Solve equations, construct proofs, own the numbers.",
    blurb: "Master algebra, geometry, and more — one equation, proof, or puzzle at a time.",
    glyph: "📐",
    color: "var(--eg-subject-mathematics)",
    colorRgb: "47,155,214",
    gradient: "linear-gradient(135deg, #031828 0%, #062848 50%, #041020 100%)",
  },
  physics: {
    name: "Physics",
    tagline: "Apply forces, trace light, move through space.",
    blurb: "Experiment with forces, waves, and optics — see the laws of physics play out in real time.",
    glyph: "⚡",
    color: "var(--eg-subject-physics)",
    colorRgb: "255,111,145",
    gradient: "linear-gradient(135deg, #200818 0%, #380820 50%, #1a0412 100%)",
  },
  biology: {
    name: "Biology",
    tagline: "Study cells, map ecosystems, decode life.",
    blurb: "Dive into cells, genetics, and ecology — the living world is more complex than you think.",
    glyph: "🧬",
    color: "var(--eg-subject-biology)",
    colorRgb: "76,175,110",
    gradient: "linear-gradient(135deg, #021408 0%, #082814 50%, #020e06 100%)",
  },
};

const ALL_SUBJECTS = ["chemistry", "mathematics", "physics", "biology"];

// ─── Component ────────────────────────────────────────────────────────────────

export function WorldsClient({
  bySubject,
  currentStudentXp,
}: WorldsClientProps) {
  const { theme, toggleTheme } = useTheme();

  const defaultSubject = ALL_SUBJECTS.find(s => (bySubject[s]?.length ?? 0) > 0) ?? "chemistry";
  const [activeSubject, setActiveSubject] = useState<string>(defaultSubject);
  const [query, setQuery]                 = useState("");

  const wm     = WORLD_META[activeSubject] ?? WORLD_META.chemistry;
  const sm     = subjectMeta(activeSubject);
  const games  = bySubject[activeSubject] ?? [];
  const isLive = games.length > 0;

  // Search filters all games by title, description, or topic label
  const filtered = useMemo(() => {
    if (!query.trim()) return games;
    const q = query.toLowerCase();
    return games.filter(({ game }) =>
      game.title.toLowerCase().includes(q) ||
      (GAME_CARD_DESC[game.slug] ?? "").toLowerCase().includes(q) ||
      topicLabel(game.topic_id).toLowerCase().includes(q)
    );
  }, [games, query]);

  return (
    <div
      className={styles.page}
      data-theme={theme}
      style={{ "--wc": wm.color, "--wrgb": wm.colorRgb } as React.CSSProperties}
    >
      {/* ── AMBIENT GLOW ── */}
      <div className={styles.ambient} aria-hidden="true">
        <div className={styles.ambientBlob1} />
        <div className={styles.ambientBlob2} />
      </div>

      <SiteHeader
        theme={theme}
        onToggleTheme={toggleTheme}
        active="games"
        currentStudentXp={currentStudentXp}
      />

      <div className={styles.shell}>

        {/* ── SEARCH BAR ── */}
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon} aria-hidden="true">🔍</span>
          <input
            className={styles.searchInput}
            type="search"
            placeholder="What do you want to learn?"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search games and topics"
          />
          {query && (
            <button className={styles.searchClear} onClick={() => setQuery("")} aria-label="Clear search">✕</button>
          )}
        </div>

        {/* ── SUBJECT TABS ── */}
        <div className={styles.tabs} role="tablist" aria-label="Subject worlds">
          {ALL_SUBJECTS.map(s => {
            const sm2  = subjectMeta(s);
            const wm2  = WORLD_META[s];
            const live = (bySubject[s]?.length ?? 0) > 0;
            return (
              <button
                key={s}
                role="tab"
                aria-selected={s === activeSubject}
                className={[styles.tab, s === activeSubject ? styles.tabActive : ""].filter(Boolean).join(" ")}
                style={{ "--twc": wm2?.color, "--twrgb": wm2?.colorRgb } as React.CSSProperties}
                onClick={() => { setActiveSubject(s); setQuery(""); }}
              >
                <span className={styles.tabGlyph}>{wm2?.glyph}</span>
                <span className={styles.tabName}>{sm2.name}</span>
                {!live && <span className={styles.tabSoon}>Soon</span>}
              </button>
            );
          })}
        </div>

        {/* ── SUBJECT IDENTITY CARD ── */}
        {!query && (
          <div
            className={styles.identityCard}
            style={{ background: wm.gradient } as React.CSSProperties}
          >
            <div className={styles.idGlyph} aria-hidden="true">{wm.glyph}</div>
            <div className={styles.idBody}>
              <div className={styles.idEyebrow}>{sm.emoji} {wm.name} World</div>
              <h2 className={styles.idTitle}>Start learning {wm.name}</h2>
              <p className={styles.idBlurb}>{wm.blurb}</p>
            </div>
            {/* Scroll-down invitation — sends eye to the game list */}
            <div className={styles.idCta}>Explore games ↓</div>
          </div>
        )}

        {/* ── GAME LIST ── */}
        <main className={styles.content}>
          {isLive ? (
            <div className={styles.gameList}>
              <div className={styles.gameListHeader}>
                {query
                  ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""} for "${query}"`
                  : `${games.length} game${games.length !== 1 ? "s" : ""} in ${wm.name}`
                }
              </div>

              {filtered.length === 0 && query ? (
                <div className={styles.emptySearch}>
                  <span className={styles.emptyGlyph}>🔍</span>
                  <p>No games match <strong>"{query}"</strong></p>
                  <button className={styles.emptyClear} onClick={() => setQuery("")}>Clear search</button>
                </div>
              ) : (
                filtered.map(({ game, missionCount, xpMax }) => (
                  <Link key={game.id} href={`/play/${game.slug}`} className={styles.gameRow}>

                    {/* Art thumbnail */}
                    <div className={styles.gameRowArt}>
                      <GameCardArt
                        gameSlug={game.slug}
                        emoji={sm.emoji}
                        color={sm.color}
                        tint={sm.tint}
                      />
                    </div>

                    {/* Info */}
                    <div className={styles.gameRowInfo}>
                      <div className={styles.gameRowName}>{game.title}</div>
                      <div className={styles.gameRowDesc}>
                        {GAME_CARD_DESC[game.slug] ?? ""}
                      </div>
                      {/* Topic · XP · missions */}
                      <div className={styles.gameRowMeta}>
                        <span className={styles.gameRowTopic}>
                          {topicLabel(game.topic_id)}
                        </span>
                        <span className={styles.gameRowXp}>
                          +{xpMax} XP
                        </span>
                        <span className={styles.gameRowMissions}>
                          {missionCount} mission{missionCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    {/* Play CTA */}
                    <div className={styles.gameRowCta}>Play →</div>
                  </Link>
                ))
              )}
            </div>
          ) : (
            <div className={styles.comingSoon}>
              <div className={styles.csGlyph}>{wm.glyph}</div>
              <h2 className={styles.csTitle}>{wm.name} World — Coming Soon</h2>
              <p className={styles.csSub}>
                Games for this world are in development. Chemistry is live now — start there while we build the rest.
              </p>
              <button className={styles.csSwitchBtn} onClick={() => setActiveSubject("chemistry")}>
                ⚗️ Go to Chemistry World
              </button>
            </div>
          )}
        </main>

      </div>
    </div>
  );
}