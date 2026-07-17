"use client";

import { getElementByAtomicNumber } from "@/motion/periodicTableData";
import { CATEGORY_COLORS } from "@/motion/periodicTableData";
import { Mascot } from "@/motion/Mascot";
import { resolveMissionBriefing } from "@/lib/content/missionBriefing";
import type { MissionRow } from "@/types/db";
import styles from "@/app/(player)/play/[gameSlug]/EntryScreen.module.css";

const SUBJECT_FALLBACK_ACCENT: Record<string, string> = {
  chemistry: "var(--eg-subject-chemistry)",
  biology: "var(--eg-subject-biology)",
  physics: "var(--eg-subject-physics)",
  mathematics: "var(--eg-subject-mathematics)"
};

function fallbackLearningGoal(topicId: string, subtopicId: string | null): string {
  const label = (subtopicId ?? topicId).replace(/-/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export interface EntryScreenProps {
  gameSlug: string;
  subject: string;
  mission: MissionRow;
  onStart: () => void;
}

export function EntryScreen({ gameSlug, subject, mission, onStart }: EntryScreenProps) {
  const target = (mission.payload as { target?: Record<string, number> }).target;
  const protonCount = target?.proton;
  const element = typeof protonCount === "number" ? getElementByAtomicNumber(protonCount) : undefined;
  const accentColor = element ? CATEGORY_COLORS[element.category] : SUBJECT_FALLBACK_ACCENT[subject] ?? "var(--eg-subject-chemistry)";

  const learningGoal = mission.learning_goal ?? fallbackLearningGoal(mission.topic_id, mission.subtopic_id);
  const briefing = resolveMissionBriefing(gameSlug);

  return (
    <div className={styles.wrap} style={{ "--accent-color": accentColor } as React.CSSProperties}>
      <div className={styles.mascotRow}>
        <Mascot pose="idle" widthPx={130} />
      </div>

      <div className={styles.card}>
        {/* Notch pointing up at mascot — same dialogue-bubble device as NarrationScreen */}
        <div className={styles.cardNotch} />

        <div className={styles.cardLabel}>Mission Briefing</div>

        <p className={styles.briefingText}>{briefing}</p>

        {element && (
          <div className={styles.elementGlyphRow}>
            <div className={styles.elementGlyph}>
              <span className={styles.elementGlyphNumber}>{element.atomicNumber}</span>
              <span className={styles.elementGlyphSymbol}>{element.symbol}</span>
            </div>
          </div>
        )}

        <div className={styles.goalRow}>
          <div className={styles.goalLabel}>Learning Goal</div>
          <div className={styles.goalText}>{learningGoal}</div>
        </div>

        <button className={styles.startButton} onClick={onStart}>
          Start Mission →
        </button>
      </div>
    </div>
  );
}
