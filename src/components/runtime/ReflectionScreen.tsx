// FILE: src/components/runtime/ReflectionScreen.tsx
"use client";

import { useMemo } from "react";
import { Mascot } from "@/motion/Mascot";
import { pickMascotLine } from "@/motion/mascotLines";
import { EnvironmentBackdrop } from "@/components/runtime/EnvironmentBackdrop";
import { resolveGameEnvironmentImages } from "@/lib/content/gameEnvironments";
import { getGameTheme } from "@/lib/content/gameThemes";
import styles from "@/components/runtime/ReflectionScreen.module.css";

export interface ReflectionScreenProps {
  successLines: string[];
  hasNextMission: boolean;
  onPlayAgain: () => void;
  onNextMission: () => void;
  onViewConceptSummary: () => void;
  onBackToHome: () => void;
  onChangeDifficulty?: () => void;
  accentColor?: string;
  gameSlug?: string;
  subject?: string;
  extraContent?: React.ReactNode;
}

const SUBJECT_CELEBRATION: Record<string, {
  gradient: string;
  accentRgb: string;
  icon: string;
  completeText: string;
  nextLabel: string;
}> = {
  chemistry: {
    gradient: "linear-gradient(160deg, #041418 0%, #061e24 50%, #042818 100%)",
    accentRgb: "0,212,255",
    icon: "⚗️",
    completeText: "Reaction complete!",
    nextLabel: "Next concept →",
  },
  physics: {
    gradient: "linear-gradient(160deg, #080820 0%, #0c1040 50%, #0a0820 100%)",
    accentRgb: "68,136,255",
    icon: "⚡",
    completeText: "Force applied!",
    nextLabel: "Next concept →",
  },
  biology: {
    gradient: "linear-gradient(160deg, #081a06 0%, #0f2a08 50%, #081a08 100%)",
    accentRgb: "126,207,62",
    icon: "🧬",
    completeText: "Evolution complete!",
    nextLabel: "Next concept →",
  },
  mathematics: {
    gradient: "linear-gradient(160deg, #fffdf5 0%, #fef9e7 50%, #fdf3cd 100%)",
    accentRgb: "201,162,39",
    icon: "📐",
    completeText: "Problem solved!",
    nextLabel: "Next mission →",
  },
};

export function ReflectionScreen({
  successLines,
  hasNextMission,
  onPlayAgain,
  onNextMission,
  onViewConceptSummary,
  onBackToHome,
  onChangeDifficulty,
  accentColor,
  gameSlug,
  subject = "chemistry",
  extraContent,
}: ReflectionScreenProps) {
  const images = gameSlug ? resolveGameEnvironmentImages(gameSlug) : undefined;
  const mascotLine = useMemo(() => pickMascotLine("celebrate"), []);

  const theme = gameSlug ? getGameTheme(gameSlug, subject) : getGameTheme(subject);
  const subjectMeta = SUBJECT_CELEBRATION[subject] ?? SUBJECT_CELEBRATION.chemistry;
  const isMaths = subject === "mathematics";

  const accent = accentColor ?? theme.accent ?? `rgb(${subjectMeta.accentRgb})`;
  const bg     = theme.preGameGradient ?? subjectMeta.gradient;

  return (
    <div
      className={styles.wrap}
      style={{
        "--accent-color": accent,
        "--accent-rgb": subjectMeta.accentRgb,
        background: bg,
      } as React.CSSProperties}
    >
      <EnvironmentBackdrop images={images} scrim />

      {/* Subject badge */}
      <div className={styles.subjectBadge} style={{ borderColor: `rgba(${subjectMeta.accentRgb},0.4)`, color: accent }}>
        <span>{subjectMeta.icon}</span>
        <span>{subjectMeta.completeText}</span>
      </div>

      {/* Mascot */}
      <div className={styles.mascotRow}>
        <Mascot pose="celebrate" widthPx={130} />
      </div>

      {/* Card */}
      <div
        className={styles.card}
        style={{
          borderColor: `rgba(${subjectMeta.accentRgb}, 0.35)`,
          background: isMaths ? "#fffdf5" : "rgba(6,12,22,0.92)",
        }}
      >
        {/* Glow accent line at top */}
        <div className={styles.accentLine} style={{ background: accent }} />

        <div className={styles.title} style={{ color: isMaths ? "#1a0a00" : "#fff" }}>
          Mission Complete
        </div>

        <div className={styles.mascotLine} style={{ color: isMaths ? "#5a4010" : "rgba(255,255,255,0.6)" }}>
          {mascotLine}
        </div>

        {successLines.length > 0 && (
          <div className={styles.lines}>
            {successLines.map((line, i) => (
              <div key={i} className={styles.line} style={{ color: isMaths ? "#2a1a00" : "rgba(255,255,255,0.85)" }}>
                {line}
              </div>
            ))}
          </div>
        )}

        {extraContent}

        <div className={styles.actions}>
          {hasNextMission && (
            <button
              onClick={onNextMission}
              className={styles.primaryButton}
              style={{
                background: accent,
                boxShadow: `0 5px 0 rgba(${subjectMeta.accentRgb}, 0.35)`,
              }}
            >
              {subjectMeta.nextLabel}
            </button>
          )}

          <button
            onClick={onViewConceptSummary}
            className={styles.conceptButton}
            style={{
              borderColor: `rgba(${subjectMeta.accentRgb}, 0.3)`,
              color: accent,
            }}
          >
            📘 Review concepts
          </button>

          <button
            onClick={onPlayAgain}
            className={styles.secondaryButton}
            style={{
              borderColor: `rgba(${subjectMeta.accentRgb}, 0.2)`,
              color: isMaths ? "#5a4010" : "rgba(255,255,255,0.5)",
            }}
          >
            ↺ Try again
          </button>

          {onChangeDifficulty && (
            <button
              onClick={onChangeDifficulty}
              className={styles.secondaryButton}
              style={{ borderColor: `rgba(${subjectMeta.accentRgb}, 0.2)`, color: isMaths ? "#5a4010" : "rgba(255,255,255,0.5)" }}
            >
              🎯 Change level
            </button>
          )}

          <button onClick={onBackToHome} className={styles.homeButton}>
            ← Back to topics
          </button>
        </div>
      </div>
    </div>
  );
}