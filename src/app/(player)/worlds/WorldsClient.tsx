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
  const [searchQuery, setSearchQuery] = useState("");
  const [yearGroupFilter, setYearGroupFilter] = useState("all");
  const [examBoardFilter, setExamBoardFilter] = useState("all");
  const [termFilter, setTermFilter] = useState("all");

  const allSubjects = Object.entries(bySubject).filter(([, g]) => g.length > 0);

  // Collect all year groups and exam boards for filter dropdowns
  const allYearGroups = Array.from(new Set(
    allSubjects.flatMap(([, games]) => games.flatMap(g => g.game.year_groups ?? []))
  )).sort();
  const allExamBoards = Array.from(new Set(
    allSubjects.flatMap(([, games]) => games.flatMap(g => g.game.exam_boards ?? []))
  )).sort();

  const q = searchQuery.toLowerCase().trim();

  const subjects = allSubjects
    .map(([key, games]) => {
      const filtered = games.filter(g => {
        const game = g.game;
        if (activeSubjectFilter !== "all" && key !== activeSubjectFilter) return false;
        if (yearGroupFilter !== "all" && !(game.year_groups ?? []).includes(yearGroupFilter)) return false;
        if (examBoardFilter !== "all" && !(game.exam_boards ?? []).includes(examBoardFilter)) return false;
        if (termFilter !== "all" && game.curriculum_term !== termFilter) return false;
        if (q) {
          const haystack = [
            game.title,
            game.topic_id,
            game.card_description ?? "",
            key,
            ...(game.year_groups ?? []),
          ].join(" ").toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });
      return [key, filtered] as [string, GameSummary[]];
    })
    .filter(([, games]) => games.length > 0);
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

      {/* Search bar */}
      <div className={styles.searchRow}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search by topic, subject, year group…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className={styles.searchClear} onClick={() => setSearchQuery("")}>✕</button>
          )}
        </div>
        {searchQuery && (
          <div className={styles.searchCount}>
            {searchResultCount} game{searchResultCount !== 1 ? "s" : ""} found
          </div>
        )}
      </div>

      {/* Filters row */}
      <div className={styles.filtersRow}>
        {/* Year group filter */}
        {allYearGroups.length > 0 && (
          <select
            className={styles.filterSelect}
            value={yearGroupFilter}
            onChange={e => setYearGroupFilter(e.target.value)}
          >
            <option value="all">All Year Groups</option>
            {allYearGroups.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        {/* Exam board filter */}
        {allExamBoards.length > 0 && (
          <select
            className={styles.filterSelect}
            value={examBoardFilter}
            onChange={e => setExamBoardFilter(e.target.value)}
          >
            <option value="all">All Exam Boards</option>
            {allExamBoards.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
        {/* Term filter */}
        <select
          className={styles.filterSelect}
          value={termFilter}
          onChange={e => setTermFilter(e.target.value)}
        >
          <option value="all">All Terms</option>
          <option value="First Term">First Term</option>
          <option value="Second Term">Second Term</option>
          <option value="Third Term">Third Term</option>
        </select>
        {/* Clear all filters */}
        {(yearGroupFilter !== "all" || examBoardFilter !== "all" || termFilter !== "all" || searchQuery) && (
          <button
            className={styles.clearFilters}
            onClick={() => { setYearGroupFilter("all"); setExamBoardFilter("all"); setTermFilter("all"); setSearchQuery(""); }}
          >
            Clear filters
          </button>
        )}
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
        {subjects.length === 0 && searchQuery && (
        <div className={styles.noResults}>
          <div className={styles.noResultsIcon}>🔍</div>
          <div className={styles.noResultsTitle}>No games found for "{searchQuery}"</div>
          <div className={styles.noResultsSub}>Try a different search — topic name, subject, or year group</div>
          <button className={styles.noResultsClear} onClick={() => setSearchQuery("")}>Clear search</button>
        </div>
      )}
      {subjects.length === 0 && !searchQuery && (
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