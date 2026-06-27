"use client";

import { Mascot } from "@/motion/Mascot";
import { DIFFICULTY_INFO, type PlayerDifficulty } from "@/lib/content/difficultyModifiers";
import styles from "@/app/(player)/play/[gameSlug]/DifficultySelectScreen.module.css";

export interface DifficultySelectScreenProps {
  accentColor: string;
  onSelect: (difficulty: PlayerDifficulty) => void;
}

const ORDER: PlayerDifficulty[] = ["EASY", "MEDIUM", "HARD"];

/** Explicit map instead of building the class name via template-literal
 *  string construction (`styles[\`tier${tier}\`]`) — same reasoning as the
 *  badge-class fix in HomePage.tsx: CSS Modules class names are
 *  hashed/typed, so a dynamically-built key is fragile even when, like
 *  here, the union is closed and the construction is currently correct. */
const TIER_CLASS: Record<PlayerDifficulty, string> = {
  EASY: styles.tierEASY,
  MEDIUM: styles.tierMEDIUM,
  HARD: styles.tierHARD
};

/**
 * Per the product brief: "Difficulty should become a player choice rather
 * than a fixed label... This makes every game replayable and suitable for
 * different levels of confidence." Shown only for engines with real
 * difficulty modifiers defined (see engineSupportsDifficultyChoice in
 * difficultyModifiers.ts) — PlayClient skips this screen entirely for an
 * engine with nothing genuine to vary, rather than showing a choice that
 * silently does nothing.
 */
export function DifficultySelectScreen({ accentColor, onSelect }: DifficultySelectScreenProps) {
  return (
    <div className={styles.wrap} style={{ "--accent-color": accentColor } as React.CSSProperties}>
      <div className={styles.mascotRow}>
        <Mascot pose="idle" widthPx={92} />
      </div>

      <div className={styles.card}>
        <div className={styles.cardLabel}>Choose Your Difficulty</div>

        <div className={styles.tierList}>
          {ORDER.map((tier) => {
            const info = DIFFICULTY_INFO[tier];
            return (
              <button key={tier} className={`${styles.tierButton} ${TIER_CLASS[tier]}`} onClick={() => onSelect(tier)}>
                <span className={styles.tierEmoji}>{info.emoji}</span>
                <span className={styles.tierText}>
                  <span className={styles.tierLabel}>{info.label}</span>
                  <span className={styles.tierDesc}>{info.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}