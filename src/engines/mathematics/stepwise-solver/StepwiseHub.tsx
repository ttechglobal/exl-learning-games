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

import React, { useState, useEffect } from "react";
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
  const [showMissions, setShowMissions] = useState(false);

  // Onboarding — show once, on first ever visit. localStorage key: exl:onboardingSeen
  const [onboardingSlide, setOnboardingSlide] = useState<number | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem("exl:onboardingSeen");
    if (!seen) setOnboardingSlide(0);
  }, []);

  const ONBOARDING_SLIDES = [
    { text: `Hey${studentName ? ", " + studentName : ""}! I'm Ms. Chidera. I'll walk you through every step of each question — you never have to guess alone.` },
    { text: "Each question shows you an equation. Your job is to rearrange it — step by step — until the subject is on its own." },
    { text: "I'll explain each move before you choose. When you pick correctly, you'll see exactly how the algebra works." },
    { text: "Ready to begin? Pick Guided Learning to start — I'll be with you the whole way." },
  ];

  const questionsFor: Record<StepMode, HubQuestion[]> = {
    guided: guidedQuestions,
    practice: practiceQuestions,
    challenge: challengeQuestions,
    mastery: [],
  };

  const activeQuestions = questionsFor[currentMode] ?? [];
  const doneCount = activeQuestions.filter((q) => q.done).length;

  // ── Onboarding overlay ─────────────────────────────────────────────────────
  if (onboardingSlide !== null) {
    const slide = ONBOARDING_SLIDES[onboardingSlide];
    const isLast = onboardingSlide === ONBOARDING_SLIDES.length - 1;
    const dismiss = () => {
      if (typeof window !== "undefined") localStorage.setItem("exl:onboardingSeen", "1");
      setOnboardingSlide(null);
    };
    return (
      <div className={styles.onboardRoot}>
        <div className={styles.hubBg} />
        {/* Dimmed hub content behind */}
        <div className={styles.onboardOverlay} />
        {/* Chidera + bubble, centred */}
        <div className={styles.onboardContent}>
          <div className={styles.onboardAvatar}>
            <ChideraAvatar size={80} mood="explain" />
          </div>
          <div className={styles.onboardBubble}>
            <div className={styles.onboardName}>Ms. Chidera</div>
            <div className={styles.onboardText}>{slide.text}</div>
            <div className={styles.onboardDots}>
              {ONBOARDING_SLIDES.map((_, i) => (
                <div
                  key={i}
                  className={[
                    styles.onboardDot,
                    i === onboardingSlide ? styles.onboardDotActive : "",
                  ].join(" ")}
                />
              ))}
            </div>
            <button
              className={styles.onboardBtn}
              onClick={() => isLast ? dismiss() : setOnboardingSlide(s => (s ?? 0) + 1)}
            >
              {isLast ? "Let's go →" : "Next →"}
            </button>
          </div>
          <button className={styles.onboardSkip} onClick={dismiss}>Skip intro</button>
        </div>
      </div>
    );
  }

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