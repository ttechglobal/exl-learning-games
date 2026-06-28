"use client";

import { Mascot } from "@/motion/Mascot";
import { EnvironmentBackdrop } from "@/components/runtime/EnvironmentBackdrop";
import { resolveGameEnvironmentImages } from "@/lib/content/gameEnvironments";
import styles from "@/components/runtime/ReflectionScreen.module.css";

export interface ReflectionScreenProps {
  successLines: string[];
  hasNextMission: boolean;
  onPlayAgain: () => void;
  onNextMission: () => void;
  onViewConceptSummary: () => void;
  accentColor?: string;
  /** Used to resolve this game's environment art (see
   *  lib/content/gameEnvironments.ts) so Mission Complete uses the same
   *  full-bleed backdrop as the rest of the pre/post-play flow, per
   *  direct feedback — this screen previously had no backdrop at all. */
  gameSlug?: string;
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
 * practice questions.
 *
 * XP CHIP REMOVED per direct feedback ("remove the +60XP, it's
 * confusing") — xpEarned is no longer a prop at all, not just hidden,
 * since nothing else on this screen needs it once the chip is gone.
 *
 * VIEW CONCEPT SUMMARY PROMOTED per direct feedback: this was the
 * smallest, least prominent control on the screen (.linkButton — plain
 * underlined text, no border, no fill), buried below two real buttons.
 * Revisiting what you just learned right after finishing a mission is at
 * least as important as replaying it, so it's now a real full-width
 * button with its own visual weight — see .conceptButton — not a quiet
 * afterthought link.
 *
 * BACKDROP added per direct feedback: this screen previously had no
 * environment art at all. Uses the same EnvironmentBackdrop + scrim
 * treatment as the rest of the pre/post-play flow.
 */
export function ReflectionScreen({
  successLines,
  hasNextMission,
  onPlayAgain,
  onNextMission,
  onViewConceptSummary,
  accentColor = "var(--eg-subject-chemistry)",
  gameSlug,
  extraContent
}: ReflectionScreenProps) {
  const images = gameSlug ? resolveGameEnvironmentImages(gameSlug) : undefined;

  return (
    <div className={styles.wrap} style={{ "--accent-color": accentColor } as React.CSSProperties}>
      <EnvironmentBackdrop images={images} scrim />

      <div className={styles.mascotRow}>
        <Mascot pose="celebrate" widthPx={140} />
      </div>
      <div className={styles.card}>
        <div className={styles.title}>Mission Complete!</div>

        <div className={styles.lines}>
          {successLines.map((line, i) => (
            <div key={i} className={styles.line}>
              {line}
            </div>
          ))}
        </div>

        {extraContent}

        <div className={styles.actions}>
          <button onClick={onViewConceptSummary} className={styles.conceptButton}>
            📘 Review Concepts
          </button>
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
        </div>
      </div>
    </div>
  );
}