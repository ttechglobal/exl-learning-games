"use client";

/**
 * WorldsClient — Game Mission Dashboard
 *
 * Design concept: Mission Briefing Room / Command Centre.
 * Players see their rank + XP progress, pick their class and subjects,
 * search instantly, resume their active mission, and browse all games
 * as rich mission-dossier cards.
 */

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { useTheme } from "@/components/ui/ThemeProvider";
import { subjectMeta } from "@/lib/content/subjects";
import { GAME_CARD_DESC } from "@/lib/content/gameCardMeta";
import { RANKS, getRank, getNextRank, getRankProgress, getXpToNextRank } from "@/lib/content/ranks";
import { GameCardArt } from "@/components/ui/GameCardArt";
import type { GameRow, Difficulty } from "@/types/db";
import styles from "@/app/(player)/worlds/WorldsClient.module.css";

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── Constants ──────────────────────────────────────────────────────────────

const CLASSES = ["JSS1","JSS2","JSS3","SS1","SS2","SS3","WAEC","JAMB"] as const;
type YearClass = typeof CLASSES[number];

const SUBJECT_ORDER = ["mathematics","physics","chemistry","biology"];

const TOPIC_KEYWORDS: Record<string, string[]> = {
  "change-of-subject-formula": ["change of subject","formula","rearrange","make subject","transpose","algebra","variable"],
  "algebra":          ["algebra","equations","linear","quadratic","simultaneous","expression"],
  "geometry":         ["geometry","angles","shapes","triangles","circles","area","perimeter","volume"],
  "periodic-table":   ["periodic table","elements","atomic","protons","electrons","noble gases","metals"],
  "atomic-structure": ["atomic structure","atom","nucleus","electron","proton","neutron","isotope"],
  "chemical-bonding": ["bonding","ionic","covalent","bond","molecule","compound"],
  "forces":           ["forces","newton","friction","gravity","pressure","weight","mass"],
  "waves":            ["waves","frequency","wavelength","amplitude","sound","light","electromagnetic"],
  "electricity":      ["electricity","current","voltage","resistance","circuit","ohm","power"],
  "biology-cells":    ["cells","cell structure","organelles","membrane","nucleus","mitosis"],
};

// Rank system imported from @/lib/content/ranks

const LS_CLASS    = "exl-pref-class";
const LS_SUBJECTS = "exl-pref-subjects";
const LS_LAST     = "exl-last-played";

function safeLS(key: string, fb: string)       { try { return localStorage.getItem(key) ?? fb; } catch { return fb; } }
function safeLSSet(key: string, val: string)   { try { localStorage.setItem(key, val); }         catch { /* noop */ } }

// ── Component ──────────────────────────────────────────────────────────────

