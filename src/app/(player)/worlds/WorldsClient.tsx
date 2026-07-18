"use client";

/**
 * WorldsClient.tsx — EXL Learning World Dashboard
 *
 * REDESIGN: Inspired by the Moze reference dashboard.
 * Structure:
 *   Hero banner    — featured world with character art + tagline + CTA
 *   World chips    — horizontal filter pills (All + 4 subjects)
 *   Game grid      — 3-column card grid (character floats above card)
 *   Featured panel — right column on desktop; stacks below on mobile
 *
 * Light/dark: built entirely on CSS custom properties from tokens.css.
 * No hardcoded colours in JSX — every value is a token or derived from --wc.
 */

import Link from "next/link";
import { useState } from "react";
import { useTheme } from "@/components/ui/ThemeProvider";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { subjectMeta } from "@/lib/content/subjects";
import { GAME_CARD_DESC } from "@/lib/content/gameCardMeta";
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
  heroLine: string;   // bolder, shorter hero headline
  glyph: string;
  color: string;
  colorRgb: string;   // raw rgb for rgba() constructions
  gradient: string;   // hero banner gradient
}> = {
  chemistry: {
    name: "Chemistry World",
    tagline: "Build atoms, break bonds, see matter behave.",
    heroLine: "Where matter reveals its secrets.",
    glyph: "⚗️",
    color: "var(--eg-subject-chemistry)",
    colorRgb: "123,79,203",
    gradient: "linear-gradient(135deg, #1a0840 0%, #2d1260 50%, #180638 100%)",
  },
  mathematics: {
    name: "Mathematics World",
    tagline: "Solve equations, construct proofs, own the numbers.",
    heroLine: "Numbers behave. Learn to speak their language.",
    glyph: "📐",
    color: "var(--eg-subject-mathematics)",
    colorRgb: "47,155,214",
    gradient: "linear-gradient(135deg, #031828 0%, #062848 50%, #041020 100%)",
  },
  physics: {
    name: "Physics World",
    tagline: "Apply forces, trace light, move through space.",
    heroLine: "Every force tells a story. Find it.",
    glyph: "⚡",
    color: "var(--eg-subject-physics)",
    colorRgb: "255,111,145",
    gradient: "linear-gradient(135deg, #200818 0%, #380820 50%, #1a0412 100%)",
  },
  biology: {
    name: "Biology World",
    tagline: "Study cells, map ecosystems, decode life.",
    heroLine: "Life is the most complex system ever built.",
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
  currentStudentRank,
  studentName,
}: WorldsClientProps) {
  const { theme, toggleTheme } = useTheme();
  const [activeWorld, setActiveWorld] = useState<string | null>(null);

  // Pick the featured world: first live subject, or first subject overall
  const featuredSubject = activeWorld
    ?? ALL_SUBJECTS.find(s => (bySubject[s]?.length ?? 0) > 0)
    ?? ALL_SUBJECTS[0];

  const featuredMeta   = WORLD_META[featuredSubject];
  const featuredGames  = bySubject[featuredSubject] ?? [];
  const featuredFirst  = featuredGames[0] ?? null;
  const subMeta        = subjectMeta(featuredSubject);

  const visibleSubjects = activeWorld ? [activeWorld] : ALL_SUBJECTS;
  const totalGames = Object.values(bySubject).reduce((s, g) => s + g.length, 0);

  return (
    <div className={styles.page} data-theme={theme}>

      {/* ── AMBIENT GLOW LAYER ──────────────────────────────────────────── */}
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

        {/* ── LEFT COLUMN — main content ────────────────────────────────── */}
        <div className={styles.mainCol}>

          {/* ── HERO BANNER ───────────────────────────────────────────────── */}
          <div
            className={styles.hero}
            style={{
              background: featuredMeta?.gradient ?? "linear-gradient(135deg,#0a0820,#1a1040)",
              "--wrgb": featuredMeta?.colorRgb ?? "123,79,203",
              "--wc": featuredMeta?.color ?? "var(--eg-subject-chemistry)",
            } as React.CSSProperties}
          >
            {/* Decorative floating glyph */}
            <div className={styles.heroGlyph} aria-hidden="true">
              {featuredMeta?.glyph}
            </div>

            {/* Text content */}
            <div className={styles.heroBody}>
              <div className={styles.heroEyebrow}>
                {subMeta.emoji} {featuredMeta?.name ?? "Learning World"}
              </div>
              <h1 className={styles.heroTitle}>
                {featuredMeta?.heroLine ?? "Enter a world of learning."}
              </h1>
              <p className={styles.heroSub}>{featuredMeta?.tagline}</p>
              {featuredFirst && (
                <Link
                  href={`/play/${featuredFirst.game.slug}`}
                  className={styles.heroCta}
                >
                  ▶ Start Exploring
                </Link>
              )}
            </div>

            {/* Stats strip inside hero */}
            <div className={styles.heroStats}>
              {currentStudentRank && (
                <div className={styles.heroStat}>
                  <span className={styles.heroStatVal}>#{currentStudentRank}</span>
                  <span className={styles.heroStatLabel}>Your Rank</span>
                </div>
              )}
              <div className={styles.heroStat}>
                <span className={styles.heroStatVal}>{totalGames}</span>
                <span className={styles.heroStatLabel}>Experiences</span>
              </div>
              {currentStudentXp !== undefined && (
                <div className={styles.heroStat}>
                  <span className={styles.heroStatVal}>{currentStudentXp.toLocaleString()}</span>
                  <span className={styles.heroStatLabel}>XP Earned</span>
                </div>
              )}
            </div>
          </div>

          {/* ── WORLD CHIPS ───────────────────────────────────────────────── */}
          <div className={styles.chipsRow}>
            <button
              className={[styles.chip, activeWorld === null ? styles.chipActive : ""].filter(Boolean).join(" ")}
              onClick={() => setActiveWorld(null)}
            >
              🌍 All Worlds
            </button>
            {ALL_SUBJECTS.map(s => {
              const wm  = WORLD_META[s];
              const sm  = subjectMeta(s);
              const cnt = (bySubject[s] ?? []).length;
              return (
                <button
                  key={s}
                  className={[styles.chip, activeWorld === s ? styles.chipActive : ""].filter(Boolean).join(" ")}
                  style={{ "--wc": wm?.color, "--wrgb": wm?.colorRgb } as React.CSSProperties}
                  onClick={() => setActiveWorld(activeWorld === s ? null : s)}
                >
                  {sm.emoji} {sm.name}
                  {cnt > 0 && <span className={styles.chipCount}>{cnt}</span>}
                </button>
              );
            })}
          </div>

          {/* ── GAME SECTIONS ─────────────────────────────────────────────── */}
          <main className={styles.sections}>
            {visibleSubjects.map(subject => {
              const summaries = bySubject[subject] ?? [];
              const wm  = WORLD_META[subject] ?? { name: `${subject} World`, glyph: "○", color: "var(--eg-brand)", colorRgb: "11,19,48", gradient: "" };
              const sm  = subjectMeta(subject);
              const isLive = summaries.length > 0;

              return (
                <section
                  key={subject}
                  className={styles.worldSection}
                  style={{ "--wc": wm.color, "--wrgb": wm.colorRgb } as React.CSSProperties}
                >
                  {/* Section header */}
                  <div className={styles.secHead}>
                    <span className={styles.secGlyph}>{wm.glyph}</span>
                    <div className={styles.secBody}>
                      <h2 className={styles.secName}>{wm.name}</h2>
                      <p className={styles.secTag}>{WORLD_META[subject]?.tagline}</p>
                    </div>
                    {isLive && (
                      <span className={styles.secCount}>
                        {summaries.length} experience{summaries.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {/* Card grid */}
                  {isLive ? (
                    <div className={styles.cardGrid}>
                      {summaries.map(({ game, missionCount, xpMin, xpMax }) => {
                        const desc = GAME_CARD_DESC[game.slug] ?? game.title;
                        return (
                          <Link
                            key={game.id}
                            href={`/play/${game.slug}`}
                            className={styles.card}
                          >
                            {/* Art — floats; card hover lifts it */}
                            <div className={styles.cardArtWrap}>
                              <div className={styles.cardArt}>
                                <GameCardArt
                                  gameSlug={game.slug}
                                  emoji={sm.emoji}
                                  color={sm.color}
                                  tint={sm.tint}
                                />
                              </div>
                            </div>

                            {/* Card body */}
                            <div className={styles.cardBody}>
                              <div className={styles.cardName}>{game.title}</div>
                              <div className={styles.cardDesc}>{desc}</div>
                              <div className={styles.cardMeta}>
                                <span className={styles.cardXp}>+{xpMin === xpMax ? xpMin : `${xpMin}–${xpMax}`} XP</span>
                                <span className={styles.cardMissions}>{missionCount} mission{missionCount !== 1 ? "s" : ""}</span>
                              </div>
                              <div className={styles.cardCta}>Explore →</div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={styles.comingSoon}>
                      <span className={styles.csGlyph}>{wm.glyph}</span>
                      <div>
                        <div className={styles.csTitle}>{wm.name} — Coming Soon</div>
                        <div className={styles.csSub}>Experiences for this world are in development. Check back soon.</div>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </main>
        </div>

        {/* ── RIGHT PANEL — featured world detail ───────────────────────── */}
        <aside className={styles.sidePanel}>
          <div className={styles.sidePanelInner}>

            {/* Featured world art */}
            <div
              className={styles.sideHero}
              style={{
                background: featuredMeta?.gradient ?? "linear-gradient(135deg,#0a0820,#1a1040)",
                "--wc": featuredMeta?.color,
                "--wrgb": featuredMeta?.colorRgb,
              } as React.CSSProperties}
            >
              <div className={styles.sideHeroGlyph} aria-hidden="true">
                {featuredMeta?.glyph}
              </div>
              <div className={styles.sideHeroLabel}>{featuredMeta?.name}</div>
            </div>

            {/* Featured world info */}
            <div className={styles.sideMeta}>
              <div className={styles.sideSubject}>{subMeta.emoji} {subMeta.name}</div>
              <h3 className={styles.sideName}>{featuredMeta?.heroLine}</h3>
              <p className={styles.sideDesc}>{featuredMeta?.tagline}</p>

              <div className={styles.sideStats}>
                <div className={styles.sideStat}>
                  <span className={styles.sideStatVal}>{featuredGames.length}</span>
                  <span className={styles.sideStatLabel}>Experiences</span>
                </div>
                <div className={styles.sideStat}>
                  <span className={styles.sideStatVal}>
                    {featuredGames.reduce((s, g) => s + g.missionCount, 0)}
                  </span>
                  <span className={styles.sideStatLabel}>Missions</span>
                </div>
                <div className={styles.sideStat}>
                  <span className={styles.sideStatVal}>
                    {featuredGames.reduce((s, g) => s + g.xpMax, 0).toLocaleString()}
                  </span>
                  <span className={styles.sideStatLabel}>Max XP</span>
                </div>
              </div>

              {/* Games list in side panel */}
              <div className={styles.sideGameList}>
                {featuredGames.slice(0, 4).map(({ game, missionCount, xpMax }) => (
                  <Link key={game.id} href={`/play/${game.slug}`} className={styles.sideGameRow}>
                    <div className={styles.sideGameArt}>
                      <GameCardArt gameSlug={game.slug} emoji={subMeta.emoji} color={subMeta.color} tint={subMeta.tint} />
                    </div>
                    <div className={styles.sideGameInfo}>
                      <div className={styles.sideGameName}>{game.title}</div>
                      <div className={styles.sideGameMeta}>{missionCount} missions · +{xpMax} XP</div>
                    </div>
                    <div className={styles.sideGameCta}>Play</div>
                  </Link>
                ))}
              </div>

              {featuredGames.length > 0 && (
                <Link
                  href={`/play/${featuredGames[0].game.slug}`}
                  className={styles.sideEnterBtn}
                  style={{ "--wc": featuredMeta?.color, "--wrgb": featuredMeta?.colorRgb } as React.CSSProperties}
                >
                  Enter {featuredMeta?.name}
                </Link>
              )}
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}
