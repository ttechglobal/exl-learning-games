"use client";

/**
 * StepwiseHub.tsx
 *
 * The "Choose Your Learning Mode" screen for the Stepwise Solver engine.
 * Extracted from StepwiseSolverEngine.tsx so it can be styled and iterated
 * independently from the core solving logic.
 *
 * Shows:
 * - Personalised greeting from Ms. Chidera
 * - Four mode cards (Guided / Practice / Challenge / Mastery)
 * - Per-mode progress fraction (e.g. 2/4)
 * - "Begin →" / "View all questions" actions
 * - Drill-down question list panel
 */

import React from "react";
import type { StepMode } from "./StepwiseSolverEngine";
import { ChideraAvatar } from "./ChideraAvatar";
import styles from "./StepwiseSolverEngine.module.css";

export interface HubQuestion {
  title: string;
  missionKey: string;
  done: boolean;
}

export interface StepwiseHubProps {
  currentMode: StepMode;
  onSelectMode: (mode: StepMode) => void;
  hasPractice: boolean;
  hasChallenge: boolean;
  onBack: () => void;
  onStart: () => void;
  resumeLabel?: string;
  studentName?: string;
  guidedQuestions: HubQuestion[];
  practiceQuestions: HubQuestion[];
  challengeQuestions: HubQuestion[];
}

const MODES: {
  id: StepMode;
  icon: string;
  name: string;
  desc: string;
  color: string;
  alwaysLocked?: boolean;
}[] = [
  {
    id: "guided",
    icon: "📖",
    name: "Guided Learning",
    color: "#f5a623",
    desc: "Ms. Chidera walks you through every step. Learn the why, not just the how.",
  },
  {
    id: "practice",
    icon: "⚡",
    name: "Practice",
    color: "#6c28e0",
    desc: "Work it out yourself. Ms. Chidera gives you a nudge, not the answer.",
  },
  {
    id: "challenge",
    icon: "🔥",
    name: "Challenge",
    color: "#e03c28",
    desc: "Solve on paper first, then pick your answer. Full marks for first-try correct.",
  },
  {
    id: "mastery",
    icon: "🏅",
    name: "Mastery",
    color: "#1a7a4a",
    alwaysLocked: true,
    desc: "Exam-level. Application questions. No scaffolding.",
  },
];

