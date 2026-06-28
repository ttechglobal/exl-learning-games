"use client";

import styles from "@/components/runtime/BackButton.module.css";

export interface BackButtonProps {
  onBack: () => void;
  /** Accessible label — defaults to "Back" but callers can be more specific
   *  (e.g. "Back to Worlds") since screen readers announce this directly. */
  label?: string;
}

/**
 * Replaces GameMenu on every PRE-PLAY screen (Level Select, Mission
 * Briefing, Difficulty Select, Mission Objectives). Per direct feedback:
 * the in-game menu (Restart Mission / Exit to Worlds) belongs to actual
 * gameplay only — these screens aren't gameplay yet, so a simple Back
 * action is the right control here, not a menu sheet with restart/exit
 * options that don't really apply before a mission has even started.
 *
 * UPDATED: now rendered by PrePlayShell, inside its .headerRow, alongside
 * MissionTopBar — not independently position:fixed in its own corner
 * anymore (that was the earlier design; see PrePlayShell.tsx for why it
 * changed — rendering BackButton/MissionTopBar as independent siblings
 * with no shared backdrop is exactly what caused a real "top bar is a
 * different color from the rest of the screen" bug). Same reasoning as
 * GameMenu.module.css's button: a position:fixed element ignores
 * whatever flex layout wraps it, so once this needed to sit predictably
 * beside MissionTopBar in one row, it had to stop being fixed too.
 *
 * Always calls a caller-supplied onBack rather than browser history —
 * PlayClient decides what "back" means at each step (Difficulty -> Entry,
 * Entry -> Level Select or Worlds, etc.), the same way GameMenu's Exit
 * always goes to a fixed destination rather than trusting wherever
 * history happens to point.
 */
export function BackButton({ onBack, label = "Back" }: BackButtonProps) {
  return (
    <button className={styles.backButton} onClick={onBack} aria-label={label}>
      ←
    </button>
  );
}
