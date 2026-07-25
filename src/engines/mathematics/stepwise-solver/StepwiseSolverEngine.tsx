"use client";

/**
 * StepwiseSolverEngine.tsx — Universal maths solving engine.
 *
 * Simple stepwise MCQ flow:
 *   1. Formula shown on parchment card
 *   2. Student picks one of 4 choices for the current step
 *   3. Correct → step stamps into the trail, next step loads
 *   4. Wrong → shake animation, try again (no penalty in guided/practice)
 *   5. When all steps done → trail shows complete solution + final answer
 *
 * Modes:
 *   Guided   — coach bubble explains each step. First visit: highlights correct answer.
 *   Practice — no coach. Hint available on tap.
 *   Challenge/Mastery — 10s think time → pick final answer from 4 options → 2 wrong → guided walkthrough.
 */

import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import type { EngineRuntimeProps } from "@/engines/engine-types";
import styles from "./StepwiseSolverEngine.module.css";

// ─── KaTeX ────────────────────────────────────────────────────────────────────

let katexModule: typeof import("katex") | null = null;
async function loadKatex() {
  if (katexModule) return katexModule;
  katexModule = await import("katex");
  return katexModule;
}

function KaTeX({ tex, block = false }: { tex: string; block?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    let cancelled = false;
    loadKatex().then((k) => {
      if (cancelled || !ref.current) return;
      try {
        k.default.render(tex, ref.current, {
          displayMode: block,
          throwOnError: false,
          strict: false,
          output: "html",
        });
      } catch {
        if (ref.current) ref.current.textContent = tex;
      }
    });
    return () => { cancelled = true; };
  }, [tex, block]);
  return <span ref={ref} className={block ? styles.katexBlock : styles.katexInline} />;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type StepMode = "guided" | "practice" | "challenge" | "mastery";

export interface StepChoice {
  icon: string;
  label: string;
  sub: string;
  correct: boolean;
}

export interface QuestionStep {
  trailLabel: string;   // short label shown in the trail
  resultEq: string;     // LaTeX — equation after this step
  coach: string;        // HTML — shown in guided mode
  coachWrong: string;   // HTML — shown after wrong pick
  hint: string;         // plain text — shown in practice on tap
  choiceQuestion: string;
  choices: StepChoice[];
}

export interface StepwiseQuestion {
  goal: string;
  formula: string;      // LaTeX. Use \\ for multi-line
  topic: string;
  finalAnswer: string;
  steps: QuestionStep[];
  answerChoices?: { label: string; correct: boolean }[];
}

interface MissionEntry {
  id: string;
  missionKey: string;
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  sequenceIndex: number;
  xpReward: number;
  payload: Record<string, unknown>;
}

// ─── Payload → Question ───────────────────────────────────────────────────────

function payloadToQuestion(m: MissionEntry): StepwiseQuestion | null {
  const p = m.payload;
  const formula = p.formula as string | undefined;
  const steps   = p.steps   as QuestionStep[] | undefined;
  if (!formula || !steps || steps.length === 0) return null;
  return {
    goal:          (p.goal        as string) ?? "Solve",
    formula,
    topic:         (p.topic       as string) ?? "",
    finalAnswer:   (p.finalAnswer as string) ?? "",
    steps,
    answerChoices: p.answerChoices as { label: string; correct: boolean }[] | undefined,
  };
}

function missionsToQuestions(missions: MissionEntry[]): StepwiseQuestion[] {
  const seen = new Set<string>();
  return missions
    .sort((a, b) => a.sequenceIndex - b.sequenceIndex)
    .reduce<StepwiseQuestion[]>((acc, m) => {
      if (seen.has(m.missionKey)) return acc;
      seen.add(m.missionKey);
      const q = payloadToQuestion(m);
      if (q) acc.push(q);
      return acc;
    }, []);
}

// ─── Formula display ──────────────────────────────────────────────────────────

