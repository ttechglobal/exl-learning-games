"use client";

import { Mascot } from "@/motion/Mascot";
import type { MissionObjectives } from "@/lib/content/missionObjectives";
import styles from "@/app/(player)/play/[gameSlug]/MissionObjectivesScreen.module.css";

export interface MissionObjectivesScreenProps {
  objectives: MissionObjectives;
  accentColor: string;
  onStart: () => void;
}

/**
 * Replaces HowToPlayScreen entirely. Per the product brief: "Avoid long
 * paragraphs. Players should understand the challenge within a few
 * seconds" — a ~5 second beat, not a page. Each objective is one short
 * checkmark line, not a paragraph; there's no Controls/Scoring/Hints
 * breakdown here anymore (that level of depth contradicted "more playing,
 * less reading"). If a player genuinely needs deeper mechanical help,
 * that's an in-game hint system's job, not a pre-game reading screen's.
 */
export function MissionObjectivesScreen({ objectives, accentColor, onStart }: MissionObjectivesScreenProps) {
  return (
    <div className={styles.wrap} style={{ "--accent-color": accentColor } as React.CSSProperties}>
      <div className={styles.mascotRow}>
        <Mascot pose="idle" widthPx={92} />
      </div>

      <div className={styles.card}>
        <div className={styles.cardLabel}>Mission Objectives</div>

        <ul className={styles.list}>
          {objectives.items.map((item, i) => (
            <li key={i} className={styles.item}>
              <span className={styles.check}>✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <button className={styles.startButton} onClick={onStart}>
          Start Mission
        </button>
      </div>
    </div>
  );
}