export function StepwiseHub({
  currentMode,
  onSelectMode,
  hasPractice,
  hasChallenge,
  onBack,
  onStart,
  resumeLabel,
  studentName,
  guidedQuestions,
  practiceQuestions,
  challengeQuestions,
}: StepwiseHubProps) {
  const [showMissions, setShowMissions] = React.useState(false);

  const questionsFor: Record<StepMode, HubQuestion[]> = {
    guided: guidedQuestions,
    practice: practiceQuestions,
    challenge: challengeQuestions,
    mastery: [],
  };

  const activeQuestions = questionsFor[currentMode] ?? [];
  const doneCount = activeQuestions.filter((q) => q.done).length;

  // ── Question drill-down panel ──────────────────────────────────────────────
  if (showMissions) {
    const modeIcon =
      currentMode === "guided" ? "📖" : currentMode === "practice" ? "⚡" : "🔥";
    const modeName =
      currentMode === "guided"
        ? "Guided Learning"
        : currentMode === "practice"
        ? "Practice"
        : "Challenge";

    return (
      <div className={styles.missionsRoot}>
        <div className={styles.hubBg} />
        <div className={styles.missionsContent}>
          <div className={styles.missionsHeader}>
            <button
              className={styles.missionsBackBtn}
              onClick={() => setShowMissions(false)}
            >
              ← Back
            </button>
            <div className={styles.missionsTitle}>
              {modeIcon} {modeName}
            </div>
            <div className={styles.missionsProg}>
              {doneCount}/{activeQuestions.length} done
            </div>
          </div>

          {/* Progress bar */}
          <div className={styles.missionsBar}>
            <div
              className={styles.missionsBarFill}
              style={{
                width: activeQuestions.length
                  ? `${(doneCount / activeQuestions.length) * 100}%`
                  : "0%",
              }}
            />
          </div>

          {/* Question list */}
          <div className={styles.missionsList}>
            {activeQuestions.length === 0 ? (
              <div className={styles.missionsEmpty}>
                No questions available yet.
              </div>
            ) : (
              activeQuestions.map((q, i) => {
                const isCurrent = !q.done && i === doneCount;
                return (
                  <div
                    key={q.missionKey}
                    className={[
                      styles.missionItem,
                      q.done
                        ? styles.missionItemDone
                        : isCurrent
                        ? styles.missionItemCurrent
                        : styles.missionItemLocked,
                    ].join(" ")}
                  >
                    <div className={styles.missionItemNumber}>
                      {q.done ? "✓" : isCurrent ? String(i + 1) : "–"}
                    </div>
                    <div className={styles.missionItemText}>
                      <div className={styles.missionItemTitle}>{q.title}</div>
                      <div className={styles.missionItemSub}>
                        {q.done
                          ? "Completed"
                          : isCurrent
                          ? "Up next"
                          : "Locked"}
                      </div>
                    </div>
                    {isCurrent && (
                      <button
                        className={styles.missionItemStart}
                        onClick={() => {
                          setShowMissions(false);
                          onStart();
                        }}
                      >
                        Start →
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Main hub ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.hubRoot}>
      <div className={styles.hubBg} />
      <div className={styles.hubContent}>
        <button className={styles.hubBackBtn} onClick={onBack}>
          ← Back
        </button>

        {/* Ms. Chidera welcome */}
        <div className={styles.hubAvatarRow}>
          <ChideraAvatar />
          <div className={styles.hubGreetingBubble}>
            <div className={styles.hubWelcome}>
              {studentName ? (
                <>
                  Welcome, <strong>{studentName}</strong>!
                </>
              ) : (
                <>Welcome!</>
              )}
            </div>
            <div className={styles.hubTeacherLine}>
              <em>Let&apos;s sharpen those maths skills today!</em>
            </div>
          </div>
        </div>

        <h1 className={styles.hubTitle}>
          Choose your{" "}
          <span className={styles.hubTitleAccent}>learning mode</span>
        </h1>
        <p className={styles.hubDesc}>
          Work through each solution step by step. Every correct move builds
          the trail.
        </p>

        <div className={styles.modeList}>
          {MODES.map((m) => {
            const locked =
              m.alwaysLocked ||
              (m.id === "practice" && !hasPractice) ||
              (m.id === "challenge" && !hasChallenge);
            const mq = questionsFor[m.id] ?? [];
            const md = mq.filter((q) => q.done).length;
            return (
              <button
                key={m.id}
                className={[
                  styles.modeBtn,
                  currentMode === m.id ? styles.modeBtnActive : "",
                  locked ? styles.modeBtnLocked : "",
                ].join(" ")}
                style={
                  currentMode === m.id
                    ? ({ "--mode-color": m.color } as React.CSSProperties)
                    : undefined
                }
                onClick={() => {
                  if (!locked) onSelectMode(m.id);
                }}
              >
                <span className={styles.modeIcon}>{m.icon}</span>
                <div className={styles.modeText}>
                  <div className={styles.modeName}>
                    {m.name}
                    {locked && (
                      <span className={styles.comingSoon}> · Coming soon</span>
                    )}
                  </div>
                  <div className={styles.modeDesc}>{m.desc}</div>
                </div>
                <div className={styles.modeMeta}>
                  {!locked && mq.length > 0 && (
                    <div className={styles.modeProg}>
                      {md}/{mq.length}
                    </div>
                  )}
                  <span className={styles.modeArrow}>
                    {locked ? "🔒" : "→"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className={styles.hubActions}>
          <button className={styles.startBtn} onClick={onStart}>
            {resumeLabel ?? "Begin →"}
          </button>
          <button
            className={styles.viewMissionsBtn}
            onClick={() => setShowMissions(true)}
          >
            View all questions
          </button>
        </div>
      </div>
    </div>
  );
}