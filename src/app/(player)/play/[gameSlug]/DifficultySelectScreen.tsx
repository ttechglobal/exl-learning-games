"use client";

import { Mascot } from "@/motion/Mascot";
import { DIFFICULTY_INFO, type PlayerDifficulty } from "@/lib/content/difficultyModifiers";
import styles from "@/app/(player)/play/[gameSlug]/DifficultySelectScreen.module.css";

export interface DifficultySelectScreenProps {
  accentColor: string;
  onSelect: (difficulty: PlayerDifficulty) => void;
}

const ORDER: PlayerDifficulty[] = ["EASY", "MEDIUM", "HARD"];
const INTENSITY: Record<PlayerDifficulty, number> = { EASY: 1, MEDIUM: 2, HARD: 3 };

/** Explicit map instead of building the class name via template-literal
 *  string construction — same reasoning as the badge-class fix in
 *  HomePage.tsx: CSS Modules class names are hashed/typed, so a
 *  dynamically-built key is fragile even when the union is closed. */
const TIER_CLASS: Record<PlayerDifficulty, string> = {
  EASY: styles.tierEASY,
  MEDIUM: styles.tierMEDIUM,
  HARD: styles.tierHARD
};

/**
 * Restyled per direct feedback: the original version rendered three
 * identical-shaped rows that only differed by border color, reading more
 * like a settings list than a meaningful choice between three different
 * intensities. Now each tier card actually grows (padding, icon size,
 * label size) and saturates (background/border color-mix percentage)
 * from Easy to Hard, and a row of small "intensity bars" per tier fills
 * up more as difficulty increases — the escalation should be visible at
 * a glance, not just read off three same-shaped labels.
 */
export function DifficultySelectScreen({ accentColor, onSelect }: DifficultySelectScreenProps) {
  return (
    <div className={styles.wrap} style={{ "--accent-color": accentColor } as React.CSSProperties}>
      <div className={styles.mascotRow}>
        <Mascot pose="idle" widthPx={92} />
      </div>

      <div className={styles.heading}>
        <div className={styles.headingLabel}>Before You Begin</div>
        <div className={styles.headingTitle}>Choose Your Difficulty</div>
      </div>

      <div className={styles.tierList}>
        {ORDER.map((tier) => {
          const info = DIFFICULTY_INFO[tier];
          const filledBars = INTENSITY[tier];
          return (
            <button key={tier} className={`${styles.tierButton} ${TIER_CLASS[tier]}`} onClick={() => onSelect(tier)}>
              <div className={styles.tierIconWrap}>
                <span className={styles.tierEmoji}>{info.emoji}</span>
              </div>
              <div className={styles.tierBody}>
                <div className={styles.tierTopRow}>
                  <span className={styles.tierLabel}>{info.label}</span>
                  <span className={styles.intensityBars}>
                    {[1, 2, 3].map((i) => (
                      <span key={i} className={`${styles.intensityBar} ${i <= filledBars ? styles.filled : ""}`} />
                    ))}
                  </span>
                </div>
                <span className={styles.tierDesc}>{info.description}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}