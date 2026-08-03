"use client";

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

const CHIDERA_LINES: Record<StepMode, string[]> = {
  guided: [
    "You followed every step — that's how real understanding is built.",
    "Step by step is exactly the right pace. You're doing brilliantly.",
    "Following the working carefully is a superpower. Well done.",
  ],
  practice: [
    "You worked it out yourself — that's the real test of understanding.",
    "Brilliant. You didn't just watch, you actually did the maths.",
    "That's practice done. You've earned every point of that XP.",
  ],
  challenge: [
    "You solved it under pressure — that's exam-level thinking.",
    "Challenge complete. That's the kind of confidence that wins exams.",
    "You tackled the hardest level. Absolutely brilliant work.",
  ],
  mastery: [
    "Mastery level — you are ready for anything this topic throws at you.",
  ],
};

const MODE_CONFIG: Record<StepMode, { label: string; icon: string; colour: string }> = {
  guided:    { label: "Guided Learning", icon: "📖", colour: "#ffb23c" },
  practice:  { label: "Practice",        icon: "⚡", colour: "#2f9bd6" },
  challenge: { label: "Challenge",       icon: "🔥", colour: "#ef5d4e" },
  mastery:   { label: "Mastery",         icon: "🏅", colour: "#4cde80" },
};

function randomLine(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
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
  const [line] = React.useState(() => randomLine(CHIDERA_LINES[completedMode]));

  const cfg = MODE_CONFIG[completedMode];

  const modesDone = {
    guided:    guidedQuestions.length > 0 && guidedQuestions.every(q => q.done),
    practice:  practiceQuestions.length > 0 && practiceQuestions.every(q => q.done),
    challenge: challengeQuestions.length > 0 && challengeQuestions.every(q => q.done),
  };
  const allDone = modesDone.guided && modesDone.practice && modesDone.challenge;

  const stagesToShow = [
    { mode: "guided"    as StepMode, qs: guidedQuestions },
    { mode: "practice"  as StepMode, qs: practiceQuestions },
    { mode: "challenge" as StepMode, qs: challengeQuestions },
  ].filter(s => s.qs.length > 0);

  return (
    <div className={styles.root}>
      <div className={styles.bg} />

      <div className={styles.content}>

        {/* ── Stage badge ── */}
        <div className={styles.stageBadge} style={{ color: cfg.colour }}>
          {cfg.icon} {allDone ? "Topic Complete!" : `${cfg.label} Complete`}
        </div>

        {/* ── XP burst ── */}
        <div className={styles.xpBurst}>
          <div className={styles.xpNumber}>+{xpEarned}</div>
          <div className={styles.xpUnit}>XP</div>
        </div>

        {/* ── Ms. Chidera ── */}
        <div className={styles.coachRow}>
          <div className={styles.coachAvatar}><ChideraAvatar size={44} mood="celebrate" /></div>
          <div className={styles.coachBubble}>
            <span className={styles.coachName}>Ms. Chidera</span>
            <span className={styles.coachLine}>{line}</span>
          </div>
        </div>

        {/* ── Stage progress pills ── */}
        <div className={styles.stages}>
          {stagesToShow.map(({ mode, qs }) => {
            const done  = qs.filter(q => q.done).length;
            const mc    = MODE_CONFIG[mode];
            const isCurrent = mode === completedMode;
            return (
              <div key={mode} className={`${styles.stageRow} ${isCurrent ? styles.stageRowCurrent : ""}`}>
                <span className={styles.stageIcon}>{mc.icon}</span>
                <span className={styles.stageLabel}>{mc.label}</span>
                <span className={styles.stageFrac}>{done}/{qs.length}</span>
                <div className={styles.stageBar}>
                  <div
                    className={styles.stageBarFill}
                    style={{
                      width: `${(done / qs.length) * 100}%`,
                      background: qs.every(q => q.done) ? "#4cde80" : mc.colour,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Actions ── */}
        <div className={styles.actions}>
          {nextMode && !modesDone[nextMode as keyof typeof modesDone] && (
            <button className={styles.btnPrimary} onClick={onNextMode}
              style={{ background: MODE_CONFIG[nextMode].colour }}>
              {MODE_CONFIG[nextMode].icon} Start {MODE_CONFIG[nextMode].label} →
            </button>
          )}
          {allDone && (
            <div className={styles.allDone}>🎉 All stages complete!</div>
          )}
          <button className={styles.btnSecondary} onClick={onReplay}>
            Replay {cfg.icon} {cfg.label}
          </button>
          <button className={styles.btnGhost} onClick={onBackToHub}>
            ← Back to hub
          </button>
        </div>

      </div>
    </div>
  );
}