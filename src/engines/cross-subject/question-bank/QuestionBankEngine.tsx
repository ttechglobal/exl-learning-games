"use client";

/**
 * QuestionBankEngine.tsx
 *
 * Cross-subject question-bank engine for Practice, Challenge, and Mastery.
 *
 * LAYOUT:
 *   Full-screen GameplayShell with:
 *   - Progress bar showing questions answered / total
 *   - Stage badge (Practice / Challenge / Mastery)
 *   - Dr. Adaobi bubble at top (her line for this question)
 *   - Question card (scenario box if present, stem, options)
 *   - After answer: explanation panel slides up, Next button
 *
 * SESSION FLOW:
 *   intro → question[0] → explanation → question[1] → ... → results
 *
 * QUESTION FLOW per question:
 *   "unanswered" → student taps option → "answered-wrong" (hint shown)
 *                                      → "answered-correct" (explanation shown)
 *   After maxWrongBeforeReveal wrong attempts → "revealed" (correct highlighted)
 */

import { useState, useMemo, useRef } from "react";
import { GameplayShell } from "@/components/gameplay/GameplayShell";
import type { EngineRuntimeProps } from "@/engines/engine-types";
import type {
  QuestionBankConfig,
  QuestionBankOutcome,
  Question,
  QuestionPart,
} from "./questionBank.config";
import styles from "./QuestionBankEngine.module.css";

// ─── Stage metadata ───────────────────────────────────────────────────────────

const STAGE_META = {
  practice:  { label: "Practice",       color: "#ffb23c", emoji: "📝" },
  challenge: { label: "Challenge",      color: "#ef5d4e", emoji: "⚡" },
  mastery:   { label: "Mastery",        color: "#7b4fcb", emoji: "🏆" },
};

// ─── Question state ───────────────────────────────────────────────────────────

type QState = "unanswered" | "wrong" | "revealed" | "correct";

