"use client";

import { useEffect, useState } from "react";
import { recordScore } from "@/lib/content/personalBest";
import styles from "@/components/runtime/PersonalBest.module.css";

export interface PersonalBestProps {
  gameSlug: string;
  score: number;
  accentColor?: string;
}

/**
 * components/runtime/PersonalBest.tsx
 *
 * REPLACES HighScoreEntry.tsx. Per direct decision: per-game competitive
 * leaderboards (the DB-backed top-10 AND the local name-entry top-10) are
 * retired — the weekly/monthly/all-time leaderboard is now the only
 * competitive ranking surface in the app (see lib/db/queries/
 * leaderboard.ts and app/leaderboard/page.tsx). What's kept is much
 * smaller in scope and NOT competitive: a quiet "your best on this game"
 * stat, scoped to this device, with no name entry and no list of other
 * players. This is the same soft-contract trigger HighScoreEntry used —
 * GameRuntime.tsx renders this for any engine outcome reporting a
 * numeric `finalScore` — just a much simpler thing once it's rendered.
 *
 * Deliberately undramatic: a number and, only when it's actually true
 * this session, a one-line "New personal best" note. No card border in
 * gold/celebratory styling that would compete with the main success
 * payoff already shown above this on the Reflection screen.
 */
export function PersonalBest({ gameSlug, score, accentColor = "var(--eg-subject-chemistry)" }: PersonalBestProps) {
  const [result, setResult] = useState<{ value: number; isNewBest: boolean } | null>(null);

  // Runs once per mount (per completed session) — recordScore both reads
  // and, if this score actually beats the stored one, writes the new
  // value. Effect (not a render-time call) since it has a write
  // side-effect and localStorage access needs to stay client-only.
  useEffect(() => {
    setResult(recordScore(gameSlug, score));
  }, [gameSlug, score]);

  if (!result) return null;

  return (
    <div className={styles.wrap} style={{ "--accent-color": accentColor } as React.CSSProperties}>
      <div className={styles.label}>Your best on this game</div>
      <div className={styles.value}>{result.value.toLocaleString()}</div>
      {result.isNewBest && <div className={styles.newBest}>New personal best</div>}
    </div>
  );
}
