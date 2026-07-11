"use client";

/**
 * WorldsClient.tsx — Worlds Dashboard v4
 *
 * Play mode:
 *   - Arcade games centrepiece (2-row grid, "See all" expands)
 *   - Subject sections below, max 2 games each + "See all →"
 *   - No continue banner
 *
 * Focus mode:
 *   - Search bar ("What do you want to study?")
 *   - Subject cards (no left-border outline treatment)
 *   - Continue banner (only here)
 *   - No arcade strip
 *
 * Both modes:
 *   - Rank badge visible in page (not buried in HUD)
 *   - Leaderboard CTA at bottom of page
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
  mathematics: "Algebra, formulas, equations",
  chemistry:   "Atoms, bonding, reactions",
  physics:     "Forces, waves, electricity",
  biology:     "Cells, genetics, ecology",
};

// ── Static arcade games ────────────────────────────────────────────────────────

interface StaticArcadeGameDef {
  slug: string;
  title: string;
  emoji: string;
  tagline: string;
  accentColor: string;
  isReady: boolean;
}

const STATIC_ARCADE_GAMES: StaticArcadeGameDef[] = [
  { slug: "whack-a-mole",  title: "Whack-a-Mole",  emoji: "🐹", tagline: "Tap critters across 5 waves",    accentColor: "#f59e0b", isReady: true  },
  { slug: "math-quest",    title: "Math Quest",     emoji: "⛳", tagline: "Golf + maths = one more hole",   accentColor: "#4ade80", isReady: true  },
  { slug: "element-crush", title: "Element Crush",  emoji: "🍬", tagline: "Match element tiles",            accentColor: "#00d4ff", isReady: false },
  { slug: "symbol-drop",   title: "Symbol Drop",    emoji: "🎯", tagline: "Catch falling symbols",          accentColor: "#a78bfa", isReady: false },
];

// ── Ranks ──────────────────────────────────────────────────────────────────────

const RANKS = [
  { label: "Recruit",  min: 0,    icon: "🌱", color: "#6b7280" },
  { label: "Cadet",    min: 100,  icon: "⚡", color: "#3b82f6" },
  { label: "Scholar",  min: 300,  icon: "📚", color: "#8b5cf6" },
  { label: "Expert",   min: 600,  icon: "🎯", color: "#f59e0b" },
  { label: "Champion", min: 1000, icon: "🏆", color: "#ef4444" },
  { label: "Legend",   min: 2000, icon: "🌟", color: "#ec4899" },
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

const LS_CLASS = "exl-pref-class";
const LS_LAST  = "exl-last-played";
const LS_MODE  = "exl-pref-mode";
function safeLS(key: string, fb: string) { try { return localStorage.getItem(key) ?? fb; } catch { return fb; } }
function safeLSSet(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* */ } }

// ── Component ──────────────────────────────────────────────────────────────────

