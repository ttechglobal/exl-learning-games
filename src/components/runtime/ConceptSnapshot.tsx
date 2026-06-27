"use client";

import { useState } from "react";
import { primeAudioOnUserGesture } from "@/motion/sound/playSound";
import { Mascot } from "@/motion/Mascot";
import { hasSeenConcepts, markConceptsSeen } from "@/lib/content/contentPrefs";
import styles from "@/components/runtime/ConceptSnapshot.module.css";

export interface ConceptCard {
  title: string;
  body: string;
}

export interface ConceptSnapshotProps {
  cards: ConceptCard[];
  onContinue: () => void;
  accentColor?: string;
  /**
   * Engine type, used only to remember "this player has seen these
   * concepts before" so a returning player can skip straight through
   * (see lib/content/conceptPrefs.ts). Optional because ReflectionScreen's
   * "View Concept Summary" reopens this same component to revisit cards
   * after a mission — in that context there's no "skip" to offer (the
   * player explicitly asked to see them again), so the caller simply
   * omits engineType and the skip button doesn't render.
   */
  engineType?: string;
}

/**
 * "Before Play" briefing — and also reused for the "View Concept Summary"
 * revisit flow after a mission (per the brief: "players should still be
 * able to reopen the concept cards"). Rebuilt from a single flat block of
 * lines into real per-idea cards with a title each, matching the brief's
 * worked example (Atomic Number -> Periodic Table -> Helpful Tip).
 *
 * Players can step forward/back between cards, or skip the whole thing
 * straight to gameplay if engineType is provided and they've seen these
 * concepts before. No countdown timer anymore — see the GameRow.snapshot
 * type comment for why a single shared readTimeSec didn't fit a
 * card-by-card, skippable experience.
 */
export function ConceptSnapshot({ cards, onContinue, accentColor = "var(--eg-subject-chemistry)", engineType }: ConceptSnapshotProps) {
  const [index, setIndex] = useState(0);
  const card = cards[index];
  const isLast = index === cards.length - 1;
  const canSkip = Boolean(engineType) && hasSeenConcepts(engineType!);

  function handleContinue() {
    primeAudioOnUserGesture();
    if (engineType) markConceptsSeen(engineType);
    onContinue();
  }

  function goNext() {
    if (isLast) {
      handleContinue();
    } else {
      setIndex((i) => i + 1);
    }
  }

  return (
    <div className={styles.wrap} style={{ "--accent-color": accentColor } as React.CSSProperties}>
      <div className={styles.mascotRow}>
        <Mascot pose="idle" widthPx={96} />
      </div>
      <div className={styles.card}>
        <div className={styles.cardTopRow}>
          <div className={styles.cardLabel}>Quick Concept {index + 1}/{cards.length}</div>
          {canSkip && (
            <button className={styles.skipButton} onClick={handleContinue}>
              Skip
            </button>
          )}
        </div>

        <div className={styles.dots}>
          {cards.map((_, i) => (
            <span key={i} className={`${styles.dot} ${i === index ? styles.dotActive : ""}`} />
          ))}
        </div>

        <div className={styles.title}>{card.title}</div>
        <div className={styles.body}>{card.body}</div>

        <div className={styles.actions}>
          {index > 0 && (
            <button className={styles.backButton} onClick={() => setIndex((i) => i - 1)}>
              Back
            </button>
          )}
          <button className={styles.continueButton} onClick={goNext}>
            {isLast ? "Start Mission" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}