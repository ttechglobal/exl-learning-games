"use client";

/**
 * StepwiseSolverEngine.tsx
 *
 * THE universal maths solving engine.
 * Works for every topic that involves step-by-step solving:
 *   - Change of Subject
 *   - Simultaneous Equations
 *   - Equations of Motion
 *   - Quadratic Equations
 *   - Any physics/maths calculation topic
 *
 * To add a new topic: create a game in admin pointing to engine type
 * "stepwise-solver", upload missions with the correct payload shape.
 * Zero code changes needed.
 *
 * Content comes entirely from config.shared._allMissions (injected by
 * PlayClient). The engine reads topic name, formula, steps, coaching,
 * hints from the mission payload — nothing is hardcoded here.
 *
 * Math rendering: KaTeX. Install: npm install katex @types/katex
 * Add to layout.tsx: <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" />
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
    let cancelled = false;
    loadKatex().then((k) => {
      if (cancelled || !ref.current) return;
      try {
        k.default.render(tex, ref.current, {
          displayMode: block,
          throwOnError: false,
          strict: false,
        });
      } catch {
        if (ref.current) ref.current.textContent = tex;
      }
    });
    return () => { cancelled = true; };
  }, [tex, block]);

  return <span ref={ref} className={block ? styles.katexBlock : styles.katexInline} />;
}

// ─── Data types ───────────────────────────────────────────────────────────────

export type StepMode = "guided" | "practice" | "challenge" | "mastery";

export interface StepChoice {
  icon: string;
  label: string;
  sub: string;
  correct: boolean;
}

export interface QuestionStep {
  trailLabel: string;     // plain text — short label for the trail
  resultEq: string;       // LaTeX — equation after this step
  coach: string;          // HTML — shown in Guided before the student picks
  coachWrong: string;     // HTML — shown after a wrong pick
  hint: string;           // plain text — shown in Practice on tap
  choiceQuestion: string; // plain text — shown above the 4 choices
  choices: StepChoice[];  // exactly 4, exactly 1 correct
}

export interface StepwiseQuestion {
  goal: string;         // plain text — e.g. "Make t the subject" or "Find x and y"
  formula: string;      // LaTeX — starting formula. Use \\ for multi-line (simultaneous eq)
  topic: string;        // plain text — e.g. "Kinematics", "Simultaneous Equations"
  finalAnswer: string;  // LaTeX — the complete answer
  steps: QuestionStep[];
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
  const p = m.payload as Partial<StepwiseQuestion>;
  if (!p.formula || !p.steps || p.steps.length === 0) return null;
  return {
    goal:        p.goal        ?? "Solve",
    formula:     p.formula,
    topic:       p.topic       ?? "",
    finalAnswer: p.finalAnswer ?? "",
    steps:       p.steps,
  };
}

function missionsToQuestions(missions: MissionEntry[]): StepwiseQuestion[] {
  return missions
    .sort((a, b) => a.sequenceIndex - b.sequenceIndex)
    .map(payloadToQuestion)
    .filter((q): q is StepwiseQuestion => q !== null);
}

// ─── State ────────────────────────────────────────────────────────────────────

type Screen = "hub" | "selfsolve" | "playing" | "review" | "complete";

interface EngineState {
  screen: Screen;
  mode: StepMode;
  questionIdx: number;
  lives: number;
  xp: number;
  hintVisible: boolean;
  selfSolveCountdown: number;
  questionsCompleted: number;
  seenFormulas: Set<string>;
}

type Action =
  | { type: "SELECT_MODE"; mode: StepMode }
  | { type: "START_PLAY" }
  | { type: "TICK_SELF_SOLVE" }
  | { type: "SELF_SOLVE_SKIP" }
  | { type: "CORRECT_PICK" }
  | { type: "WRONG_PICK" }
  | { type: "TOGGLE_HINT" }
  | { type: "CLOSE_HINT" }
  | { type: "SHOW_REVIEW" }
  | { type: "NEXT_QUESTION" }
  | { type: "RESTART" };

const INITIAL_STATE: EngineState = {
  screen: "hub",
  mode: "guided",
  questionIdx: 0,
  lives: 3,
  xp: 0,
  hintVisible: false,
  selfSolveCountdown: 10,
  questionsCompleted: 0,
  seenFormulas: new Set(),
};

function reduce(state: EngineState, action: Action): EngineState {
  switch (action.type) {
    case "SELECT_MODE":
      return { ...state, mode: action.mode };

    case "START_PLAY": {
      const shouldSelfSolve =
        state.questionsCompleted >= 1 && state.mode !== "guided";
      return {
        ...state,
        screen: shouldSelfSolve ? "selfsolve" : "playing",
        hintVisible: false,
        selfSolveCountdown: 10,
        lives: 3,
      };
    }

    case "TICK_SELF_SOLVE":
      if (state.selfSolveCountdown <= 1)
        return { ...state, screen: "playing", selfSolveCountdown: 0 };
      return { ...state, selfSolveCountdown: state.selfSolveCountdown - 1 };

    case "SELF_SOLVE_SKIP":
      return { ...state, screen: "playing" };

    case "CORRECT_PICK": {
      const gain =
        state.mode === "guided"    ? 5  :
        state.mode === "practice"  ? 8  :
        state.mode === "challenge" ? 15 : 20;
      return { ...state, xp: state.xp + gain };
    }

    case "WRONG_PICK": {
      const newLives =
        state.mode === "challenge" || state.mode === "mastery"
          ? state.lives - 1 : state.lives;
      return { ...state, lives: newLives };
    }

    case "TOGGLE_HINT":
      return { ...state, hintVisible: !state.hintVisible };

    case "CLOSE_HINT":
      return { ...state, hintVisible: false };

    case "SHOW_REVIEW":
      return { ...state, screen: "review" };

    case "NEXT_QUESTION":
      return {
        ...state,
        screen: "complete",
        questionsCompleted: state.questionsCompleted + 1,
        questionIdx: state.questionIdx + 1,
      };

    case "RESTART":
      return {
        ...INITIAL_STATE,
        mode: state.mode,
        seenFormulas: state.seenFormulas,
        questionsCompleted: state.questionsCompleted,
      };

    default:
      return state;
  }
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function StepwiseSolverEngine({ config, onComplete }: EngineRuntimeProps) {
  const [state, dispatch] = useReducer(reduce, INITIAL_STATE);

  // Read all missions from PlayClient injection
  const allMissions =
    (((config as Record<string, unknown>).shared as Record<string, unknown>)
      ?._allMissions as MissionEntry[] | undefined) ?? [];

  const guidedQ    = missionsToQuestions(allMissions.filter(m => m.difficulty === "EASY"));
  const practiceQ  = missionsToQuestions(allMissions.filter(m => m.difficulty === "MEDIUM"));
  const challengeQ = missionsToQuestions(allMissions.filter(m => m.difficulty === "HARD"));
  // Mastery reuses HARD questions until dedicated mastery missions are added
  const masteryQ   = challengeQ;

  const questions =
    state.mode === "guided"    ? guidedQ    :
    state.mode === "practice"  ? practiceQ  :
    state.mode === "challenge" ? challengeQ :
                                 masteryQ;

  // Derive topic name from first available mission across all difficulties
  const topicName =
    [...guidedQ, ...practiceQ, ...challengeQ][0]?.topic ?? "Maths";

  // Local UI state
  const [locked, setLocked]                 = useState(false);
  const [feedback, setFeedback]             = useState<Record<number, "correct" | "wrong">>({});
  const [coachText, setCoachText]           = useState("");
  const [advancing, setAdvancing]           = useState(false);
  const [localStepIdx, setLocalStepIdx]     = useState(0);
  const [completedSteps, setCompletedSteps] = useState<{ label: string; eq: string }[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentQ = questions.length
    ? questions[Math.min(state.questionIdx, questions.length - 1)]
    : undefined;

  const activeStep  = currentQ?.steps[localStepIdx];
  const isFirstVisit = !state.seenFormulas.has(currentQ?.formula ?? "");
  const isTellMode  = state.mode === "guided" && isFirstVisit;
  const correctIdx  = activeStep?.choices.findIndex(c => c.correct) ?? -1;
  const isHardMode  = state.mode === "challenge" || state.mode === "mastery";
  const livesOut    = isHardMode && state.lives <= 0;

  // Reset local step state when question changes
  useEffect(() => {
    setLocalStepIdx(0);
    setCompletedSteps([]);
    setLocked(false);
    setFeedback({});
    setAdvancing(false);
  }, [state.questionIdx]);

  // Init coach text when step changes
  useEffect(() => {
    if (!activeStep) return;
    setCoachText(activeStep.coach);
    setLocked(false);
    setFeedback({});
  }, [localStepIdx, state.questionIdx]); // eslint-disable-line

  // Self-solve countdown
  useEffect(() => {
    if (state.screen !== "selfsolve") return;
    timerRef.current = setInterval(() => dispatch({ type: "TICK_SELF_SOLVE" }), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.screen]);

  const handlePick = useCallback((idx: number, correct: boolean) => {
    if (locked || advancing || !activeStep || !currentQ) return;
    setLocked(true);

    if (correct) {
      setFeedback({ [idx]: "correct" });
      dispatch({ type: "CORRECT_PICK" });
      dispatch({ type: "CLOSE_HINT" });

      setTimeout(() => {
        setAdvancing(true);
        const isLastStep = localStepIdx >= currentQ.steps.length - 1;

        if (isLastStep) {
          state.seenFormulas.add(currentQ.formula);
          setTimeout(() => {
            dispatch({ type: "SHOW_REVIEW" });
            setAdvancing(false);
          }, 800);
        } else {
          setTimeout(() => {
            setCompletedSteps(prev => [
              ...prev,
              { label: activeStep.trailLabel, eq: activeStep.resultEq },
            ]);
            setLocalStepIdx(prev => prev + 1);
            setLocked(false);
            setFeedback({});
            setAdvancing(false);
          }, 900);
        }
      }, 600);
    } else {
      setFeedback({ [idx]: "wrong" });
      dispatch({ type: "WRONG_PICK" });
      setCoachText(activeStep.coachWrong);
      setTimeout(() => {
        setFeedback({});
        setLocked(false);
      }, 1500);
    }
  }, [locked, advancing, activeStep, localStepIdx, currentQ, state]);

  // ── Screen routing ─────────────────────────────────────────────────────────

  if (state.screen === "hub") {
    return (
      <HubScreen
        state={state}
        dispatch={dispatch}
        topicName={topicName}
        hasPractice={practiceQ.length > 0}
        hasChallenge={challengeQ.length > 0}
      />
    );
  }

  if (!currentQ) {
    return (
      <div className={styles.emptyState}>
        <p>No questions available for this mode yet.</p>
        <button className={styles.emptyBack} onClick={() => dispatch({ type: "RESTART" })}>
          ← Back
        </button>
      </div>
    );
  }

  if (state.screen === "selfsolve") {
    return (
      <SelfSolveScreen
        question={currentQ}
        countdown={state.selfSolveCountdown}
        dispatch={dispatch}
      />
    );
  }

  if (state.screen === "review") {
    return (
      <ReviewScreen
        question={currentQ}
        completedSteps={completedSteps}
        mode={state.mode}
        onDone={() => dispatch({ type: "NEXT_QUESTION" })}
      />
    );
  }

  if (state.screen === "complete") {
    const doneQ = questions[Math.min(state.questionIdx - 1, questions.length - 1)];
    return (
      <CompleteScreen
        state={state}
        question={doneQ}
        dispatch={dispatch}
        hasMore={state.questionIdx < questions.length}
        onComplete={onComplete}
      />
    );
  }

  if (!activeStep) return null;

  // ── Playing screen ─────────────────────────────────────────────────────────

  const modeLabel =
    state.mode === "guided"    ? "📖 Guided"   :
    state.mode === "practice"  ? "⚡ Practice"  :
    state.mode === "mastery"   ? "🏅 Mastery"  : "🔥 Challenge";

  const badgeClass =
    state.mode === "guided"    ? styles.badgeGuided    :
    state.mode === "practice"  ? styles.badgePractice  :
    state.mode === "mastery"   ? styles.badgeMastery   : styles.badgeChallenge;

  // Detect multi-line formula (simultaneous equations use \\)
  const isMultiLine = currentQ.formula.includes("\\\\");

  return (
    <div className={styles.playRoot}>
      <div className={styles.playBg} />

      {/* Topbar */}
      <div className={styles.topbar}>
        <button className={styles.backBtn} onClick={() => dispatch({ type: "RESTART" })}>←</button>
        <div className={`${styles.modeBadge} ${badgeClass}`}>{modeLabel}</div>
        <div className={styles.topRight}>
          {isHardMode ? (
            <div className={styles.lives}>
              {[0,1,2].map(i => (
                <span key={i} className={i < state.lives ? styles.heartFull : styles.heartLost}>
                  {i < state.lives ? "❤️" : "🖤"}
                </span>
              ))}
            </div>
          ) : (
            <div className={styles.stepCounter}>
              Step <strong>{localStepIdx + 1}/{currentQ.steps.length}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Scroll area */}
      <div className={styles.scroll}>

        {/* Mission card — parchment */}
        <div className={styles.missionCard}>
          <div className={styles.mcTop}>
            <div className={styles.mcLeft}>
              <div className={styles.mcCase}>{currentQ.topic}</div>
              <div className={isMultiLine ? styles.mcFormulaMulti : styles.mcFormula}>
                <KaTeX tex={currentQ.formula} block={isMultiLine} />
              </div>
              <div className={styles.mcGoal}>🎯 {currentQ.goal}</div>
            </div>
            <div className={styles.mcStamp}>
              {state.mode === "guided"   ? "LEARN"    :
               state.mode === "practice" ? "PRACTICE" :
               state.mode === "mastery"  ? "MASTERY"  : "CHALLENGE"}
            </div>
          </div>
        </div>

        {/* Completed step trail */}
        {completedSteps.map((s, i) => (
          <div key={i} className={`${styles.stepRow} ${styles.stepRowVisible}`}>
            <div className={styles.stepLine}>
              <div className={`${styles.stepCircle} ${styles.stepDone}`}>✓</div>
              <div className={styles.stepTail} />
            </div>
            <div className={styles.stepBody}>
              <div className={styles.stepLabel}>{s.label}</div>
              <div className={styles.stepEq}><KaTeX tex={s.eq} /></div>
            </div>
          </div>
        ))}

        {/* Current step indicator */}
        {completedSteps.length > 0 && (
          <div className={`${styles.stepRow} ${styles.stepRowVisible}`}>
            <div className={styles.stepLine}>
              <div className={`${styles.stepCircle} ${styles.stepCurrent}`}>{localStepIdx + 1}</div>
            </div>
            <div className={styles.stepBody}>
              <div className={`${styles.stepLabel} ${styles.stepLabelCurrent}`}>
                Step {localStepIdx + 1} · Your move
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Coach bubble — Guided only */}
      {state.mode === "guided" && (
        <div className={styles.coachZone}>
          <div className={styles.coachFace}>🧠</div>
          <div className={styles.coachBubble}>
            {isTellMode && !advancing && correctIdx >= 0 ? (
              <>
                <span dangerouslySetInnerHTML={{ __html: coachText || activeStep.coach }} />
                {" "}<strong className={styles.tellHint}>
                  → Try: <em>{activeStep.choices[correctIdx].label}</em>
                </strong>
              </>
            ) : (
              <span dangerouslySetInnerHTML={{ __html: coachText || activeStep.coach }} />
            )}
          </div>
        </div>
      )}

      {/* Hint — Practice only */}
      {state.mode === "practice" && (
        <div className={styles.hintZone}>
          <button className={styles.hintToggle} onClick={() => dispatch({ type: "TOGGLE_HINT" })}>
            <span>💡</span>
            <span>{state.hintVisible ? "Hide hint" : "Need a hint? (free)"}</span>
          </button>
          {state.hintVisible && (
            <div className={styles.hintBox}>{activeStep.hint}</div>
          )}
        </div>
      )}

      {/* Choices */}
      {!livesOut && (
        <div className={styles.choicesZone}>
          <div className={styles.choicesLabel}>
            {isHardMode ? "No hints. What's your move?" : activeStep.choiceQuestion}
          </div>
          <div className={styles.choicesGrid}>
            {activeStep.choices.map((ch, i) => (
              <button
                key={i}
                className={[
                  styles.choiceBtn,
                  feedback[i] === "correct" ? styles.choiceCorrect : "",
                  feedback[i] === "wrong"   ? styles.choiceWrong   : "",
                  isHardMode                ? styles.choiceBtnChallenge : "",
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

      {/* Lives out */}
      {livesOut && (
        <div className={styles.livesOut}>
          <div className={styles.livesOutIcon}>💔</div>
          <div className={styles.livesOutTitle}>Out of lives</div>
          <div className={styles.livesOutSub}>
            The answer was:{" "}
            <span className={styles.livesOutAnswer}>
              <KaTeX tex={currentQ.finalAnswer} />
            </span>
            <br />Try Guided mode to learn each step first.
          </div>
          <button className={styles.restartBtn} onClick={() => dispatch({ type: "RESTART" })}>
            Try Again
          </button>
        </div>
      )}

      <div className={styles.bottomSpacer} />
    </div>
  );
}

// ─── Hub Screen ───────────────────────────────────────────────────────────────
// Topic name is read from the first available mission — not hardcoded

function HubScreen({
  state, dispatch, topicName, hasPractice, hasChallenge,
}: {
  state: EngineState;
  dispatch: React.Dispatch<Action>;
  topicName: string;
  hasPractice: boolean;
  hasChallenge: boolean;
}) {
  const modes: {
    id: StepMode; icon: string; name: string; desc: string; color: string; locked: boolean;
  }[] = [
    {
      id: "guided", icon: "📖", name: "Guided Learning", color: "#f5a623", locked: false,
      desc: "Ms. Chidera coaches every step. Learn why each operation works.",
    },
    {
      id: "practice", icon: "⚡", name: "Practice", color: "#6c28e0", locked: !hasPractice,
      desc: "No coach. Work it out yourself. Free hint available on tap.",
    },
    {
      id: "challenge", icon: "🔥", name: "Challenge", color: "#e03c28", locked: !hasChallenge,
      desc: "No help. Lose a heart for every wrong pick. Exam conditions.",
    },
    {
      id: "mastery", icon: "🏅", name: "Mastery", color: "#1a7a4a", locked: true,
      desc: "Application questions. No scaffolding. WAEC / JAMB level.",
    },
  ];

  return (
    <div className={styles.hubRoot}>
      <div className={styles.hubBg} />
      <div className={styles.hubContent}>
        <div className={styles.hubKicker}>{topicName}</div>
        <h1 className={styles.hubTitle}>
          Stepwise <span className={styles.hubTitleAccent}>Solver</span>
        </h1>
        <p className={styles.hubDesc}>
          Work through each solution step by step. Every correct move builds the trail.
        </p>

        <div className={styles.modeList}>
          {modes.map(m => (
            <button
              key={m.id}
              className={[
                styles.modeBtn,
                state.mode === m.id ? styles.modeBtnActive : "",
                m.locked ? styles.modeBtnLocked : "",
              ].join(" ")}
              style={state.mode === m.id
                ? ({ "--mode-color": m.color } as React.CSSProperties)
                : undefined}
              onClick={() => { if (!m.locked) dispatch({ type: "SELECT_MODE", mode: m.id }); }}
            >
              <span className={styles.modeIcon}>{m.icon}</span>
              <div className={styles.modeText}>
                <div className={styles.modeName}>
                  {m.name}
                  {m.locked && <span className={styles.comingSoon}> · Coming soon</span>}
                </div>
                <div className={styles.modeDesc}>{m.desc}</div>
              </div>
              <span className={styles.modeArrow}>{m.locked ? "🔒" : "→"}</span>
            </button>
          ))}
        </div>

        <button className={styles.startBtn} onClick={() => dispatch({ type: "START_PLAY" })}>
          Begin →
        </button>
      </div>
    </div>
  );
}

// ─── Self-Solve Screen ────────────────────────────────────────────────────────

function SelfSolveScreen({
  question, countdown, dispatch,
}: {
  question: StepwiseQuestion;
  countdown: number;
  dispatch: React.Dispatch<Action>;
}) {
  const isMultiLine = question.formula.includes("\\\\");

  return (
    <div className={styles.selfSolveRoot}>
      <div className={styles.playBg} />
      <div className={styles.selfSolveContent}>
        <div className={styles.ssKicker}>Try it yourself first</div>
        <div className={isMultiLine ? styles.ssFormulaMulti : styles.ssFormulaWrap}>
          <KaTeX tex={question.formula} block />
        </div>
        <div className={styles.ssGoal}>🎯 {question.goal}</div>
        <div className={styles.ssTimer}>
          <div className={styles.ssTimerBar} style={{ width: `${(countdown / 10) * 100}%` }} />
        </div>
        <div className={styles.ssTimerLabel}>{countdown}s</div>
        <p className={styles.ssSub}>Work it out on paper. No pressure — just try.</p>
        <div className={styles.ssBtns}>
          <button
            className={`${styles.ssBtn} ${styles.ssBtnSecondary}`}
            onClick={() => dispatch({ type: "SELF_SOLVE_SKIP" })}
          >
            Let&apos;s solve it together →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Review Screen ────────────────────────────────────────────────────────────

function ReviewScreen({
  question, completedSteps, mode, onDone,
}: {
  question: StepwiseQuestion;
  completedSteps: { label: string; eq: string }[];
  mode: StepMode;
  onDone: () => void;
}) {
  const accentColor =
    mode === "guided"   ? "#f5a623" :
    mode === "practice" ? "#6c28e0" :
    mode === "mastery"  ? "#1a7a4a" : "#9b59b6";

  const xpEarned =
    mode === "guided" ? 10 : mode === "practice" ? 20 : mode === "mastery" ? 50 : 40;

  return (
    <div className={styles.reviewRoot}>
      <div className={styles.playBg} />
      <div className={styles.reviewContent}>
        <div className={styles.reviewIcon}>✅</div>
        <div className={styles.reviewTitle}>Here&apos;s what you did</div>

        <div className={styles.reviewFormulaWrap}>
          <KaTeX tex={question.formula} block />
        </div>
        <div className={styles.reviewGoal}>🎯 {question.goal}</div>

        <div className={styles.reviewTrail}>
          <div className={styles.reviewTrailRow}>
            <div className={styles.reviewTrailDot}
              style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.4)", fontSize: 10 }}>
              ↓
            </div>
            <div className={styles.reviewTrailBody}>
              <div className={styles.reviewTrailLabel}>Starting point</div>
              <div className={styles.reviewTrailEq}><KaTeX tex={question.formula} /></div>
            </div>
          </div>

          {completedSteps.map((s, i) => (
            <div key={i} className={styles.reviewTrailRow}>
              <div className={styles.reviewTrailDot} style={{ background: accentColor }}>✓</div>
              <div className={styles.reviewTrailBody}>
                <div className={styles.reviewTrailLabel}>{s.label}</div>
                <div className={styles.reviewTrailEq}><KaTeX tex={s.eq} /></div>
              </div>
            </div>
          ))}

          <div className={styles.reviewTrailRow}>
            <div className={styles.reviewTrailDot} style={{ background: "#2e6b2e" }}>★</div>
            <div className={styles.reviewTrailBody}>
              <div className={styles.reviewTrailLabel}>Answer</div>
              <div className={styles.reviewFinalEq}><KaTeX tex={question.finalAnswer} /></div>
            </div>
          </div>
        </div>

        <div className={styles.reviewXp}>+{xpEarned} XP</div>

        <button
          className={styles.reviewDoneBtn}
          style={{ background: accentColor }}
          onClick={onDone}
        >
          Done ✓
        </button>
      </div>
    </div>
  );
}

// ─── Complete Screen ──────────────────────────────────────────────────────────

function CompleteScreen({
  state, question, dispatch, hasMore, onComplete,
}: {
  state: EngineState;
  question: StepwiseQuestion;
  dispatch: React.Dispatch<Action>;
  hasMore: boolean;
  onComplete: (outcome: unknown) => void;
}) {
  const msgs: Record<StepMode, { icon: string; title: string; sub: string }> = {
    guided:    { icon: "🎉", title: "You got it!",        sub: "You followed every step. That's the complete solution." },
    practice:  { icon: "⚡", title: "Solved it!",          sub: "You worked through that independently. Well done." },
    challenge: { icon: "🏆", title: "Challenge Complete!", sub: `${state.lives}/3 lives remaining. Exam fluency building.` },
    mastery:   { icon: "🏅", title: "Mastery Complete!",   sub: "Exceptional. You're ready for any exam question on this." },
  };
  const xpMap: Record<StepMode, number> = { guided: 10, practice: 20, challenge: 40, mastery: 50 };
  const msg = msgs[state.mode];

  return (
    <div className={styles.completeRoot}>
      <div className={styles.playBg} />
      <div className={styles.completeContent}>
        <div className={styles.completeIcon}>{msg.icon}</div>
        <div className={styles.completeTitle}>{msg.title}</div>
        {question?.finalAnswer && (
          <div className={styles.completeAnswer}>
            <KaTeX tex={question.finalAnswer} />
          </div>
        )}
        <div className={styles.completeSub}>{msg.sub}</div>
        <div className={styles.xpPop}>+{xpMap[state.mode]} XP</div>

        <div className={styles.completeBtns}>
          {hasMore && (
            <button
              className={`${styles.completeBtn} ${styles.completeBtnPrimary}`}
              onClick={() => dispatch({ type: "START_PLAY" })}
            >
              Next question →
            </button>
          )}
          <button
            className={`${styles.completeBtn} ${styles.completeBtnSecondary}`}
            onClick={() => dispatch({ type: "RESTART" })}
          >
            Try again
          </button>
          <button
            className={`${styles.completeBtn} ${styles.completeBtnGhost}`}
            onClick={() => dispatch({ type: "RESTART" })}
          >
            Change mode
          </button>
        </div>
      </div>
    </div>
  );
}