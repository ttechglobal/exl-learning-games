"use client";

import { useEffect, useState } from "react";
import { getHighScores, qualifiesAsHighScore, saveHighScore, type HighScoreEntry as LocalHighScoreEntry } from "@/lib/content/localHighScores";
import styles from "@/components/runtime/HighScoreEntry.module.css";

export interface HighScoreEntryProps {
  gameId: string;
  gameSlug: string;
  score: number;
  accentColor?: string;
}

interface DbLeaderboardRow {
  studentId: string;
  displayName: string;
  score: number;
  date: string;
  rank: number;
}

/**
 * Slots into ReflectionScreen.extraContent exactly like PeriodicTableReveal
 * does — engine/game-specific content the shared Reflection screen doesn't
 * need to know about. Triggered automatically (see GameRuntime.tsx) for
 * any engine outcome reporting a numeric `finalScore` — currently
 * tile-match (every session) and bond-match's factory mode specifically
 * (Atom Forge Level 4). bond-match's level mode and particle-assembly's
 * one-shot completion have no comparable per-session score and never
 * trigger this.
 *
 * REWRITTEN per direct feedback ("make the leaderboard come from the DB,
 * not just local" / "shouldn't only be visible when you submit a
 * score") — this used to gate its ENTIRE render behind whether the
 * current score happened to qualify for the local top 10, and even when
 * it did, the "leaderboard" shown afterward was still only ever this
 * one device's localStorage list. Two separate things now:
 *
 *   1. REAL LEADERBOARD (top of the component, ALWAYS rendered): fetches
 *      getGameLeaderboard via /api/games/[id]/leaderboard — actual
 *      scores from every player who's completed this game, server-side,
 *      visible regardless of how this particular session scored.
 *   2. LOCAL PERSONAL BEST (below, only when this session's score
 *      actually qualifies for THIS DEVICE's local top 10): unchanged in
 *      spirit from before — name + score + date saved to localStorage —
 *      kept because "did I beat my own best on this device" is still a
 *      genuinely useful, different question from "where do I rank
 *      against everyone," not a feature being removed.
 */
export function HighScoreEntry({ gameId, gameSlug, score, accentColor = "var(--eg-subject-chemistry)" }: HighScoreEntryProps) {
  const [dbLeaderboard, setDbLeaderboard] = useState<DbLeaderboardRow[] | null>(null);
  const [dbLoadFailed, setDbLoadFailed] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [localScores, setLocalScores] = useState<LocalHighScoreEntry[]>(() => getHighScores(gameSlug));
  const qualifiesLocally = qualifiesAsHighScore(gameSlug, score);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/games/${gameId}/leaderboard?limit=10`)
      .then((res) => {
        if (!res.ok) throw new Error(`leaderboard fetch failed: ${res.status}`);
        return res.json();
      })
      .then((body: { leaderboard: DbLeaderboardRow[] }) => {
        if (!cancelled) setDbLeaderboard(body.leaderboard ?? []);
      })
      .catch(() => {
        // A leaderboard that fails to load shouldn't block the rest of
        // Mission Complete — show the local section (if applicable) and
        // quietly omit the DB section rather than erroring the screen.
        if (!cancelled) setDbLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  function handleSubmitLocal() {
    const trimmed = name.trim().slice(0, 20);
    const finalName = trimmed.length > 0 ? trimmed : "Anonymous";
    const updated = saveHighScore(gameSlug, {
      name: finalName,
      score,
      date: new Date().toISOString().slice(0, 10)
    });
    setLocalScores(updated);
    setSubmitted(true);
  }

  const showDbSection = !dbLoadFailed && dbLeaderboard !== null && dbLeaderboard.length > 0;
  const showLocalCapture = qualifiesLocally && !submitted;
  const showLocalList = qualifiesLocally && submitted;

  // Nothing useful to show at all (DB still loading with nothing yet AND
  // this score doesn't qualify locally either) — render nothing rather
  // than an empty-looking box. Once the DB fetch resolves (success or
  // fail) this re-evaluates; a loading flicker is preferable to a
  // permanently empty card if the fetch is merely slow.
  if (!showDbSection && !showLocalCapture && !showLocalList && dbLeaderboard !== null) {
    return null;
  }

  return (
    <div className={styles.wrap} style={{ "--accent-color": accentColor } as React.CSSProperties}>
      {showDbSection && (
        <>
          <div className={styles.label}>🏆 Leaderboard</div>
          <div className={styles.list}>
            {dbLeaderboard!.map((entry) => (
              <div key={entry.studentId + entry.rank} className={styles.row}>
                <span className={styles.rank}>{entry.rank}</span>
                <span className={styles.name}>{entry.displayName}</span>
                <span className={styles.entryScore}>{entry.score.toLocaleString()}</span>
                <span className={styles.date}>{entry.date}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {showLocalCapture && (
        <div className={showDbSection ? styles.localSection : undefined}>
          <div className={styles.label}>⭐ New Personal Best (this device)</div>
          <div className={styles.scoreValue}>{score.toLocaleString()}</div>
          <div className={styles.formRow}>
            <input
              className={styles.nameInput}
              type="text"
              placeholder="Enter your name"
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmitLocal();
              }}
            />
            <button className={styles.saveButton} onClick={handleSubmitLocal}>
              Save
            </button>
          </div>
        </div>
      )}

      {showLocalList && (
        <div className={showDbSection ? styles.localSection : undefined}>
          <div className={styles.label}>⭐ Your Best (this device)</div>
          <div className={styles.list}>
            {localScores.map((entry, i) => (
              <div key={i} className={styles.row}>
                <span className={styles.rank}>{i + 1}</span>
                <span className={styles.name}>{entry.name}</span>
                <span className={styles.entryScore}>{entry.score.toLocaleString()}</span>
                <span className={styles.date}>{entry.date}</span>
              </div>
            ))}
          </div>
          <div className={styles.localNote}>Personal best list — saved on this device only.</div>
        </div>
      )}
    </div>
  );
}