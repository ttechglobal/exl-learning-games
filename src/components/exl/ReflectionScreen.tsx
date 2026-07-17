"use client";

/**
 * ReflectionScreen.tsx — EXL standard
 *
 * Mission complete screen. Character uses pose="celebrate" — Dr. Adaobi
 * has her arms raised, a big smile, sparkles around her. The parchment
 * card shows the result and the next actions.
 *
 * Drops ConceptSnapshot revisit ("View Concept Summary") — with guided
 * learning inside the engine, students don't need a separate concept
 * review screen. The learning happened during play.
 *
 * All other props are compatible with the existing ReflectionScreen
 * interface so GameRuntime needs minimal changes.
 */

import { useMemo } from "react";
import { EXLShell } from "@/components/exl/EXLShell";
import { pickMascotLine } from "@/motion/mascotLines";
import styles from "./ReflectionScreen.module.css";

export interface ReflectionScreenProps {
  successLines: string[];
  hasNextMission: boolean;
  onPlayAgain: () => void;
  onNextMission: () => void;
  onBackToHome: () => void;
  onChangeDifficulty?: () => void;
  accentColor?: string;
  subject?: string;
  extraContent?: React.ReactNode;
  /** gameSlug kept for API compatibility with GameRuntime — unused here
   *  since EXLShell owns the environment, not gameSlug-based images */
  gameSlug?: string;
  /** onViewConceptSummary kept for API compatibility — no longer rendered
   *  since ConceptSnapshot is removed from the flow */
  onViewConceptSummary?: () => void;
}

export function ReflectionScreen({
  successLines,
  hasNextMission,
  onPlayAgain,
  onNextMission,
  onBackToHome,
  onChangeDifficulty,
  accentColor = "var(--eg-subject-chemistry)",
  subject = "chemistry",
  extraContent,
}: ReflectionScreenProps) {
  const celebLine = useMemo(() => pickMascotLine("celebrate"), []);

  return (
    <EXLShell subject={subject} pose="celebrate">
      {/* Celebration header */}
      <div className={styles.completeBadge} aria-label="Mission complete">
        <span className={styles.completeStar} aria-hidden="true">★</span>
        <span className={styles.completeLabel}>Mission complete!</span>
        <span className={styles.completeStar} aria-hidden="true">★</span>
      </div>

      {/* Mascot line */}
      <p className={styles.celebLine}>{celebLine}</p>

      {/* Success lines */}
      {successLines.length > 0 && (
        <div className={styles.resultLines}>
          {successLines.map((line, i) => (
            <p key={i} className={styles.resultLine}>{line}</p>
          ))}
        </div>
      )}

      {/* Extra content (PeriodicTableReveal etc.) */}
      {extraContent}

      {/* Actions */}
      <div className={styles.actions}>
        {hasNextMission && (
          <button
            className={styles.primaryBtn}
            style={{ "--accent": accentColor } as React.CSSProperties}
            onClick={onNextMission}
          >
            Next mission →
          </button>
        )}
        <button
          className={[styles.secondaryBtn, !hasNextMission ? styles.secondaryBtnPromoted : ""].join(" ")}
          style={{ "--accent": accentColor } as React.CSSProperties}
          onClick={onPlayAgain}
        >
          Play again
        </button>
        {onChangeDifficulty && (
          <button className={styles.ghostBtn} onClick={onChangeDifficulty}>
            Change difficulty
          </button>
        )}
        <button className={styles.ghostBtn} onClick={onBackToHome}>
          Back to worlds
        </button>
      </div>
    </EXLShell>
  );
}