export function WorldsClient({ bySubject, currentStudentXp = 0, studentName }: WorldsClientProps) {
  const { theme, toggleTheme } = useTheme();

  // Persisted prefs
  const [selectedClass,  setSelectedClass]  = useState<YearClass>("JSS3");
  const [activeSubjects, setActiveSubjects] = useState<string[]>(["mathematics"]);
  const [lastPlayed,     setLastPlayed]     = useState<string | null>(null);
  const [prefsLoaded,    setPrefsLoaded]    = useState(false);

  useEffect(() => {
    setSelectedClass(safeLS(LS_CLASS, "JSS3") as YearClass);
    const saved = safeLS(LS_SUBJECTS, "");
    setActiveSubjects(saved ? saved.split(",") : ["mathematics"]);
    setLastPlayed(safeLS(LS_LAST, "") || null);
    setPrefsLoaded(true);
  }, []);

  const handleClassChange = useCallback((c: YearClass) => {
    setSelectedClass(c); safeLSSet(LS_CLASS, c);
  }, []);

  const toggleSubject = useCallback((sub: string) => {
    setActiveSubjects(prev => {
      const next = prev.includes(sub)
        ? prev.length > 1 ? prev.filter(s => s !== sub) : prev
        : [...prev, sub];
      safeLSSet(LS_SUBJECTS, next.join(","));
      return next;
    });
  }, []);

  // Search
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const q = searchQuery.toLowerCase().trim();

  const allGames = useMemo(() => Object.values(bySubject).flat(), [bySubject]);

  const searchIndex = useMemo(() =>
    allGames.map(g => ({
      summary: g,
      tokens: [
        g.game.title, g.game.topic_id, g.game.subject,
        g.game.card_description ?? "",
        ...(TOPIC_KEYWORDS[g.game.topic_id] ?? []),
        ...(g.game.year_groups ?? []),
        ...(g.game.exam_boards ?? []),
      ].join(" ").toLowerCase(),
    })),
  [allGames]);

  const searchResults = useMemo(() => {
    if (!q) return [];
    return searchIndex
      .filter(({ tokens }) => q.split(" ").every(w => tokens.includes(w)))
      .map(({ summary }) => summary);
  }, [searchIndex, q]);

  const suggestions = useMemo(() => {
    if (!q || q.length < 2) return [];
    const seen = new Set<string>(); const out: string[] = [];
    for (const { summary } of searchIndex) {
      const label = summary.game.title;
      if (!seen.has(label) && label.toLowerCase().includes(q)) {
        seen.add(label); out.push(label);
      }
      if (out.length >= 5) break;
    }
    return out;
  }, [searchIndex, q]);

  // Last played
  const lastPlayedGame = useMemo(() =>
    lastPlayed ? allGames.find(g => g.game.slug === lastPlayed) ?? null : null,
  [allGames, lastPlayed]);

  // Filtered subjects
  const visibleSubjects = useMemo(() =>
    SUBJECT_ORDER
      .filter(sub => activeSubjects.includes(sub))
      .map(sub => {
        const games = (bySubject[sub] ?? []).filter(g => {
          const yg = g.game.year_groups ?? [];
          if (selectedClass !== "WAEC" && selectedClass !== "JAMB" && yg.length > 0) {
            if (!yg.includes(selectedClass)) return false;
          }
          return true;
        });
        return [sub, games] as [string, GameSummary[]];
      })
      .filter(([, games]) => games.length > 0),
  [bySubject, activeSubjects, selectedClass]);

  // XP / rank
  const rank     = getRank(currentStudentXp);
  const nextRank = getNextRank(currentStudentXp);
  const xpToNext = getXpToNextRank(currentStudentXp);
  const xpPct    = getRankProgress(currentStudentXp);

  const handleGameClick = useCallback((slug: string) => {
    safeLSSet(LS_LAST, slug); setLastPlayed(slug);
  }, []);

  if (!prefsLoaded) return null;

  const isSearching = q.length > 0;

  return (
    <div className={styles.page} data-theme={theme}>
      <SiteHeader theme={theme} onToggleTheme={toggleTheme} active="games" currentStudentXp={currentStudentXp} />

      {/* ══════════════════════════════════════════
          MISSION CONTROL HEADER
          Top row: rank badge (left) + class dropdown (right)
          Below:   XP progress bar
          Below:   subject toggle pills (full width)
      ══════════════════════════════════════════ */}
      <div className={styles.missionControl}>

        {/* Top row */}
        <div className={styles.mcTopRow}>
          <div className={styles.rankBadge}>
            <div className={styles.rankIconWrap}>{rank.icon}</div>
            <div className={styles.rankMeta}>
              <div className={styles.rankLabel}>{rank.label}</div>
              {studentName && <div className={styles.playerName}>{studentName}</div>}
            </div>
          </div>

          {/* Class selector — right side of top row */}
          <div className={styles.classPill}>
            <label className={styles.controlLabel} htmlFor="class-select">Class</label>
            <select
              id="class-select"
              className={styles.classDropdown}
              value={selectedClass}
              onChange={e => handleClassChange(e.target.value as YearClass)}
            >
              {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* XP progress bar */}
        {nextRank && (
          <div className={styles.xpBar}>
            <div className={styles.xpBarTrack}>
              <div className={styles.xpBarFill} style={{ width: `${xpPct}%` }} />
            </div>
            <div className={styles.xpBarLabel}>
              {currentStudentXp} XP · {xpToNext} to {nextRank.label}
            </div>
          </div>
        )}

        {/* Subject toggles — full width below XP bar */}
        <div className={styles.subjectRow}>
          <span className={styles.controlLabel}>Choose your subjects</span>
          <div className={styles.subjectToggles}>
            {SUBJECT_ORDER.map(sub => {
              const m = subjectMeta(sub);
              const active = activeSubjects.includes(sub);
              return (
                <button
                  key={sub}
                  className={[styles.subjectToggle, active ? styles.subjectToggleActive : ""].join(" ")}
                  style={(active ? {
                    "--faction-color": m.color,
                    "--faction-tint":  m.tint,
                    borderColor: m.color,
                    background:  m.tint,
                    color:       m.color,
                  } : {}) as React.CSSProperties}
                  onClick={() => toggleSubject(sub)}
                >
                  <span className={styles.subjectToggleEmoji}>{m.emoji}</span>
                  <span className={styles.subjectToggleName}>{m.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          SEARCH
      ══════════════════════════════════════════ */}
      <div className={styles.searchZone}>
        <div className={styles.searchInner}>
          <div className={styles.searchBox}>
            <span className={styles.searchIconGlyph}>⌕</span>
            <input
              ref={searchRef}
              className={styles.searchField}
              type="text"
              placeholder="What would you like to learn today?"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              autoComplete="off"
              spellCheck={false}
            />
            {searchQuery && (
              <button className={styles.searchClearBtn} onClick={() => { setSearchQuery(""); searchRef.current?.focus(); }}>✕</button>
            )}
          </div>
          {searchFocused && suggestions.length > 0 && (
            <div className={styles.suggestions}>
              {suggestions.map(s => (
                <button key={s} className={styles.suggestion} onClick={() => setSearchQuery(s)}>
                  <span className={styles.suggestionIcon}>→</span> {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.mainContent}>

        {/* ══════════════════════════════════════
            SEARCH RESULTS
        ══════════════════════════════════════ */}
        {isSearching && (
          <section className={styles.contentSection}>
            {searchResults.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon}>🔍</div>
                <div className={styles.emptyStateTitle}>No games found for &ldquo;{searchQuery}&rdquo;</div>
                <div className={styles.emptyStateSub}>Try: forces, bonding, change of subject, algebra…</div>
                <button className={styles.emptyStateCta} onClick={() => setSearchQuery("")}>Clear search</button>
              </div>
            ) : (
              <>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionEyebrow}>Search results</span>
                  <h2 className={styles.sectionTitle}>
                    {searchResults.length} game{searchResults.length !== 1 ? "s" : ""} match &ldquo;{searchQuery}&rdquo;
                  </h2>
                </div>
                <div className={styles.missionGrid}>
                  {searchResults.map(({ game }) => (
                    <MissionCard key={game.id} game={game} onClick={() => handleGameClick(game.slug)} />
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* ══════════════════════════════════════
            ACTIVE MISSION BANNER
        ══════════════════════════════════════ */}
        {!isSearching && lastPlayedGame && (() => {
          const m   = subjectMeta(lastPlayedGame.game.subject);
          const desc = GAME_CARD_DESC[lastPlayedGame.game.slug];
          return (
            <section className={styles.activeMissionSection}>
              <div className={styles.activeMissionLabel}>
                <span className={styles.activePulse} />
                <span>Active Mission</span>
              </div>
              <Link
                href={`/play/${lastPlayedGame.game.slug}`}
                className={styles.activeMissionBanner}
                style={{ "--faction-color": m.color, "--faction-tint": m.tint } as React.CSSProperties}
                onClick={() => handleGameClick(lastPlayedGame.game.slug)}
              >
                <div className={styles.amBgGlow} aria-hidden="true" />
                <div className={styles.amArt}>
                  <GameCardArt gameSlug={lastPlayedGame.game.slug} emoji={m.emoji} color={m.color} tint={m.tint} />
                  <span className={styles.amSubjectBadge} style={{ background: m.color }}>{m.emoji}</span>
                </div>
                <div className={styles.amBody}>
                  <div className={styles.amSubject} style={{ color: m.color }}>
                    {m.name} · {lastPlayedGame.game.topic_id.replace(/-/g," ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                  </div>
                  <div className={styles.amTitle}>{lastPlayedGame.game.title}</div>
                  {desc && <p className={styles.amDesc}>{desc}</p>}
                </div>
                <div className={styles.amCta} style={{ background: m.color }}>
                  <span className={styles.amCtaIcon}>▶</span>
                  <span className={styles.amCtaText}>Keep Playing!</span>
                </div>
              </Link>
            </section>
          );
        })()}

        {/* ══════════════════════════════════════
            SUBJECT MISSION ROWS
        ══════════════════════════════════════ */}
        {!isSearching && visibleSubjects.map(([sub, games]) => {
          const m = subjectMeta(sub);
          return (
            <section key={sub} className={styles.contentSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle} style={{ "--faction-color": m.color } as React.CSSProperties}>
                  <span className={styles.sectionTitleAccent}>{m.emoji}</span>
                  {m.name} <span className={styles.sectionTitleMissions}>Missions</span>
                </h2>
                <span className={styles.missionCount} style={{ background: m.tint, color: m.color }}>
                  {games.length} available
                </span>
              </div>
              <div className={styles.missionRow}>
                {games.map(({ game }) => (
                  <MissionCard
                    key={game.id}
                    game={game}
                    subjectColor={m.color}
                    subjectTint={m.tint}
                    onClick={() => handleGameClick(game.slug)}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {!isSearching && visibleSubjects.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>📡</div>
            <div className={styles.emptyStateTitle}>No games for {selectedClass} yet</div>
            <div className={styles.emptyStateSub}>
              Try a different class above, or select more subjects — new games are added regularly!
            </div>
            <button className={styles.emptyStateCta} onClick={() => {
              safeLSSet(LS_SUBJECTS, SUBJECT_ORDER.join(","));
              setActiveSubjects(SUBJECT_ORDER);
            }}>Show all subjects</button>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Mission Card ────────────────────────────────────────────────────────────
// Same visual language as the Active Mission banner:
//   • faction-coloured top border (3px)
//   • glowing coloured shadow on hover
//   • art panel at top, then tag + title + description, then Play CTA

function MissionCard({
  game,
  subjectColor,
  subjectTint,
  onClick,
}: {
  game: GameRow;
  subjectColor?: string;
  subjectTint?: string;
  onClick?: () => void;
}) {
  const m     = subjectMeta(game.subject);
  const color = subjectColor ?? m.color;
  const tint  = subjectTint  ?? m.tint;
  const desc  = GAME_CARD_DESC[game.slug];

  return (
    <Link
      href={`/play/${game.slug}`}
      className={styles.missionCard}
      style={{ "--faction-color": color, "--faction-tint": tint } as React.CSSProperties}
      onClick={onClick}
    >
      {/* Art */}
      <div className={styles.missionCardArt}>
        <GameCardArt gameSlug={game.slug} emoji={m.emoji} color={color} tint={tint} />
      </div>

      {/* Body */}
      <div className={styles.missionCardBody}>
        <div className={styles.missionCardTag} style={{ color }}>
          {game.topic_id.replace(/-/g," ").replace(/\b\w/g, c => c.toUpperCase())}
        </div>
        <div className={styles.missionCardTitle}>{game.title}</div>
        {desc && <p className={styles.missionCardDesc}>{desc}</p>}
      </div>

      {/* Footer */}
      <div className={styles.missionCardFooter}>
        <span className={styles.missionCardPlayBtn}>▶ Play</span>
      </div>
    </Link>
  );
}