"use client";

/**
 * StepwiseSolverEngine.tsx — Universal maths solving engine.
 *
 * Hearts are per-question (3 lives per question, reset on NEXT_QUESTION).
 * Wrong answer = lose 1 heart. 0 hearts = question resets (try again).
 * Completing a question correctly = earn XP for that question.
 * Choices are shuffled in practice + challenge so correct answer doesn't stay in place A.
 *
 * Modes:
 *   Guided   — Ms. Chidera explains every step. Stay-and-review after done.
 *              No hearts displayed (no penalty).
 *   Practice — Coach shows choiceQuestion nudge. Hearts shown. Wrong = -1 heart.
 *              Complete question = +20 XP. 0 hearts = restart this question.
 *   Challenge — Phase 1 (think): coach encourages paper solving. Timer + "I'm ready".
 *              Phase 2 (pick): 4 final-answer options. Correct = 40 XP + review trail.
 *              2 wrong picks → Phase 3 (stepwise): same as practice, coach shows
 *              choiceQuestion nudge. Complete stepwise = 20 XP (half). Review trail shown.
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

// Phase within challenge:
//   think        → countdown / paper solve
//   pick         → 4 final-answer MCQ
//   stepwise     → fallback stepwise (like practice) after 2 wrong picks
//   review_pick  → after correct pick: show trail read-only, then navigate
type ChalPhase = "think" | "pick" | "stepwise" | "review_pick";

export interface StepChoice {
  icon: string;
  label: string;
  sub: string;
  correct: boolean;
}

export interface WorkingLine {
  text: string;         // arithmetic line shown in the popup
  blank?: {
    answer: string;     // correct value the student must pick
    options: string[];  // exactly 3 options including the correct one
  };
}

export interface QuestionStep {
  trailLabel: string;
  resultEq: string;
  coach: string;
  coachWrong: string;
  hint: string;
  choiceQuestion: string;
  choices: StepChoice[];
  workingLines?: WorkingLine[]; // arithmetic walkthrough shown after correct pick
}

export interface StepwiseQuestion {
  goal: string;
  formula: string;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Detective payload translator ─────────────────────────────────────────────
// Reads the simultaneous-equations-detective.json format (equations + solutionSteps)
// and converts it into the StepwiseQuestion shape the engine expects.
// This is completely additive — the original payloadToQuestion still handles
// content authored in the formula/steps format.

const OPERATION_DEFS: Record<string, { icon: string; label: string; sub: string }> = {
  add:          { icon: "➕", label: "Add the equations",         sub: "Adds both equations together" },
  subtract:     { icon: "➖", label: "Subtract the equations",    sub: "Subtracts one equation from the other" },
  multiply_eq1: { icon: "✖️",  label: "Multiply equation 1",       sub: "Scales equation 1 by a factor" },
  multiply_eq2: { icon: "✖️",  label: "Multiply equation 2",       sub: "Scales equation 2 by a factor" },
  solve:        { icon: "🔢", label: "Divide to solve",            sub: "Isolates the variable" },
  substitute:   { icon: "🔄", label: "Substitute back",           sub: "Replaces a known value" },
};

// Wrong operation distractors per correct operation
const WRONG_OPS: Record<string, string[]> = {
  add:          ["subtract", "multiply_eq1", "multiply_eq2"],
  subtract:     ["add", "multiply_eq1", "multiply_eq2"],
  multiply_eq1: ["multiply_eq2", "add", "subtract"],
  multiply_eq2: ["multiply_eq1", "subtract", "add"],
  solve:        ["substitute", "add", "subtract"],
  substitute:   ["solve", "add", "subtract"],
};

function buildWorkingLines(
  operation: string,
  resultDisplay: string[],
  equations: { id: string; display: string }[],
  prevResults: string[]
): WorkingLine[] {
  const lines: WorkingLine[] = [];
  const eq1 = equations[0]?.display ?? "";
  const eq2 = equations[1]?.display ?? "";
  const cur1 = prevResults.length > 0 ? (prevResults[0] ?? eq1) : eq1;
  const cur2 = prevResults.length > 1 ? (prevResults[1] ?? eq2) : eq2;

  if (operation === "add") {
    lines.push({ text: `  ${cur1}` });
    lines.push({ text: `+ ${cur2}` });
    lines.push({ text: `─────────────────────` });
    resultDisplay.forEach(r => lines.push({ text: `  ${r}` }));
  } else if (operation === "subtract") {
    lines.push({ text: `  ${cur1}` });
    lines.push({ text: `− ${cur2}` });
    lines.push({ text: `─────────────────────` });
    resultDisplay.forEach(r => lines.push({ text: `  ${r}` }));
  } else if (operation === "multiply_eq1") {
    lines.push({ text: `  Eq 1: ${cur1}` });
    resultDisplay.forEach(r => lines.push({ text: `  → ${r}` }));
  } else if (operation === "multiply_eq2") {
    lines.push({ text: `  Eq 2: ${cur2}` });
    resultDisplay.forEach(r => lines.push({ text: `  → ${r}` }));
  } else if (operation === "solve") {
    if (cur1) lines.push({ text: `  ${cur1}` });
    lines.push({ text: `  ÷ both sides:` });
    resultDisplay.forEach(r => lines.push({ text: `  ${r}` }));
  } else if (operation === "substitute") {
    if (cur1) lines.push({ text: `  Into: ${cur1}` });
    resultDisplay.forEach(r => lines.push({ text: `  ${r}` }));
  } else {
    // Unknown operation — still show the result lines so trail is never empty
    resultDisplay.forEach(r => lines.push({ text: `  ${r}` }));
  }
  // Safety: always return at least the result lines
  if (lines.length === 0) {
    resultDisplay.forEach(r => lines.push({ text: `  ${r}` }));
  }
  return lines;
}

function payloadToDetectiveQuestion(m: MissionEntry): StepwiseQuestion | null {
  const p = m.payload;
  const equations = p.equations as { id: string; display: string }[] | undefined;
  const solutionSteps = p.solutionSteps as {
    description: string;
    operation: string;
    resultDisplay: string[];
    targetVariable: string;
    isFinal: boolean;
    multiplyFactor?: number;
  }[] | undefined;
  const solution = p.solution as { variables: Record<string, number> } | undefined;
  const caseHints = p.caseHints as string[] | undefined;

  if (!equations || !solutionSteps || solutionSteps.length === 0) return null;

  // Build the formula display: two equations stacked
  const formula = equations.map(e => e.display).join(" \\\\ ");

  // Track running equation state for working-line generation
  let prevResults: string[] = [];

  const steps: QuestionStep[] = solutionSteps.map((s, idx) => {
    const def = OPERATION_OPS(s.operation, s.multiplyFactor);
    const wrongOps = (WRONG_OPS[s.operation] ?? ["add", "subtract", "multiply_eq1"])
      .slice(0, 3)
      .map(op => {
        const d = OPERATION_OPS(op);
        return { icon: d.icon, label: d.label, sub: d.sub, correct: false };
      });

    const choices: StepChoice[] = shuffle([
      { icon: def.icon, label: def.label, sub: def.sub, correct: true },
      ...wrongOps,
    ]);

    // resultEq: join multiple resultDisplay lines with \
    const resultEq = s.resultDisplay.join(" \\\\ ");

    // workingLines: authored ones preferred, generated as fallback
    const rawWorking = (s as Record<string,unknown>).workingLines as WorkingLine[] | undefined;
    const workingLines = rawWorking && rawWorking.length > 0
      ? rawWorking
      : buildWorkingLines(s.operation, s.resultDisplay, equations, prevResults);

    // Track equation state for next step's context:
    // multiply steps produce new equation pairs; other steps produce single results
    if (s.operation === "multiply_eq1") {
      prevResults = [s.resultDisplay[0] ?? "", prevResults[1] ?? equations[1]?.display ?? ""];
    } else if (s.operation === "multiply_eq2") {
      prevResults = [prevResults[0] ?? equations[0]?.display ?? "", s.resultDisplay[0] ?? ""];
    } else {
      prevResults = s.resultDisplay;
    }

    // Coach text for guided mode
    const hint = caseHints?.[idx] ?? "";
    const coach = `<strong>${def.label}:</strong> ${s.description}.`;
    const coachWrong = `Not quite — think about what happens to each term. ${hint ? hint : ""}`;

    // Describe what variable we are targeting
    const targetDesc = s.targetVariable
      ? `What do we do to eliminate or find ${s.targetVariable}?`
      : "What is the next step?";

    return {
      trailLabel: s.description,
      resultEq,
      coach,
      coachWrong,
      hint: hint,
      choiceQuestion: targetDesc,
      choices,
      workingLines,
    };
  });

  // Final answer string from solution
  const vars = solution?.variables ?? {};
  const finalAnswer = Object.entries(vars)
    .map(([k, v]) => `${k} = ${v}`)
    .join(",\\quad ");

  return {
    goal: `Solve the simultaneous equations`,
    formula,
    topic: "Simultaneous Equations",
    finalAnswer,
    steps,
  };
}

function OPERATION_OPS(op: string, factor?: number): { icon: string; label: string; sub: string } {
  if (op === "multiply_eq1") return { icon: "✖️", label: `Multiply Equation 1${factor ? ` (×${factor})` : ""}`, sub: "Scales equation 1 by a factor" };
  if (op === "multiply_eq2") return { icon: "✖️", label: `Multiply Equation 2${factor ? ` (×${factor})` : ""}`, sub: "Scales equation 2 by a factor" };
  return OPERATION_DEFS[op] ?? { icon: "❓", label: op, sub: "" };
}

function missionsToQuestions(missions: MissionEntry[]): StepwiseQuestion[] {
  const seen = new Set<string>();
  return missions
    .sort((a, b) => a.sequenceIndex - b.sequenceIndex)
    .reduce<StepwiseQuestion[]>((acc, m) => {
      if (seen.has(m.missionKey)) return acc;
      seen.add(m.missionKey);
      // Try the formula/steps format first, then the detective (equations/solutionSteps) format
      const q = payloadToQuestion(m) ?? payloadToDetectiveQuestion(m);
      if (q) acc.push(q);
      return acc;
    }, []);
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─── Formula display ──────────────────────────────────────────────────────────

function FormulaDisplay({ formula }: { formula: string }) {
  if (formula.includes("\\\\")) {
    const lines = formula.split("\\\\").map(l => l.trim()).filter(Boolean);
    return (
      // Simultaneous equations: opening brace (via CSS ::before) + stacked equations side by side
      <div className={styles.mcFormulaMulti}>
        <div className={styles.mcFormulaLines}>
          {lines.map((line, i) => (
            <div key={i} className={styles.mcFormulaLine}>
              <KaTeX tex={line} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className={styles.mcFormula}>
      <KaTeX tex={formula} />
    </div>
  );
}

// ─── Step equation display (supports multi-line via \\) ───────────────────────
// Used in the solution trail. Simultaneous equations often have two equations
// per step — authored as "6x + 9y = 48 \\ 6x + 4y = 28". We split on \\ and
// render each on its own line, matching how the problem card handles formulas.

function StepEq({ tex }: { tex: string }) {
  if (tex.includes("\\\\")) {
    const lines = tex.split("\\\\").map(l => l.trim()).filter(Boolean);
    return (
      <div className={styles.stepEqMulti}>
        {lines.map((line, i) => (
          <div key={i} className={styles.stepEqLine}>
            <KaTeX tex={line} />
          </div>
        ))}
      </div>
    );
  }
  return <div className={styles.stepEq}><KaTeX tex={tex} /></div>;
}



type Screen = "hub" | "playing";

interface EngineState {
  screen: Screen;
  mode: StepMode;
  questionIdx: number;
  lives: number;         // 3 per question, reset on NEXT_QUESTION
  xp: number;
  questionsCompleted: number;
  seenFormulas: Set<string>;
}

const INITIAL_STATE: EngineState = {
  screen: "hub",
  mode: "guided",
  questionIdx: 0,
  lives: 3,
  xp: 0,
  questionsCompleted: 0,
  seenFormulas: new Set(),
};

type Action =
  | { type: "SELECT_MODE"; mode: StepMode }
  | { type: "START_PLAY"; resumeIdx?: number }
  | { type: "EARN_XP"; amount: number }
  | { type: "LOSE_LIFE" }
  | { type: "RESET_LIVES" }
  | { type: "NEXT_QUESTION"; nextIdx: number }
  | { type: "GO_TO_MODE"; mode: StepMode; resumeIdx?: number }
  | { type: "RESTART" };

function reduce(state: EngineState, action: Action): EngineState {
  switch (action.type) {
    case "SELECT_MODE":  return { ...state, mode: action.mode };
    case "START_PLAY":   return { ...state, screen: "playing", lives: 3, questionIdx: action.resumeIdx ?? 0 };
    case "EARN_XP":      return { ...state, xp: state.xp + action.amount };
    case "LOSE_LIFE":    return { ...state, lives: Math.max(0, state.lives - 1) };
    case "RESET_LIVES":  return { ...state, lives: 3 };
    case "NEXT_QUESTION":
      return { ...state, questionIdx: action.nextIdx, questionsCompleted: state.questionsCompleted + 1, lives: 3 };
    case "GO_TO_MODE":
      return { ...state, mode: action.mode, questionIdx: action.resumeIdx ?? 0, lives: 3, screen: "playing" };
    case "RESTART":
      return { ...INITIAL_STATE, mode: state.mode, seenFormulas: state.seenFormulas, questionsCompleted: state.questionsCompleted };
    default: return state;
  }
}

// ─── Ms. Chidera Avatar ───────────────────────────────────────────────────────

function ChideraAvatar() {
  return (
    <svg
      width="44" height="44" viewBox="0 0 44 44"
      xmlns="http://www.w3.org/2000/svg"
      className={styles.coachAvatarSvg}
      aria-label="Ms. Chidera"
    >
      {/* Background — warm gold circle */}
      <circle cx="22" cy="22" r="22" fill="#f5a623" />

      {/* Body — blazer with book */}
      <path d="M8 44 Q10 30 22 29 Q34 30 36 44Z" fill="#2a5298" />
      {/* Lapels */}
      <path d="M22 29 L17 33 L15 44" fill="none" stroke="#1a3a7a" strokeWidth="1.2" />
      <path d="M22 29 L27 33 L29 44" fill="none" stroke="#1a3a7a" strokeWidth="1.2" />
      {/* White shirt */}
      <path d="M20 29 L22 32 L24 29" fill="white" />
      {/* Book in left hand */}
      <rect x="9" y="30" width="8" height="10" rx="1.5" fill="#1a3a7a" />
      <rect x="10" y="30" width="6" height="10" rx="1" fill="#e8f0fe" />
      <line x1="11" y1="32" x2="15" y2="32" stroke="#9ab" strokeWidth="0.7" />
      <line x1="11" y1="34" x2="15" y2="34" stroke="#9ab" strokeWidth="0.7" />
      <line x1="11" y1="36" x2="13" y2="36" stroke="#9ab" strokeWidth="0.7" />

      {/* Neck */}
      <rect x="19.5" y="26" width="5" height="5" rx="2" fill="#b87045" />

      {/* Head */}
      <ellipse cx="22" cy="17" rx="10" ry="11" fill="#b87045" />

      {/* Natural hair — full, shaped, proud */}
      <ellipse cx="22" cy="9" rx="11" ry="8.5" fill="#1a0800" />
      <ellipse cx="12" cy="14" rx="3" ry="6" fill="#1a0800" />
      <ellipse cx="32" cy="14" rx="3" ry="6" fill="#1a0800" />
      <ellipse cx="22" cy="6" rx="8" ry="5" fill="#1a0800" />
      {/* Hair volume highlights */}
      <ellipse cx="16" cy="8" rx="3" ry="1.5" fill="#2d0e00" opacity="0.5" />
      <ellipse cx="28" cy="7.5" rx="2.5" ry="1.2" fill="#2d0e00" opacity="0.4" />

      {/* Ears */}
      <ellipse cx="12" cy="18" rx="2" ry="2.5" fill="#a86035" />
      <ellipse cx="32" cy="18" rx="2" ry="2.5" fill="#a86035" />

      {/* Glasses — thick dark frames, teacher-style */}
      <rect x="13" y="15" width="6.5" height="4.5" rx="2.2" fill="none" stroke="#1a0800" strokeWidth="1.4" />
      <rect x="21" y="15" width="6.5" height="4.5" rx="2.2" fill="none" stroke="#1a0800" strokeWidth="1.4" />
      <line x1="19.5" y1="17.2" x2="21" y2="17.2" stroke="#1a0800" strokeWidth="1.4" />
      {/* Arms */}
      <line x1="13" y1="17.2" x2="11" y2="17.2" stroke="#1a0800" strokeWidth="1.4" />
      <line x1="27.5" y1="17.2" x2="29.5" y2="17.2" stroke="#1a0800" strokeWidth="1.4" />

      {/* Eyes behind glasses */}
      <ellipse cx="16.2" cy="17.2" rx="1.5" ry="1.6" fill="#0f0500" />
      <ellipse cx="24.2" cy="17.2" rx="1.5" ry="1.6" fill="#0f0500" />
      <circle cx="16.8" cy="16.6" r="0.5" fill="white" />
      <circle cx="24.8" cy="16.6" r="0.5" fill="white" />

      {/* Eyebrows */}
      <path d="M14 14.5 Q16.2 13.5 18.5 14.5" fill="none" stroke="#0f0500" strokeWidth="1" />
      <path d="M22 14.5 Q24.2 13.5 26.5 14.5" fill="none" stroke="#0f0500" strokeWidth="1" />

      {/* Nose */}
      <ellipse cx="22" cy="20.5" rx="1.3" ry="0.7" fill="#9a5030" opacity="0.6" />

      {/* Smile — warm and confident */}
      <path d="M17.5 23 Q22 26.5 26.5 23" fill="none" stroke="#7a3520" strokeWidth="1.4" strokeLinecap="round" />

      {/* Right arm raised — pointing up (inspired by reference) */}
      <path d="M32 31 Q36 25 34 19" fill="none" stroke="#b87045" strokeWidth="3.5" strokeLinecap="round" />
      {/* Pointing finger */}
      <ellipse cx="33.5" cy="17.5" rx="1.2" ry="2.5" fill="#b87045" transform="rotate(-20 33.5 17.5)" />
    </svg>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function StepwiseSolverEngine({ config, onComplete }: EngineRuntimeProps) {
  const [state, dispatch] = useReducer(reduce, INITIAL_STATE);

  const shared             = ((config as Record<string, unknown>).shared as Record<string, unknown>) ?? {};
  const allMissions        = (shared._allMissions as MissionEntry[] | undefined) ?? [];
  const onBack             = (shared._onBack as (() => void) | undefined) ?? (() => {});
  const studentId          = (shared._studentId as string | undefined) ?? "anon";
  const gameId             = (shared._gameId    as string | undefined) ?? "game";

  // ── Resume: read per-student progress from localStorage ──
  // Key: "exl_progress_{studentId}_{gameId}_{mode}"
  // Value: index of the next question to show (0-based)
  const progressKey = (mode: StepMode) => `exl_progress_${studentId}_${gameId}_${mode}`;
  const getResume = (mode: StepMode, total: number): number => {
    if (typeof window === "undefined") return 0;
    const saved = parseInt(localStorage.getItem(progressKey(mode)) ?? "0", 10);
    return isNaN(saved) ? 0 : Math.min(saved, Math.max(0, total - 1));
  };
  const saveProgress = (mode: StepMode, idx: number) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(progressKey(mode), String(idx));
  };
  const clearProgress = (mode: StepMode) => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(progressKey(mode));
  };

  const guidedQ    = missionsToQuestions(allMissions.filter(m => m.difficulty === "EASY"));
  const practiceQ  = missionsToQuestions(allMissions.filter(m => m.difficulty === "MEDIUM"));
  const challengeQ = missionsToQuestions(allMissions.filter(m => m.difficulty === "HARD"));

  const questions =
    state.mode === "guided"   ? guidedQ   :
    state.mode === "practice" ? practiceQ : challengeQ;

  // ── Step state (shared by guided, practice, challenge stepwise) ──
  const [stepIdx, setStepIdx]               = useState(0);
  const [completedSteps, setCompletedSteps] = useState<{ label: string; eq: string; workingLines?: WorkingLine[] }[]>([]);
  const [questionDone, setQuestionDone]     = useState(false);
  const [locked, setLocked]                 = useState(false);
  const [feedback, setFeedback]             = useState<Record<number, "correct" | "wrong">>({});
  const [coachText, setCoachText]           = useState("");
  const [wrongFeedback, setWrongFeedback]   = useState<string | null>(null);
  const [shuffledChoices, setShuffledChoices] = useState<StepChoice[]>([]);

  // Working popup — shown after a correct operation pick, before the trail stamps
  const [workingPopup, setWorkingPopup]     = useState<WorkingLine[] | null>(null);
  const [workingLineIdx, setWorkingLineIdx] = useState(0);    // which line we are on
  const [blankAnswer, setBlankAnswer]       = useState<string | null>(null); // chosen option
  const [blankDone, setBlankDone]           = useState(false);
  const pendingStep = useRef<{ newStep: { label: string; eq: string; workingLines?: WorkingLine[] }; isLast: boolean } | null>(null);

  // ── Challenge state ──
  const [chalPhase, setChalPhase]           = useState<ChalPhase>("think");
  const [countdown, setCountdown]           = useState(10);
  const [chalWrong, setChalWrong]           = useState(0);
  const [chalFeedback, setChalFeedback]     = useState<Record<number, "correct" | "wrong">>({});
  const [chalLocked, setChalLocked]         = useState(false);
  const [chalFullXp, setChalFullXp]         = useState(false); // got answer before stepwise
  // Trail to show in review_pick (built from all steps, revealed at once)
  const [reviewTrail, setReviewTrail]       = useState<{ label: string; eq: string }[]>([]);

  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTime  = useRef(Date.now());
  const totalTries = useRef(0);

  const currentQ   = questions.length
    ? questions[Math.min(state.questionIdx, questions.length - 1)]
    : undefined;
  const activeStep = currentQ?.steps[stepIdx];
  const isFirstVisit = !state.seenFormulas.has(currentQ?.formula ?? "");
  const isTellMode   = state.mode === "guided" && isFirstVisit;
  const correctIdx   = activeStep?.choices.findIndex(c => c.correct) ?? -1;
  const hasMore      = state.questionIdx + 1 < questions.length;

  const nextMode: StepMode | null =
    state.mode === "guided"   ? (practiceQ.length  > 0 ? "practice"  : null) :
    state.mode === "practice" ? (challengeQ.length > 0 ? "challenge" : null) : null;

  const isChallengeStepwise = state.mode === "challenge" && chalPhase === "stepwise";
  const showHearts = state.mode === "practice" || state.mode === "challenge";

  // Shuffle choices per step for practice + challenge stepwise
  useEffect(() => {
    if (!activeStep) return;
    const shouldShuffle = state.mode === "practice" || isChallengeStepwise;
    setShuffledChoices(shouldShuffle ? shuffle(activeStep.choices) : activeStep.choices);
  }, [state.questionIdx, stepIdx, state.mode, isChallengeStepwise]); // eslint-disable-line

  // Reset all step state when question or screen changes
  useEffect(() => {
    setStepIdx(0);
    setCompletedSteps([]);
    setQuestionDone(false);
    setLocked(false);
    setFeedback({});
    setCoachText("");
    setChalPhase("think");
    setCountdown(10);
    setChalWrong(0);
    setChalFeedback({});
    setChalLocked(false);
    setChalFullXp(false);
    setReviewTrail([]);
    startTime.current = Date.now();
    totalTries.current = 0;
    completedReported.current = false;
    setWorkingPopup(null);
    setWorkingLineIdx(0);
    setBlankAnswer(null);
    setBlankDone(false);
    pendingStep.current = null;
  }, [state.questionIdx, state.screen]);

  // Set coach text when step changes
  useEffect(() => {
    if (activeStep) setCoachText(activeStep.coach);
    setLocked(false);
    setFeedback({});
    setWrongFeedback(null);
  }, [stepIdx, state.questionIdx]); // eslint-disable-line

  // Challenge countdown
  useEffect(() => {
    if (state.mode !== "challenge" || chalPhase !== "think") return;
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); setChalPhase("pick"); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.mode, chalPhase, state.questionIdx]);

  // ── Hearts: 0 → restart this question ──
  const [showHeartOut, setShowHeartOut] = useState(false);
  useEffect(() => {
    if (showHearts && state.lives === 0 && !questionDone) {
      setShowHeartOut(true);
    }
  }, [state.lives, showHearts, questionDone]);

  const restartQuestion = useCallback(() => {
    setStepIdx(0);
    setCompletedSteps([]);
    setQuestionDone(false);
    setLocked(false);
    setFeedback({});
    setCoachText("");
    setShowHeartOut(false);
    if (state.mode === "challenge") {
      setChalPhase("stepwise"); // stay in stepwise on restart
      setChalWrong(0);
      setChalFeedback({});
      setChalLocked(false);
    }
    dispatch({ type: "RESET_LIVES" });
    startTime.current = Date.now();
    totalTries.current = 0;
    completedReported.current = false;
  }, [state.mode]);

  // Track whether onComplete has been reported (so we only fire it once per question)
  const completedReported = useRef(false);

  // ── Stepwise pick handler (guided / practice / challenge stepwise) ──
  // Shared step-advance logic (called from handlePick directly, or after working popup closes)
  const advanceStep = useCallback((newStep: { label: string; eq: string; workingLines?: WorkingLine[] }, isLast: boolean) => {
    if (!currentQ) return;
    if (isLast) {
      state.seenFormulas.add(currentQ.formula);
      setCompletedSteps(prev => [...prev, newStep]);
      setQuestionDone(true);
      setLocked(false);
      setFeedback({});
      const xpAmount = state.mode === "guided" ? 10 : state.mode === "practice" ? 20 : 20;
      dispatch({ type: "EARN_XP", amount: xpAmount });
    } else {
      setCompletedSteps(prev => [...prev, newStep]);
      setStepIdx(prev => prev + 1);
      setLocked(false);
      setFeedback({});
    }
  }, [currentQ, state]); // eslint-disable-line

  // Called when working popup "Got it →" / "Continue →" is tapped
  const advanceAfterWorking = useCallback(() => {
    setWorkingPopup(null);
    setBlankAnswer(null);
    setBlankDone(false);
    setWorkingLineIdx(0);
    if (pendingStep.current) {
      // Guided mode only: popup gated the advance, so advance now
      advanceStep(pendingStep.current.newStep, pendingStep.current.isLast);
      pendingStep.current = null;
    }
    // Practice/Challenge: trail was already stamped before popup opened — nothing to do
  }, [advanceStep]);

  const handlePick = useCallback((idx: number, choice: StepChoice) => {
    if (locked || !activeStep || !currentQ || questionDone) return;
    setLocked(true);
    totalTries.current += 1;

    if (choice.correct) {
      setFeedback({ [idx]: "correct" });
      setWrongFeedback(null);

      setTimeout(() => {
        const newStep = { label: activeStep.trailLabel, eq: activeStep.resultEq, workingLines: activeStep.workingLines };
        const isLast  = stepIdx >= currentQ.steps.length - 1;

        const hasWorking    = !!(activeStep.workingLines && activeStep.workingLines.length > 0);
        const hasBlanks     = hasWorking && activeStep.workingLines!.some(l => l.blank);
        // Guided first 2 questions: no popup, just show working inline
        // Guided question 3+: popup fires (student tries the blanks themselves)
        // Practice & Challenge: stamp to trail immediately so working lines are always
        //   visible, THEN open popup so student fills in blanks as a check
        const isGuidedEarly = state.mode === "guided" && state.questionIdx < 2;
        const showPopup     = hasWorking && hasBlanks && !isGuidedEarly;

        if (showPopup && (state.mode === "practice" || state.mode === "challenge")) {
          // Stamp trail first so intermediate steps are visible, then open popup
          advanceStep(newStep, isLast);
          // After trail stamps, open popup for blank-filling
          // We don't need pendingStep here — trail already updated
          setWorkingLineIdx(0);
          setBlankAnswer(null);
          setBlankDone(false);
          setWorkingPopup(activeStep.workingLines!);
          setFeedback({});
          // locked released by advanceStep already
        } else if (showPopup) {
          // Guided question 3+: popup gates the advance (student must fill blanks first)
          pendingStep.current = { newStep, isLast };
          setWorkingLineIdx(0);
          setBlankAnswer(null);
          setBlankDone(false);
          setWorkingPopup(activeStep.workingLines!);
          setFeedback({});
          // locked stays true while popup is open
        } else {
          // No popup: stamp immediately
          advanceStep(newStep, isLast);
        }
      }, 600);
    } else {
      setFeedback({ [idx]: "wrong" });
      if (state.mode !== "guided") dispatch({ type: "LOSE_LIFE" });
      // Show the sub text as feedback toast (what this wrong option would have done)
      if (choice.sub) setWrongFeedback(choice.sub);
      setCoachText(activeStep.coachWrong);
      setTimeout(() => { setFeedback({}); setLocked(false); }, 1400);
    }
  }, [locked, activeStep, currentQ, stepIdx, questionDone, state]); // eslint-disable-line

  // ── Challenge: pick final answer (MCQ phase) ──
  const handleChalPick = useCallback((idx: number, correct: boolean) => {
    if (chalLocked || !currentQ) return;
    setChalLocked(true);
    totalTries.current += 1;

    if (correct) {
      setChalFeedback(prev => ({ ...prev, [idx]: "correct" }));
      setChalFullXp(true);
      dispatch({ type: "EARN_XP", amount: 40 });
      // Build trail so user can review the working on the next screen
      const trail = currentQ.steps.map(s => ({ label: s.trailLabel, eq: s.resultEq }));
      setReviewTrail(trail);
      // Go to review screen — onComplete fires when user taps Next, not here
      setTimeout(() => { setChalPhase("review_pick"); setChalLocked(false); }, 600);
    } else {
      setChalFeedback(prev => ({ ...prev, [idx]: "wrong" }));
      dispatch({ type: "LOSE_LIFE" });
      const newWrong = chalWrong + 1;
      setChalWrong(newWrong);
      if (newWrong >= 2) {
        dispatch({ type: "RESET_LIVES" });
        setTimeout(() => { setChalPhase("stepwise"); setChalLocked(false); }, 1000);
      } else {
        setTimeout(() => setChalLocked(false), 1200);
      }
    }
  }, [chalLocked, currentQ, chalWrong]);

  // ── Hub ──
  if (state.screen === "hub") {
    const modeQ = state.mode === "guided" ? guidedQ : state.mode === "practice" ? practiceQ : challengeQ;
    const resumeIdx = getResume(state.mode, modeQ.length);
    const resumeLabel = resumeIdx > 0 ? `Continue from Q${resumeIdx + 1} →` : undefined;
    const handleStart = () => dispatch({ type: "START_PLAY", resumeIdx });
    // Build question lists for the missions panel — include done status from localStorage
    const makeHubQ = (qs: StepwiseQuestion[], mode: StepMode) => {
      const resumeI = getResume(mode, qs.length);
      return qs.map((q, i) => ({
        title: q.goal || q.formula,
        missionKey: `${mode}-${i}`,
        done: i < resumeI,
      }));
    };
    return (
      <HubScreen
        state={state}
        dispatch={dispatch}
        hasPractice={practiceQ.length > 0}
        hasChallenge={challengeQ.length > 0}
        onBack={onBack}
        onStart={handleStart}
        resumeLabel={resumeLabel}
        guidedQuestions={makeHubQ(guidedQ, "guided")}
        practiceQuestions={makeHubQ(practiceQ, "practice")}
        challengeQuestions={makeHubQ(challengeQ, "challenge")}
      />
    );
  }

  if (!currentQ) {
    return (
      <div className={styles.emptyState}>
        <p>No questions available for this mode yet.</p>
        <button className={styles.emptyBack} onClick={() => dispatch({ type: "RESTART" })}>← Back</button>
      </div>
    );
  }

  // ── Shared derived values ──
  const badgeClass =
    state.mode === "guided"   ? styles.badgeGuided   :
    state.mode === "practice" ? styles.badgePractice :
    state.mode === "mastery"  ? styles.badgeMastery  : styles.badgeChallenge;

  const modeLabel =
    state.mode === "guided"   ? "📖 Guided"   :
    state.mode === "practice" ? "⚡ Practice"  :
    state.mode === "mastery"  ? "🏅 Mastery"  : "🔥 Challenge";

  // Topbar hearts + XP (hearts only for practice / challenge)
  const Topbar = ({ extra }: { extra?: React.ReactNode }) => (
    <div className={styles.topbar}>
      <button className={styles.backBtn} onClick={() => dispatch({ type: "RESTART" })}>←</button>
      <div className={`${styles.modeBadge} ${badgeClass}`}>{modeLabel}</div>
      <div className={styles.topRight}>
        {showHearts && (
          <div className={styles.lives}>
            {[0,1,2].map(i => (
              <span key={i} className={i < state.lives ? styles.heartFull : styles.heartLost}>
                {i < state.lives ? "❤️" : "🖤"}
              </span>
            ))}
          </div>
        )}
        <div className={styles.xpBadge}>⭐ {state.xp}</div>
        {extra}
      </div>
    </div>
  );

  const MissionCard = () => (
    <div className={styles.missionCard}>
      <div className={styles.mcTop}>
        <div className={styles.mcLeft}>
          <FormulaDisplay formula={currentQ.formula} />
          <div className={styles.mcGoal}>🎯 {currentQ.goal}</div>
        </div>
        <div className={styles.mcStamp}>
          {state.mode === "guided"   ? "LEARN"    :
           state.mode === "practice" ? "PRACTICE" :
           state.mode === "mastery"  ? "MASTERY"  : "CHALLENGE"}
        </div>
      </div>
    </div>
  );

  // ── 0 hearts — restart prompt ──
  if (showHeartOut) {
    return (
      <div className={styles.playRoot}>
        <div className={styles.playBg} />
        <Topbar />
        <div className={styles.heartOutZone}>
          <div className={styles.heartOutIcon}>💔</div>
          <div className={styles.heartOutTitle}>Out of hearts!</div>
          <div className={styles.heartOutSub}>
            <ChideraAvatar />
            <span>Don&apos;t worry — let&apos;s try this one again together.</span>
          </div>
          <button className={styles.heartOutBtn} onClick={restartQuestion}>Try again →</button>
        </div>
      </div>
    );
  }

  // ── Navigation block (shared after every question completes) ──
  // onComplete is called HERE — when the user chooses to move on — not when the last
  // step resolves. This ensures the student always sees their completed work first.
  const NavBlock = ({ xpLabel }: { xpLabel: string }) => {
    const advance = () => {
      // Internal flow only — do NOT call onComplete here.
      // onComplete fires only once, when the whole mode is exhausted (in finish()).
      // Calling it per-question causes the platform shell to show ReflectionScreen
      // after every question, breaking the in-engine flow.
      const nextIdx = state.questionIdx + 1;
      saveProgress(state.mode, nextIdx);
      dispatch({ type: "NEXT_QUESTION", nextIdx });
    };
    const finish = (goToMode?: StepMode) => {
      if (!completedReported.current) {
        completedReported.current = true;
        onComplete({
          success: true,
          score: 100,
          timeSpentSec: Math.round((Date.now() - startTime.current) / 1000),
          attemptsBeforeSuccess: totalTries.current,
        });
      }
      if (goToMode) {
        const resumeIdx = getResume(goToMode, goToMode === "practice" ? practiceQ.length : goToMode === "challenge" ? challengeQ.length : guidedQ.length);
        dispatch({ type: "GO_TO_MODE", mode: goToMode, resumeIdx });
      }
      else dispatch({ type: "RESTART" });
    };

    return (
      <div className={styles.doneZone}>
        <div className={styles.celebrationBanner}>
          <ChideraAvatar />
          <div className={styles.celebrationText}>
            <div className={styles.celebrationTitle}>
              {state.mode === "guided" ? "Well done! ✨" :
               state.mode === "practice" ? "Great work! 🌟" : "Solved it! 🔥"}
            </div>
            <div className={styles.celebrationSub}>
              {state.mode === "guided"
                ? "You followed every step — that builds real understanding."
                : "You worked it out yourself. That's the real test."}
            </div>
          </div>
        </div>
        <div className={styles.doneXp}>{xpLabel}</div>
        {hasMore ? (
          <button className={styles.nextBtn} onClick={advance}>
            Next question →
          </button>
        ) : (
          <div className={styles.allDoneBlock}>
            <div className={styles.allDoneBadge}>🏆 Stage complete!</div>
            {nextMode && (
              <button className={styles.nextModeBtn} onClick={() => {
                clearProgress(state.mode); // reset this mode so it starts fresh next time
                finish(nextMode);
              }}>
                Move to {nextMode === "practice" ? "⚡ Practice" : "🔥 Challenge"} →
              </button>
            )}
            <button className={styles.hubBtn} onClick={() => {
              clearProgress(state.mode);
              finish();
            }}>← Choose mode</button>
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // CHALLENGE: think phase
  // ─────────────────────────────────────────────────────────────────────────────
  if (state.mode === "challenge" && chalPhase === "think") {
    return (
      <div className={styles.challengeRoot}>
        <div className={styles.playBg} />
        <Topbar />
        <div className={styles.scroll}>
          <MissionCard />
          <div className={styles.coachCard}>
            <div className={styles.coachHeader}>
              <ChideraAvatar />
              <span className={styles.coachName}>Ms. Chidera</span>
            </div>
            <div className={styles.coachText}>
              Grab a pen and paper — try to solve this yourself before picking your answer. You&apos;ve got this! 💪
            </div>
          </div>
          <div className={styles.thinkZone}>
            <div className={styles.thinkLabel}>Solve it on paper first…</div>
            <div className={styles.thinkCountdown}>{countdown}</div>
            <div className={styles.thinkBar}>
              <div className={styles.thinkBarFill} style={{ width: `${(countdown / 10) * 100}%` }} />
            </div>
            <button
              className={styles.thinkReadyBtn}
              onClick={() => { if (timerRef.current) clearInterval(timerRef.current); setChalPhase("pick"); }}
            >
              I&apos;m ready →
            </button>
          </div>
        </div>
        <div className={styles.bottomSpacer} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHALLENGE: pick final answer (MCQ)
  // ─────────────────────────────────────────────────────────────────────────────
  if (state.mode === "challenge" && chalPhase === "pick") {
    const choices = currentQ.answerChoices ?? [];

    // No answer choices authored — show clear message with option to work through stepwise
    // Kept visible so content gaps are obvious (not silently swallowed)
    if (choices.length === 0) {
      return (
        <div className={styles.challengeRoot}>
          <div className={styles.playBg} />
          <Topbar />
          <div className={styles.scroll}>
            <MissionCard />
            <div className={styles.coachCard}>
              <div className={styles.coachHeader}>
                <ChideraAvatar />
                <span className={styles.coachName}>Ms. Chidera</span>
              </div>
              <div className={styles.coachText}>
                Answer options aren&apos;t set up for this question yet.
                Let&apos;s work through it step by step instead — you&apos;ll still earn XP!
              </div>
            </div>
            <div className={styles.thinkZone}>
              <button
                className={styles.thinkReadyBtn}
                onClick={() => { dispatch({ type: "RESET_LIVES" }); setChalPhase("stepwise"); }}
              >
                Work through it →
              </button>
            </div>
          </div>
          <div className={styles.bottomSpacer} />
        </div>
      );
    }

    return (
      <div className={styles.challengeRoot}>
        <div className={styles.playBg} />
        <Topbar />
        <div className={styles.scroll}>
          <MissionCard />
          <div className={styles.coachCard}>
            <div className={styles.coachHeader}>
              <ChideraAvatar />
              <span className={styles.coachName}>Ms. Chidera</span>
            </div>
            <div className={styles.coachText}>
              You&apos;ve had time to work it out. What&apos;s your answer?
              {chalWrong === 0 && " You have two chances — pick carefully! 🎯"}
            </div>
          </div>
          <div className={styles.challengePickZone}>
            <div className={styles.answerGrid}>
              {choices.map((ch, i) => (
                <button key={i}
                  className={[
                    styles.answerBtn,
                    chalFeedback[i] === "correct" ? styles.answerCorrect : "",
                    chalFeedback[i] === "wrong"   ? styles.answerWrong   : "",
                  ].join(" ")}
                  onClick={() => handleChalPick(i, ch.correct)}
                  disabled={chalLocked || chalFeedback[i] === "wrong"}
                >
                  <KaTeX tex={ch.label} />
                </button>
              ))}
            </div>
            {chalWrong === 1 && (
              <div className={styles.challengeWarning}>
                ⚠️ Last chance — one more wrong and we&apos;ll solve it step by step (half points).
              </div>
            )}
          </div>
        </div>
        <div className={styles.bottomSpacer} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHALLENGE: review_pick — correct pick, now show the trail + celebrate
  // ─────────────────────────────────────────────────────────────────────────────
  if (state.mode === "challenge" && chalPhase === "review_pick") {
    return (
      <div className={styles.playRoot}>
        <div className={styles.playBg} />
        <Topbar />
        <div className={styles.scroll}>
          <MissionCard />
          {/* Show the full solution trail (all steps at once — they solved on paper) */}
          {reviewTrail.map((s, i) => (
            <div key={i} className={`${styles.stepRow} ${styles.stepRowVisible}`}>
              <div className={styles.stepLine}>
                <div className={`${styles.stepCircle} ${styles.stepDone}`}>✓</div>
                {i < reviewTrail.length - 1 && <div className={styles.stepTail} />}
              </div>
              <div className={styles.stepBody}>
                <div className={styles.stepLabel}>{s.label}</div>
                <StepEq tex={s.eq} />
              </div>
            </div>
          ))}
          {/* Final answer */}
          <div className={`${styles.stepRow} ${styles.stepRowVisible}`}>
            <div className={styles.stepLine}>
              <div className={`${styles.stepCircle} ${styles.stepFinal}`}>★</div>
            </div>
            <div className={styles.stepBody}>
              <div className={`${styles.stepLabel} ${styles.stepLabelFinal}`}>Answer</div>
              <div className={styles.stepEqFinal}><KaTeX tex={currentQ.finalAnswer} /></div>
            </div>
          </div>
          <NavBlock xpLabel="+40 XP 🎉 You got it!" />
        </div>
        <div className={styles.bottomSpacer} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GUIDED / PRACTICE / CHALLENGE STEPWISE
  // (challenge stepwise looks exactly like practice — same coach nudge, same hearts)
  // ─────────────────────────────────────────────────────────────────────────────
  if (!activeStep && !questionDone) return null;

  const xpLabel =
    state.mode === "guided"   ? "+10 XP 🎉" :
    state.mode === "practice" ? "+20 XP 🎉" :
    "+20 XP ⭐ (half points — solved with help)";

  return (
    <div className={styles.playRoot}>
      <div className={styles.playBg} />

      <Topbar extra={
        !showHearts ? (
          <div className={styles.stepCounter}>
            Step <strong>{questionDone ? currentQ.steps.length : stepIdx + 1}/{currentQ.steps.length}</strong>
          </div>
        ) : undefined
      } />

      {/* Challenge stepwise banner */}
      {isChallengeStepwise && (
        <div className={styles.chalStepwiseBanner}>
          <span>🔥 Challenge — work through the steps</span>
        </div>
      )}

      <div className={styles.scroll}>
        <MissionCard />

        {/* Completed steps trail — each step shows its working lines inline */}
        {completedSteps.map((s, i) => (
          <div key={i} className={`${styles.stepRow} ${styles.stepRowVisible}`}>
            <div className={styles.stepLine}>
              <div className={`${styles.stepCircle} ${styles.stepDone}`}>✓</div>
              {(i < completedSteps.length - 1 || !questionDone) && <div className={styles.stepTail} />}
            </div>
            <div className={styles.stepBody}>
              <div className={styles.stepLabel}>{s.label}</div>
              {/* Intermediate working lines — the "how we got here" */}
              {s.workingLines && s.workingLines.length > 0 && (
                <div className={styles.trailWorking}>
                  {s.workingLines.map((wl, wi) => (
                    <div key={wi} className={styles.trailWorkingLine}>{wl.text}</div>
                  ))}
                </div>
              )}
              <StepEq tex={s.eq} />
            </div>
          </div>
        ))}

        {/* Final answer — inline, no separate page */}
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

        {/* Done — celebrate + navigate, all inline */}
        {questionDone && <NavBlock xpLabel={xpLabel} />}
      </div>

      {/* Coach — guided: full explanation. Practice + challenge stepwise: choiceQuestion nudge. */}
      {!questionDone && activeStep && (
        <div className={styles.coachCard}>
          <div className={styles.coachHeader}>
            <ChideraAvatar />
            <span className={styles.coachName}>Ms. Chidera</span>
          </div>
          {state.mode === "guided" ? (
            <>
              <div className={styles.coachText}
                dangerouslySetInnerHTML={{ __html: coachText || activeStep.coach }}
              />
              {/* coachTip ("Try: ...") removed — coach explanation is already sufficient */}
            </>
          ) : (
            /* Practice & challenge stepwise — just the nudge question */
            <div className={styles.coachText}>{activeStep.choiceQuestion || activeStep.hint}</div>
          )}
        </div>
      )}

      {/* Choices */}
      {!questionDone && activeStep && (
        <div className={styles.choicesZone}>
          <div className={styles.choicesGrid}>
            {shuffledChoices.map((ch, i) => (
              <button key={i}
                className={[
                  styles.choiceBtn,
                  feedback[i] === "correct" ? styles.choiceCorrect : "",
                  feedback[i] === "wrong"   ? styles.choiceWrong   : "",
                ].join(" ")}
                onClick={() => handlePick(i, ch)}
                disabled={locked && feedback[i] !== "correct"}
              >
                <span className={styles.choiceIcon}>{ch.icon}</span>
                <span className={styles.choiceLabel}>{ch.label}</span>
                {/* sub is intentionally NOT shown here — it reveals the outcome */}
              </button>
            ))}
          </div>
          {/* Wrong-pick feedback toast — appears below grid after a wrong answer */}
          {wrongFeedback && (
            <div className={styles.wrongFeedbackToast}>
              <span className={styles.wrongFeedbackIcon}>❌</span>
              <span>{wrongFeedback}</span>
            </div>
          )}
        </div>
      )}

      {/* Working popup — student completes the arithmetic before the result is revealed.
          Design principle: the question being asked must be visually unmistakable.
          Context lines (what we've done so far) sit above a clear divider.
          The question line shows ONLY what the student needs to answer — nothing after ?.
          Options sit immediately below the question, large and tappable. */}
      {workingPopup && (() => {
        const blankLineIndices = workingPopup
          .map((l, i) => l.blank ? i : -1)
          .filter(i => i >= 0);
        const currentBlankLineIdx = blankLineIndices[workingLineIdx] ?? -1;
        const allBlanksDone = workingLineIdx >= blankLineIndices.length;
        const doneLabel = state.mode === "guided" ? "Got it →" : "Continue →";

        // Split a blank line text at "?" into: the question part (before ?) and
        // any trailing annotation (after ?). We show ONLY the question part.
        // The trailing part (if any) was extra context authored for fallback display —
        // hiding it keeps the question clean and unambiguous.
        const splitBlankText = (text: string) => {
          const idx = text.indexOf("?");
          if (idx < 0) return { question: text, trailing: "" };
          return { question: text.slice(0, idx).trimEnd(), trailing: text.slice(idx + 1).trimStart() };
        };

        return (
          <div className={styles.workingOverlay}>
            <div className={styles.workingSheet}>

              {/* Header — restored: user likes this framing */}
              <div className={styles.wpHeader}>
                <div className={styles.wpHeaderIcon}>✏️</div>
                <div className={styles.wpHeaderText}>
                  <div className={styles.wpHeaderTitle}>
                    {allBlanksDone ? "Working complete!" : "Your turn"}
                  </div>
                  <div className={styles.wpHeaderSub}>
                    {allBlanksDone
                      ? "All steps correct — see the result below."
                      : "Fill in the missing value to continue."}
                  </div>
                </div>
              </div>

              {/* Context section — everything we've established so far */}
              {(() => {
                const contextLines = workingPopup
                  .slice(0, currentBlankLineIdx < 0 ? undefined : currentBlankLineIdx)
                  .filter((_, i) => {
                    const isBlank = workingPopup[i]?.blank !== undefined;
                    const blankPos = blankLineIndices.indexOf(i);
                    return !isBlank || blankPos < workingLineIdx; // show answered blanks as context
                  });
                const hasContext = contextLines.some(l => !l.text.trim().startsWith("─"));
                if (!hasContext && !allBlanksDone) return null;
                return (
                  <div className={styles.wpContext}>
                    {contextLines.map((line, i) => {
                      const isSep = line.text.trim().startsWith("─");
                      if (isSep) return <div key={i} className={styles.wpSeparator} />;
                      const isAnsweredBlank = line.blank !== undefined;
                      if (isAnsweredBlank) {
                        return (
                          <div key={i} className={styles.wpContextLine}>
                            <span className={styles.wpContextCheck}>✓</span>
                            <span>{line.text.replace("?", line.blank!.answer)}</span>
                          </div>
                        );
                      }
                      return <div key={i} className={styles.wpContextLine}>{line.text}</div>;
                    })}
                  </div>
                );
              })()}

              {/* Question section — what the student must answer RIGHT NOW */}
              {!allBlanksDone && currentBlankLineIdx >= 0 && (() => {
                const activeLine = workingPopup[currentBlankLineIdx];
                if (!activeLine?.blank) return null;
                const { question } = splitBlankText(activeLine.text);

                return (
                  <div className={styles.wpQuestion}>
                    {/* Question equation */}
                    <div className={styles.wpQuestionEq}>
                      {question} = <span className={styles.wpQuestionSlot}>
                        {blankDone ? activeLine.blank.answer : "?"}
                      </span>
                    </div>
                    {/* Options */}
                    <div className={styles.wpOptions}>
                      {activeLine.blank.options.map((opt, oi) => (
                        <button
                          key={oi}
                          className={[
                            styles.wpOptionBtn,
                            blankAnswer === opt && opt === activeLine.blank!.answer ? styles.wpOptionCorrect : "",
                            blankAnswer === opt && opt !== activeLine.blank!.answer ? styles.wpOptionWrong  : "",
                          ].join(" ")}
                          onClick={() => {
                            if (blankDone) return;
                            setBlankAnswer(opt);
                            if (opt === activeLine.blank!.answer) {
                              setBlankDone(true);
                            } else {
                              setTimeout(() => setBlankAnswer(null), 700);
                            }
                          }}
                          disabled={blankDone}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    {blankAnswer && !blankDone && (
                      <div className={styles.wpWrong}>Not quite — try again</div>
                    )}
                  </div>
                );
              })()}

              {/* All done — result revealed message */}
              {allBlanksDone && (
                <div className={styles.wpAllDone}>
                  <span className={styles.wpAllDoneIcon}>✓</span>
                  <span>Correct! The working is complete.</span>
                </div>
              )}

              {/* Footer */}
              {!allBlanksDone ? (
                blankDone ? (
                  <button className={styles.wpNextBtn} onClick={() => {
                    setBlankAnswer(null);
                    setBlankDone(false);
                    setWorkingLineIdx(prev => prev + 1);
                  }}>
                    Next →
                  </button>
                ) : null
              ) : (
                <button className={styles.wpDoneBtn} onClick={advanceAfterWorking}>
                  {doneLabel}
                </button>
              )}
            </div>
          </div>
        );
      })()}

      <div className={styles.bottomSpacer} />
    </div>
  );
}

// ─── Hub ──────────────────────────────────────────────────────────────────────

interface HubQuestion { title: string; missionKey: string; done: boolean; }

function HubScreen({ state, dispatch, hasPractice, hasChallenge, onBack, onStart, resumeLabel,
  guidedQuestions, practiceQuestions, challengeQuestions }: {
  state: EngineState; dispatch: React.Dispatch<Action>;
  hasPractice: boolean; hasChallenge: boolean; onBack: () => void;
  onStart: () => void; resumeLabel?: string;
  guidedQuestions: HubQuestion[];
  practiceQuestions: HubQuestion[];
  challengeQuestions: HubQuestion[];
}) {
  const [showMissions, setShowMissions] = React.useState(false);

  const modes: { id: StepMode; icon: string; name: string; desc: string; color: string; locked: boolean }[] = [
    { id: "guided",    icon: "📖", name: "Guided Learning", color: "#f5a623", locked: false,         desc: "Ms. Chidera walks you through every step. Learn the why, not just the how." },
    { id: "practice",  icon: "⚡", name: "Practice",         color: "#6c28e0", locked: !hasPractice,  desc: "Work it out yourself. Ms. Chidera gives you a nudge, not the answer." },
    { id: "challenge", icon: "🔥", name: "Challenge",         color: "#e03c28", locked: !hasChallenge, desc: "Solve on paper first, then pick your answer. Full marks for first-try correct." },
    { id: "mastery",   icon: "🏅", name: "Mastery",           color: "#1a7a4a", locked: true,          desc: "Exam-level. Application questions. No scaffolding." },
  ];

  const questionsFor: Record<StepMode, HubQuestion[]> = {
    guided: guidedQuestions, practice: practiceQuestions, challenge: challengeQuestions, mastery: [],
  };
  const activeQuestions = questionsFor[state.mode] ?? [];
  const doneCount = activeQuestions.filter(q => q.done).length;

  if (showMissions) {
    return (
      <div className={styles.missionsRoot}>
        <div className={styles.hubBg} />
        <div className={styles.missionsContent}>
          <div className={styles.missionsHeader}>
            <button className={styles.missionsBackBtn} onClick={() => setShowMissions(false)}>← Back</button>
            <div className={styles.missionsTitle}>
              {state.mode === "guided" ? "📖" : state.mode === "practice" ? "⚡" : "🔥"}{" "}
              {state.mode === "guided" ? "Guided Learning" : state.mode === "practice" ? "Practice" : "Challenge"}
            </div>
            <div className={styles.missionsProg}>
              {doneCount}/{activeQuestions.length} done
            </div>
          </div>

          {/* Progress bar */}
          <div className={styles.missionsBar}>
            <div className={styles.missionsBarFill}
              style={{ width: activeQuestions.length ? `${(doneCount / activeQuestions.length) * 100}%` : "0%" }} />
          </div>

          {/* Question list */}
          <div className={styles.missionsList}>
            {activeQuestions.length === 0 ? (
              <div className={styles.missionsEmpty}>No questions available yet.</div>
            ) : activeQuestions.map((q, i) => {
              const isCurrent = !q.done && i === doneCount;
              return (
                <div key={q.missionKey} className={[
                  styles.missionItem,
                  q.done ? styles.missionItemDone : isCurrent ? styles.missionItemCurrent : styles.missionItemLocked,
                ].join(" ")}>
                  <div className={styles.missionItemNumber}>
                    {q.done ? "✓" : isCurrent ? String(i + 1) : "–"}
                  </div>
                  <div className={styles.missionItemText}>
                    <div className={styles.missionItemTitle}>{q.title}</div>
                    <div className={styles.missionItemSub}>
                      {q.done ? "Completed" : isCurrent ? "Up next" : "Locked"}
                    </div>
                  </div>
                  {isCurrent && (
                    <button className={styles.missionItemStart} onClick={() => {
                      setShowMissions(false);
                      onStart();
                    }}>
                      Start →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.hubRoot}>
      <div className={styles.hubBg} />
      <div className={styles.hubContent}>
        <button className={styles.hubBackBtn} onClick={onBack}>← Back</button>
        <div className={styles.hubWelcome}>👋 Welcome</div>
        <h1 className={styles.hubTitle}>Choose your <span className={styles.hubTitleAccent}>learning mode</span></h1>
        <p className={styles.hubDesc}>Work through each solution step by step. Every correct move builds the trail.</p>
        <div className={styles.modeList}>
          {modes.map(m => {
            const mq = questionsFor[m.id] ?? [];
            const md = mq.filter(q => q.done).length;
            return (
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
                <div className={styles.modeMeta}>
                  {!m.locked && mq.length > 0 && (
                    <div className={styles.modeProg}>{md}/{mq.length}</div>
                  )}
                  <span className={styles.modeArrow}>{m.locked ? "🔒" : "→"}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className={styles.hubActions}>
          <button className={styles.startBtn} onClick={onStart}>{resumeLabel ?? "Begin →"}</button>
          <button className={styles.viewMissionsBtn} onClick={() => setShowMissions(true)}>
            View all questions
          </button>
        </div>
      </div>
    </div>
  );
}