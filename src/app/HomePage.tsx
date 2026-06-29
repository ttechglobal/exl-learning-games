"use client";

import Link from "next/link";
import type { GameRow } from "@/types/db";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { useTheme } from "@/components/ui/ThemeProvider";
import { SUBJECT_META } from "@/lib/content/subjects";
import { GAME_CARD_ART, GAME_CARD_DESC } from "@/lib/content/gameCardMeta";
import styles from "@/app/HomePage.module.css";

/**
 * HomePage.tsx — "learning arcade lobby" redesign.
 *
 * Replaces the previous mascot-hero homepage. No traditional marketing
 * hero: minimal top bar, one bold typographic statement, a subject rail
 * that acts as navigation (not the main content), and a promoted games
 * grid — games are the main event here, subjects are just a filter.
 *
 * DATA HONESTY NOTE: this component is wired to exactly what `page.tsx`
 * already fetches (`gamesBySubject`, `featuredGames` via lib/db/queries/
 * games, and now `leaderboard` via lib/db/queries/leaderboard's
 * getWeeklyLeaderboard — see that file for why it's a genuinely weekly
 * figure computed from the attempt table, not StudentRow.xp_total's
 * lifetime total). One piece of the original mockup still doesn't exist
 * anywhere in the schema and is intentionally left as an honest gap
 * rather than faked:
 *
 *   - "coins" — there is no coins column anywhere in the schema (only
 *     xp_total on student). The top-bar pill below shows XP, not coins,
 *     for that reason. Don't reintroduce a coins display without a real
 *     column + query backing it.
 *
 * `leaderboard` stays an optional prop (the query can fail or return
 * empty for a brand-new install with no attempts yet this week) — this
 * section renders an honest empty state in that case rather than a
 * hardcoded mock list.
 *
 * Subject metadata and game card art/descriptions used to be local
 * constants here — promoted to lib/content/subjects.ts and
 * lib/content/gameCardMeta.ts since /worlds needs the exact same data and
 * a second hand-copied duplicate would drift. (A /worlds/[subject]
 * "Choose Game" split briefly existed and was reverted — /worlds is a
 * single combined page again; these shared modules stayed since the
 * homepage needs them regardless of how /worlds is structured.)
 */

const SUBJECTS = Object.entries(SUBJECT_META).map(([key, meta]) => ({ key, ...meta }));

type Badge = "featured" | "new" | "trending" | "popular";

/** Difficulty (EASY/MEDIUM/HARD) lives on MissionRow, not GameRow, so a
 *  per-game star rating isn't derivable from listGames() alone yet. Until
 *  featured games carry an aggregate difficulty, this is a fixed display
 *  value rather than a fabricated per-game number. */
const DEFAULT_STARS = "\u2605\u2605\u2606\u2606\u2606";

const BADGE_LABEL: Record<Badge, string> = {
  featured: "Featured",
  new: "New",
  trending: "Trending",
  popular: "Popular"
};

/** Explicit map instead of building the class name via string concatenation
 *  against `styles` — CSS Modules class names are hashed/typed, so
 *  `styles[`badge${x}`]` is fragile (breaks silently if casing or the
 *  generated .d.ts ever drift). Each value here is a literal styles.* key. */
const BADGE_CLASS: Record<Badge, string> = {
  featured: styles.badgeFeatured,
  new: styles.badgeNew,
  trending: styles.badgeTrending,
  popular: styles.badgePopular
};

/** Cycles through meaningful badges by position rather than asserting a
 *  real "trending this week" signal that isn't tracked yet. Replace with
 *  real engagement data (plays/week, recency) once that's available. */
function badgeForIndex(i: number): Badge {
  const order: Badge[] = ["featured", "new", "trending", "popular"];
  return order[i % order.length];
}export interface LeaderboardEntry {
  studentId: string;
  displayName: string;
  xpTotal: number;
  gamesPlayed: number;
  rank: number;
  avatarEmoji?: string;
}

