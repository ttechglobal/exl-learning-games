"use client";

import { useEffect, useState } from "react";
import styles from "@/components/runtime/InlineLeaderboardPreview.module.css";

export interface InlineLeaderboardPreviewProps {
  gameId: string;
  accentColor?: string;
  /** How many rows to show inline — kept small on purpose (3 by
   *  default). This sits directly on the Mission Briefing card, not in
   *  a dedicated modal/screen, so it needs to read at a glance
   *  alongside the briefing text and Start button, not become its own
   *  scrollable list. The full leaderboard (LeaderboardModal) is still
   *  one tap away via the existing "View High Scores" button for
   *  anyone who wants more than the top few. */
  limit?: number;
}

interface DbLeaderboardRow {
  studentId: string;
  displayName: string;
  score: number;
  date: string;
  rank: number;
}

/**
 * components/runtime/InlineLeaderboardPreview.tsx
 *
 * Per direct feedback: "can we have the leaderboard for each game
 * beside the title card? It should easily show the high scores for
 * that game." The existing leaderboard (LeaderboardModal.tsx) already
 * existed and was already correct, but it only ever appeared after an
 * extra tap on "View High Scores" — not actually visible alongside the
 * title card the way this was asked for. This component is the
 * difference: a small, always-visible top-3 strip rendered directly on
 * EntryScreen's Mission Briefing card (see EntryScreen.tsx), fetching
 * the exact same /api/games/[id]/leaderboard endpoint
 * LeaderboardModal/HighScoreEntry already use, so there's still only
 * ONE source of truth for leaderboard data — this is a second, more
 * visible PRESENTATION of it, not a second query path that could drift
 * out of sync with the others.
 *
 * Deliberately quiet failure/empty states (no error banner, no
 * "Loading..." text taking up space) — this sits on a screen whose main
 * job is the mission briefing and Start button; a leaderboard preview
 * that can't load shouldn't visually compete with or block either of
 * those. It simply doesn't render anything until real rows exist.
 */
export function InlineLeaderboardPreview({ gameId, accentColor = "var(--eg-subject-chemistry)", limit = 3 }: InlineLeaderboardPreviewProps) {
  const [rows, setRows] = useState<DbLeaderboardRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/games/${gameId}/leaderboard?limit=${limit}`)
      .then((res) => {
        if (!res.ok) throw new Error(`leaderboard fetch failed: ${res.status}`);
        return res.json();
      })
      .then((body: { leaderboard: DbLeaderboardRow[] }) => {
        if (!cancelled) setRows(body.leaderboard ?? []);
      })
      .catch(() => {
        // Quiet failure per the file header's reasoning — rows simply
        // stays null, and null renders nothing rather than an error
        // state competing with the briefing/Start button for attention.
      });
    return () => {
      cancelled = true;
    };
  }, [gameId, limit]);

  if (!rows || rows.length === 0) return null;

  return (
    <div className={styles.wrap} style={{ "--accent-color": accentColor } as React.CSSProperties}>
      <div className={styles.label}>🏆 Top Scores</div>
      <div className={styles.list}>
        {rows.map((entry) => (
          <div key={entry.studentId + entry.rank} className={styles.row}>
            <span className={styles.rank}>{entry.rank}</span>
            <span className={styles.name}>{entry.displayName}</span>
            <span className={styles.score}>{entry.score.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
