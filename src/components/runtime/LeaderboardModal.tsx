"use client";

import { useEffect, useState } from "react";
import styles from "@/components/runtime/LeaderboardModal.module.css";

export interface LeaderboardModalProps {
  gameId: string;
  gameTitle: string;
  accentColor?: string;
  onClose: () => void;
}

interface DbLeaderboardRow {
  studentId: string;
  displayName: string;
  score: number;
  date: string;
  rank: number;
}

/**
 * On-demand leaderboard, openable right from the Mission Briefing screen
 * via a "View High Scores" button (see EntryScreen.tsx) — per direct
 * feedback: players shouldn't have to finish a mission first just to see
 * where they (or anyone else) ranks. Fetches the exact same
 * /api/games/[id]/leaderboard endpoint HighScoreEntry.tsx uses after a
 * completed attempt, so the two surfaces can never show different data —
 * one query, one source of truth, two entry points into seeing it.
 *
 * Genuinely a modal (overlay + centered card), not an inline section —
 * per the explicit request ("which can be a modal"). Closes on backdrop
 * click or the X button; Escape key also closes it for keyboard users.
 */
export function LeaderboardModal({ gameId, gameTitle, accentColor = "var(--eg-subject-chemistry)", onClose }: LeaderboardModalProps) {
  const [rows, setRows] = useState<DbLeaderboardRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/games/${gameId}/leaderboard?limit=10`)
      .then((res) => {
        if (!res.ok) throw new Error(`leaderboard fetch failed: ${res.status}`);
        return res.json();
      })
      .then((body: { leaderboard: DbLeaderboardRow[] }) => {
        if (!cancelled) setRows(body.leaderboard ?? []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose} style={{ "--accent-color": accentColor } as React.CSSProperties}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>High Scores</div>
            <div className={styles.title}>{gameTitle}</div>
          </div>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {rows === null && !failed && <div className={styles.statusText}>Loading...</div>}
        {failed && <div className={styles.statusText}>Couldn't load the leaderboard right now.</div>}
        {rows !== null && rows.length === 0 && !failed && (
          <div className={styles.statusText}>No scores yet — be the first to set one!</div>
        )}

        {rows !== null && rows.length > 0 && (
          <div className={styles.list}>
            {rows.map((entry) => (
              <div key={entry.studentId + entry.rank} className={styles.row}>
                <span className={styles.rank}>{entry.rank}</span>
                <span className={styles.name}>{entry.displayName}</span>
                <span className={styles.score}>{entry.score.toLocaleString()}</span>
                <span className={styles.date}>{entry.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}