export interface HomePageProps {
  gamesBySubject: Record<string, GameRow[]>;
  featuredGames: GameRow[];
  /** Optional since the query can return empty (no attempts yet this
   *  week) or fail — see getLeaderboard("weekly", ...) in
   *  lib/db/queries/leaderboard.ts, wired up in page.tsx. */
  leaderboard?: LeaderboardEntry[];
  /** Current student's XP total for the header pill; omit while logged out. */
  currentStudentXp?: number;
}

export function HomePage({ gamesBySubject, featuredGames, leaderboard, currentStudentXp }: HomePageProps) {
  const { theme, toggleTheme } = useTheme();

  const champion = leaderboard?.[0];
  // Top 5 total on the homepage (1 champion + 4 more) — see page.tsx's
  // HOMEPAGE_LEADERBOARD_SIZE comment for why this shrank from the
  // previous top 10 now that /leaderboard exists as the "see more"
  // destination (top 20 + your rank, with weekly/monthly/all-time tabs).
  const rest = leaderboard?.slice(1, 5) ?? [];

  return (
    <div className={styles.page} data-theme={theme}>
      <div className={styles.ambient} aria-hidden="true">
        <div className={styles.ambientBlob} style={{ width: 420, height: 420, top: -120, left: -80, background: "var(--eg-subject-chemistry)" }} />
        <div className={styles.ambientBlob} style={{ width: 380, height: 380, top: 280, right: -100, background: "var(--eg-subject-mathematics)" }} />
        <div className={styles.ambientBlob} style={{ width: 320, height: 320, bottom: 60, left: "10%", background: "var(--eg-subject-physics)" }} />
        <div className={styles.ambientBlob} style={{ width: 300, height: 300, bottom: -100, right: "15%", background: "var(--eg-subject-biology)" }} />

        <svg className={`${styles.ambientSymbol} ${styles.driftA}`} style={{ top: "14%", left: "6%" }} width="46" height="46" viewBox="0 0 46 46">
          <circle cx="23" cy="23" r="6" fill="var(--eg-subject-chemistry)" />
          <circle cx="36" cy="14" r="4" fill="var(--eg-subject-chemistry)" opacity={0.6} />
          <line x1="23" y1="23" x2="36" y2="14" stroke="var(--eg-subject-chemistry)" strokeWidth={1.6} />
        </svg>
        <svg className={`${styles.ambientSymbol} ${styles.driftB}`} style={{ top: "8%", right: "10%" }} width="60" height="40" viewBox="0 0 60 40">
          <text x="0" y="30" fontFamily="var(--eg-font-display)" fontWeight={700} fontSize={28} fill="var(--eg-subject-mathematics)">
            &#8721;
          </text>
        </svg>
        <svg className={`${styles.ambientSymbol} ${styles.driftC}`} style={{ top: "38%", left: "3%" }} width="40" height="40" viewBox="0 0 40 40">
          <path d="M22 6 L8 26 h10 L12 40 L34 14 H22 Z" fill="var(--eg-subject-physics)" />
        </svg>
        <svg className={`${styles.ambientSymbol} ${styles.driftA}`} style={{ top: "60%", right: "5%" }} width="44" height="56" viewBox="0 0 44 56">
          <path d="M10 6 C28 16 12 28 30 36 C26 48 10 48 10 56" fill="none" stroke="var(--eg-subject-biology)" strokeWidth={2.4} strokeLinecap="round" />
        </svg>
      </div>

      <SiteHeader theme={theme} onToggleTheme={toggleTheme} active="games" currentStudentXp={currentStudentXp} />

      <div className={`${styles.playHero} ${styles.container}`}>
        <div className={styles.playHeroMotifs} aria-hidden="true">
          <svg className={styles.phMotif} style={{ top: -46, left: "10%", animationDelay: "-1s" }} width="40" height="40" viewBox="0 0 40 40">
            <path
              d="M16 0 L16 16 L4 36 a6 6 0 0 0 5 9 h22 a6 6 0 0 0 5-9 L24 16 L24 0"
              fill="none"
              stroke="var(--eg-subject-chemistry)"
              strokeWidth={3}
            />
          </svg>
          <svg className={styles.phMotif} style={{ top: -30, right: "12%", animationDelay: "-2.2s" }} width="36" height="36" viewBox="0 0 36 36">
            <polygon points="18,4 32,12 32,26 18,34 4,26 4,12" fill="none" stroke="var(--eg-subject-mathematics)" strokeWidth={2.4} />
          </svg>
          <svg className={styles.phMotif} style={{ top: 10, left: "2%", animationDelay: "-0.4s" }} width="30" height="30" viewBox="0 0 30 30">
            <path d="M15 2 L7 18 h6 L9 28 L23 10 H17 Z" fill="var(--eg-subject-physics)" />
          </svg>
        </div>
        <h1 className={styles.fd}>
          <span className={styles.w1}>PLAY.</span> <span className={styles.w2}>LEARN.</span> <span className={styles.w3}>MASTER.</span>
        </h1>
        <p>Master the subjects you learn in school through interactive games.</p>
        <Link href="/worlds" className={`${styles.heroCta} ${styles.fd}`}>
          Start Learning
        </Link>
      </div>

      <div className={styles.container} id="worlds">
        <div className={styles.railHead}>
          <span className={`${styles.railTag} ${styles.fd}`}>Learn by subject</span>
        </div>
        <div className={styles.subjectGrid}>
          {SUBJECTS.map((subject) => {
            const games = gamesBySubject[subject.key] ?? [];
            const isLive = games.length > 0;
            const card = (
              <div
                className={`${styles.subjectCard} ${isLive ? "" : styles.subjectCardLocked}`}
                style={{ "--c": subject.color, "--c-tint": subject.tint } as React.CSSProperties}
              >
                <span className={styles.subjectCardIco}>{subject.emoji}</span>
                <span className={`${styles.subjectCardName} ${styles.fd}`}>{subject.name}</span>
                <span className={styles.subjectCardCount}>{isLive ? `${games.length} games` : "Coming soon"}</span>
              </div>
            );
            return isLive ? (
              <Link key={subject.key} href={`/worlds#${subject.key}`}>
                {card}
              </Link>
            ) : (
              <div key={subject.key}>{card}</div>
            );
          })}
        </div>
      </div>

      {featuredGames.length > 0 && (
        <section className={styles.gameZone}>
          <div className={styles.container}>
            <div className={styles.railHead}>
              <span className={`${styles.railTag} ${styles.fd}`}>🔥 Popular games</span>
            </div>

            <div className={styles.popularGrid}>
              {featuredGames.map((game, i) => {
                const subject = SUBJECTS.find((s) => s.key === game.subject);
                const badge = badgeForIndex(i);
                return (
                  <Link
                    key={game.id}
                    href={`/play/${game.slug}`}
                    className={styles.pgCard}
                    style={{ "--c": subject?.color ?? "var(--eg-subject-chemistry)", "--c-tint": subject?.tint ?? "var(--eg-brand-tint)" } as React.CSSProperties}
                  >
                    <div className={styles.pgArt}>
                      <img className={styles.pgArtImg} src={GAME_CARD_ART[game.slug] ?? ""} alt="" />
                      <div className={`${styles.pgBadge} ${BADGE_CLASS[badge]}`}>{BADGE_LABEL[badge]}</div>
                    </div>
                    <div className={styles.pgBody}>
                      <div className={styles.pgTop}>
                        <span className={`${styles.pgTitle} ${styles.fd}`}>{game.title}</span>
                        <span className={styles.pgStars} aria-label="Difficulty">
                          {DEFAULT_STARS}
                        </span>
                      </div>
                      <p className={styles.pgDesc}>{GAME_CARD_DESC[game.slug] ?? ""}</p>
                      <div className={styles.pgMeta}>
                        <span>{subject?.name ?? game.subject}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className={styles.lbZone} id="leaderboard">
        <div className={styles.container}>
          <div className={styles.railHead}>
            <span className={`${styles.railTag} ${styles.fd}`}>🏆 Top players</span>
          </div>

          {leaderboard && leaderboard.length > 0 ? (
            <div className={styles.lbPanel}>
              {champion && (
                <div className={styles.championCard}>
                  <div className={styles.championGlow} aria-hidden="true" />
                  <div className={styles.championCrown}>👑</div>
                  <div className={styles.championAvatar}>{champion.avatarEmoji ?? "🧑‍🚀"}</div>
                  <div className={`${styles.championName} ${styles.fd}`}>{champion.displayName}</div>
                  <div className={styles.championLabel}>Weekly Champion</div>
                  <div className={styles.championStats}>
                    <div>
                      <b className={styles.fd}>{champion.xpTotal.toLocaleString()}</b>
                      <span>XP</span>
                    </div>
                    <div>
                      <b className={styles.fd}>{champion.gamesPlayed}</b>
                      <span>Games</span>
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.lbList}>
                {rest.map((entry) => (
                  <div key={entry.studentId} className={styles.lbRow}>
                    <div className={styles.lbRank}>{entry.rank}</div>
                    <div className={styles.lbAvatar}>{entry.avatarEmoji ?? "⭐"}</div>
                    <div className={styles.lbInfo}>
                      <div className={styles.lbName}>{entry.displayName}</div>
                      <div className={styles.lbSub}>{entry.gamesPlayed} games played</div>
                    </div>
                    <div className={styles.lbXp}>
                      {entry.xpTotal.toLocaleString()} <span>XP</span>
                    </div>
                  </div>
                ))}
              </div>

              <Link href="/leaderboard" className={styles.lbSeeFullLink}>
                See full leaderboard
              </Link>
            </div>
          ) : (
            <div className={styles.lbList}>
              <div className={styles.lbEmpty}>
                Leaderboard rankings are coming soon — play a game to be one of the first on the board.
              </div>
            </div>
          )}
        </div>
      </section>

      <section className={styles.finaleZone}>
        <div className={styles.container}>
          <div className={styles.finalePanel}>
            <div className={`${styles.finaleGlow} ${styles.finaleGlowG1}`} aria-hidden="true" />
            <div className={`${styles.finaleGlow} ${styles.finaleGlowG2}`} aria-hidden="true" />

            <h2 className={styles.fd}>
              Your Next Subject
              <br />
              Is One Game Away
            </h2>
            <p className={styles.finaleSub}>
              Every game on EXL turns a real school topic into something you actually want to finish. Keep playing,
              keep mastering — there&apos;s always another world to step into.
            </p>

            <div className={styles.finaleGrid}>
              <div className={styles.finaleItem}>
                <span className={styles.fiIco}>🆕</span>
                <span>New games released regularly</span>
              </div>
              <div className={styles.finaleItem}>
                <span className={styles.fiIco}>🌍</span>
                <span>More subjects coming soon</span>
              </div>
              <div className={styles.finaleItem}>
                <span className={styles.fiIco}>📅</span>
                <span>Daily challenges</span>
              </div>
              <div className={styles.finaleItem}>
                <span className={styles.fiIco}>⚔️</span>
                <span>Weekly competitions</span>
              </div>
              <div className={styles.finaleItem}>
                <span className={styles.fiIco}>🏅</span>
                <span>Unlockable achievements</span>
              </div>
            </div>

            <Link href="/worlds" className={`${styles.btnFinale} ${styles.fd}`}>
              Start Learning
            </Link>
          </div>
        </div>
      </section>

      <footer className={styles.siteFooter}>
        <div className={`${styles.container} ${styles.footerRow}`}>
          <div className={styles.footerBrand}>
            <div className={`${styles.footerMark} ${styles.fd}`}>E</div>
            <span className={styles.fd}>EXL</span>
          </div>
          <span className={styles.footerTag}>Master school subjects through play</span>
        </div>
      </footer>
    </div>
  );
}