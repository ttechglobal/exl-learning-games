"use client";

import { useState } from "react";
import { useTheme } from "@/components/ui/ThemeProvider";
import { SiteHeader } from "@/components/ui/SiteHeader";
import type { LeaderboardEntry, LeaderboardPeriod } from "@/lib/db/queries/leaderboard";
import styles from "@/app/leaderboard/LeaderboardClient.module.css";

export interface StudentRankInfo {
  rank: number;
  xpTotal: number;
  totalRanked: number;
}

export interface LeaderboardClientProps {
  initialPeriod: LeaderboardPeriod;
  initialEntries: LeaderboardEntry[];
  initialMyRank: StudentRankInfo | null;
  currentStudentId?: string;
  currentStudentXp?: number;
}

const TABS: { key: LeaderboardPeriod; label: string }[] = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "allTime", label: "All-Time" }
];

const RANK_MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/**
 * app/leaderboard/LeaderboardClient.tsx
 *
 * The full leaderboard surface — per direct decision: top 20 (not the
 * homepage's top 5 teaser), with three tabs (Weekly / Monthly /
 * All-Time — "users can still see their total XP, but there will also
 * be a weekly leaderboard and monthly") sharing one shared list UI, and
 * a pinned "Your rank" row whenever the viewing student exists but isn't
 * already visible in the top 20 for the active tab.
 *
 * Weekly is the default/first tab — it resets most often, which keeps
 * the board feeling alive (a new student can realistically reach it)
 * rather than being permanently dominated by whoever has the most
 * lifetime XP. All-Time still exists as its own tab for exactly that
 * "total XP" view, just not as the default.
 *
 * Tab switches re-fetch from /api/leaderboard rather than navigating —
 * see page.tsx's header for why only the default period is fetched
 * server-side.
 */
export function LeaderboardClient({ initialPeriod, initialEntries, initialMyRank, currentStudentId, currentStudentXp }: LeaderboardClientProps) {
  const { theme, toggleTheme } = useTheme();
  const [period, setPeriod] = useState<LeaderboardPeriod>(initialPeriod);
  const [entries, setEntries] = useState<LeaderboardEntry[]>(initialEntries);
  const [myRank, setMyRank] = useState<StudentRankInfo | null>(initialMyRank);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleTabChange(next: LeaderboardPeriod) {
    if (next === period) return;
    setPeriod(next);
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/leaderboard?period=${next}&limit=20`);
      if (!res.ok) throw new Error(`leaderboard fetch failed: ${res.status}`);
      const body: { entries: LeaderboardEntry[]; myRank: StudentRankInfo | null } = await res.json();
      setEntries(body.entries ?? []);
      setMyRank(body.myRank ?? null);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  // The viewing student is shown a pinned row below the top-20 list ONLY
  // when they're not already visible in it — otherwise their normal row
  // (highlighted via .lbRowYou, the same hook HomePage.module.css already
  // defines for this) is enough; a second "you" row would be redundant.
  const amIVisible = currentStudentId ? entries.some((e) => e.studentId === currentStudentId) : true;
  const showPinnedRank = currentStudentId && myRank && !amIVisible;

  return (
    <div className={styles.page} data-theme={theme}>
      <SiteHeader theme={theme} onToggleTheme={toggleTheme} active="leaderboard" currentStudentXp={currentStudentXp} />

      <div className={styles.container}>
        <div className={styles.headRow}>
          <h1 className={styles.title}>🏆 Leaderboard</h1>
          <p className={styles.subtitle}>Earn XP by completing missions across every game to climb the board.</p>
        </div>

        <div className={styles.tabs} role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={period === tab.key}
              className={`${styles.tab} ${period === tab.key ? styles.tabActive : ""}`}
              onClick={() => handleTabChange(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.panel}>
          {loading && <div className={styles.statusText}>Loading...</div>}
          {!loading && failed && <div className={styles.statusText}>Couldn't load the leaderboard right now.</div>}
          {!loading && !failed && entries.length === 0 && (
            <div className={styles.statusText}>No rankings yet for this period — play a game to be the first on the board.</div>
          )}

          {!loading && !failed && entries.length > 0 && (
            <div className={styles.list}>
              {entries.map((entry) => (
                <div
                  key={entry.studentId}
                  className={`${styles.row} ${entry.studentId === currentStudentId ? styles.rowYou : ""}`}
                >
                  <div className={styles.rank}>{RANK_MEDALS[entry.rank] ?? entry.rank}</div>
                  <div className={styles.info}>
                    <div className={styles.name}>{entry.displayName}</div>
                    <div className={styles.sub}>{entry.gamesPlayed} games played</div>
                  </div>
                  <div className={styles.xp}>
                    {entry.xpTotal.toLocaleString()} <span>XP</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showPinnedRank && myRank && (
            <>
              <div className={styles.pinnedDivider}>Your rank</div>
              <div className={`${styles.row} ${styles.rowYou} ${styles.rowPinned}`}>
                <div className={styles.rank}>{myRank.rank}</div>
                <div className={styles.info}>
                  <div className={styles.name}>You</div>
                  <div className={styles.sub}>out of {myRank.totalRanked.toLocaleString()} ranked players</div>
                </div>
                <div className={styles.xp}>
                  {myRank.xpTotal.toLocaleString()} <span>XP</span>
                </div>
              </div>
            </>
          )}

          {currentStudentId && !loading && !failed && !myRank && (
            <div className={styles.notRankedNote}>Play a game this period to appear on the board.</div>
          )}
        </div>
      </div>
    </div>
  );
}
