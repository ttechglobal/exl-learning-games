"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "@/components/runtime/GameMenu.module.css";

export interface GameMenuProps {
  onRestart: () => void;
  onChangeDifficulty?: () => void;
  onReviewConcepts?: () => void;
}

/**
 * In-game menu — redesigned to match the NarrationScreen visual language.
 *
 * Trigger button: dark push-shadow (#2e1258) matching BackButton.
 * Panel: parchment (#f5f0e4) dialogue-card style with:
 *   - Dark push-shadow action buttons (Restart, Review, Change Difficulty)
 *   - Amber "Continue Playing" CTA matching NarrationScreen's Begin button
 *   - Amber-tinted Exit to Worlds (distinct action, different color)
 */
export function GameMenu({ onRestart, onChangeDifficulty, onReviewConcepts }: GameMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className={styles.menuButton} onClick={() => setOpen(true)} aria-label="Game menu">
        ☰
      </button>

      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>

            <div className={styles.sheetLabel}>⏸ Game Paused</div>

            <button
              className={styles.sheetButton}
              onClick={() => { onRestart(); setOpen(false); }}
            >
              ↻ Restart Mission
            </button>

            {onReviewConcepts && (
              <button
                className={styles.sheetButton}
                onClick={() => { onReviewConcepts(); setOpen(false); }}
              >
                ✦ Review Concepts
              </button>
            )}

            {onChangeDifficulty && (
              <button
                className={styles.sheetButton}
                onClick={() => { onChangeDifficulty(); setOpen(false); }}
              >
                🎯 Change Difficulty
              </button>
            )}

            <Link href="/worlds" className={`${styles.sheetButton} ${styles.exitButton}`}>
              ✕ Exit to Worlds
            </Link>

            <hr className={styles.divider} />

            <button className={styles.cancelButton} onClick={() => setOpen(false)}>
              ▶ Continue Playing
            </button>

          </div>
        </div>
      )}
    </>
  );
}