function FormulaDisplay({ formula }: { formula: string }) {
  // Split on \\ for simultaneous equations — each equation on its own line
  if (formula.includes("\\\\")) {
    const lines = formula.split("\\\\").map(l => l.trim()).filter(Boolean);
    return (
      <div className={styles.mcFormulaMulti}>
        {lines.map((line, i) => (
          <div key={i} className={styles.mcFormulaLine}>
            <KaTeX tex={line} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={styles.mcFormula}>
      <KaTeX tex={formula} />
    </div>
  );
}

// ─── State ────────────────────────────────────────────────────────────────────

type Screen = "hub" | "playing";

interface EngineState {
  screen: Screen;
  mode: StepMode;
  questionIdx: number;
  lives: number;
  xp: number;
  questionsCompleted: number;
  seenFormulas: Set<string>;
}

type Action =
  | { type: "SELECT_MODE"; mode: StepMode }
  | { type: "START_PLAY" }
  | { type: "EARN_XP"; amount: number }
  | { type: "LOSE_LIFE" }
  | { type: "NEXT_QUESTION" }
  | { type: "RESTART" };

const INITIAL_STATE: EngineState = {
  screen: "hub",
  mode: "guided",
  questionIdx: 0,
  lives: 3,
  xp: 0,
  questionsCompleted: 0,
  seenFormulas: new Set(),
};

function reduce(state: EngineState, action: Action): EngineState {
  switch (action.type) {
    case "SELECT_MODE":  return { ...state, mode: action.mode };
    case "START_PLAY":   return { ...state, screen: "playing", lives: 3 };
    case "EARN_XP":      return { ...state, xp: state.xp + action.amount };
    case "LOSE_LIFE":    return { ...state, lives: Math.max(0, state.lives - 1) };
    case "NEXT_QUESTION":
      return { ...state, questionIdx: state.questionIdx + 1, questionsCompleted: state.questionsCompleted + 1, lives: 3 };
    case "RESTART":
      return { ...INITIAL_STATE, mode: state.mode, seenFormulas: state.seenFormulas, questionsCompleted: state.questionsCompleted };
    default: return state;
  }
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function StepwiseSolverEngine({ config, onComplete }: EngineRuntimeProps) {
  const [state, dispatch] = useReducer(reduce, INITIAL_STATE);

  const shared      = ((config as Record<string, unknown>).shared as Record<string, unknown>) ?? {};
  const allMissions = (shared._allMissions as MissionEntry[] | undefined) ?? [];
  const onBack      = (shared._onBack as (() => void) | undefined) ?? (() => {});

  const guidedQ    = missionsToQuestions(allMissions.filter(m => m.difficulty === "EASY"));
  const practiceQ  = missionsToQuestions(allMissions.filter(m => m.difficulty === "MEDIUM"));
  const challengeQ = missionsToQuestions(allMissions.filter(m => m.difficulty === "HARD"));

  const questions =
    state.mode === "guided"   ? guidedQ   :
    state.mode === "practice" ? practiceQ : challengeQ;

  const isHardMode = state.mode === "challenge" || state.mode === "mastery";

  // Step state
  const [stepIdx, setStepIdx]               = useState(0);
  const [completedSteps, setCompletedSteps] = useState<{ label: string; eq: string }[]>([]);
  const [questionDone, setQuestionDone]     = useState(false);
  const [locked, setLocked]                 = useState(false);
  const [feedback, setFeedback]             = useState<Record<number, "correct" | "wrong">>({});
  const [coachText, setCoachText]           = useState("");
  const [hintVisible, setHintVisible]       = useState(false);

  // Challenge state
  const [chalPhase, setChalPhase]           = useState<"think" | "pick" | "solve_together">("think");
  const [countdown, setCountdown]           = useState(10);
  const [chalWrong, setChalWrong]           = useState(0);
  const [chalFeedback, setChalFeedback]     = useState<Record<number, "correct" | "wrong">>({});
  const [chalLocked, setChalLocked]         = useState(false);

  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTime  = useRef(Date.now());
  const totalTries = useRef(0);

  const currentQ  = questions.length
    ? questions[Math.min(state.questionIdx, questions.length - 1)]
    : undefined;
  const activeStep = currentQ?.steps[stepIdx];
  const isFirstVisit = !state.seenFormulas.has(currentQ?.formula ?? "");
  const isTellMode   = state.mode === "guided" && isFirstVisit;
  const correctIdx   = activeStep?.choices.findIndex(c => c.correct) ?? -1;

  // Reset on question change
  useEffect(() => {
    setStepIdx(0);
    setCompletedSteps([]);
    setQuestionDone(false);
    setLocked(false);
    setFeedback({});
    setCoachText("");
    setHintVisible(false);
    setChalPhase("think");
    setCountdown(10);
    setChalWrong(0);
    setChalFeedback({});
    setChalLocked(false);
    startTime.current = Date.now();
    totalTries.current = 0;
  }, [state.questionIdx, state.screen]);

  // Set coach text when step changes
  useEffect(() => {
    if (activeStep) setCoachText(activeStep.coach);
    setLocked(false);
    setFeedback({});
    setHintVisible(false);
  }, [stepIdx, state.questionIdx]); // eslint-disable-line

  // Challenge countdown
  useEffect(() => {
    if (!isHardMode || chalPhase !== "think") return;
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); setChalPhase("pick"); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isHardMode, chalPhase, state.questionIdx]);

  // ── Guided/Practice: pick a step operation ──
  const handlePick = useCallback((idx: number, correct: boolean) => {
    if (locked || !activeStep || !currentQ || questionDone) return;
    setLocked(true);
    totalTries.current += 1;

    if (correct) {
      setFeedback({ [idx]: "correct" });
      dispatch({ type: "EARN_XP", amount: state.mode === "guided" ? 5 : 8 });

      setTimeout(() => {
        const newStep = { label: activeStep.trailLabel, eq: activeStep.resultEq };
        const isLast  = stepIdx >= currentQ.steps.length - 1;

        if (isLast) {
          state.seenFormulas.add(currentQ.formula);
          setCompletedSteps(prev => [...prev, newStep]);
          setQuestionDone(true);
          setLocked(false);
          setFeedback({});
          onComplete({ success: true, score: 100, timeSpentSec: Math.round((Date.now() - startTime.current) / 1000), attemptsBeforeSuccess: totalTries.current });
        } else {
          setCompletedSteps(prev => [...prev, newStep]);
          setStepIdx(prev => prev + 1);
          // useEffect will set coach text for the new step
          setLocked(false);
          setFeedback({});
        }
      }, 600);
    } else {
      setFeedback({ [idx]: "wrong" });
      if (state.mode === "guided" || state.mode === "practice") {
        setCoachText(activeStep.coachWrong);
      }
      setTimeout(() => { setFeedback({}); setLocked(false); }, 1400);
    }
  }, [locked, activeStep, currentQ, stepIdx, questionDone, state, onComplete]);

  // ── Challenge: pick final answer ──
  const handleChalPick = useCallback((idx: number, correct: boolean) => {
    if (chalLocked || !currentQ) return;
    setChalLocked(true);
    totalTries.current += 1;

    if (correct) {
      setChalFeedback(prev => ({ ...prev, [idx]: "correct" }));
      dispatch({ type: "EARN_XP", amount: 20 });
      onComplete({ success: true, score: 100, timeSpentSec: Math.round((Date.now() - startTime.current) / 1000), attemptsBeforeSuccess: totalTries.current });
      setTimeout(() => { setQuestionDone(true); setChalLocked(false); }, 800);
    } else {
      setChalFeedback(prev => ({ ...prev, [idx]: "wrong" }));
      dispatch({ type: "LOSE_LIFE" });
      const newWrong = chalWrong + 1;
      setChalWrong(newWrong);
      if (newWrong >= 2) {
        setTimeout(() => { setChalPhase("solve_together"); setChalLocked(false); }, 1000);
      } else {
        setTimeout(() => setChalLocked(false), 1200);
      }
    }
  }, [chalLocked, currentQ, chalWrong, onComplete]);

  // ── Hub ──
  if (state.screen === "hub") {
    return <HubScreen state={state} dispatch={dispatch} hasPractice={practiceQ.length > 0} hasChallenge={challengeQ.length > 0} onBack={onBack} />;
  }

  if (!currentQ) {
    return (
      <div className={styles.emptyState}>
        <p>No questions available for this mode yet.</p>
        <button className={styles.emptyBack} onClick={() => dispatch({ type: "RESTART" })}>← Back</button>
      </div>
    );
  }

  const badgeClass =
    state.mode === "guided"   ? styles.badgeGuided   :
    state.mode === "practice" ? styles.badgePractice :
    state.mode === "mastery"  ? styles.badgeMastery  : styles.badgeChallenge;

  const modeLabel =
    chalPhase === "solve_together" ? "🤝 Together" :
    state.mode === "guided"   ? "📖 Guided"   :
    state.mode === "practice" ? "⚡ Practice"  :
    state.mode === "mastery"  ? "🏅 Mastery"  : "🔥 Challenge";

  const hasMore = state.questionIdx + 1 < questions.length;

  const MissionCard = () => (
    <div className={styles.missionCard}>
      <div className={styles.mcTop}>
        <div className={styles.mcLeft}>
          <div className={styles.mcTopic}>{currentQ.topic}</div>
          <FormulaDisplay formula={currentQ.formula} />
          <div className={styles.mcGoal}>🎯 {currentQ.goal}</div>
        </div>
        <div className={styles.mcStamp}>
          {chalPhase === "solve_together" ? "TOGETHER" :
           state.mode === "guided"   ? "LEARN"    :
           state.mode === "practice" ? "PRACTICE" :
           state.mode === "mastery"  ? "MASTERY"  : "CHALLENGE"}
        </div>
      </div>
    </div>
  );

  // ── Challenge: think ──
  if (isHardMode && chalPhase === "think") {
    return (
      <div className={styles.challengeRoot}>
        <div className={styles.playBg} />
        <div className={styles.topbar}>
          <button className={styles.backBtn} onClick={() => dispatch({ type: "RESTART" })}>←</button>
          <div className={`${styles.modeBadge} ${badgeClass}`}>{modeLabel}</div>
          <div className={styles.lives}>{[0,1,2].map(i => <span key={i} className={i < state.lives ? styles.heartFull : styles.heartLost}>{i < state.lives ? "❤️" : "🖤"}</span>)}</div>
        </div>
        <div className={styles.challengeCardWrap}><MissionCard /></div>
        <div className={styles.thinkZone}>
          <div className={styles.thinkLabel}>Work it out on paper…</div>
          <div className={styles.thinkCountdown}>{countdown}</div>
          <div className={styles.thinkBar}><div className={styles.thinkBarFill} style={{ width: `${(countdown / 10) * 100}%` }} /></div>
          <button className={styles.thinkReadyBtn} onClick={() => { if (timerRef.current) clearInterval(timerRef.current); setChalPhase("pick"); }}>I&apos;m ready →</button>
        </div>
      </div>
    );
  }

  // ── Challenge: pick final answer ──
  if (isHardMode && chalPhase === "pick") {
    const choices = currentQ.answerChoices ?? [];
    // If no answer choices in payload, fall straight to stepwise solve_together
    if (choices.length === 0 && !questionDone) {
      setChalPhase("solve_together");
    }
    return (
      <div className={styles.challengeRoot}>
        <div className={styles.playBg} />
        <div className={styles.topbar}>
          <button className={styles.backBtn} onClick={() => dispatch({ type: "RESTART" })}>←</button>
          <div className={`${styles.modeBadge} ${badgeClass}`}>{modeLabel}</div>
          <div className={styles.lives}>{[0,1,2].map(i => <span key={i} className={i < state.lives ? styles.heartFull : styles.heartLost}>{i < state.lives ? "❤️" : "🖤"}</span>)}</div>
        </div>
        <div className={styles.challengeCardWrap}><MissionCard /></div>
        {questionDone ? (
          <div className={styles.doneZone}>
            <div className={styles.doneXp}>+20 XP 🎉</div>
            <button className={styles.nextBtn} onClick={() => hasMore ? dispatch({ type: "NEXT_QUESTION" }) : dispatch({ type: "RESTART" })}>
              {hasMore ? "Next question →" : "All done! →"}
            </button>
          </div>
        ) : choices.length > 0 ? (
          <div className={styles.challengePickZone}>
            <div className={styles.challengePickLabel}>What is the answer?</div>
            <div className={styles.answerGrid}>
              {choices.map((ch, i) => (
                <button key={i}
                  className={[styles.answerBtn, chalFeedback[i] === "correct" ? styles.answerCorrect : "", chalFeedback[i] === "wrong" ? styles.answerWrong : ""].join(" ")}
                  onClick={() => handleChalPick(i, ch.correct)}
                  disabled={chalLocked || chalFeedback[i] === "wrong"}
                >
                  <KaTeX tex={ch.label} />
                </button>
              ))}
            </div>
            {chalWrong === 1 && <div className={styles.challengeWarning}>⚠️ One more wrong and we&apos;ll solve it together.</div>}
          </div>
        ) : null}
      </div>
    );
  }

  // ── Stepwise (guided / practice / solve_together) ──
  if (!activeStep && !questionDone) return null;

  return (
    <div className={styles.playRoot}>
      <div className={styles.playBg} />

      <div className={styles.topbar}>
        <button className={styles.backBtn} onClick={() => dispatch({ type: "RESTART" })}>←</button>
        <div className={`${styles.modeBadge} ${badgeClass}`}>{modeLabel}</div>
        <div className={styles.topRight}>
          <div className={styles.stepCounter}>
            Step <strong>{questionDone ? currentQ.steps.length : stepIdx + 1}/{currentQ.steps.length}</strong>
          </div>
        </div>
      </div>

      <div className={styles.scroll}>
        <MissionCard />

        {/* Completed steps trail */}
        {completedSteps.map((s, i) => (
          <div key={i} className={`${styles.stepRow} ${styles.stepRowVisible}`}>
            <div className={styles.stepLine}>
              <div className={`${styles.stepCircle} ${styles.stepDone}`}>✓</div>
              {(i < completedSteps.length - 1 || !questionDone) && <div className={styles.stepTail} />}
            </div>
            <div className={styles.stepBody}>
              <div className={styles.stepLabel}>{s.label}</div>
              <div className={styles.stepEq}><KaTeX tex={s.eq} /></div>
            </div>
          </div>
        ))}

        {/* Final answer */}
        {questionDone && (
          <div className={`${styles.stepRow} ${styles.stepRowVisible}`}>
            <div className={styles.stepLine}>
              <div className={`${styles.stepCircle} ${styles.stepFinal}`}>★</div>
            </div>
            <div className={styles.stepBody}>
              <div className={`${styles.stepLabel} ${styles.stepLabelFinal}`}>Answer</div>
              <div className={styles.stepEqFinal}><KaTeX tex={currentQ.finalAnswer} /></div>
            </div>
          </div>
        )}

        {/* Current step marker */}
        {!questionDone && completedSteps.length > 0 && activeStep && (
          <div className={`${styles.stepRow} ${styles.stepRowVisible}`}>
            <div className={styles.stepLine}>
              <div className={`${styles.stepCircle} ${styles.stepCurrent}`}>{stepIdx + 1}</div>
            </div>
            <div className={styles.stepBody}>
              <div className={`${styles.stepLabel} ${styles.stepLabelCurrent}`}>Step {stepIdx + 1} · Your move</div>
            </div>
          </div>
        )}
      </div>

      {/* Done */}
      {questionDone && (
        <div className={styles.doneZone}>
          <div className={styles.doneXp}>+{state.mode === "guided" ? 10 : state.mode === "practice" ? 20 : 40} XP 🎉</div>
          <button className={styles.nextBtn} onClick={() => hasMore ? dispatch({ type: "NEXT_QUESTION" }) : dispatch({ type: "RESTART" })}>
            {hasMore ? "Next question →" : "All done! →"}
          </button>
        </div>
      )}

      {/* Coach — guided only */}
      {!questionDone && (state.mode === "guided" || chalPhase === "solve_together") && activeStep && (
        <div className={styles.coachCard}>
          <div className={styles.coachHeader}>
            <span className={styles.coachAvatar}>🧠</span>
            <span className={styles.coachName}>Ms. Chidera</span>
          </div>
          <div className={styles.coachText}
            dangerouslySetInnerHTML={{ __html: coachText || activeStep.coach }}
          />
          {isTellMode && correctIdx >= 0 && (
            <div className={styles.coachTip}>
              <span className={styles.coachTipIcon}>💡</span>
              <span>Try: <strong>{activeStep.choices[correctIdx]?.label}</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Hint — practice only */}
      {!questionDone && state.mode === "practice" && activeStep && (
        <div className={styles.hintZone}>
          <button className={styles.hintToggle} onClick={() => setHintVisible(v => !v)}>
            <span>💡</span><span>{hintVisible ? "Hide hint" : "Need a hint?"}</span>
          </button>
          {hintVisible && <div className={styles.hintBox}>{activeStep.hint}</div>}
        </div>
      )}

      {/* Solve together banner */}
      {chalPhase === "solve_together" && (
        <div className={styles.solveTogetherBanner}>
          <span>🤝</span><span>Let&apos;s work through this together.</span>
        </div>
      )}

      {/* Choices */}
      {!questionDone && activeStep && (
        <div className={styles.choicesZone}>
          <div className={styles.choicesLabel}>
            {chalPhase === "solve_together" ? "Pick the correct step:" : activeStep.choiceQuestion}
          </div>
          <div className={styles.choicesGrid}>
            {activeStep.choices.map((ch, i) => (
              <button key={i}
                className={[
                  styles.choiceBtn,
                  feedback[i] === "correct" ? styles.choiceCorrect : "",
                  feedback[i] === "wrong"   ? styles.choiceWrong   : "",
                  isHardMode ? styles.choiceBtnChallenge : "",
                ].join(" ")}
                onClick={() => handlePick(i, ch.correct)}
                disabled={locked && feedback[i] !== "correct"}
              >
                <span className={styles.choiceIcon}>{ch.icon}</span>
                <span className={styles.choiceLabel}>{ch.label}</span>
                <span className={styles.choiceSub}>{ch.sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.bottomSpacer} />
    </div>
  );
}

// ─── Hub ──────────────────────────────────────────────────────────────────────

function HubScreen({ state, dispatch, hasPractice, hasChallenge, onBack }: {
  state: EngineState; dispatch: React.Dispatch<Action>;
  hasPractice: boolean; hasChallenge: boolean; onBack: () => void;
}) {
  const modes: { id: StepMode; icon: string; name: string; desc: string; color: string; locked: boolean }[] = [
    { id: "guided",    icon: "📖", name: "Guided Learning", color: "#f5a623", locked: false,        desc: "Ms. Chidera coaches every step. Learn why each operation works." },
    { id: "practice",  icon: "⚡", name: "Practice",         color: "#6c28e0", locked: !hasPractice, desc: "No coach. Work it out yourself. Hint available on tap." },
    { id: "challenge", icon: "🔥", name: "Challenge",         color: "#e03c28", locked: !hasChallenge,desc: "10 seconds to think, then pick the final answer. 2 wrong → solve together." },
    { id: "mastery",   icon: "🏅", name: "Mastery",           color: "#1a7a4a", locked: true,        desc: "Exam-level. Application questions. No scaffolding." },
  ];
  return (
    <div className={styles.hubRoot}>
      <div className={styles.hubBg} />
      <div className={styles.hubContent}>
        <button className={styles.hubBackBtn} onClick={onBack}>← Back</button>
        <div className={styles.hubWelcome}>👋 Welcome</div>
        <h1 className={styles.hubTitle}>Choose your <span className={styles.hubTitleAccent}>learning mode</span></h1>
        <p className={styles.hubDesc}>Work through each solution step by step. Every correct move builds the trail.</p>
        <div className={styles.modeList}>
          {modes.map(m => (
            <button key={m.id}
              className={[styles.modeBtn, state.mode === m.id ? styles.modeBtnActive : "", m.locked ? styles.modeBtnLocked : ""].join(" ")}
              style={state.mode === m.id ? ({ "--mode-color": m.color } as React.CSSProperties) : undefined}
              onClick={() => { if (!m.locked) dispatch({ type: "SELECT_MODE", mode: m.id }); }}
            >
              <span className={styles.modeIcon}>{m.icon}</span>
              <div className={styles.modeText}>
                <div className={styles.modeName}>{m.name}{m.locked && <span className={styles.comingSoon}> · Coming soon</span>}</div>
                <div className={styles.modeDesc}>{m.desc}</div>
              </div>
              <span className={styles.modeArrow}>{m.locked ? "🔒" : "→"}</span>
            </button>
          ))}
        </div>
        <button className={styles.startBtn} onClick={() => dispatch({ type: "START_PLAY" })}>Begin →</button>
      </div>
    </div>
  );
}