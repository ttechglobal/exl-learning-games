"use client";

/**
 * LearnScreen.tsx
 *
 * The "Learn" phase of the Learn → Practice → Challenge → Master framework.
 *
 * This replaces the old ConceptSnapshot behaviour of showing before
 * EVERY mission. Learn shows ONCE per game (first visit), then lives
 * permanently in the game menu as "Review Concepts" and on the topic
 * page as the "Learn" tab.
 *
 * Key differences from the old ConceptSnapshot:
 *   - Shown once per GAME, not once per session per engine type
 *   - Richer content — more cards, more detail, no word limit pressure
 *   - Clear framing: "Before you play, understand these concepts"
 *   - After Learn, the student goes to Practice (the game)
 *   - "You can always revisit this" is shown prominently — not hidden
 *   - The mode label shows "LEARN" not "Quick Concept 1/4"
 */

import { useState } from "react";
import { markLearnSeen } from "@/lib/content/contentPrefs";
import { primeAudioOnUserGesture } from "@/motion/sound/playSound";
import { Mascot } from "@/motion/Mascot";
import { EnvironmentBackdrop } from "@/components/runtime/EnvironmentBackdrop";
import { resolveGameEnvironmentImages } from "@/lib/content/gameEnvironments";
import { BackButton } from "@/components/runtime/BackButton";
import { MissionTopBar } from "@/components/runtime/MissionTopBar";
import { ConceptVisual } from "@/components/runtime/ConceptVisual";
import styles from "./LearnScreen.module.css";

export interface LearnCard {
  title: string;
  body: string;
  visual?: string;
}

export interface LearnScreenProps {
  cards: LearnCard[];
  gameSlug: string;
  gameTitle: string;
  subject: string;
  accentColor?: string;
  /** Where "Start Playing" goes — into Practice (the game) */
  onStartPlaying: () => void;
  /** Back to the topic/entry screen */
  onBack?: () => void;
  /** True when opened from the game menu mid-session — hides the
   *  "Start Playing" button, shows "Back to Game" instead */
  isReview?: boolean;
  onBackToGame?: () => void;
}

export function LearnScreen({
  cards,
  gameSlug,
  gameTitle,
  subject,
  accentColor = "var(--eg-subject-chemistry)",
  onStartPlaying,
  onBack,
  isReview = false,
  onBackToGame,
}: LearnScreenProps) {
  const [index, setIndex] = useState(0);
  const card = cards[index];
  const isLast = index === cards.length - 1;
  const images = resolveGameEnvironmentImages(gameSlug);

  function handleFinish() {
    primeAudioOnUserGesture();
    markLearnSeen(gameSlug);
    if (isReview && onBackToGame) {
      onBackToGame();
    } else {
      onStartPlaying();
    }
  }

  function handleSkip() {
    primeAudioOnUserGesture();
    markLearnSeen(gameSlug);
    if (isReview && onBackToGame) {
      onBackToGame();
    } else {
      onStartPlaying();
    }
  }

  function goNext() {
    if (isLast) {
      handleFinish();
    } else {
      setIndex(i => i + 1);
    }
  }

  return (
    <div
      className={styles.wrap}
      style={{ "--accent-color": accentColor } as React.CSSProperties}
    >
      <EnvironmentBackdrop images={images} scrim />

      {/* Header */}
      <div className={styles.headerRow}>
        {onBack && !isReview && (
          <BackButton onBack={onBack} label="Back" />
        )}
        {isReview && onBackToGame && (
          <BackButton onBack={onBackToGame} label="Back to Game" />
        )}
        <MissionTopBar
          gameTitle={gameTitle}
          subject={subject}
          accentColor={accentColor}
        />
      </div>

      {/* Mode label */}
      <div className={styles.modeRow}>
        <div className={styles.modeChip}>
          <span className={styles.modeIcon}>✦</span>
          <span>LEARN</span>
        </div>
        {!isReview && (
          <button className={styles.skipLink} onClick={handleSkip}>
            Skip to game →
          </button>
        )}
      </div>

      <div className={styles.mascotRow}>
        <Mascot pose="idle" widthPx={88} />
      </div>

      {/* Card */}
      <div className={styles.card}>
        {/* Progress dots */}
        <div className={styles.progressRow}>
          <div className={styles.dots}>
            {cards.map((_, i) => (
              <button
                key={i}
                className={`${styles.dot} ${i === index ? styles.dotActive : i < index ? styles.dotDone : ""}`}
                onClick={() => setIndex(i)}
                aria-label={`Card ${i + 1}`}
              />
            ))}
          </div>
          <div className={styles.counter}>{index + 1} / {cards.length}</div>
        </div>

        <div className={styles.cardTitle}>{card.title}</div>

        {card.visual && (
          <div className={styles.visual}>
            <ConceptVisual visualKey={card.visual} />
          </div>
        )}

        <div className={styles.cardBody}>{card.body}</div>

        <div className={styles.actions}>
          {index > 0 && (
            <button
              className={styles.prevBtn}
              onClick={() => setIndex(i => i - 1)}
            >
              ←
            </button>
          )}
          <button className={styles.nextBtn} onClick={goNext}>
            {isLast
              ? isReview ? "Done reviewing" : "Start Playing →"
              : "Next →"}
          </button>
        </div>
      </div>

      {/* Revisit reminder — only on first viewing */}
      {!isReview && (
        <div className={styles.revisitNote}>
          💡 You can always revisit this from the game menu
        </div>
      )}
    </div>
  );
}