export function WorldsClient({ bySubject, currentStudentXp = 0, studentName }: WorldsClientProps) {
  const { theme, toggleTheme } = useTheme();

  const [selectedClass, setSelectedClass] = useState<YearClass>("JSS3");
  const [lastPlayed,    setLastPlayed]    = useState<string | null>(null);
  const [prefsLoaded,   setPrefsLoaded]   = useState(false);
  const [mode,          setMode]          = useState<AppMode>("play");
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [arcadeExpanded, setArcadeExpanded] = useState(false);
  const [focusSearch,   setFocusSearch]  = useState("");

  // HUD search (Play mode / global)
  const [searchQuery, setSearchQuery] = useState("");
  const q = searchQuery.toLowerCase().trim();
  const isSearching = q.length > 0;

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
    setSearchQuery("");
    setFocusSearch("");
    setArcadeExpanded(false);
  }, []);

  const handleGameClick = useCallback((slug: string) => {
    safeLSSet(LS_LAST, slug); setLastPlayed(slug);
  }, []);

  const allGames = useMemo(() => Object.values(bySubject).flat(), [bySubject]);

  const filterByClass = useCallback((games: GameSummary[]) =>
    games.filter(g => {
      const yg = g.game.year_groups ?? [];
      if (!["WAEC", "JAMB"].includes(selectedClass) && yg.length > 0) {
        return yg.includes(selectedClass);
      }
      return true;
    }), [selectedClass]);

  const searchResults = useMemo(() => {
    if (!q) return [];
    return allGames.filter(({ game }) => {
      const hay = [game.title, game.subject, game.topic_id, GAME_CARD_DESC[game.slug] ?? ""].join(" ").toLowerCase();
      return q.split(" ").every(w => hay.includes(w));
    });
  }, [allGames, q]);

  // Focus mode search: filter subjects + games by the focus search term
  const fq = focusSearch.toLowerCase().trim();
  const focusFilteredSubjects = useMemo(() => {
    return SUBJECT_ORDER.map(sub => {
      const games = filterByClass(bySubject[sub] ?? []);
      if (!fq) return { sub, games, count: games.length };
      // match subject name or any game title/topic
      const subMeta = subjectMeta(sub);
      const subMatch = subMeta.name.toLowerCase().includes(fq) || SUBJECT_DESCRIPTIONS[sub]?.toLowerCase().includes(fq);
      const matchedGames = games.filter(({ game }) => {
        const hay = [game.title, game.topic_id, GAME_CARD_DESC[game.slug] ?? ""].join(" ").toLowerCase();
        return hay.includes(fq);
      });
      if (subMatch) return { sub, games, count: games.length };
      return { sub, games: matchedGames, count: matchedGames.length };
    }).filter(s => s.count > 0);
  }, [bySubject, filterByClass, fq]);

  const subjectStats = useMemo(() =>
    SUBJECT_ORDER.map(sub => {
      const games = filterByClass(bySubject[sub] ?? []);
      return { sub, games, count: games.length };
    }).filter(s => s.count > 0),
  [bySubject, filterByClass]);

  const lastPlayedGame = useMemo(() =>
    lastPlayed ? allGames.find(g => g.game.slug === lastPlayed) ?? null : null,
  [allGames, lastPlayed]);

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
  const showSubjectView   = activeSubject !== null && !isSearching;

  // How many arcade rows to show (2 cards per row in scroll, show first row = 2 cards)
  const visibleArcadeGames = arcadeExpanded ? STATIC_ARCADE_GAMES : STATIC_ARCADE_GAMES.slice(0, 2);

  return (
    <div className={styles.page} data-theme={theme}>

      {/* Ambient grid + blobs */}
      <div className={styles.ambient} aria-hidden="true">
        <div className={`${styles.ambientBlob} ${styles.blobA}`} />
        <div className={`${styles.ambientBlob} ${styles.blobB}`} />
      </div>

      {/* ── HUD ── */}
      <header className={styles.hud}>
        <div className={styles.hudInner}>

          <div className={styles.hudLeft}>
            {showSubjectView ? (
              <button className={styles.backBtn} onClick={() => setActiveSubject(null)}>
                <span>←</span>
                <span className={styles.backLabel}>Back</span>
              </button>
            ) : (
              <Link href="/" className={styles.logo}>
                <div className={styles.logoMark}>E</div>
                <span className={styles.logoText}>EXL</span>
              </Link>
            )}
          </div>

          <div className={styles.hudCenter}>
            {showSubjectView && activeSubjectMeta ? (
              <div className={styles.hudSubjectTitle}>
                <span>{activeSubjectMeta.emoji}</span>
                <span>{activeSubjectMeta.name}</span>
              </div>
            ) : (
              <span className={styles.hudTitle}>Worlds</span>
            )}
          </div>

          <div className={styles.hudRight}>
            {/* Search — only in play mode hub */}
            {!showSubjectView && mode === "play" && (
              <div className={`${styles.searchBox} ${isSearching ? styles.searchBoxActive : ""}`}>
                <span className={styles.searchIcon}>🔍</span>
                <input
                  className={styles.searchInput}
                  type="search"
                  placeholder="Search games…"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setActiveSubject(null); }}
                />
                {searchQuery && (
                  <button className={styles.searchClear} onClick={() => setSearchQuery("")}>✕</button>
                )}
              </div>
            )}

            <select
              className={styles.classSelector}
              value={selectedClass}
              onChange={e => handleClassChange(e.target.value as YearClass)}
              aria-label="Select year class"
            >
              {YEAR_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Rank chip — compact in HUD, always visible */}
            {prefsLoaded && !showSubjectView && (
              <div className={styles.hudRankChip} style={{ "--rank-color": rank.color } as React.CSSProperties}
                title={`${rank.label} · ${currentStudentXp.toLocaleString()} XP`}>
                <span className={styles.hudRankIcon}>{rank.icon}</span>
                <span className={styles.hudRankLabel}>{rank.label}</span>
                <div className={styles.hudRankBar}>
                  <div className={styles.hudRankFill} style={{ width: `${xpPct}%`, background: rank.color }} />
                </div>
              </div>
            )}

            <button className={styles.themeBtn} onClick={toggleTheme} aria-label="Toggle theme">
              {theme === "dark" ? "☀️" : "🌙"}
            </button>

            <Link href="/profile" className={styles.avatarBtn} aria-label="Profile">
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
        {isSearching && mode === "play" && (
          <div className={styles.searchResults}>
            <div className={styles.searchResultsMeta}>
              <span>{searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;</span>
              <button className={styles.searchResultsClear} onClick={() => setSearchQuery("")}>Clear</button>
            </div>
            {searchResults.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🔍</div>
                <p>No games matched. Try a different word.</p>
              </div>
            ) : (
              <div className={styles.gameGrid}>
                {searchResults.map(({ game }) => {
                  const m = subjectMeta(game.subject);
                  return (
                    <GameCard key={game.id} game={game}
                      subjectColor={m.color} subjectTint={m.tint} subjectEmoji={m.emoji}
                      desc={GAME_CARD_DESC[game.slug]}
                      onPlay={() => setQuickPlayGame(game)}
                      onCardClick={() => handleGameClick(game.slug)} />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ SUBJECT DRILL-DOWN ══ */}
        {showSubjectView && activeSubjectMeta && (
          <div className={styles.subjectView}>
            <div className={styles.subjectHero} style={{ background: activeSubjectMeta.color }}>
              <span className={styles.subjectHeroEmoji}>{activeSubjectMeta.emoji}</span>
              <div>
                <div className={styles.subjectHeroName}>{activeSubjectMeta.name}</div>
                <div className={styles.subjectHeroSub}>{activeSubjectGames.length} game{activeSubjectGames.length !== 1 ? "s" : ""} available</div>
              </div>
            </div>
            {activeSubjectGames.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📡</div>
                <p>No games for {selectedClass} yet.</p>
              </div>
            ) : (
              <div className={styles.gameGrid}>
                {activeSubjectGames.map(({ game }) => (
                  <GameCard key={game.id} game={game}
                    subjectColor={activeSubjectMeta.color} subjectTint={activeSubjectMeta.tint} subjectEmoji={activeSubjectMeta.emoji}
                    desc={GAME_CARD_DESC[game.slug]}
                    onPlay={() => setQuickPlayGame(game)}
                    onCardClick={() => handleGameClick(game.slug)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ HUB ══ */}
        {!isSearching && !showSubjectView && (
          <>
            {/* MODE SWITCHER — clean, no rank here (rank lives in HUD) */}
            <div className={styles.modeRow}>
              <div className={styles.modePills}>
                <button
                  className={`${styles.modePill} ${mode === "play" ? styles.modePillActive : ""}`}
                  onClick={() => handleModeChange("play")}
                >
                  🕹️ Play
                </button>
                <button
                  className={`${styles.modePill} ${mode === "focus" ? styles.modePillActive : ""}`}
                  onClick={() => handleModeChange("focus")}
                >
                  🎯 Focus
                </button>
              </div>
            </div>

            {/* ── PLAY MODE ── */}
            {mode === "play" && (
              <>
                {/* Arcade centrepiece — horizontal scroll, expand to grid */}
                <div className={styles.arcadeSection}>
                  <div className={styles.sectionHead}>
                    <span className={styles.sectionLabel}>🕹️ Arcade</span>
                    <button
                      className={styles.seeAllBtn}
                      onClick={() => setArcadeExpanded(e => !e)}
                    >
                      {arcadeExpanded ? "Show less" : `See all ${STATIC_ARCADE_GAMES.length} →`}
                    </button>
                  </div>
                  <div className={arcadeExpanded ? styles.arcadeGrid : styles.arcadeStrip}>
                    {visibleArcadeGames.map(ag => (
                      <StaticArcadeCard key={ag.slug} game={ag} />
                    ))}
                  </div>
                </div>

                {/* Subject games — mixed single horizontal scroll row.
                    2 games from each subject, all in one swipeable row.
                    "Switch to Focus →" at the end nudges curious users. */}
                {(() => {
                  const mixedGames = subjectStats.flatMap(({ sub, games }) =>
                    games.slice(0, 2).map(s => ({ ...s, sub }))
                  );
                  if (mixedGames.length === 0) return null;
                  return (
                    <div className={styles.subjectSection}>
                      <div className={styles.subjectSectionHead}>
                        <span className={styles.subjectSectionLabel}>Practice Games</span>
                        <button
                          className={styles.seeAllBtn}
                          onClick={() => handleModeChange("focus")}
                        >
                          View by subject →
                        </button>
                      </div>
                      <div className={styles.mixedScroll}>
                        {mixedGames.map(({ game, sub }) => {
                          const m = subjectMeta(sub);
                          return (
                            <div key={game.id} className={styles.mixedCard}>
                              <GameCard
                                game={game}
                                subjectColor={m.color} subjectTint={m.tint} subjectEmoji={m.emoji}
                                desc={GAME_CARD_DESC[game.slug]}
                                onPlay={() => setQuickPlayGame(game)}
                                onCardClick={() => handleGameClick(game.slug)} />
                            </div>
                          );
                        })}
                        {/* End nudge */}
                        <div className={styles.mixedScrollCta} onClick={() => handleModeChange("focus")}>
                          <span className={styles.mixedScrollCtaIcon}>🎯</span>
                          <span className={styles.mixedScrollCtaText}>Switch to Focus mode to study by subject</span>
                          <span className={styles.mixedScrollCtaArrow}>→</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {subjectStats.length === 0 && (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📡</div>
                    <p>No games for {selectedClass} yet.</p>
                  </div>
                )}
              </>
            )}

            {/* ── FOCUS MODE ── */}
            {mode === "focus" && (
              <>
                {/* Continue — only in focus mode */}
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
                          <div className={styles.continueBannerSubject} style={{ color: m.color }}>{m.emoji} {m.name}</div>
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

                {/* Focus search bar */}
                <div className={styles.focusSearchWrap}>
                  <span className={styles.focusSearchIcon}>🔍</span>
                  <input
                    className={styles.focusSearchInput}
                    type="search"
                    placeholder="What do you want to study?"
                    value={focusSearch}
                    onChange={e => setFocusSearch(e.target.value)}
                  />
                  {focusSearch && (
                    <button className={styles.focusSearchClear} onClick={() => setFocusSearch("")}>✕</button>
                  )}
                </div>

                {/* Subject cards — clean, no left-border outline */}
                {focusFilteredSubjects.length === 0 ? (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📡</div>
                    <p>No matches for &ldquo;{focusSearch}&rdquo;</p>
                  </div>
                ) : (
                  <div className={styles.focusSubjectGrid}>
                    {focusFilteredSubjects.map(({ sub, count }) => {
                      const m = subjectMeta(sub);
                      return (
                        <button
                          key={sub}
                          className={styles.focusSubjectCard}
                          onClick={() => setActiveSubject(sub)}
                        >
                          <div className={styles.focusSubjectCardBg} style={{ background: m.color }} />
                          <span className={styles.focusSubjectEmoji}>{m.emoji}</span>
                          <span className={styles.focusSubjectName}>{m.name}</span>
                          <span className={styles.focusSubjectDesc}>{SUBJECT_DESCRIPTIONS[sub]}</span>
                          <span className={styles.focusSubjectCount} style={{ color: m.color }}>
                            {count} game{count !== 1 ? "s" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── LEADERBOARD CTA — bottom of page, both modes ── */}
            <Link href="/leaderboard" className={styles.leaderboardCta}>
              <div className={styles.leaderboardCtaLeft}>
                <span className={styles.leaderboardCtaIcon}>🏆</span>
                <div>
                  <div className={styles.leaderboardCtaTitle}>Leaderboard</div>
                  <div className={styles.leaderboardCtaSub}>See how you rank against everyone</div>
                </div>
              </div>
              <span className={styles.leaderboardCtaArrow}>→</span>
            </Link>
          </>
        )}
      </div>

      <QuickPlayModal game={quickPlayGame} onClose={() => setQuickPlayGame(null)} />
    </div>
  );
}

// ── StaticArcadeCard ───────────────────────────────────────────────────────────

function StaticArcadeCard({ game }: { game: StaticArcadeGameDef }) {
  if (!game.isReady) {
    return (
      <div className={`${styles.arcadeCard} ${styles.arcadeCardSoon}`}>
        <div className={styles.arcadeCardArt} style={{ background: `${game.accentColor}12` }}>
          <span className={styles.arcadeCardEmoji}>{game.emoji}</span>
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
          <span className={styles.arcadeCardEmoji}>{game.emoji}</span>
        </div>
        <div className={styles.arcadeCardBody}>
          <div className={styles.arcadeCardTitle}>{game.title}</div>
          <div className={styles.arcadeCardMeta}>{game.tagline}</div>
        </div>
      </Link>
      <Link href={`/games/${game.slug}`} className={styles.arcadePlayBtn} style={{ background: game.accentColor }}>
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
      <button className={styles.gameCardPlayBtn} style={{ background: subjectColor }} onClick={onPlay}>
        ▶ Play
      </button>
    </div>
  );
}