"use client";

/**
 * GameTitleScreen.tsx
 *
 * The splash/title screen shown when a student first enters a game.
 * Displayed as the FIRST screen before NarrationScreen, giving every
 * game a consistent, exciting entrance — like "The Quest for Knowledge"
 * reference image.
 *
 * VISUAL DESIGN:
 *   - Full-screen dark atmospheric background with subject-specific gradient
 *   - Large animated game title in the EXL stamp style
 *   - Subject character/icon floats above the title
 *   - Animated "PLAY" button at the bottom (Duolingo-style push shadow)
 *   - XP reward badge and mission count visible — sets expectations
 *   - Auto-advances after 8 seconds OR when student taps Play
 *
 * FLOW:
 *   Worlds page → game card → GameTitleScreen → NarrationScreen → game
 */

import { useEffect, useState } from "react";
import { CharacterFigure } from "@/components/exl/NarrationScene";
import styles from "@/components/runtime/GameTitleScreen.module.css";

export interface GameTitleScreenProps {
  gameTitle: string;
  subject: string;
  missionTitle: string;
  missionCount: number;
  xpReward: number;
  onPlay: () => void;
  onBack: () => void;
}

const SUBJECT_GRADIENT: Record<string, string> = {
  chemistry:   "linear-gradient(160deg, #0d0320 0%, #1a0840 40%, #2d1260 70%, #100428 100%)",
  mathematics: "linear-gradient(160deg, #020810 0%, #041828 40%, #083060 70%, #020c18 100%)",
  physics:     "linear-gradient(160deg, #180408 0%, #280810 40%, #480820 70%, #140208 100%)",
  biology:     "linear-gradient(160deg, #021008 0%, #042018 40%, #083828 70%, #020e06 100%)",
};

const SUBJECT_ACCENT_RGB: Record<string, string> = {
  chemistry:   "123,79,203",
  mathematics: "47,155,214",
  physics:     "255,111,145",
  biology:     "76,175,110",
};

const SUBJECT_GLYPH: Record<string, string> = {
  chemistry:   "⚗️",
  mathematics: "📐",
  physics:     "⚡",
  biology:     "🧬",
};

export function GameTitleScreen({
  gameTitle,
  subject,
  missionTitle,
  missionCount,
  xpReward,
  onPlay,
  onBack,
}: GameTitleScreenProps) {
  const [entered, setEntered] = useState(false);
  const [autoCountdown, setAutoCountdown] = useState(false);

  const gradient  = SUBJECT_GRADIENT[subject]  ?? SUBJECT_GRADIENT.chemistry;
  const accentRgb = SUBJECT_ACCENT_RGB[subject] ?? "123,79,203";
  const glyph     = SUBJECT_GLYPH[subject]      ?? "🔬";

  // Trigger entrance animation
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Shimmer on the button after 2s
  useEffect(() => {
    const t = setTimeout(() => setAutoCountdown(true), 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={styles.screen}
      style={{
        background: gradient,
        "--aRgb": accentRgb,
      } as React.CSSProperties}
    >
      {/* Radial glow behind title */}
      <div className={styles.glow} aria-hidden="true" />

      {/* Subtle grid */}
      <div className={styles.grid} aria-hidden="true" />

      {/* Back button */}
      <button className={styles.backBtn} onClick={onBack} aria-label="Back to worlds">
        ←
      </button>

      {/* ── CHARACTER ─────────────────────────────────────────────────── */}
      <div
        className={[styles.character, entered ? styles.characterIn : ""].filter(Boolean).join(" ")}
        aria-hidden="true"
      >
        <CharacterFigure subject={subject} />
      </div>

      {/* ── TITLE BLOCK ───────────────────────────────────────────────── */}
      <div className={[styles.titleBlock, entered ? styles.titleIn : ""].filter(Boolean).join(" ")}>

        {/* Subject glyph above the title */}
        <div className={styles.glyphBadge} aria-hidden="true">{glyph}</div>

        {/* "THE" label */}
        <div className={styles.theLabel}>THE</div>

        {/* Main game title — stroke text on coloured background pill */}
        <div className={styles.titlePill}>
          <h1 className={styles.titleText}>{gameTitle}</h1>
        </div>

        {/* Mission subtitle */}
        <div className={styles.missionChip}>
          {missionTitle}
        </div>
      </div>

      {/* ── STATS ROW ─────────────────────────────────────────────────── */}
      <div className={[styles.statsRow, entered ? styles.statsIn : ""].filter(Boolean).join(" ")}>
        <div className={styles.stat}>
          <span className={styles.statVal}>{missionCount}</span>
          <span className={styles.statLabel}>Mission{missionCount !== 1 ? "s" : ""}</span>
        </div>
        <div className={styles.statDivider} aria-hidden="true" />
        <div className={styles.stat}>
          <span className={styles.statVal}>+{xpReward}</span>
          <span className={styles.statLabel}>XP</span>
        </div>
        <div className={styles.statDivider} aria-hidden="true" />
        <div className={styles.stat}>
          <span className={styles.statVal}>🏆</span>
          <span className={styles.statLabel}>Track progress</span>
        </div>
      </div>

      {/* ── PLAY BUTTON ───────────────────────────────────────────────── */}
      <div className={[styles.ctaWrap, entered ? styles.ctaIn : ""].filter(Boolean).join(" ")}>
        <button
          className={[styles.playBtn, autoCountdown ? styles.playBtnReady : ""].filter(Boolean).join(" ")}
          onClick={onPlay}
        >
          <span className={styles.playIcon} aria-hidden="true">▶</span>
          Play Now
        </button>
        <p className={styles.tapHint}>Tap to begin your mission</p>
      </div>
    </div>
  );
}
