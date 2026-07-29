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
  onViewConceptSummary,
}: ReflectionScreenProps) {
  const celebLine = useMemo(() => {
    const line = pickMascotLine("celebrate");
    const firstName = studentName?.split(" ")[0];
    if (firstName) {
      return line.replace(
        /^(Great|Nice|Well done|Amazing|Excellent|Brilliant|Fantastic|Perfect)/,
        `$1, ${firstName}`
      );
    }
    return line;
  }, [studentName]);

  const nextLabel = nextMissionLabel ?? "Next Mission →";
  const isNextLevel =
    nextLabel.toLowerCase().includes("practice") ||
    nextLabel.toLowerCase().includes("challenge") ||
    nextLabel.toLowerCase().includes("level");

  return (
    <EXLShell subject={subject} pose="celebrate">
      {/* ── HERO BADGE ─────────────────────────────────── */}
      <div className={styles.heroBadge} style={{ "--accent": accentColor } as React.CSSProperties}>
        <div className={styles.starRow} aria-hidden="true">
          <span className={styles.star}>★</span>
          <span className={styles.starMid}>★</span>
          <span className={styles.star}>★</span>
        </div>
        <div className={styles.heroTitle}>Mission Complete!</div>
        <div className={styles.heroCelebLine}>{celebLine}</div>
      </div>

      {/* ── SUCCESS DETAIL LINES ───────────────────────── */}
      {successLines.length > 0 && (
        <div className={styles.resultLines}>
          {successLines.map((line, i) => (
            <div key={i} className={styles.resultLine}>
              <span className={styles.resultCheck} aria-hidden="true">✓</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      )}

      {extraContent}

      {/* ── ACTIONS ────────────────────────────────────── */}
      <div className={styles.actions}>
        {/* Primary CTA — next mission or promoted play-again */}
        {hasNextMission ? (
          <button
            className={isNextLevel ? styles.nextLevelBtn : styles.primaryBtn}
            style={{ "--accent": accentColor } as React.CSSProperties}
            onClick={onNextMission}
          >
            {nextLabel}
          </button>
        ) : (
          <button
            className={styles.primaryBtn}
            style={{ "--accent": accentColor } as React.CSSProperties}
            onClick={onPlayAgain}
          >
            Play Again
          </button>
        )}

        {/* Review concepts — secondary but real visual weight */}
        {onViewConceptSummary && (
          <button
            className={styles.conceptBtn}
            style={{ "--accent": accentColor } as React.CSSProperties}
            onClick={onViewConceptSummary}
          >
            📘 Review Concepts
          </button>
        )}

        {/* Try again — only if Next Mission is also present */}
        {hasNextMission && (
          <button
            className={styles.secondaryBtn}
            style={{ "--accent": accentColor } as React.CSSProperties}
            onClick={onPlayAgain}
          >
            Try Again
          </button>
        )}

        {/* Ghost-tier: change difficulty / back home */}
        <div className={styles.ghostRow}>
          {onChangeDifficulty && (
            <button className={styles.ghostBtn} onClick={onChangeDifficulty}>
              Change difficulty
            </button>
          )}
          <button className={styles.ghostBtn} onClick={onBackToHome}>
            ← Back to levels
          </button>
        </div>
      </div>
    </EXLShell>
  );
}