"use client";

import { useMemo } from "react";
import { Mascot } from "@/motion/Mascot";
import { pickMascotLine } from "@/motion/mascotLines";
import { EnvironmentBackdrop } from "@/components/runtime/EnvironmentBackdrop";
import { resolveGameEnvironmentImages } from "@/lib/content/gameEnvironments";
import styles from "@/components/runtime/ReflectionScreen.module.css";

export interface ReflectionScreenProps {
  successLines: string[];
  hasNextMission: boolean;
  onPlayAgain: () => void;
  onNextMission: () => void;
  onViewConceptSummary: () => void;
  /** Per direct feedback: a real way back to the homepage from Mission
   *  Complete, not just Play Again / Next Mission / Review Concepts.
   *  Always shown — unlike onNextMission, this isn't conditional on
   *  hasNextMission, since "go home" is a sensible action regardless of
   *  whether more missions exist. */
  onBackToHome: () => void;
  /**
   * Per direct feedback specifically about Atom Forge ("after completing
   * a level, [players should be able to] either change difficulty or go
   * to another level to pick"): once Atom Forge collapsed from four
   * separate Levels into one difficulty-driven session (see
   * BondMatchEngine.tsx's session model), "another level" effectively
   * means "a different difficulty" — there's no separate level list
   * anymore. Optional and additive: only engines with a real difficulty
   * choice (engineSupportsDifficultyChoice) get this button at all; see
   * PlayClient.tsx for where it's wired to the same handleChangeDifficulty
   * the in-game menu's "Change Difficulty" action already uses, so both
   * entry points land in the exact same place.
   */
  onChangeDifficulty?: () => void;
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
 *
 * "ALL MISSIONS COMPLETE" BUTTON REMOVED per direct feedback: previously
 * when hasNextMission was false, Next Mission didn't disappear — it
 * relabeled itself to a disabled "All Missions Complete" button, which
 * still occupied space and looked like a dead control rather than just
 * not being there. Now the Next Mission button only renders AT ALL when
 * hasNextMission is true; nothing replaces it when there's no next
 * mission, rather than a disabled stand-in.
 */
export function ReflectionScreen({
  successLines,
  hasNextMission,
  onPlayAgain,
  onNextMission,
  onViewConceptSummary,
  onBackToHome,
  onChangeDifficulty,
  accentColor = "var(--eg-subject-chemistry)",
  gameSlug,
  extraContent
}: ReflectionScreenProps) {
  const images = gameSlug ? resolveGameEnvironmentImages(gameSlug) : undefined;
  // Picked once per mount (not on every render) — a fresh line each time
  // a player lands on Mission Complete, per direct feedback that the
  // mascot should react in different encouraging ways rather than the
  // same static caption every time.
  const mascotLine = useMemo(() => pickMascotLine("celebrate"), []);

  return (
    <div className={styles.wrap} style={{ "--accent-color": accentColor } as React.CSSProperties}>
      <EnvironmentBackdrop images={images} scrim />

      <div className={styles.mascotRow}>
        <Mascot pose="celebrate" widthPx={140} />
      </div>
      <div className={styles.card}>
        <div className={styles.title}>Mission Complete!</div>
        <div className={styles.mascotLine}>{mascotLine}</div>

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
          {hasNextMission && (
            <button onClick={onNextMission} className={styles.primaryButton}>
              Next Mission
            </button>
          )}
          <button onClick={onPlayAgain} className={styles.secondaryButton}>
            Play Again
          </button>
          {onChangeDifficulty && (
            <button onClick={onChangeDifficulty} className={styles.secondaryButton}>
              🎯 Change Difficulty
            </button>
          )}
          <button onClick={onBackToHome} className={styles.homeButton}>
            🏠 Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}