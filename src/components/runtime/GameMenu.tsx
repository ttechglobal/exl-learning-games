"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "@/components/runtime/GameMenu.module.css";

export interface GameMenuProps {
  onRestart: () => void;
  /**
   * Per direct feedback: players should be able to change difficulty
   * mid-game, not just at the very start. Optional and additive — only
   * PlayClient passes this (and only when
   * engineSupportsDifficultyChoice(game.engine_type) is true; see
   * PlayClient.tsx's `menu` construction), so a game with no real
   * difficulty modifiers defined simply doesn't get this button at all,
   * same reasoning DifficultySelectScreen itself already uses to decide
   * whether to show the picker in the first place.
   */
  onChangeDifficulty?: () => void;
}

/**
 * In-game menu — replaces the top-level SiteHeader inside the play flow
 * entirely (per direct instruction: no site nav inside the game). Per
 * the gameplay-redesign brief, section 6 ("Simplify the Menu... Restart
 * Mission, Exit to Worlds. Remove unnecessary actions"): the core two
 * options, nothing else — PLUS, per later direct feedback, an optional
 * third "Change Difficulty" action for engines that actually support a
 * difficulty choice (see onChangeDifficulty's own comment). Not a
 * contradiction of "remove unnecessary actions": this one's only ever
 * rendered when it does something real, the same standard the original
 * two already met.
 *
 * PAUSE REMOVED FROM THIS MENU BY DIRECT INSTRUCTION — but the
 * underlying isPaused mechanism (GameplayShell's pause overlay,
 * EngineRuntimeProps.isPaused, TileMatchEngine's timer-halting logic) is
 * intentionally left in place, not ripped out, since it's real, already
 * working, already verified (timer genuinely stops, tile taps are
 * blocked, no answer-leaking through the feedback text either — see
 * earlier session notes). If pause needs a UI trigger again later (e.g.
 * a dedicated icon beside this menu button, not inside the sheet), that
 * infrastructure is already correct and doesn't need rebuilding —
 * PlayClient.tsx would just need a new way to flip isPaused, not a new
 * way to MAKE pause work.
 *
 * Exit always goes to /worlds (not browser back) — a player exiting
 * mid-mission should land somewhere coherent, not wherever history
 * happens to point.
 */
export function GameMenu({ onRestart, onChangeDifficulty }: GameMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className={styles.menuButton} onClick={() => setOpen(true)} aria-label="Game menu">
        ☰
      </button>

      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetLabel}>Game Menu</div>

            <button
              className={styles.sheetButton}
              onClick={() => {
                onRestart();
                setOpen(false);
              }}
            >
              ↻ Restart Mission
            </button>

            {onChangeDifficulty && (
              <button
                className={styles.sheetButton}
                onClick={() => {
                  onChangeDifficulty();
                  setOpen(false);
                }}
              >
                🎯 Change Difficulty
              </button>
            )}

            <Link href="/worlds" className={`${styles.sheetButton} ${styles.exitButton}`}>
              ✕ Exit to Worlds
            </Link>

            <button className={styles.cancelButton} onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}