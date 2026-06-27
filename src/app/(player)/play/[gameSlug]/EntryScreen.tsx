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

/**
 * Falls back to a topic_id-derived label when MissionRow.learning_goal is
 * null — true for any mission seeded before that column existed (see the
 * migration caveat on MissionRow.learning_goal). "chemical-bonding"
 * becomes "Chemical Bonding" rather than showing nothing or the raw slug.
 */
function fallbackLearningGoal(topicId: string, subtopicId: string | null): string {
  const label = (subtopicId ?? topicId).replace(/-/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export interface EntryScreenProps {
  gameTitle: string;
  gameSlug: string;
  subject: string;
  mission: MissionRow;
  onStart: () => void;
}

/**
 * Mission Briefing screen. Per the latest product brief (Version 3,
 * section 3): "Reduce unnecessary information that competes for
 * attention... let the briefing take centre stage. The screen should
 * communicate one thing: 'What is my mission?'" Learning Goal stays (the
 * brief explicitly keeps it, since it reinforces the educational purpose);
 * Reward/Difficulty/Time are simplified into one quiet line rather than
 * three separate boxed-feeling meta items, and the game-title banner that
 * used to dominate the top of the screen (a 3.4rem display heading) is
 * now a small identifier instead of competing with the briefing itself.
 * The element-glyph badge moved from its own top-row slot to sit quietly
 * beside the mission title instead of acting as a second focal point.
 *
 * Still does the periodic-table-glyph preview for particle-assembly-style
 * missions (target.proton in payload) — unaffected by this revision,
 * just relocated.
 */
export function EntryScreen({ gameTitle, gameSlug, subject, mission, onStart }: EntryScreenProps) {
  const target = (mission.payload as { target?: Record<string, number> }).target;
  const protonCount = target?.proton;
  const element = typeof protonCount === "number" ? getElementByAtomicNumber(protonCount) : undefined;
  const accentColor = element ? CATEGORY_COLORS[element.category] : SUBJECT_FALLBACK_ACCENT[subject] ?? "var(--eg-subject-chemistry)";

  const learningGoal = mission.learning_goal ?? fallbackLearningGoal(mission.topic_id, mission.subtopic_id);
  const briefing = resolveMissionBriefing(gameSlug);

  return (
    <div className={styles.wrap} style={{ "--accent-color": accentColor } as React.CSSProperties}>
      <img src="/mascot/scene-backdrop.svg" alt="" role="presentation" className={styles.backdrop} />

      <div className={styles.kicker}>
        {gameTitle} · {subject}
      </div>

      <div className={styles.mascotRow}>
        <Mascot pose="idle" widthPx={130} />
      </div>

      <div className={styles.card}>
        <div className={styles.cardLabel}>Mission Briefing</div>

        <p className={styles.briefingText}>{briefing}</p>

        <div className={styles.missionTitleRow}>
          <div className={styles.missionTitle}>{mission.title}</div>
          {element && (
            <div className={styles.elementGlyph}>
              <span className={styles.elementGlyphNumber}>{element.atomicNumber}</span>
              <span className={styles.elementGlyphSymbol}>{element.symbol}</span>
            </div>
          )}
        </div>

        <div className={styles.goalRow}>
          <div className={styles.goalLabel}>Learning Goal</div>
          <div className={styles.goalText}>{learningGoal}</div>
        </div>

        <div className={styles.metaLine}>
          +{mission.xp_reward} XP · {mission.difficulty}
          {mission.estimated_minutes != null ? ` · ~${mission.estimated_minutes} min` : ""}
        </div>

        <button className={styles.startButton} onClick={onStart}>
          Start Mission
        </button>
      </div>
    </div>
  );
}