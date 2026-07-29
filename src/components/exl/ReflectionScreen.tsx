// FILE: src/components/exl/ReflectionScreen.tsx
"use client";

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
  studentName?: string;
  nextMissionLabel?: string;
  extraContent?: React.ReactNode;
  gameSlug?: string;
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
  studentName,
  nextMissionLabel,
  extraContent,
}: ReflectionScreenProps) {
  const celebLine = useMemo(() => {
    const line = pickMascotLine("celebrate");
    const firstName = studentName?.split(" ")[0];
    // Insert name naturally if the line starts with a common opener
    if (firstName) {
      return line.replace(
        /^(Great|Nice|Well done|Amazing|Excellent|Brilliant|Fantastic|Perfect)/,
        `$1, ${firstName}`
      );
    }
    return line;
  }, [studentName]);

  // Determine next button label
  const nextLabel = nextMissionLabel ?? "Next →";
  const isNextLevel = nextLabel.toLowerCase().includes("practice") ||
    nextLabel.toLowerCase().includes("challenge") ||
    nextLabel.toLowerCase().includes("level");

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

      {extraContent}

      {/* Actions */}
      <div className={styles.actions}>
        {hasNextMission && (
          <button
            className={isNextLevel ? styles.nextLevelBtn : styles.primaryBtn}
            style={{ "--accent": accentColor } as React.CSSProperties}
            onClick={onNextMission}
          >
            {nextLabel}
          </button>
        )}
        <button
          className={[styles.secondaryBtn, !hasNextMission ? styles.secondaryBtnPromoted : ""].join(" ")}
          style={{ "--accent": accentColor } as React.CSSProperties}
          onClick={onPlayAgain}
        >
          Try again
        </button>
        {onChangeDifficulty && (
          <button className={styles.ghostBtn} onClick={onChangeDifficulty}>
            Change difficulty
          </button>
        )}
        <button className={styles.ghostBtn} onClick={onBackToHome}>
          ← Back to levels
        </button>
      </div>
    </EXLShell>
  );
}