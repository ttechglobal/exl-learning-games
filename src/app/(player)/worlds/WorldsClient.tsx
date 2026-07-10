"use client";

/**
 * WorldsClient — Game Discovery Dashboard
 *
 * Personalized dashboard with:
 * - Class selector (JSS1–SS3) — persisted in localStorage
 * - Subject preference pills — persisted in localStorage
 * - Search with topic recommendation
 * - Continue card (last played)
 * - Subject rows with horizontal scroll
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { useTheme } from "@/components/ui/ThemeProvider";
import { subjectMeta } from "@/lib/content/subjects";
import { GAME_CARD_DESC } from "@/lib/content/gameCardMeta";
import { GameCardArt } from "@/components/ui/GameCardArt";
import type { GameRow, Difficulty } from "@/types/db";
import styles from "@/app/(player)/worlds/WorldsClient.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Constants ─────────────────────────────────────────────────────────────────

const CLASSES = ["JSS1","JSS2","JSS3","SS1","SS2","SS3","WAEC","JAMB"] as const;
type YearClass = typeof CLASSES[number];

const ALL_SUBJECTS = ["mathematics","physics","chemistry","biology"] as const;

const TOPIC_LABELS: Record<string, string> = {
  "periodic-table": "Periodic Table",
  "atomic-structure": "Atomic Structure",
  "chemical-bonding": "Chemical Bonding",
  "change-of-subject-formula": "Change of Subject",
  "algebra": "Algebra",
  "geometry": "Geometry",
  "forces": "Forces",
  "waves": "Waves",
  "electricity": "Electricity",
};
function topicLabel(id: string) {
  return TOPIC_LABELS[id] ?? id.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

const LS_CLASS   = "exl-pref-class";
const LS_SUBJECTS = "exl-pref-subjects";
const LS_LAST    = "exl-last-played";

function safeLS(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function safeLSSet(key: string, val: string) {
  try { localStorage.setItem(key, val); } catch { /* noop */ }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WorldsClient({ bySubject }: WorldsClientProps) {
  const { theme, toggleTheme } = useTheme();

  // ── Persisted preferences ─────────────────────────────────────────────────
  const [selectedClass,    setSelectedClass]    = useState<YearClass>("JSS3");
  const [activeSubjects,   setActiveSubjects]   = useState<string[]>(["mathematics"]);
  const [prefsLoaded,      setPrefsLoaded]      = useState(false);
  const [lastPlayed,       setLastPlayed]       = useState<string | null>(null);

  useEffect(() => {
    setSelectedClass((safeLS(LS_CLASS, "JSS3") as YearClass));
    const saved = safeLS(LS_SUBJECTS, "");
    setActiveSubjects(saved ? saved.split(",") : ["mathematics"]);
    setLastPlayed(safeLS(LS_LAST, ""));
    setPrefsLoaded(true);
  }, []);

  const handleClassChange = useCallback((c: YearClass) => {
    setSelectedClass(c);
    safeLSSet(LS_CLASS, c);
  }, []);

  const toggleSubject = useCallback((sub: string) => {
    setActiveSubjects(prev => {
      const next = prev.includes(sub)
        ? prev.length > 1 ? prev.filter(s => s !== sub) : prev // keep at least 1
        : [...prev, sub];
      safeLSSet(LS_SUBJECTS, next.join(","));
      return next;
    });
  }, []);

  // ── Search ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const q = searchQuery.toLowerCase().trim();

  // ── All games flat list ───────────────────────────────────────────────────
  const allGames = useMemo(
    () => Object.values(bySubject).flat(),
    [bySubject]
  );

  // ── Last played game ──────────────────────────────────────────────────────
  const lastPlayedGame = useMemo(() => {
    if (!lastPlayed) return null;
    return allGames.find(g => g.game.slug === lastPlayed) ?? null;
  }, [allGames, lastPlayed]);

  // ── Filtered subjects + games ─────────────────────────────────────────────
  const visibleSubjects = useMemo(() => {
    return Object.entries(bySubject)
      .filter(([sub, games]) => {
        if (!activeSubjects.includes(sub)) return false;
        if (games.length === 0) return false;
        return true;
      })
      .map(([sub, games]) => {
        const filtered = games.filter(g => {
          const game = g.game;
          // Class filter
          if (selectedClass !== "WAEC" && selectedClass !== "JAMB") {
            const yg = game.year_groups ?? [];
            if (yg.length > 0 && !yg.includes(selectedClass)) return false;
          }
          // Search
          if (q) {
            const hay = [game.title, game.topic_id, game.card_description ?? "", sub].join(" ").toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });
        return [sub, filtered] as [string, GameSummary[]];
      })
      .filter(([, games]) => games.length > 0);
  }, [bySubject, activeSubjects, selectedClass, q]);

  // ── Search results flat (for search mode) ────────────────────────────────
  const searchResults = useMemo(() => {
    if (!q) return [];
    return allGames.filter(g => {
      const game = g.game;
      const hay = [game.title, game.topic_id, game.card_description ?? "", game.subject].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [allGames, q]);

  // ── Record last played on game click ─────────────────────────────────────
  const handleGameClick = useCallback((slug: string) => {
    safeLSSet(LS_LAST, slug);
    setLastPlayed(slug);
  }, []);

  if (!prefsLoaded) return null;

  const isSearching = q.length > 0;

  return (
    <div className={styles.page} data-theme={theme}>
      <SiteHeader theme={theme} onToggleTheme={toggleTheme} active="games" />

      {/* ── DASHBOARD HEADER ── */}
      <div className={styles.dashHeader}>
        <div className={styles.dashHeaderInner}>
          <div className={styles.dashGreeting}>
            <h1 className={styles.dashTitle}>My Learning Dashboard</h1>
            <p className={styles.dashSub}>Find a game, pick up where you left off, or explore something new.</p>
          </div>

          {/* Class selector */}
          <div className={styles.classSelectorWrap}>
            <span className={styles.classSelectorLabel}>Your class</span>
            <div className={styles.classSelector}>
              {CLASSES.map(c => (
                <button
                  key={c}
                  className={[styles.classBtn, selectedClass === c ? styles.classBtnActive : ""].join(" ")}
                  onClick={() => handleClassChange(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── SUBJECT PREFERENCES ── */}
      <div className={styles.prefRow}>
        <span className={styles.prefLabel}>Subjects</span>
        <div className={styles.prefPills}>
          {ALL_SUBJECTS.map(sub => {
            const m = subjectMeta(sub);
            const active = activeSubjects.includes(sub);
            return (
              <button
                key={sub}
                className={[styles.prefPill, active ? styles.prefPillActive : ""].join(" ")}
                style={active ? { borderColor: m.color, color: m.color, background: m.tint } as React.CSSProperties : {}}
                onClick={() => toggleSubject(sub)}
              >
                {m.emoji} {m.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SEARCH ── */}
      <div className={styles.searchRow}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search by topic, subject, keyword…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            autoComplete="off"
          />
          {searchQuery && (
            <button className={styles.searchClear} onClick={() => setSearchQuery("")}>✕</button>
          )}
        </div>
      </div>

      {/* ── SEARCH RESULTS ── */}
      {isSearching && (
        <div className={styles.dashContainer}>
          {searchResults.length === 0 ? (
            <div className={styles.noResults}>
              <div className={styles.noResultsIcon}>🔍</div>
              <div className={styles.noResultsTitle}>No games found for &ldquo;{searchQuery}&rdquo;</div>
              <div className={styles.noResultsSub}>Try a different topic name, subject, or year group.</div>
              <button className={styles.noResultsClear} onClick={() => setSearchQuery("")}>Clear search</button>
            </div>
          ) : (
            <>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionName}>
                  {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;
                </h2>
              </div>
              <div className={styles.gameGrid}>
                {searchResults.map(({ game }) => {
                  const m = subjectMeta(game.subject);
                  return (
                    <Link
                      key={game.id}
                      href={`/play/${game.slug}`}
                      className={styles.gameCard}
                      onClick={() => handleGameClick(game.slug)}
                    >
                      <div className={styles.gameCardArt}>
                        <GameCardArt gameSlug={game.slug} emoji={m.emoji} color={m.color} tint={m.tint} />
                      </div>
                      <div className={styles.gameCardBody}>
                        <div className={styles.gameCardTag} style={{ color: m.color, background: m.tint }}>
                          {topicLabel(game.topic_id)}
                        </div>
                        <div className={styles.gameCardTitle}>{game.title}</div>
                        {GAME_CARD_DESC[game.slug] && (
                          <p className={styles.gameCardDesc}>{GAME_CARD_DESC[game.slug]}</p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── CONTINUE CARD ── */}
      {!isSearching && lastPlayedGame && (
        <div className={styles.dashContainer}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionName}>Continue learning</h2>
          </div>
          <Link
            href={`/play/${lastPlayedGame.game.slug}`}
            className={styles.continueCard}
            onClick={() => handleGameClick(lastPlayedGame.game.slug)}
          >
            <div className={styles.continueCardLeft}>
              {(() => {
                const m = subjectMeta(lastPlayedGame.game.subject);
                return (
                  <>
                    <div className={styles.continueCardArt}>
                      <GameCardArt gameSlug={lastPlayedGame.game.slug} emoji={m.emoji} color={m.color} tint={m.tint} />
                    </div>
                    <div>
                      <div className={styles.continueCardTag} style={{ color: m.color }}>
                        {m.emoji} {topicLabel(lastPlayedGame.game.topic_id)}
                      </div>
                      <div className={styles.continueCardTitle}>{lastPlayedGame.game.title}</div>
                      {GAME_CARD_DESC[lastPlayedGame.game.slug] && (
                        <p className={styles.continueCardDesc}>{GAME_CARD_DESC[lastPlayedGame.game.slug]}</p>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
            <div className={styles.continueBtn}>Continue →</div>
          </Link>
        </div>
      )}

      {/* ── SUBJECT ROWS ── */}
      {!isSearching && (
        <div className={styles.dashContainer}>
          {visibleSubjects.length === 0 && (
            <div className={styles.noResults}>
              <div className={styles.noResultsIcon}>📚</div>
              <div className={styles.noResultsTitle}>No games for your current filters</div>
              <div className={styles.noResultsSub}>Try selecting a different class or enabling more subjects above.</div>
            </div>
          )}
          {visibleSubjects.map(([sub, games]) => {
            const m = subjectMeta(sub);
            return (
              <section key={sub} className={styles.subjectSection}>
                <div className={styles.sectionHead}>
                  <span className={styles.sectionEmoji}>{m.emoji}</span>
                  <h2 className={styles.sectionName}>{m.name}</h2>
                  <span className={styles.sectionCount} style={{ background: m.tint, color: m.color }}>
                    {games.length}
                  </span>
                </div>
                <div className={styles.scrollRow}>
                  {games.map(({ game }) => (
                    <Link
                      key={game.id}
                      href={`/play/${game.slug}`}
                      className={styles.miniCard}
                      onClick={() => handleGameClick(game.slug)}
                    >
                      <div className={styles.miniCardArt} style={{ background: m.tint }}>
                        <GameCardArt gameSlug={game.slug} emoji={m.emoji} color={m.color} tint={m.tint} />
                      </div>
                      <div className={styles.miniCardBody}>
                        <div className={styles.miniCardTag} style={{ color: m.color, background: m.tint }}>
                          {topicLabel(game.topic_id)}
                        </div>
                        <div className={styles.miniCardTitle}>{game.title}</div>
                        {GAME_CARD_DESC[game.slug] && (
                          <p className={styles.miniCardDesc}>{GAME_CARD_DESC[game.slug]}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}