interface SessionQuestion {
  q: Question;
  state: QState;
  selectedKey: string | null;
  wrongAttempts: number;
  hintShown: boolean;
  firstTry: boolean;
  /** For multi-part: which part index we're on */
  currentPart: number;
  /** For multi-part: which parts are answered correctly */
  partResults: boolean[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuestionBankEngine({ config: rawConfig, onComplete, menu, isPaused }: EngineRuntimeProps) {
  const cfg = rawConfig as QuestionBankConfig;
  const { shared, mission } = cfg;
  const payload = mission.payload;
  const stage   = payload.stage;
  const stageMeta = STAGE_META[stage];

  // Build session question list
  const sessionQuestions = useMemo<SessionQuestion[]>(() => {
    const pool = shared.questions.filter(q => payload.questionKeys.includes(q.key));
    const shuffled = shuffle(pool);
    const selected = payload.sessionSize ? shuffled.slice(0, payload.sessionSize) : shuffled;
    return selected.map(q => ({
      q,
      state:        "unanswered",
      selectedKey:  null,
      wrongAttempts: 0,
      hintShown:    false,
      firstTry:     true,
      currentPart:  0,
      partResults:  q.parts ? new Array(q.parts.length).fill(false) : [],
    }));
  }, []); // eslint-disable-line

  const [questions, setQuestions] = useState<SessionQuestion[]>(sessionQuestions);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [screen, setScreen] = useState<"intro" | "question" | "results">("intro");

  const startTime = useRef(Date.now());
  const hintsUsed = useRef(0);

  const current = questions[currentIdx];
  const answered = questions.filter(q => q.state === "correct" || q.state === "revealed").length;
  const total    = questions.length;
  const progress = total > 0 ? answered / total : 0;

  // ── Update question state ─────────────────────────────────────────────────
  function updateCurrent(update: Partial<SessionQuestion>) {
    setQuestions(prev => prev.map((q, i) => i === currentIdx ? { ...q, ...update } : q));
  }

  // ── Handle MCQ/true-false tap ─────────────────────────────────────────────
  function handleOptionTap(key: string) {
    if (!current || current.state !== "unanswered") return;
    const isCorrect = key === current.q.correctKey;

    if (isCorrect) {
      updateCurrent({ state: "correct", selectedKey: key });
    } else {
      const newWrong = current.wrongAttempts + 1;
      const showHint = newWrong === 1;
      if (showHint) hintsUsed.current++;
      if (newWrong >= shared.maxWrongBeforeReveal) {
        updateCurrent({ state: "revealed", selectedKey: key, wrongAttempts: newWrong, hintShown: true, firstTry: false });
      } else {
        updateCurrent({ state: "wrong", selectedKey: key, wrongAttempts: newWrong, hintShown: showHint || current.hintShown, firstTry: false });
      }
    }
  }

  // ── Handle part tap (Mastery structured) ─────────────────────────────────
  function handlePartTap(partIdx: number, key: string) {
    if (!current || !current.q.parts) return;
    const part = current.q.parts[partIdx];
    if (!part) return;
    const isCorrect = key === part.correctKey;
    const newResults = [...current.partResults];
    newResults[partIdx] = isCorrect;

    const allDone = partIdx >= (current.q.parts.length - 1);
    updateCurrent({
      partResults: newResults,
      currentPart: allDone ? partIdx : partIdx + 1,
      state: allDone ? "correct" : "unanswered",
      firstTry: current.firstTry && isCorrect,
    });
  }

  // ── Retry (wrong state → unanswered, different option available) ──────────
  function handleRetry() {
    updateCurrent({ state: "unanswered", selectedKey: null });
  }

  // ── Advance to next question ──────────────────────────────────────────────
  function handleNext() {
    if (currentIdx + 1 >= total) {
      setScreen("results");
    } else {
      setCurrentIdx(prev => prev + 1);
    }
  }

  // ── Complete ──────────────────────────────────────────────────────────────
  function handleComplete() {
    const correctCount  = questions.filter(q => q.state === "correct").length;
    const firstTryCount = questions.filter(q => q.state === "correct" && q.firstTry).length;
    const scorePct      = total > 0 ? correctCount / total : 0;
    const passMark      = payload.passMark ?? 0.7;
    const outcome: QuestionBankOutcome = {
      success:         true,
      questionsTotal:  total,
      questionsCorrect: correctCount,
      firstTryCorrect: firstTryCount,
      hintsUsed:       hintsUsed.current,
      timeSpentSec:    Math.round((Date.now() - startTime.current) / 1000),
      passed:          scorePct >= passMark,
      scorePct,
    };
    onComplete(outcome as never);
  }

  const stats = [
    { label: "Stage",    value: stageMeta.label, tone: "gold" as const },
    { label: "Progress", value: `${answered}/${total}` },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // INTRO SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === "intro") {
    return (
      <GameplayShell
        fallbackGradient="linear-gradient(160deg, #0b1330 0%, #1a1248 100%)"
        accentColor={stageMeta.color}
        stats={[]}
        menu={menu!}
        isPaused={isPaused}
        gameTitle={mission.title}
      >
        <div className={styles.introWrap}>
          <div className={styles.introBadge} style={{ color: stageMeta.color, borderColor: stageMeta.color + "40", background: stageMeta.color + "18" }}>
            {stageMeta.emoji} {stageMeta.label}
          </div>
          <h2 className={styles.introTitle}>{mission.title}</h2>
          <p className={styles.introLine}>{payload.openingLine}</p>
          <div className={styles.introMeta}>
            <span>{total} question{total !== 1 ? "s" : ""}</span>
            <span>·</span>
            <span>{total * (stage === "mastery" ? 100 : stage === "challenge" ? 40 : 20)} XP available</span>
          </div>
          <button className={styles.startBtn} style={{ background: stageMeta.color }} onClick={() => setScreen("question")}>
            Begin →
          </button>
          <div className={styles.adaobiRow}>
            <div className={styles.adaobiSmall}><DrAdaobi /></div>
            <div className={styles.adaobiIntroLine}>{payload.openingLine}</div>
          </div>
        </div>
      </GameplayShell>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESULTS SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === "results") {
    const correctCount = questions.filter(q => q.state === "correct").length;
    const pct          = Math.round((correctCount / total) * 100);
    const passed       = pct >= ((payload.passMark ?? 0.7) * 100);

    return (
      <GameplayShell
        fallbackGradient="linear-gradient(160deg, #0b1330 0%, #1a1248 100%)"
        accentColor={stageMeta.color}
        stats={[]}
        menu={menu!}
        isPaused={isPaused}
        gameTitle={mission.title}
      >
        <div className={styles.resultsWrap}>
          <div className={styles.resultsScore} style={{ color: passed ? "#4caf6e" : "#ef5d4e" }}>
            {pct}%
          </div>
          <div className={styles.resultsLabel}>{passed ? "✓ Passed" : "Keep practising"}</div>
          <div className={styles.resultsMeta}>
            {correctCount} / {total} correct
            {hintsUsed.current > 0 && ` · ${hintsUsed.current} hint${hintsUsed.current > 1 ? "s" : ""} used`}
          </div>

          {/* Per-question summary */}
          <div className={styles.resultsList}>
            {questions.map((sq, i) => (
              <div key={sq.q.key} className={[styles.resultItem, sq.state === "correct" ? styles.resultCorrect : styles.resultWrong].join(" ")}>
                <span className={styles.resultNum}>{i + 1}</span>
                <span className={styles.resultQ}>{sq.q.stem.slice(0, 60)}{sq.q.stem.length > 60 ? "…" : ""}</span>
                <span className={styles.resultIcon}>{sq.state === "correct" ? "✓" : "✗"}</span>
              </div>
            ))}
          </div>

          <button className={styles.completeBtn} style={{ background: stageMeta.color }} onClick={handleComplete}>
            {passed ? "Continue →" : "Try again →"}
          </button>
        </div>
      </GameplayShell>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QUESTION SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (!current) return null;
  const q            = current.q;
  const qState       = current.state;
  const isAnswered   = qState === "correct" || qState === "revealed";
  const isWrong      = qState === "wrong";
  const showExpl     = isAnswered && (shared.showExplanation === "always" || qState === "revealed");
  const hasParts     = !!(q.parts && q.parts.length > 0);

  // Dr. Adaobi's line for this question
  function adaobiLine(): string {
    if (qState === "correct" && current.firstTry) return "Correct — well done. Read the explanation, then continue.";
    if (qState === "correct")  return "Got it — check the explanation below.";
    if (qState === "revealed") return `Here is the answer. ${q.explanation.slice(0, 80)}…`;
    if (isWrong && current.hintShown) return q.hint;
    return stage === "mastery"
      ? "Read carefully. Take your time."
      : stage === "challenge"
      ? "Apply what you know — reason it through."
      : "Think about what you saw in the lab.";
  }

  return (
    <GameplayShell
      fallbackGradient="linear-gradient(160deg, #0b1330 0%, #1a1248 100%)"
      accentColor={stageMeta.color}
      stats={stats}
      menu={menu!}
      isPaused={isPaused}
      gameTitle={mission.title}
    >
      <div className={styles.sessionWrap}>

        {/* Progress bar */}
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress * 100}%`, background: stageMeta.color }} />
        </div>

        {/* Question counter */}
        <div className={styles.qCounter}>
          Question {currentIdx + 1} of {total}
        </div>

        {/* Dr. Adaobi bubble */}
        <div className={styles.adaobiStrip}>
          <div className={styles.adaobiAvatar}><DrAdaobi /></div>
          <div className={styles.adaobiBubble}>
            <p className={styles.adaobiText}>{adaobiLine()}</p>
          </div>
        </div>

        {/* Question card */}
        <div className={styles.qCard}>

          {/* Scenario box */}
          {q.scenario && (
            <div className={styles.scenario}>
              <span className={styles.scenarioLabel}>🔬 In the lab</span>
              <p className={styles.scenarioText}>{q.scenario}</p>
            </div>
          )}

          {/* Stem */}
          <p className={styles.stem}>{q.stem}</p>

          {/* ── MULTI-PART (Mastery) ─────────────────────────────────── */}
          {hasParts && q.parts && (
            <div className={styles.partsWrap}>
              {q.parts.map((part: QuestionPart, pi: number) => {
                const isActive  = pi === current.currentPart && !isAnswered;
                const isDone    = pi < current.currentPart || isAnswered;
                const partResult = current.partResults[pi];

                return (
                  <div key={pi} className={[styles.part, isActive ? styles.partActive : "", isDone ? styles.partDone : ""].filter(Boolean).join(" ")}>
                    <div className={styles.partLabel}>{part.label} <span className={styles.partMarks}>[{part.marks} mark{part.marks > 1 ? "s" : ""}]</span></div>
                    <p className={styles.partStem}>{part.stem}</p>
                    {isActive && (
                      <div className={styles.optionGrid}>
                        {part.options.map(opt => (
                          <button key={opt.key} className={styles.option} onClick={() => handlePartTap(pi, opt.key)}>
                            {opt.text}
                          </button>
                        ))}
                      </div>
                    )}
                    {isDone && (
                      <div className={[styles.partResult, partResult ? styles.partCorrect : styles.partWrong].join(" ")}>
                        {partResult ? "✓ Correct" : "✗ Incorrect"} — {part.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── STANDARD OPTIONS ─────────────────────────────────────── */}
          {!hasParts && q.options && (
            <div className={styles.optionGrid}>
              {q.options.map(opt => {
                const isSelected = current.selectedKey === opt.key;
                const isCorrectOpt = opt.key === q.correctKey;
                let cls = styles.option;
                if (isAnswered && isCorrectOpt)                   cls = `${styles.option} ${styles.optionCorrect}`;
                else if (isSelected && (isWrong || qState === "revealed")) cls = `${styles.option} ${styles.optionWrong}`;
                else if (isAnswered)                               cls = `${styles.option} ${styles.optionDimmed}`;
                return (
                  <button
                    key={opt.key}
                    className={cls}
                    onClick={() => handleOptionTap(opt.key)}
                    disabled={isAnswered}
                  >
                    {opt.text}
                  </button>
                );
              })}
            </div>
          )}

          {/* Hint (shown after first wrong attempt, before reveal) */}
          {isWrong && current.hintShown && (
            <div className={styles.hint} role="alert">
              💡 {q.hint}
            </div>
          )}

          {/* Wrong: retry button */}
          {isWrong && !current.hintShown && (
            <div className={styles.hint} role="alert">
              Not quite — try again.
            </div>
          )}

          {/* Explanation (after answer) */}
          {showExpl && (
            <div className={styles.explanation}>
              <div className={styles.explLabel}>{qState === "correct" ? "✓ Correct" : "✗ Revealed"}</div>
              <p className={styles.explText}>{q.explanation}</p>
              {q.guidedMissionRef && (
                <div className={styles.explRef}>
                  This concept was covered in {q.guidedMissionRef}.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Next button — shown after answering */}
        {isAnswered && (
          <button
            className={styles.nextBtn}
            style={{ background: stageMeta.color }}
            onClick={handleNext}
          >
            {currentIdx + 1 >= total ? "See Results →" : "Next Question →"}
          </button>
        )}
      </div>
    </GameplayShell>
  );
}

// ─── Dr. Adaobi SVG ──────────────────────────────────────────────────────────

function DrAdaobi() {
  return (
    <svg viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%"}} aria-hidden="true">
      <ellipse cx="40" cy="97" rx="22" ry="4" fill="rgba(0,0,0,0.3)"/>
      <rect x="27" y="74" width="10" height="18" fill="#1a2a4a" rx="3"/>
      <rect x="43" y="74" width="10" height="18" fill="#1a2a4a" rx="3"/>
      <ellipse cx="32" cy="92" rx="7" ry="4" fill="#0e1828"/>
      <ellipse cx="48" cy="92" rx="7" ry="4" fill="#0e1828"/>
      <rect x="19" y="48" width="42" height="30" fill="#dde8f8" rx="6"/>
      <path d="M34 48 L40 64 L46 48Z" fill="#b8cce8"/>
      <rect x="35" y="48" width="10" height="14" fill="#2a4a8a"/>
      <rect x="10" y="50" width="10" height="28" fill="#dde8f8" rx="5"/>
      <rect x="60" y="50" width="10" height="28" fill="#dde8f8" rx="5"/>
      <ellipse cx="15" cy="79" rx="6" ry="5" fill="#c8956a"/>
      <ellipse cx="65" cy="78" rx="6" ry="5" fill="#c8956a"/>
      <rect x="36" y="44" width="8" height="6" fill="#c8956a" rx="3"/>
      <ellipse cx="40" cy="32" rx="18" ry="21" fill="#c8956a"/>
      <ellipse cx="40" cy="14" rx="19" ry="10" fill="#1a0800"/>
      {[25,30,35,40,45,50,55].map((x,i)=>(
        <ellipse key={i} cx={x} cy={16} rx={2.5} ry={6} fill={i%2===0?"#1a0800":"#2a0e00"}/>
      ))}
      <ellipse cx="22" cy="34" rx="4" ry="6" fill="#c8956a"/>
      <ellipse cx="58" cy="34" rx="4" ry="6" fill="#c8956a"/>
      <ellipse cx="33" cy="31" rx="5" ry="5" fill="#fff"/>
      <ellipse cx="47" cy="31" rx="5" ry="5" fill="#fff"/>
      <ellipse cx="34" cy="32" rx="3" ry="3" fill="#2a1808"/>
      <ellipse cx="48" cy="32" rx="3" ry="3" fill="#2a1808"/>
      <ellipse cx="33" cy="31" rx="1" ry="1" fill="#fff"/>
      <ellipse cx="47" cy="31" rx="1" ry="1" fill="#fff"/>
      <path d="M28 25 Q33 22 38 25" fill="none" stroke="#1a0800" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M42 25 Q47 22 52 25" fill="none" stroke="#1a0800" strokeWidth="1.4" strokeLinecap="round"/>
      <ellipse cx="40" cy="40" rx="2" ry="1.5" fill="#b07050"/>
      <path d="M35 46 Q40 50 45 46" fill="none" stroke="#9a6040" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
