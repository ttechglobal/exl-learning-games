"use client";

/**
 * WorldsClient.tsx — Worlds Dashboard Redesign
 *
 * Architecture:
 *   - HUD header: XP bar, level, hearts, avatar — game-native chrome
 *   - Mode toggle: Play (game-first) vs Focus (subject-first, exam prep)
 *   - Arcade strip: standalone fun games (horizontal scroll), shown prominently in Play mode
 *   - Subject sections: learning games grouped by subject
 *   - Subject drill-down: tap subject → see its games fullscreen
 *   - Search: cross-subject game search
 *   - Continue banner: last played game
 *   - QuickPlay modal: difficulty picker bottom sheet (unchanged)
 *
 * Design tokens: only --eg-* from motion/tokens.css. Light/dark via [data-theme].
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTheme } from "@/components/ui/ThemeProvider";
import { subjectMeta } from "@/lib/content/subjects";
import { GAME_CARD_DESC } from "@/lib/content/gameCardMeta";
import { GameCardArt } from "@/components/ui/GameCardArt";
import { QuickPlayModal } from "@/components/ui/QuickPlayModal";
import type { GameRow, Difficulty } from "@/types/db";
import styles from "@/app/(player)/worlds/WorldsClient.module.css";

// ── Types ──────────────────────────────────────────────────────────────────────

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
}

// ── Constants ──────────────────────────────────────────────────────────────────

type YearClass = "JSS1" | "JSS2" | "JSS3" | "SS1" | "SS2" | "SS3" | "WAEC" | "JAMB";
const YEAR_CLASSES: YearClass[] = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3", "WAEC", "JAMB"];
const SUBJECT_ORDER = ["mathematics", "chemistry", "physics", "biology"];

type AppMode = "play" | "focus";

const SUBJECT_DESCRIPTIONS: Record<string, string> = {
  mathematics: "Algebra, formulas, equations and more",
  chemistry:   "Atoms, bonding, elements and reactions",
  physics:     "Forces, waves, electricity and optics",
  biology:     "Cells, ecology, genetics and systems",
};

// ── Static arcade games (not DB-backed, shown always) ────────────────────────
// These are standalone fun games. They don't need a DB row to show on the page.
// Add entries here as new games are built. isReady = false shows "Coming Soon".
interface StaticArcadeGameDef {
  slug: string;
  title: string;
  emoji: string;
  tagline: string;
  accentColor: string;
  isReady: boolean;
}

const STATIC_ARCADE_GAMES: StaticArcadeGameDef[] = [
  {
    slug: "whack-a-mole",
    title: "Whack-a-Mole",
    emoji: "🐹",
    tagline: "Tap critters across 5 waves",
    accentColor: "#f59e0b",
    isReady: true,
  },
  {
    slug: "element-crush",
    title: "Element Crush",
    emoji: "🍬",
    tagline: "Match element tiles",
    accentColor: "#00d4ff",
    isReady: false,
  },
  {
    slug: "symbol-drop",
    title: "Symbol Drop",
    emoji: "🎯",
    tagline: "Catch falling symbols",
    accentColor: "#4488ff",
    isReady: false,
  },
];

const RANKS = [
  { label: "Recruit",  min: 0,    icon: "🌱" },
  { label: "Cadet",    min: 100,  icon: "⚡" },
  { label: "Scholar",  min: 300,  icon: "📚" },
  { label: "Expert",   min: 600,  icon: "🎯" },
  { label: "Champion", min: 1000, icon: "🏆" },
  { label: "Legend",   min: 2000, icon: "🌟" },
];

function getRank(xp: number) {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (xp >= RANKS[i].min) return RANKS[i];
  }
  return RANKS[0];
}
function getNextRank(xp: number) {
  for (const r of RANKS) { if (xp < r.min) return r; }
  return null;
}
function topicLabel(topicId: string | null | undefined): string {
  if (!topicId) return "Game";
  return topicId.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

const LS_CLASS  = "exl-pref-class";
const LS_LAST   = "exl-last-played";
const LS_MODE   = "exl-pref-mode";
function safeLS(key: string, fb: string) { try { return localStorage.getItem(key) ?? fb; } catch { return fb; } }
function safeLSSet(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* noop */ } }

// ── Component ──────────────────────────────────────────────────────────────────

