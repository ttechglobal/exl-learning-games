"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/components/ui/ThemeProvider";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { ShareInvite } from "@/components/ui/ShareInvite";
import { DepthBackdrop } from "@/motion/DepthBackdrop";
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
  { key: "weekly", label: "This Week" },
  { key: "monthly", label: "30 Days" },
  { key: "allTime", label: "All Time" }
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

  /**
   * Fetch the viewer's own rank client-side on mount. The server page no
   * longer sends it (see page.tsx's CACHING STRATEGY comment) — the
   * leaderboard data itself is served from ISR cache for instant load,
   * and "your rank" (which varies per device) is fetched separately here
   * so it doesn't bust that cache. The viewer sees the full top-20 list
   * immediately from cache, and their own rank row fills in one beat
   * later once this resolves. If the fetch fails, we just don't show
   * the pinned row — the rest of the page is unaffected.
   */
  useEffect(() => {
    if (!currentStudentId) return;
    fetch(`/api/leaderboard?period=${period}&limit=20`)
      .then((res) => {
        if (!res.ok) throw new Error("rank fetch failed");
        return res.json() as Promise<{ entries: LeaderboardEntry[]; myRank: StudentRankInfo | null }>;
      })
      .then((body) => {
        setMyRank(body.myRank ?? null);
      })
      .catch(() => {
        // Quiet failure — rank just won't show, which is fine
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStudentId]);

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

      <div className={styles.titleRow}>
        <DepthBackdrop accentColor="var(--eg-gold)" />
        <div className={styles.container}>
          <div className={styles.headRow}>
            <h1 className={styles.title}>🏆 Leaderboard</h1>
            <p className={styles.subtitle}>Earn XP by completing missions across every game to climb the board.</p>
          </div>
        </div>
      </div>

      <div className={styles.container}>
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
                    <div className={styles.nameRow}>
                      <div className={styles.name}>{entry.displayName}</div>
                      {entry.school && <div className={styles.schoolTag}>{entry.school}</div>}
                    </div>
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
                  <div className={styles.nameRow}>
                    <div className={styles.name}>You</div>
                    <div className={styles.schoolTag}>out of {myRank.totalRanked.toLocaleString()} ranked</div>
                  </div>
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

        {/* Invite friends — shown below the leaderboard so the player
            sees the rankings first (the reason to share), then the CTA.
            Uses the Web Share API on Android/iOS (triggers native share
            sheet including WhatsApp) and falls back to clipboard copy. */}
        <div className={styles.shareZone}>
          <div className={styles.sharePrompt}>Know someone who should be on here?</div>
          <ShareInvite
            title="EXL Learning Games — Beat my score!"
            text="I've been studying Chemistry, Physics and more with these games — come challenge me on the leaderboard!"
            label="Invite Friends to Play"
            variant="banner"
          />
        </div>
      </div>
    </div>
  );
}
