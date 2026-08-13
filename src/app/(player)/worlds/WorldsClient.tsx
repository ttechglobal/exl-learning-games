"use client";

/**
 * WorldsClient.tsx — EXL Learning World (Immersive Dark Redesign)
 *
 * Visual direction: matches the AI-generated mockup —
 *   - Full-page dark (#0a0b14) base, no light mode on this page
 *   - Subject identity card uses an AI-generated world scene image as background
 *   - Rank hero card with progress bar
 *   - Continue shortcut bar
 *   - Horizontal subject tabs with active fill
 *   - Vertical game list rows (not grid cards)
 *
 * Each subject world has a unique scene image sourced from /public/worlds/
 * e.g. /worlds/chemistry.jpg, /worlds/mathematics.jpg, etc.
 * These are AI-generated illustrations of the subject world environment.
 * If an image doesn't exist yet, the card falls back to the subject gradient.
 */

import Link from "next/link";
import { useState, useMemo } from "react";
import { useTheme } from "@/components/ui/ThemeProvider";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { subjectMeta } from "@/lib/content/subjects";
import { GAME_CARD_DESC } from "@/lib/content/gameCardMeta";
import { topicLabel } from "@/lib/content/gameTopics";
import { GameCardArt } from "@/components/ui/GameCardArt";
import { getRank, getNextRank, getRankProgress, getXpToNextRank } from "@/lib/content/ranks";
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
  studentName?: string;
  lastPlayedGameSlug?: string;
  lastPlayedMissionNumber?: number;
  lastPlayedMissionTotal?: number;
}

// ─── World config ─────────────────────────────────────────────────────────────

const WORLD_CONFIG: Record<string, {
  label: string;
  tagline: string;
  blurb: string;
  emoji: string;
  /** Subject accent hex (used for tab + bar fills) */
  accentHex: string;
  accentRgb: string;
  /** Dark atmospheric gradient fallback when no scene image */
  gradient: string;
  /** Path under /public e.g. /worlds/chemistry.jpg */
  sceneImage: string;
}> = {
  chemistry: {
    label: "Chemistry",
    tagline: "Build atoms, break bonds, see matter behave.",
    blurb: "Explore atomic structure, chemical bonding, and the periodic table through hands-on lab games.",
    emoji: "⚗️",
    accentHex: "#9b6dff",
    accentRgb: "155,109,255",
    gradient: "linear-gradient(160deg, #12073a 0%, #1e0b52 50%, #0a0520 100%)",
    sceneImage: "/worlds/chemistry.jpg",
  },
  mathematics: {
    label: "Mathematics",
    tagline: "Solve equations, construct proofs, own the numbers.",
    blurb: "Master algebra, geometry and more — one equation, proof, or puzzle at a time.",
    emoji: "📐",
    accentHex: "#4a9eff",
    accentRgb: "74,158,255",
    gradient: "linear-gradient(160deg, #031828 0%, #062848 50%, #020f1f 100%)",
    sceneImage: "/worlds/mathematics.jpg",
  },
  physics: {
    label: "Physics",
    tagline: "Apply forces, trace light, move through space.",
    blurb: "Experiment with forces, waves, and optics — see the laws of physics play out in real time.",
    emoji: "⚡",
    accentHex: "#ff5e8a",
    accentRgb: "255,94,138",
    gradient: "linear-gradient(160deg, #1e0512 0%, #380820 50%, #100208 100%)",
    sceneImage: "/worlds/physics.jpg",
  },
  biology: {
    label: "Biology",
    tagline: "Study cells, map ecosystems, decode life.",
    blurb: "Dive into cells, genetics, and ecology — the living world is more complex than you think.",
    emoji: "🧬",
    accentHex: "#3ecf7a",
    accentRgb: "62,207,122",
    gradient: "linear-gradient(160deg, #021408 0%, #082814 50%, #010a04 100%)",
    sceneImage: "/worlds/biology.jpg",
  },
};

const SUBJECT_ORDER = ["chemistry", "mathematics", "physics", "biology"];

// ─── Rank Hero ────────────────────────────────────────────────────────────────