export function WorldsClient({ bySubject, currentStudentXp = 0, studentName }: WorldsClientProps) {
  const { theme, toggleTheme } = useTheme();

  const [selectedClass, setSelectedClass] = useState<YearClass>("JSS3");
  const [lastPlayed,    setLastPlayed]    = useState<string | null>(null);
  const [prefsLoaded,   setPrefsLoaded]   = useState(false);
  const [mode,          setMode]          = useState<AppMode>("play");

  // View: null = hub, string = drilled subject
  const [activeSubject, setActiveSubject] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const q = searchQuery.toLowerCase().trim();
  const isSearching = q.length > 0;

  // QuickPlay modal
  const [quickPlayGame, setQuickPlayGame] = useState<GameRow | null>(null);

  useEffect(() => {
    setSelectedClass(safeLS(LS_CLASS, "JSS3") as YearClass);
    setLastPlayed(safeLS(LS_LAST, "") || null);
    setMode((safeLS(LS_MODE, "play") as AppMode) || "play");
    setPrefsLoaded(true);
  }, []);

  const handleClassChange = useCallback((c: YearClass) => {
    setSelectedClass(c); safeLSSet(LS_CLASS, c);
  }, []);

  const handleModeChange = useCallback((m: AppMode) => {
    setMode(m); safeLSSet(LS_MODE, m);
    setActiveSubject(null);
  }, []);

  const handleGameClick = useCallback((slug: string) => {
    safeLSSet(LS_LAST, slug); setLastPlayed(slug);
  }, []);

  const allGames = useMemo(() => Object.values(bySubject).flat(), [bySubject]);

  const filterByClass = useCallback((games: GameSummary[]) =>
    games.filter(g => {
      const yg = g.game.year_groups ?? [];
      if (selectedClass !== "WAEC" && selectedClass !== "JAMB" && yg.length > 0) {
        return yg.includes(selectedClass);
      }
      return true;
    }), [selectedClass]);

  const searchResults = useMemo(() => {
    if (!q) return [];
    return allGames.filter(({ game }) => {
      const haystack = [game.title, game.subject, game.topic_id, GAME_CARD_DESC[game.slug] ?? ""]
        .join(" ").toLowerCase();
      return q.split(" ").every(w => haystack.includes(w));
    });
  }, [allGames, q]);

  // Subject stats
  const subjectStats = useMemo(() =>
    SUBJECT_ORDER.map(sub => {
      const games = filterByClass(bySubject[sub] ?? []);
      return { sub, games, count: games.length };
    }).filter(s => s.count > 0),
  [bySubject, filterByClass]);

  const lastPlayedGame = useMemo(() =>
    lastPlayed ? allGames.find(g => g.game.slug === lastPlayed) ?? null : null,
  [allGames, lastPlayed]);

  // XP
  const rank     = getRank(currentStudentXp);
  const nextRank = getNextRank(currentStudentXp);
  const xpToNext = nextRank ? nextRank.min - currentStudentXp : 0;
  const xpPct    = nextRank
    ? Math.round(((currentStudentXp - rank.min) / (nextRank.min - rank.min)) * 100)
    : 100;

  const activeSubjectGames = useMemo(() =>
    activeSubject ? filterByClass(bySubject[activeSubject] ?? []) : [],
  [activeSubject, bySubject, filterByClass]);

  const activeSubjectMeta = activeSubject ? subjectMeta(activeSubject) : null;
  const showSubjectView = activeSubject !== null && !isSearching;

  return (
    <div className={styles.page} data-theme={theme}>

      {/* ── AMBIENT BACKGROUND ── */}
      <div className={styles.ambient} aria-hidden="true">
        <div className={`${styles.ambientBlob} ${styles.blobA}`} />
        <div className={`${styles.ambientBlob} ${styles.blobB}`} />
      </div>

      {/* ── HUD HEADER ── */}
      <header className={styles.hud}>
        <div className={styles.hudInner}>

          {/* Left: logo or back button */}
          <div className={styles.hudLeft}>
            {showSubjectView ? (
              <button className={styles.backBtn} onClick={() => setActiveSubject(null)}>
                <span className={styles.backArrow}>←</span>
                <span className={styles.backLabel}>Back</span>
              </button>
            ) : (
              <Link href="/" className={styles.logo}>
                <div className={styles.logoMark}>E</div>
                <span className={styles.logoText}>EXL</span>
              </Link>
            )}
          </div>

          {/* Centre: title + XP bar (hub) or subject name (drill-down) */}
          <div className={styles.hudCenter}>
            {showSubjectView && activeSubjectMeta ? (
              <div className={styles.hudSubjectTitle}>
                <span>{activeSubjectMeta.emoji}</span>
                <span>{activeSubjectMeta.name}</span>
              </div>
            ) : isSearching ? (
              <div className={styles.hudTitleGroup}>
                <span className={styles.hudTitle}>Search</span>
              </div>
            ) : (
              <div className={styles.hudTitleGroup}>
                <span className={styles.hudTitle}>Worlds</span>
                {prefsLoaded && (
                  <div className={styles.hudXpBar}>
                    <div
                      className={styles.hudXpFill}
                      style={{ width: `${xpPct}%` }}
                    />
                  </div>
                )}
                {prefsLoaded && (
                  <span className={styles.hudXpLabel}>
                    {rank.icon} {rank.label} · {currentStudentXp > 0 ? `${currentStudentXp.toLocaleString()} XP` : "0 XP"}
                    {nextRank && <span className={styles.hudXpNext}> · {xpToNext} to {nextRank.label}</span>}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: search, class selector, hearts, theme, avatar */}
          <div className={styles.hudRight}>
            {/* Search box */}
            <div className={`${styles.searchBox} ${isSearching ? styles.searchBoxActive : ""}`}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                className={styles.searchInput}
                type="search"
                placeholder="Search…"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setActiveSubject(null); }}
              />
              {searchQuery && (
                <button className={styles.searchClear} onClick={() => setSearchQuery("")}>✕</button>
              )}
            </div>

            <select
              className={styles.classSelector}
              value={selectedClass}
              onChange={e => handleClassChange(e.target.value as YearClass)}
              aria-label="Select year class"
            >
              {YEAR_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <button className={styles.themeBtn} onClick={toggleTheme} aria-label="Toggle theme">
              {theme === "dark" ? "☀️" : "🌙"}
            </button>

            <Link href="/profile" className={styles.avatarBtn} aria-label="Your profile">
              <span className={styles.avatarInner}>
                {studentName ? studentName.slice(0, 2).toUpperCase() : "👤"}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <div className={styles.main}>

        {/* ══ SEARCH RESULTS ══ */}
        {isSearching && (
          <div className={styles.searchResults}>
            <p className={styles.searchResultsLabel}>
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;
            </p>
            {searchResults.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🔍</div>
                <p>No games found. Try a shorter search.</p>
              </div>
            ) : (
              <div className={styles.gameGrid}>
                {searchResults.map(({ game }) => {
                  const m = subjectMeta(game.subject);
                  return (
                    <GameCard
                      key={game.id}
                      game={game}
                      subjectColor={m.color}
                      subjectTint={m.tint}
                      subjectEmoji={m.emoji}
                      desc={GAME_CARD_DESC[game.slug]}
                      onPlay={() => setQuickPlayGame(game)}
                      onCardClick={() => handleGameClick(game.slug)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ SUBJECT DRILL-DOWN VIEW ══ */}
        {showSubjectView && activeSubjectMeta && (
          <div className={styles.subjectView}>
            <div
              className={styles.subjectHero}
              style={{ background: activeSubjectMeta.color }}
            >
              <div className={styles.subjectHeroEmoji}>{activeSubjectMeta.emoji}</div>
              <div className={styles.subjectHeroText}>
                <div className={styles.subjectHeroName}>{activeSubjectMeta.name}</div>
                <div className={styles.subjectHeroSub}>
                  {activeSubjectGames.length} game{activeSubjectGames.length !== 1 ? "s" : ""} available
                </div>
              </div>
            </div>

            {activeSubjectGames.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📡</div>
                <p>No games for {selectedClass} in this subject yet.</p>
              </div>
            ) : (
              <div className={styles.gameGrid}>
                {activeSubjectGames.map(({ game }) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    subjectColor={activeSubjectMeta.color}
                    subjectTint={activeSubjectMeta.tint}
                    subjectEmoji={activeSubjectMeta.emoji}
                    desc={GAME_CARD_DESC[game.slug]}
                    onPlay={() => setQuickPlayGame(game)}
                    onCardClick={() => handleGameClick(game.slug)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ HUB VIEW ══ */}
        {!isSearching && !showSubjectView && (
          <>
            {/* MODE SWITCHER — first thing the user sees */}
            <div className={styles.modeBar}>
              <div className={styles.modePills}>
                <button
                  className={`${styles.modePill} ${mode === "play" ? styles.modePillActive : ""}`}
                  onClick={() => handleModeChange("play")}
                >
                  🕹️ <span>Play</span>
                </button>
                <button
                  className={`${styles.modePill} ${mode === "focus" ? styles.modePillActive : ""}`}
                  onClick={() => handleModeChange("focus")}
                >
                  🎯 <span>Focus</span>
                </button>
              </div>
              <p className={styles.modeDesc}>
                {mode === "play"
                  ? "Pick a game and dive in. Choose your topic after."
                  : "Pick a subject first. Games become your study breaks."}
              </p>
            </div>

            {/* FOCUS BANNER */}
            {mode === "focus" && (
              <div className={styles.focusBanner}>
                <div className={styles.focusIco}>📚</div>
                <div className={styles.focusText}>
                  <div className={styles.focusTitle}>Focus session</div>
                  <div className={styles.focusSub}>Pick a subject → topic → play 3 rounds. A game break is offered after each session.</div>
                </div>
                <button className={styles.focusCta}>Set up →</button>
              </div>
            )}

            {/* CONTINUE — label floats above the card, card sits below it.
                The "Continue" text is not inside the card flex row — it's a
                separate element visually anchored above the card's top edge. */}
            {prefsLoaded && lastPlayedGame && (() => {
              const g = lastPlayedGame.game;
              const m = subjectMeta(g.subject);
              return (
                <div className={styles.continueWrap}>
                  <div className={styles.continueLabelRow}>
                    <div className={styles.continuePulse} />
                    <span className={styles.continueBannerLabel}>Continue where you left off</span>
                  </div>
                  <div className={styles.continueBanner}>
                    <div className={styles.continueBannerArt}>
                      <GameCardArt gameSlug={g.slug} emoji={m.emoji} color={m.color} tint={m.tint} />
                    </div>
                    <div className={styles.continueBannerBody}>
                      <div className={styles.continueBannerSubject} style={{ color: m.color }}>
                        {m.emoji} {m.name}
                      </div>
                      <div className={styles.continueBannerTitle}>{g.title}</div>
                    </div>
                    <Link
                      href={`/play/${g.slug}`}
                      className={styles.continueBannerBtn}
                      style={{ background: m.color }}
                      onClick={() => handleGameClick(g.slug)}
                    >
                      ▶ Play
                    </Link>
                  </div>
                </div>
              );
            })()}

            {/* ARCADE GAMES STRIP
                Always shown — these are standalone games not tied to the DB.
                Hardcoded here so the strip is visible even before a game row
                exists. Once a slug has a real /play/{slug} route, the link works.
                "Coming Soon" cards are shown for unbuilt games. */}
            <div className={`${styles.arcadeSection} ${mode === "focus" ? styles.arcadeDimmed : ""}`}>
              <div className={styles.sectionHead}>
                <span className={styles.sectionLabel}>🕹️ Arcade Games</span>
                <span className={styles.sectionTag}>Just for fun</span>
              </div>
              <div className={styles.arcadeScroll}>
                {STATIC_ARCADE_GAMES.map(ag => (
                  <StaticArcadeCard key={ag.slug} game={ag} />
                ))}
              </div>
            </div>

            {/* SUBJECT SECTIONS */}
            {mode === "focus" ? (
              /* Focus mode: prominent subject grid first */
              <>
                <div className={styles.sectionHead} style={{ marginTop: 28 }}>
                  <span className={styles.sectionLabel}>Choose a subject</span>
                </div>
                <div className={styles.subjectGrid}>
                  {subjectStats.map(({ sub, count }) => {
                    const m = subjectMeta(sub);
                    return (
                      <button
                        key={sub}
                        className={styles.subjectCard}
                        style={{ "--subject-color": m.color } as React.CSSProperties}
                        onClick={() => setActiveSubject(sub)}
                      >
                        <div className={styles.subjectCardGlow} style={{ background: m.color }} />
                        <div className={styles.subjectCardEmoji}>{m.emoji}</div>
                        <div className={styles.subjectCardName}>{m.name}</div>
                        <div className={styles.subjectCardDesc}>{SUBJECT_DESCRIPTIONS[sub] ?? ""}</div>
                        <div className={styles.subjectCardCount} style={{ color: m.color }}>
                          {count} game{count !== 1 ? "s" : ""} →
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              /* Play mode: subject sections each with their game cards */
              <>
                {subjectStats.map(({ sub, games }) => {
                  const m = subjectMeta(sub);
                  return (
                    <div key={sub} className={styles.subjectSection}>
                      <div className={styles.subjectSectionHead}>
                        <div
                          className={styles.subjectSectionIcon}
                          style={{ background: m.tint }}
                        >
                          {m.emoji}
                        </div>
                        <span className={styles.subjectSectionName} style={{ color: m.color }}>
                          {m.name}
                        </span>
                        <button
                          className={styles.subjectSectionAll}
                          style={{ color: m.color }}
                          onClick={() => setActiveSubject(sub)}
                        >
                          See all {games.length} →
                        </button>
                      </div>
                      <div className={styles.gameGrid}>
                        {games.slice(0, 4).map(({ game }) => (
                          <GameCard
                            key={game.id}
                            game={game}
                            subjectColor={m.color}
                            subjectTint={m.tint}
                            subjectEmoji={m.emoji}
                            desc={GAME_CARD_DESC[game.slug]}
                            onPlay={() => setQuickPlayGame(game)}
                            onCardClick={() => handleGameClick(game.slug)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {subjectStats.length === 0 && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📡</div>
                <p>No games available for {selectedClass} yet. Try a different class.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* QuickPlay modal */}
      <QuickPlayModal
        game={quickPlayGame}
        onClose={() => setQuickPlayGame(null)}
      />
    </div>
  );
}

// ── StaticArcadeCard ───────────────────────────────────────────────────────────
// Shows a standalone arcade game. isReady=true links to /play/{slug}.
// isReady=false shows a "Coming Soon" treatment — still visible but not clickable.

function StaticArcadeCard({ game }: { game: StaticArcadeGameDef }) {
  if (!game.isReady) {
    return (
      <div className={`${styles.arcadeCard} ${styles.arcadeCardSoon}`}>
        <div className={styles.arcadeCardArt} style={{ background: "var(--eg-surface-card-2)" }}>
          <span style={{ fontSize: 36 }}>{game.emoji}</span>
          <span className={styles.arcadeSoonBadge}>Soon</span>
        </div>
        <div className={styles.arcadeCardBody}>
          <div className={styles.arcadeCardTitle}>{game.title}</div>
          <div className={styles.arcadeCardMeta}>{game.tagline}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.arcadeCard}>
      <Link href={`/games/${game.slug}`} className={styles.arcadeCardInner}>
        <div className={styles.arcadeCardArt} style={{ background: `${game.accentColor}18` }}>
          <span style={{ fontSize: 40 }}>{game.emoji}</span>
        </div>
        <div className={styles.arcadeCardBody}>
          <div className={styles.arcadeCardTitle}>{game.title}</div>
          <div className={styles.arcadeCardMeta}>{game.tagline}</div>
        </div>
      </Link>
      <Link
        href={`/games/${game.slug}`}
        className={styles.arcadePlayBtn}
        style={{ background: game.accentColor }}
      >
        ▶ Play
      </Link>
    </div>
  );
}

// ── GameCard ───────────────────────────────────────────────────────────────────

interface GameCardProps {
  game: GameRow;
  subjectColor: string;
  subjectTint: string;
  subjectEmoji: string;
  desc: string | undefined;
  onPlay: () => void;
  onCardClick: () => void;
}

function GameCard({ game, subjectColor, subjectTint, subjectEmoji, desc, onPlay, onCardClick }: GameCardProps) {
  return (
    <div className={styles.gameCard}>
      <Link href={`/play/${game.slug}`} className={styles.gameCardInner} onClick={onCardClick}>
        <div className={styles.gameCardArt}>
          <GameCardArt gameSlug={game.slug} emoji={subjectEmoji} color={subjectColor} tint={subjectTint} />
        </div>
        <div className={styles.gameCardBody}>
          <div className={styles.gameCardTag} style={{ color: subjectColor, background: subjectTint }}>
            {topicLabel(game.topic_id)}
          </div>
          <div className={styles.gameCardTitle}>{game.title}</div>
          {desc && <p className={styles.gameCardDesc}>{desc}</p>}
        </div>
      </Link>
      <button
        className={styles.gameCardPlayBtn}
        style={{ background: subjectColor }}
        onClick={onPlay}
      >
        ▶ Play
      </button>
    </div>
  );
}