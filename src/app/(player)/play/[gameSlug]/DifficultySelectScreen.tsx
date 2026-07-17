"use client";

import { DIFFICULTY_INFO, type PlayerDifficulty } from "@/lib/content/difficultyModifiers";
import { CharacterFigure, SceneBackground } from "@/app/(player)/play/[gameSlug]/NarrationScene";
import styles from "@/app/(player)/play/[gameSlug]/DifficultySelectScreen.module.css";

export interface DifficultySelectScreenProps {
  subject: string;
  accentColor: string;
  onSelect: (difficulty: PlayerDifficulty) => void;
  onBack?: () => void;
}

const ORDER: PlayerDifficulty[] = ["EASY", "MEDIUM", "HARD"];
const INTENSITY: Record<PlayerDifficulty, number> = { EASY: 1, MEDIUM: 2, HARD: 3 };

const TIER_CLASS: Record<PlayerDifficulty, string> = {
  EASY: styles.tierEASY,
  MEDIUM: styles.tierMEDIUM,
  HARD: styles.tierHARD,
};

/**
 * Redesigned as a full NarrationScreen-style screen:
 * - Owns its own dark scene (no longer uses PrePlayShell)
 * - Character fills the scene area just like NarrationScreen
 * - Parchment card at the bottom / right column contains the tier choices
 * - Desktop: side-by-side layout matching NarrationScreen exactly
 */
export function DifficultySelectScreen({ subject, accentColor: _accentColor, onSelect, onBack }: DifficultySelectScreenProps) {
  return (
    <div className={styles.screen}>

      {/* ── SCENE ── */}
      <div className={styles.scene}>
        <SceneBackground subject={subject} />

        {onBack && (
          <button className={styles.backBtn} onClick={onBack} aria-label="Go back">
            ←
          </button>
        )}

        <div className={styles.characterWrap} aria-hidden="true">
          <CharacterFigure subject={subject} />
        </div>

        <div className={styles.sceneBadge}>
          <span className={styles.sceneBadgeTitle}>Choose Difficulty</span>
          <span className={styles.sceneBadgeSub}>Before You Begin</span>
        </div>
      </div>

      {/* ── PARCHMENT CARD — tier buttons ── */}
      <div className={styles.card}>
        <div className={styles.cardNotch} />
        <div className={styles.cardLabel}>Select Your Challenge</div>

        <div className={styles.tierList}>
          {ORDER.map((tier) => {
            const info = DIFFICULTY_INFO[tier];
            const filledBars = INTENSITY[tier];
            return (
              <button
                key={tier}
                className={`${styles.tierButton} ${TIER_CLASS[tier]}`}
                onClick={() => onSelect(tier)}
              >
                <div className={styles.tierIconWrap}>
                  <span className={styles.tierEmoji}>{info.emoji}</span>
                </div>
                <div className={styles.tierBody}>
                  <div className={styles.tierTopRow}>
                    <span className={styles.tierLabel}>{info.label}</span>
                    <span className={styles.intensityBars}>
                      {[1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={`${styles.intensityBar} ${i <= filledBars ? styles.filled : ""}`}
                        />
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
    </div>
  );
}