function RankHero({ xp, name }: { xp: number; name?: string }) {
  const rank = getRank(xp);
  const next = getNextRank(xp);
  const progress = getRankProgress(xp);
  const xpToNext = getXpToNextRank(xp);

  return (
    <div className={styles.rankCard}>
      {/* Left: greeting + rank */}
      <div className={styles.rankLeft}>
        <p className={styles.rankGreeting}>
          Hey, <span className={styles.rankName}>{name?.split(" ")[0] ?? "Explorer"}</span>
          <span className={styles.rankWave} aria-hidden>👋</span>
        </p>
        <div className={styles.rankBadgeRow}>
          <span className={styles.rankIcon}>{rank.icon}</span>
          <span className={styles.rankLabel}>{rank.label}</span>
          <span className={styles.rankXpPill}>{xp.toLocaleString()} XP</span>
        </div>
        {/* Progress bar */}
        <div className={styles.barTrack}>
          <div
            className={styles.barFill}
            style={{ width: `${progress}%`, background: rank.color } as React.CSSProperties}
          />
        </div>
      </div>
      {/* Right: next rank */}
      {next && (
        <div className={styles.rankRight}>
          <span className={styles.nextLabel}>NEXT RANK</span>
          <span className={styles.nextName}>{next.label}</span>
          <span className={styles.nextXp}>{xpToNext.toLocaleString()} XP away</span>
        </div>
      )}
    </div>
  );
}

// ─── WorldsClient ─────────────────────────────────────────────────────────────

