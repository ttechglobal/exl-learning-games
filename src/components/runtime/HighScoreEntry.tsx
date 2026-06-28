"use client";

import { useState } from "react";
import { getHighScores, qualifiesAsHighScore, saveHighScore, type HighScoreEntry } from "@/lib/content/localHighScores";
import styles from "@/components/runtime/HighScoreEntry.module.css";

export interface HighScoreEntryProps {
  gameSlug: string;
  score: number;
  accentColor?: string;
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
 * Per the brief (Part 11): name + score + date, saved locally, shown as a
 * local top-10 list — explicitly NOT a real account-linked leaderboard.
 */
export function HighScoreEntry({ gameSlug, score, accentColor = "var(--eg-subject-chemistry)" }: HighScoreEntryProps) {
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [scores, setScores] = useState<HighScoreEntry[]>(() => getHighScores(gameSlug));

  const qualifies = qualifiesAsHighScore(gameSlug, score);

  if (!qualifies && !submitted) {
    // Doesn't make the local top-10 — no prompt, no clutter on a screen
    // that already has a lot going on. The brief's "when a player
    // achieves a high score" implies this is a moment that matters, not
    // every single completion.
    return null;
  }

  function handleSubmit() {
    const trimmed = name.trim().slice(0, 20);
    const finalName = trimmed.length > 0 ? trimmed : "Anonymous";
    const updated = saveHighScore(gameSlug, {
      name: finalName,
      score,
      date: new Date().toISOString().slice(0, 10)
    });
    setScores(updated);
    setSubmitted(true);
  }

  return (
    <div className={styles.wrap} style={{ "--accent-color": accentColor } as React.CSSProperties}>
      {!submitted ? (
        <>
          <div className={styles.label}>🏆 New High Score!</div>
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
                if (e.key === "Enter") handleSubmit();
              }}
            />
            <button className={styles.saveButton} onClick={handleSubmit}>
              Save
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={styles.label}>🏆 Local Leaderboard</div>
          <div className={styles.list}>
            {scores.map((entry, i) => (
              <div key={i} className={styles.row}>
                <span className={styles.rank}>{i + 1}</span>
                <span className={styles.name}>{entry.name}</span>
                <span className={styles.entryScore}>{entry.score.toLocaleString()}</span>
                <span className={styles.date}>{entry.date}</span>
              </div>
            ))}
          </div>
          <div className={styles.localNote}>Saved on this device only.</div>
        </>
      )}
    </div>
  );
}