"use client";

/**
 * StepwiseMissionComplete.tsx
 *
 * Shown when a student finishes ALL questions in a learning mode
 * (Guided / Practice / Challenge). Maths-specific — separate from the
 * generic ReflectionScreen used by other engines.
 *
 * Shows:
 * - Ms. Chidera celebrating with a personalised message
 * - XP earned this session
 * - Progress summary across all three modes
 * - Next action (move to next mode, replay, or return to hub)
 */

import React from "react";
import { ChideraAvatar } from "./ChideraAvatar";
import type { StepMode } from "./StepwiseSolverEngine";
import type { HubQuestion } from "./StepwiseHub";
import styles from "./StepwiseMissionComplete.module.css";

export interface StepwiseMissionCompleteProps {
  completedMode: StepMode;
  xpEarned: number;
  guidedQuestions: HubQuestion[];
  practiceQuestions: HubQuestion[];
  challengeQuestions: HubQuestion[];
  nextMode: StepMode | null;
  onNextMode: () => void;
  onReplay: () => void;
  onBackToHub: () => void;
}

const MODE_LABEL: Record<StepMode, string> = {
  guided: "Guided Learning",
  practice: "Practice",
  challenge: "Challenge",
  mastery: "Mastery",
};

const MODE_ICON: Record<StepMode, string> = {
  guided: "📖",
  practice: "⚡",
  challenge: "🔥",
  mastery: "🏅",
};

const CHIDERA_LINES: Record<StepMode, string[]> = {
  guided: [
    "You followed every step — that's how real understanding is built!",
    "Step by step is exactly the right pace. You're doing brilliantly!",
    "Following the working carefully is a superpower. Well done!",
  ],
  practice: [
    "You worked it out yourself — that's the real test of understanding!",
    "Brilliant! You didn't just watch, you actually did the maths.",
    "That's practice done. You've earned every point of that XP!",
  ],
  challenge: [
    "You solved it under pressure — that's exam-level thinking!",
    "Challenge complete! That's the kind of confidence that wins exams.",
    "You tackled the hardest level. Absolutely brilliant work!",
  ],
  mastery: [
    "Mastery level — you are ready for anything this topic throws at you!",
  ],
};

function randomLine(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}

interface ModeProgressRowProps {
  mode: StepMode;
  questions: HubQuestion[];
  isCompleted: boolean;
}

function ModeProgressRow({ mode, questions, isCompleted }: ModeProgressRowProps) {
  if (questions.length === 0) return null;
  const done = questions.filter((q) => q.done).length;
  const pct = Math.round((done / questions.length) * 100);

  return (
    <div className={styles.progressRow}>
      <div className={styles.progressRowLeft}>
        <span className={styles.progressIcon}>{MODE_ICON[mode]}</span>
        <span className={styles.progressLabel}>{MODE_LABEL[mode]}</span>
      </div>
      <div className={styles.progressBarWrap}>
        <div className={styles.progressBar}>
          <div
            className={[
              styles.progressBarFill,
              isCompleted ? styles.progressBarComplete : "",
            ].join(" ")}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={styles.progressFraction}>
          {done}/{questions.length}
        </span>
        {isCompleted && <span className={styles.progressCheck}>✓</span>}
      </div>
    </div>
  );
}

export function StepwiseMissionComplete({
  completedMode,
  xpEarned,
  guidedQuestions,
  practiceQuestions,
  challengeQuestions,
  nextMode,
  onNextMode,
  onReplay,
  onBackToHub,
}: StepwiseMissionCompleteProps) {
  const [chideraLine] = React.useState(() =>
    randomLine(CHIDERA_LINES[completedMode])
  );

  const modesDone: Record<StepMode, boolean> = {
    guided:    guidedQuestions.length > 0 && guidedQuestions.every((q) => q.done),
    practice:  practiceQuestions.length > 0 && practiceQuestions.every((q) => q.done),
    challenge: challengeQuestions.length > 0 && challengeQuestions.every((q) => q.done),
    mastery:   false,
  };

  const allDone = modesDone.guided && modesDone.practice && modesDone.challenge;

  return (
    <div className={styles.root}>
      <div className={styles.bg} />

      <div className={styles.content}>
        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.badge}>
            {allDone ? "🏆 Topic Complete!" : `${MODE_ICON[completedMode]} Stage Complete!`}
          </div>
          <div className={styles.modeName}>{MODE_LABEL[completedMode]}</div>
        </div>

        {/* ── Ms. Chidera ── */}
        <div className={styles.teacherCard}>
          <ChideraAvatar size={52} />
          <div className={styles.teacherBubble}>
            <div className={styles.teacherName}>Ms. Chidera</div>
            <div className={styles.teacherLine}>{chideraLine}</div>
          </div>
        </div>

        {/* ── XP earned ── */}
        <div className={styles.xpCard}>
          <span className={styles.xpStar}>⭐</span>
          <div className={styles.xpAmount}>+{xpEarned} XP</div>
          <div className={styles.xpLabel}>earned this session</div>
        </div>

        {/* ── Progress across all modes ── */}
        <div className={styles.progressSection}>
          <div className={styles.progressTitle}>Your progress</div>
          <ModeProgressRow
            mode="guided"
            questions={guidedQuestions}
            isCompleted={modesDone.guided}
          />
          <ModeProgressRow
            mode="practice"
            questions={practiceQuestions}
            isCompleted={modesDone.practice}
          />
          <ModeProgressRow
            mode="challenge"
            questions={challengeQuestions}
            isCompleted={modesDone.challenge}
          />
        </div>

        {/* ── Actions ── */}
        <div className={styles.actions}>
          {nextMode && !modesDone[nextMode] && (
            <button className={styles.btnPrimary} onClick={onNextMode}>
              Move to {MODE_ICON[nextMode]} {MODE_LABEL[nextMode]} →
            </button>
          )}
          {allDone && (
            <div className={styles.allDoneMessage}>
              🎉 You&apos;ve completed all stages for this topic!
            </div>
          )}
          <button className={styles.btnSecondary} onClick={onReplay}>
            Replay {MODE_ICON[completedMode]} {MODE_LABEL[completedMode]}
          </button>
          <button className={styles.btnGhost} onClick={onBackToHub}>
            ← Back to learning modes
          </button>
        </div>
      </div>
    </div>
  );
}