export function WorldsClient({
  bySubject,
  currentStudentXp,
  studentName,
  lastPlayedGameSlug,
  lastPlayedMissionNumber,
  lastPlayedMissionTotal,
}: WorldsClientProps) {
  const { theme, toggleTheme } = useTheme();

  const defaultSubject =
    SUBJECT_ORDER.find((s) => (bySubject[s]?.length ?? 0) > 0) ?? "chemistry";
  const [active, setActive] = useState(defaultSubject);
  const [query, setQuery] = useState("");

  const wc = WORLD_CONFIG[active] ?? WORLD_CONFIG.chemistry;
  const sm = subjectMeta(active);
  const games = bySubject[active] ?? [];
  const isLive = games.length > 0;

  // Continue shortcut: find last-played game across all subjects
  const lastPlayedSummary = useMemo(() => {
    if (!lastPlayedGameSlug) return null;
    for (const summaries of Object.values(bySubject)) {
      const found = summaries.find((s) => s.game.slug === lastPlayedGameSlug);
      if (found) return found;
    }
    return null;
  }, [bySubject, lastPlayedGameSlug]);

  // Search across current subject's games
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
    // Always dark — this page has its own full-dark identity
    <div className={styles.page} data-theme="dark">
      <SiteHeader
        theme={theme}
        onToggleTheme={toggleTheme}
        active="games"
        currentStudentXp={currentStudentXp}
      />

      <div className={styles.layout}>

        {/* ── RANK CARD ── */}
        {typeof currentStudentXp === "number" && (
          <RankHero xp={currentStudentXp} name={studentName} />
        )}

        {/* ── CONTINUE BAR ── */}
        {lastPlayedSummary && (
          <Link href={`/play/${lastPlayedSummary.game.slug}`} className={styles.continueBar}>
            <span className={styles.continuePlay} aria-hidden>▶</span>
            <div className={styles.continueBody}>
              <span className={styles.continueEyebrow}>Continue your journey</span>
              <span className={styles.continueTitle}>{lastPlayedSummary.game.title}</span>
              {lastPlayedMissionNumber != null && lastPlayedMissionTotal != null && (
                <span className={styles.continueSub}>
                  Mission {lastPlayedMissionNumber} of {lastPlayedMissionTotal}
                </span>
              )}
            </div>
            <span className={styles.continueArrow} aria-hidden>→</span>
          </Link>
        )}

        {/* ── SEARCH ── */}
        <div className={styles.searchRow}>
          <span className={styles.searchEmoji} aria-hidden>🔍</span>
          <input
            className={styles.searchInput}
            type="search"
            placeholder="What do you want to learn?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search games and topics"
          />
          {query && (
            <button className={styles.searchClear} onClick={() => setQuery("")} aria-label="Clear">
              ✕
            </button>
          )}
        </div>

        {/* ── SUBJECT TABS ── */}
        <div className={styles.tabs} role="tablist">
          {SUBJECT_ORDER.map((s) => {
            const wc2 = WORLD_CONFIG[s];
            const live = (bySubject[s]?.length ?? 0) > 0;
            const isActive = s === active;
            return (
              <button
                key={s}
                role="tab"
                aria-selected={isActive}
                className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
                style={
                  isActive
                    ? ({
                        "--tab-accent": wc2.accentHex,
                        "--tab-accent-rgb": wc2.accentRgb,
                      } as React.CSSProperties)
                    : undefined
                }
                onClick={() => { setActive(s); setQuery(""); }}
              >
                <span className={styles.tabEmoji}>{wc2.emoji}</span>
                <span className={styles.tabLabel}>{wc2.label}</span>
                {!live && <span className={styles.tabSoon}>Soon</span>}
              </button>
            );
          })}
        </div>

        {/* ── WORLD IDENTITY CARD ── */}
        {!query && (
          <div
            className={styles.worldCard}
            style={{ background: wc.gradient } as React.CSSProperties}
          >
            {/* Scene image — positioned right side */}
            <img
              src={wc.sceneImage}
              alt=""
              className={styles.worldScene}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            {/* Overlay gradient to ensure left text is readable */}
            <div className={styles.worldOverlay} />
            {/* Content */}
            <div className={styles.worldContent}>
              <div className={styles.worldEyebrow}>✦ YOUR WORLD</div>
              <h1 className={styles.worldTitle}>{wc.label} World</h1>
              <p className={styles.worldTagline}>{wc.tagline}</p>
              <button
                className={styles.worldCta}
                style={{ "--wc-accent": wc.accentHex } as React.CSSProperties}
                onClick={() => {
                  document.getElementById("game-list")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Enter {wc.label} World →
              </button>
            </div>
          </div>
        )}

        {/* ── GAME LIST ── */}
        <section id="game-list" className={styles.gameSection}>
          {isLive ? (
            <>
              <div className={styles.gameCount}>
                {query
                  ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""} in ${wc.label}`
                  : `${games.length} game${games.length !== 1 ? "s" : ""} in ${wc.label} World`
                }
              </div>

              <div className={styles.gameList}>
                {filtered.length === 0 && query ? (
                  <div className={styles.emptySearch}>
                    <div className={styles.emptyIcon}>🔍</div>
                    <p>No games match <strong>"{query}"</strong></p>
                    <button className={styles.emptyBtn} onClick={() => setQuery("")}>Clear search</button>
                  </div>
                ) : (
                  filtered.map(({ game, missionCount, xpMax }) => (
                    <Link
                      key={game.id}
                      href={`/play/${game.slug}`}
                      className={styles.gameRow}
                      style={{ "--gr-accent": wc.accentHex, "--gr-rgb": wc.accentRgb } as React.CSSProperties}
                    >
                      {/* Thumbnail */}
                      <div className={styles.gameThumb}>
                        <GameCardArt
                          gameSlug={game.slug}
                          emoji={sm.emoji}
                          color={sm.color}
                          tint={sm.tint}
                        />
                      </div>
                      {/* Info */}
                      <div className={styles.gameInfo}>
                        <div className={styles.gameTitle}>{game.title}</div>
                        <div className={styles.gameDesc}>{GAME_CARD_DESC[game.slug] ?? ""}</div>
                        <div className={styles.gameMeta}>
                          <span className={styles.gameTopic}>{topicLabel(game.topic_id)}</span>
                          <span className={styles.gameXp}>+{xpMax} XP</span>
                          <span className={styles.gameMissions}>
                            {missionCount} mission{missionCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      {/* CTA */}
                      <div
                        className={styles.gamePlay}
                        style={{ background: wc.accentHex } as React.CSSProperties}
                      >
                        Play →
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className={styles.comingSoon}>
              <div className={styles.csEmoji}>{wc.emoji}</div>
              <h2 className={styles.csTitle}>{wc.label} World is coming soon</h2>
              <p className={styles.csSub}>
                Games for this world are in development. Chemistry is live now — start there.
              </p>
              <button className={styles.csBtn} onClick={() => setActive("chemistry")}>
                ⚗️ Go to Chemistry World
              </button>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}