"use client";

/**
 * MissionObjectivesScreen.tsx — EXL standard
 *
 * Replaces the mascot+card version with EXLShell. Character uses
 * pose="focused" — Dr. Adaobi leans in slightly, eyebrows slightly
 * raised, conveying "pay attention, here's what you need to do."
 *
 * Props are identical to the old MissionObjectivesScreen so PlayClient
 * needs no signature changes — just update the import.
 */

import { EXLShell } from "@/components/exl/EXLShell";
import type { MissionObjectives } from "@/lib/content/missionObjectives";
import styles from "./MissionObjectivesScreen.module.css";

export interface MissionObjectivesScreenProps {
  objectives: MissionObjectives;
  accentColor: string;
  subject: string;
  onStart: () => void;
  onBack: () => void;
}

export function MissionObjectivesScreen({ objectives, accentColor, subject, onStart, onBack }: MissionObjectivesScreenProps) {
  return (
    <EXLShell
      subject={subject}
      pose="focused"
      topLeft={
        <button className={styles.backCircle} onClick={onBack} aria-label="Back">←</button>
      }
      topRight={
        <div className={styles.objectivesChip}>Mission objectives</div>
      }
    >
      {/* Eyebrow */}
      <div className={styles.eyebrow}>Here&rsquo;s what you&rsquo;ll do</div>

      {/* Objectives list */}
      <ul className={styles.list} aria-label="Mission objectives">
        {objectives.items.map((item, i) => (
          <li key={i} className={styles.item}>
            <span className={styles.check} aria-hidden="true">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {/* Start button */}
      <button
        className={styles.startBtn}
        style={{ "--accent": accentColor } as React.CSSProperties}
        onClick={onStart}
      >
        Start mission →
      </button>
    </EXLShell>
  );
}