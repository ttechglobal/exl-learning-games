"use client";

import { Mascot } from "@/motion/Mascot";
import styles from "@/components/runtime/ReflectionScreen.module.css";

export interface ReflectionScreenProps {
  successLines: string[];
  hasNextMission: boolean;
  onPlayAgain: () => void;
  onNextMission: () => void;
  onViewConceptSummary: () => void;
  accentColor?: string;
  /**
   * XP earned from this attempt. Was always available on
   * GameRuntimeMission.xpReward but never threaded through to this
   * screen — "Mission Complete!" rendered with zero visible reward,
   * which doesn't match the rest of the app (the homepage's whole pitch
   * is "real rewards, real progress"). Optional only so this component
   * doesn't hard-crash for any caller that hasn't been updated yet;
   * GameRuntime always passes it now.
   */
  xpEarned?: number;
  /**
   * Optional slot for game/engine-specific reveal content (e.g. the
   * chemistry-only PeriodicTableReveal). Kept generic here on purpose —
   * ReflectionScreen is shared across every engine, so anything specific to
   * one subject's visuals is injected by the caller (GameRuntime / the page),
   * not hardcoded into this component.
   */
  extraContent?: React.ReactNode;
}

/**
 * "After Play" reflection — per the product brief: review, play again,
 * practice questions. Converted from inline styles to a real CSS module;
 * also fixes the accentColor fallback (same stale "#7b4fcb" issue as
 * ConceptSnapshot — see that file's comment) and adds the XP reward chip
 * that was missing despite the data being available all along.
 */
export function ReflectionScreen({
  successLines,
  hasNextMission,
  onPlayAgain,
  onNextMission,
  onViewConceptSummary,
  accentColor = "var(--eg-subject-chemistry)",
  xpEarned,
  extraContent
}: ReflectionScreenProps) {
  return (
    <div className={styles.wrap} style={{ "--accent-color": accentColor } as React.CSSProperties}>
      <div className={styles.mascotRow}>
        <Mascot pose="celebrate" widthPx={140} />
      </div>
      <div className={styles.card}>
        <div className={styles.title}>Mission Complete!</div>

        {typeof xpEarned === "number" && (
          <div className={styles.rewardChip}>
            <span className={styles.rewardIcon}>⭐</span>
            <span className={styles.rewardText}>+{xpEarned} XP</span>
          </div>
        )}

        <div className={styles.lines}>
          {successLines.map((line, i) => (
            <div key={i} className={styles.line}>
              {line}
            </div>
          ))}
        </div>

        {extraContent}

        <div className={styles.actions}>
          <button
            disabled={!hasNextMission}
            onClick={onNextMission}
            className={`${styles.primaryButton} ${!hasNextMission ? styles.primaryButtonDisabled : ""}`}
          >
            {hasNextMission ? "Next Mission" : "All Missions Complete"}
          </button>
          <button onClick={onPlayAgain} className={styles.secondaryButton}>
            Play Again
          </button>
          <button onClick={onViewConceptSummary} className={styles.linkButton}>
            View Concept Summary
          </button>
        </div>
      </div>
    </div>
  );
}