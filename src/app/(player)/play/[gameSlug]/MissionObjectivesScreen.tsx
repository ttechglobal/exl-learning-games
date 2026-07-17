"use client";

import { Mascot } from "@/motion/Mascot";
import type { MissionObjectives } from "@/lib/content/missionObjectives";
import styles from "@/app/(player)/play/[gameSlug]/MissionObjectivesScreen.module.css";

export interface MissionObjectivesScreenProps {
  objectives: MissionObjectives;
  accentColor: string;
  onStart: () => void;
}

export function MissionObjectivesScreen({ objectives, accentColor, onStart }: MissionObjectivesScreenProps) {
  return (
    <>
      <div className={styles.mascotRow}>
        <Mascot pose="idle" widthPx={92} />
      </div>

      <div className={styles.card} style={{ "--accent-color": accentColor } as React.CSSProperties}>
        {/* Notch pointing up at mascot */}
        <div className={styles.cardNotch} />

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
          Begin Mission →
        </button>
      </div>
    </>
  );
}
