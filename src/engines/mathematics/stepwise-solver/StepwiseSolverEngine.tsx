"use client";

/**
 * StepwiseSolverEngine.tsx
 *
 * Render matches combined_stepwise_v3.html prototype exactly.
 * Content JSON must supply steps in the prototype's shape:
 *   lbl, beats, stageLines, ops | isOpts+opts | isMulti+...,
 *   trailLabel, trailDetail, resultText, afterSpeech
 */

import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import type { EngineRuntimeProps } from "@/engines/engine-types";
import { ChideraAvatar } from "./ChideraAvatar";
import { StepwiseHub } from "./StepwiseHub";
import { StepwiseMissionComplete } from "./StepwiseMissionComplete";
import styles from "./StepwiseSolverEngine.module.css";

// ─── KaTeX ─────────────────────────────────────────────────────────────────────

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

// ─── Types ─────────────────────────────────────────────────────────────────────

export type StepMode = "guided" | "practice" | "challenge" | "mastery";
type ChalPhase = "think" | "pick" | "stepwise" | "review_pick";

// One token in a stageLines row
export type StageTerm = { t: string } | { op: string };

// Operation button (full-width stacked rows — prototype .opb)
export interface StepOp {
  l: string;       // label: "Add them together"
  s: string;       // math symbol: "+"
  correct: boolean;
  note?: string;   // wrong-answer feedback
}

// Compact value button (prototype .opt)
export interface StepOpt {
  l: string;       // value: "5"
  c: boolean;      // correct
  n?: string;      // wrong-answer feedback
}

// One step exactly matching the prototype's steps[] shape
export interface QuestionStep {
  lbl: string;                    // "Step 1 — Combine"
  beats: [string, string][];      // [["speech","mood"], ...]
  stageLines: StageTerm[][];      // equation token rows

  // Op-button variant (most steps)
  ops?: StepOp[];

  // Compact opts variant (value calculation)
  isOpts?: boolean;
  opts?: StepOpt[];

  // Multi-term simplification variant
  isMulti?: boolean;
  termIndices?: number[];
  lockLabels?: string[];
  multiSpeeches?: [string, string][];
  multiOpts?: StepOpt[][];

  // After correct pick
  trailLabel: string;
  trailDetail: string;
  resultText: string;
  afterSpeech: string;
}

export interface StepwiseQuestion {
  goal: string;
  formula: string;              // for MissionCard display
  topic: string;
  finalAnswer: string;
  steps: QuestionStep[];
  answerChoices?: { label: string; correct: boolean }[];
  caseHints?: string[];
  missionId?: string;
  topicId?: string;
  subtopicId?: string;
  xpReward?: number;
}

interface MissionEntry {
  id: string;
  missionKey: string;
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  sequenceIndex: number;
  xpReward: number;
  topicId?: string;
  subtopicId?: string;
  payload: Record<string, unknown>;
}

// ─── Translator ─────────────────────────────────────────────────────────────────
// Reads content JSON payload and returns a StepwiseQuestion.
// The payload's solutionSteps must already be in the prototype's step shape
// (lbl, beats, stageLines, ops/isOpts/isMulti, trailLabel, etc.)
// Legacy payloads with `formula + steps[]{choices}` pass through as-is.

function payloadToQuestion(m: MissionEntry): StepwiseQuestion | null {
  const p = m.payload;

  // ── Format A: already fully formed steps (legacy or new authored) ──
  const rawSteps = p.steps as QuestionStep[] | undefined;
  const formula  = p.formula as string | undefined;
  if (formula && rawSteps && rawSteps.length > 0 && rawSteps[0].lbl) {
    return {
      goal:         (p.goal as string) ?? "Solve",
      formula,
      topic:        (p.topic as string) ?? "",
      finalAnswer:  (p.finalAnswer as string) ?? "",
      steps:        rawSteps,
      answerChoices: p.answerChoices as { label: string; correct: boolean }[] | undefined,
      missionId:   m.id,
      topicId:     m.topicId,
      subtopicId:  m.subtopicId,
      xpReward:    m.xpReward,
    };
  }

  // ── Format B: detective payload — equations + solutionSteps ──
  // solutionSteps must have `lbl` to be the new format
  const equations   = p.equations as { id: string; display: string }[] | undefined;
  const solutionSteps = p.solutionSteps as QuestionStep[] | undefined;
  if (equations && solutionSteps && solutionSteps.length > 0 && solutionSteps[0].lbl) {
    const formula = equations.map(e => e.display).join(" \\\\ ");
    const solution = p.solution as { variables: Record<string, number> } | undefined;
    const vars = solution?.variables ?? {};
    const finalAnswer = Object.entries(vars).map(([k, v]) => `${k} = ${v}`).join(",\\quad ");
    return {
      goal:         `Solve the simultaneous equations`,
      formula,
      topic:        "Simultaneous Equations",
      finalAnswer,
      steps:        solutionSteps,
      answerChoices: p.answerChoices as { label: string; correct: boolean }[] | undefined,
      caseHints:    p.caseHints as string[] | undefined,
      missionId:    m.id,
      topicId:      m.topicId,
      subtopicId:   m.subtopicId,
      xpReward:     m.xpReward,
    };
  }

  // ── Format C: challenge/mastery — no steps, just answerChoices ──
  if (formula && p.answerChoices) {
    return {
      goal:         (p.goal as string) ?? "Solve",
      formula,
      topic:        (p.topic as string) ?? "",
      finalAnswer:  (p.finalAnswer as string) ?? "",
      steps:        [],
      answerChoices: p.answerChoices as { label: string; correct: boolean }[],
      caseHints:    p.caseHints as string[] | undefined,
      missionId:    m.id,
      topicId:      m.topicId,
      subtopicId:   m.subtopicId,
      xpReward:     m.xpReward,
    };
  }

  return null;
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

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─── Formula / step-equation display ───────────────────────────────────────────

function FormulaDisplay({ formula }: { formula: string }) {
  if (formula.includes("\\\\")) {
    const lines = formula.split("\\\\").map(l => l.trim()).filter(Boolean);
    return (
      <div className={styles.mcFormulaMulti}>
        <div className={styles.mcFormulaLines}>
          {lines.map((line, i) => (
            <div key={i} className={styles.mcFormulaLine}><KaTeX tex={line} /></div>
          ))}
        </div>
      </div>
    );
  }
  return <div className={styles.mcFormula}><KaTeX tex={formula} /></div>;
}

function StepEq({ tex }: { tex: string }) {
  if (tex.includes("\\\\")) {
    const lines = tex.split("\\\\").map(l => l.trim()).filter(Boolean);
    return (
      <div className={styles.stepEqMulti}>
        {lines.map((line, i) => (
          <div key={i} className={styles.stepEqLine}><KaTeX tex={line} /></div>
        ))}
      </div>
    );
  }
  return <div className={styles.stepEq}><KaTeX tex={tex} /></div>;
}

// ─── State machine ──────────────────────────────────────────────────────────────

type Screen = "hub" | "playing" | "missionComplete";

interface EngineState {
  screen: Screen;
  mode: StepMode;
  questionIdx: number;
  lives: number;
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
  | { type: "GO_TO_MISSION_COMPLETE" }
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
    case "GO_TO_MISSION_COMPLETE":
      return { ...state, screen: "missionComplete" };
    case "RESTART":
      return { ...INITIAL_STATE, mode: state.mode, seenFormulas: state.seenFormulas, questionsCompleted: state.questionsCompleted };
    default: return state;
  }
}

// ─── Root ───────────────────────────────────────────────────────────────────────

export default function StepwiseSolverEngine({ config, onComplete }: EngineRuntimeProps) {
  const [state, dispatch] = useReducer(reduce, INITIAL_STATE);

  const shared      = ((config as Record<string, unknown>).shared as Record<string, unknown>) ?? {};
  const allMissions = (shared._allMissions as MissionEntry[] | undefined) ?? [];
  const onBack      = (shared._onBack as (() => void) | undefined) ?? (() => {});
  const studentId   = (shared._studentId as string | undefined) ?? "anon";
  const gameId      = (shared._gameId    as string | undefined) ?? "game";
  const playerName  = typeof window !== "undefined"
    ? (window.localStorage.getItem("exl:playerName") ?? undefined)
    : undefined;

  const progressKey   = (mode: StepMode) => `exl_progress_${studentId}_${gameId}_${mode}`;
  const DONE_SENTINEL = 9999;
  const getResume = (mode: StepMode, total: number): number => {
    if (typeof window === "undefined") return 0;
    const saved = parseInt(localStorage.getItem(progressKey(mode)) ?? "0", 10);
    if (isNaN(saved)) return 0;
    return Math.min(saved, total);
  };
  const saveProgress  = (mode: StepMode, idx: number) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(progressKey(mode), String(idx));
  };
  const markModeDone  = (mode: StepMode) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(progressKey(mode), String(DONE_SENTINEL));
  };

  const guidedQ    = missionsToQuestions(allMissions.filter(m => m.difficulty === "EASY"));
  const practiceQ  = missionsToQuestions(allMissions.filter(m => m.difficulty === "MEDIUM"));
  const challengeQ = missionsToQuestions(allMissions.filter(m => m.difficulty === "HARD"));

  const questions =
    state.mode === "guided"   ? guidedQ   :
    state.mode === "practice" ? practiceQ : challengeQ;

  // ── Step state ──
  const [stepIdx, setStepIdx]               = useState(0);
  const [completedSteps, setCompletedSteps] = useState<{ label: string; detail: string }[]>([]);
  const [questionDone, setQuestionDone]     = useState(false);
  const [locked, setLocked]                 = useState(false);
  const [coachSpeech, setCoachSpeech]       = useState("");
  const [coachMood, setCoachMood]           = useState("Your guide");
  const [trailOpen, setTrailOpen]           = useState(false);

  // Beat sequencing
  const [beatsReady, setBeatsReady]         = useState(false);
  const beatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Result reveal inside stage
  const [resultRevealed, setResultRevealed] = useState(false);

  // Continue button (after correct pick)

  // Wrong-answer note below buttons
  const [wrongNote, setWrongNote]           = useState("");

  // Multi-term state
  const [multiDone, setMultiDone]           = useState(0);
  const [multiLocked, setMultiLocked]       = useState<Record<number, string>>({});
  const [pickedOpt, setPickedOpt]           = useState<{idx: number; correct: boolean} | null>(null); // immediate button feedback
  const [showContinue, setShowContinue]     = useState(false); // show Continue button after correct pick

  // ── Challenge state ──
  const [chalPhase, setChalPhase]           = useState<ChalPhase>("think");
  const [dontUnderstandVisible, setDontUnderstandVisible] = useState(false);

  // ── Try-yourself phase (every 3rd question in guided/practice) ──
  // tryPhase: "try" = show question + I have solution
  //           "pick" = show MCQ options (after pressing I have solution)
  //           "off"  = normal stepwise flow
  const [tryPhase, setTryPhase]             = useState<"off"|"try"|"pick">("off");
  const [tryWrong, setTryWrong]             = useState(0);    // wrong MCQ picks in try mode
  const [tryFeedback, setTryFeedback]       = useState<Record<number,"correct"|"wrong">>({});
  const [tryLocked, setTryLocked]           = useState(false);
  const [tryDontUnderstand, setTryDontUnderstand] = useState(false);
  const tryDontUnderstandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [chalWrong, setChalWrong]           = useState(0);
  const [chalFeedback, setChalFeedback]     = useState<Record<number, "correct" | "wrong">>({});
  const [chalLocked, setChalLocked]         = useState(false);
  const [chalFullXp, setChalFullXp]         = useState(false);
  const [reviewTrail, setReviewTrail]       = useState<{ label: string; detail: string }[]>([]);

  const dontUnderstandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrongNoteTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTime           = useRef(Date.now());
  const totalTries          = useRef(0);
  const completedReported   = useRef(false);
  const fallbackStepsRef    = useRef<QuestionStep[]>([]);

  const currentQ       = questions.length
    ? questions[Math.min(state.questionIdx, questions.length - 1)]
    : undefined;
  const effectiveSteps = (currentQ?.steps.length ?? 0) > 0
    ? (currentQ?.steps ?? [])
    : fallbackStepsRef.current;
  const activeStep     = effectiveSteps[stepIdx];
  const hasMore        = state.questionIdx + 1 < questions.length;

  const challengeChoices = React.useMemo(
    () => shuffle([...(currentQ?.answerChoices ?? [])]),
    [state.questionIdx] // eslint-disable-line
  );
  // Same shuffle for try-yourself MCQ (same question pool)
  const tryChoices = challengeChoices;

  const isChallengeStepwise = state.mode === "challenge" && chalPhase === "stepwise";

  // Every 3rd question (0-indexed: 2, 5, 8...) triggers try-yourself if answerChoices exist
  // Works for both guided and practice modes
  const isGuidedOrPractice = state.mode === "guided" || state.mode === "practice";
  const isTryQuestion = isGuidedOrPractice
    && state.questionIdx > 0
    && state.questionIdx % 3 === 2
    && (currentQ?.answerChoices?.length ?? 0) >= 2;

  // On question load, set tryPhase to "try" if this is a try question
  // (handled in the question-change useEffect below via isTryQuestion)

  const showHearts = state.mode === "practice" || state.mode === "challenge";

  // ── Reset on question/screen change ──
  useEffect(() => {
    setStepIdx(0);
    setCompletedSteps([]);
    setQuestionDone(false);
    setLocked(false);
    setCoachSpeech("");
    setCoachMood("Your guide");
    setTrailOpen(false);
    setBeatsReady(false);
    setResultRevealed(false);
    setWrongNote("");
    setMultiDone(0);
    setMultiLocked({});
    setPickedOpt(null);
    setShowContinue(false);
    setChalPhase("think");
    setDontUnderstandVisible(false);
    setTryPhase("off");
    setTryWrong(0);
    setTryFeedback({});
    setTryLocked(false);
    setTryDontUnderstand(false);
    setChalWrong(0);
    setChalFeedback({});
    setChalLocked(false);
    setChalFullXp(false);
    setReviewTrail([]);
    startTime.current = Date.now();
    totalTries.current = 0;
    completedReported.current = false;
  }, [state.questionIdx, state.screen]);

  // ── Activate try-yourself mode on every 3rd question ──
  useEffect(() => {
    if (!isTryQuestion) return;
    setTryPhase("try");
    // "I don't understand" appears after 10 seconds
    if (tryDontUnderstandTimerRef.current) clearTimeout(tryDontUnderstandTimerRef.current);
    tryDontUnderstandTimerRef.current = setTimeout(() => setTryDontUnderstand(true), 10000);
    return () => { if (tryDontUnderstandTimerRef.current) clearTimeout(tryDontUnderstandTimerRef.current); };
  }, [state.questionIdx, isTryQuestion]); // eslint-disable-line

  // ── Beat sequencer: fires when step changes ──
  useEffect(() => {
    if (!activeStep) return;
    setLocked(false);
    setResultRevealed(false);
    setWrongNote("");
    setMultiDone(0);
    setMultiLocked({});
    setPickedOpt(null);
    setShowContinue(false);
    setTryPhase("off");
    setTryWrong(0);
    setTryFeedback({});
    setTryLocked(false);
    setTryDontUnderstand(false);
    setBeatsReady(false);

    const beats = activeStep.beats ?? [];
    if (beats.length === 0) { setBeatsReady(true); return; }

    // Challenge stepwise: skip beats — student works independently
    if (isChallengeStepwise) {
      setCoachSpeech("Work through this step.");
      setCoachMood("Challenge");
      setBeatsReady(true);
      return;
    }

    // Show first beat immediately
    setCoachSpeech(beats[0][0]);
    setCoachMood(beats[0][1]);

    if (beats.length === 1) {
      // Single beat — wait then show action
      // Practice mode: shorter delay since student already knows the flow from guided
      const delay = Math.max(beats[0][0].length * 28 + 200, 800);
      beatTimerRef.current = setTimeout(() => setBeatsReady(true), delay);
      return () => { if (beatTimerRef.current) clearTimeout(beatTimerRef.current); };
    }

    // Multiple beats — chain them
    let bi = 0;
    function nextBeat() {
      bi++;
      if (bi < beats.length) {
        setCoachSpeech(beats[bi][0]);
        setCoachMood(beats[bi][1]);
        const delay = Math.max(beats[bi - 1][0].length * 28 + 200, 800);
        beatTimerRef.current = setTimeout(nextBeat, delay);
      } else {
        // After last beat, pause then show action
        const delay = Math.max(beats[bi - 1][0].length * 28 + 200, 800);
        beatTimerRef.current = setTimeout(() => setBeatsReady(true), delay);
      }
    }
    const firstDelay = Math.max(beats[0][0].length * 28 + 200, 800);
    beatTimerRef.current = setTimeout(nextBeat, firstDelay);
    return () => { if (beatTimerRef.current) clearTimeout(beatTimerRef.current); };
  }, [stepIdx, state.questionIdx]); // eslint-disable-line

  // ── Multi: when multiDone changes, update coach speech ──
  useEffect(() => {
    if (!activeStep?.isMulti || !activeStep.multiSpeeches) return;
    const sp = activeStep.multiSpeeches[multiDone];
    if (sp) { setCoachSpeech(sp[0]); setCoachMood(sp[1]); }
  }, [multiDone]); // eslint-disable-line

  // ── Challenge "I don't understand" appears after 12 seconds on think screen ──
  useEffect(() => {
    if (state.mode !== "challenge" || chalPhase !== "think") return;
    setDontUnderstandVisible(false);
    dontUnderstandTimerRef.current = setTimeout(() => setDontUnderstandVisible(true), 12000);
    return () => { if (dontUnderstandTimerRef.current) clearTimeout(dontUnderstandTimerRef.current); };
  }, [state.mode, chalPhase, state.questionIdx]);

  // ── Hearts: 0 → restart ──
  const [showHeartOut, setShowHeartOut] = useState(false);
  useEffect(() => {
    if (showHearts && state.lives === 0 && !questionDone) {
      if (wrongNoteTimerRef.current) clearTimeout(wrongNoteTimerRef.current);
      setLocked(false);
      setShowHeartOut(true);
    }
  }, [state.lives, showHearts, questionDone]);

  const restartQuestion = useCallback(() => {
    fallbackStepsRef.current = [];
    setStepIdx(0);
    setCompletedSteps([]);
    setQuestionDone(false);
    setLocked(false);
    setShowHeartOut(false);
    if (state.mode === "challenge") {
      setChalPhase("stepwise");
      setChalWrong(0);
      setChalFeedback({});
      setChalLocked(false);
    }
    dispatch({ type: "RESET_LIVES" });
    startTime.current = Date.now();
    totalTries.current = 0;
    completedReported.current = false;
  }, [state.mode]);

  const saveQuestionXp = useCallback((q: StepwiseQuestion, xpAmount: number) => {
    if (!q.missionId || !q.topicId) return;
    fetch("/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId, gameId,
        missionId: q.missionId,
        topicId: q.topicId,
        subtopicId: q.subtopicId,
        success: true,
        rawOutcome: { xpEarned: xpAmount, perQuestion: true },
        completedAt: new Date().toISOString(),
      }),
    }).catch(() => {});
  }, [studentId, gameId]);

  // ── Step advance (stamps trail, increments stepIdx or marks question done) ──
  const advanceStep = useCallback((step: QuestionStep) => {
    if (!currentQ) return;
    const newEntry = { label: step.trailLabel, detail: step.trailDetail };
    const isLast = stepIdx >= effectiveSteps.length - 1;
    if (isLast) {
      state.seenFormulas.add(currentQ.formula);
      setCompletedSteps(prev => [...prev, newEntry]);
      setQuestionDone(true);
      setLocked(false);
      const xpAmount = state.mode === "guided" ? 10 : 20;
      dispatch({ type: "EARN_XP", amount: xpAmount });
      saveQuestionXp(currentQ, xpAmount);
    } else {
      setCompletedSteps(prev => [...prev, newEntry]);
      setStepIdx(prev => prev + 1);
      setLocked(false);
    }
  }, [currentQ, stepIdx, effectiveSteps, state, saveQuestionXp]); // eslint-disable-line

  // ── Correct pick: reveal result → afterSpeech → Continue button ──
  const handleCorrect = useCallback((step: QuestionStep) => {
    setLocked(true);
    setWrongNote("");
    totalTries.current += 1;

    // 1. Reveal result in stage + update coach
    setTimeout(() => {
      setResultRevealed(true);
      setCoachSpeech(step.afterSpeech);
      setCoachMood("Well done");
    }, 400);

    // 2. Show Continue button so student pauses, reads, then chooses to proceed
    setTimeout(() => setShowContinue(true), 700);
  }, []); // eslint-disable-line

  // ── Wrong pick ──
  const handleWrong = useCallback((note: string) => {
    if (state.mode !== "guided") dispatch({ type: "LOSE_LIFE" });
    totalTries.current += 1;
    setWrongNote(note || "Not quite — think again.");
    setCoachSpeech("Not quite — think about which operation removes what's attached.");
    setCoachMood("Try again");
    if (wrongNoteTimerRef.current) clearTimeout(wrongNoteTimerRef.current);
    wrongNoteTimerRef.current = setTimeout(() => {
      setWrongNote("");
      setLocked(false);
    }, 1400);
  }, [state.mode]); // eslint-disable-line

  // ── Challenge MCQ ──
  const handleChalPick = useCallback((idx: number, correct: boolean) => {
    if (chalLocked || !currentQ) return;
    setChalLocked(true);
    totalTries.current += 1;
    if (correct) {
      setChalFeedback(prev => ({ ...prev, [idx]: "correct" }));
      setChalFullXp(true);
      dispatch({ type: "EARN_XP", amount: 40 });
      saveQuestionXp(currentQ, 40);
      const trail = effectiveSteps.map(s => ({ label: s.trailLabel, detail: s.trailDetail }));
      setReviewTrail(trail);
      setTimeout(() => { setChalPhase("review_pick"); setChalLocked(false); }, 600);
    } else {
      setChalFeedback(prev => ({ ...prev, [idx]: "wrong" }));
      dispatch({ type: "LOSE_LIFE" });
      const newWrong = chalWrong + 1;
      setChalWrong(newWrong);
      if (newWrong >= 2) {
        dispatch({ type: "RESET_LIVES" });
        setTimeout(() => { setChalPhase("stepwise"); setChalLocked(false); setStepIdx(0); }, 1000);
      } else {
        setTimeout(() => setChalLocked(false), 1200);
      }
    }
  }, [chalLocked, currentQ, chalWrong, effectiveSteps, saveQuestionXp]); // eslint-disable-line

  // ── Hub ──
  if (state.screen === "hub") {
    const modeQ = state.mode === "guided" ? guidedQ : state.mode === "practice" ? practiceQ : challengeQ;
    const rawResumeIdx = getResume(state.mode, modeQ.length);
    const isModeDone = rawResumeIdx >= modeQ.length;
    const resumeIdx  = isModeDone ? 0 : rawResumeIdx;
    const resumeLabel = !isModeDone && resumeIdx > 0 ? `Continue from Q${resumeIdx + 1} →` : undefined;
    const makeHubQ = (qs: StepwiseQuestion[], mode: StepMode) => {
      const resumeI = getResume(mode, qs.length);
      return qs.map((q, i) => ({ title: q.goal || q.formula, missionKey: `${mode}-${i}`, done: i < resumeI }));
    };
    return (
      <StepwiseHub
        currentMode={state.mode}
        onSelectMode={(mode) => dispatch({ type: "SELECT_MODE", mode })}
        hasPractice={practiceQ.length > 0}
        hasChallenge={challengeQ.length > 0}
        onBack={onBack}
        onStart={() => dispatch({ type: "START_PLAY", resumeIdx })}
        resumeLabel={resumeLabel}
        studentName={playerName}
        guidedQuestions={makeHubQ(guidedQ, "guided")}
        practiceQuestions={makeHubQ(practiceQ, "practice")}
        challengeQuestions={makeHubQ(challengeQ, "challenge")}
      />
    );
  }

  // ── Mission Complete ──
  if (state.screen === "missionComplete") {
    const makeHubQ = (qs: StepwiseQuestion[], mode: StepMode) => {
      const resumeI = getResume(mode, qs.length);
      return qs.map((q, i) => ({ title: q.goal || q.formula, missionKey: `${mode}-${i}`, done: i < resumeI }));
    };
    const nextMode: StepMode | null =
      state.mode === "guided"   ? (practiceQ.length  > 0 ? "practice"  : null) :
      state.mode === "practice" ? (challengeQ.length > 0 ? "challenge" : null) : null;
    return (
      <StepwiseMissionComplete
        completedMode={state.mode}
        xpEarned={state.xp}
        guidedQuestions={makeHubQ(guidedQ, "guided")}
        practiceQuestions={makeHubQ(practiceQ, "practice")}
        challengeQuestions={makeHubQ(challengeQ, "challenge")}
        nextMode={nextMode}
        onNextMode={() => {
          if (!nextMode) return;
          const targetTotal = nextMode === "practice" ? practiceQ.length : challengeQ.length;
          const rawIdx = getResume(nextMode, targetTotal);
          dispatch({ type: "GO_TO_MODE", mode: nextMode, resumeIdx: rawIdx >= targetTotal ? 0 : rawIdx });
        }}
        onReplay={() => dispatch({ type: "START_PLAY", resumeIdx: 0 })}
        onBackToHub={() => dispatch({ type: "RESTART" })}
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

  // ── Shared UI pieces ──
  const badgeClass =
    state.mode === "guided"   ? styles.badgeGuided   :
    state.mode === "practice" ? styles.badgePractice :
    state.mode === "mastery"  ? styles.badgeMastery  : styles.badgeChallenge;

  const modeLabel =
    state.mode === "guided"   ? "📖 Guided"   :
    state.mode === "practice" ? "⚡ Practice"  :
    state.mode === "mastery"  ? "🏅 Mastery"  : "🔥 Challenge";

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
          {state.mode === "guided" ? "LEARN" : state.mode === "practice" ? "PRACTICE" : state.mode === "mastery" ? "MASTERY" : "CHALLENGE"}
        </div>
      </div>
    </div>
  );

  // ── 0 hearts — overlay modal (not full screen takeover) ──
  // Rendered as overlay on top of the playing screen further down
  const HeartOutOverlay = showHeartOut ? (
    <div className={styles.heartOutOverlay}>
      <div className={styles.heartOutModal}>
        <div className={styles.heartOutIcon}>💔</div>
        <div className={styles.heartOutTitle}>Out of hearts!</div>
        <div className={styles.heartOutLine}>
          <ChideraAvatar size={28} mood="wrong" />
          <span>Don&apos;t worry — let&apos;s try this one again.</span>
        </div>
        <button className={styles.heartOutBtn} onClick={restartQuestion}>Try again →</button>
      </div>
    </div>
  ) : null;

  // ── NavBlock (question done) ──
  const NavBlock = ({ xpLabel }: { xpLabel: string }) => {
    const advance = () => {
      fallbackStepsRef.current = [];
      const nextIdx = state.questionIdx + 1;
      saveProgress(state.mode, nextIdx);
      dispatch({ type: "NEXT_QUESTION", nextIdx });
    };
    const finish = () => {
      if (!completedReported.current) {
        completedReported.current = true;
        onComplete({ success: true, score: 100, timeSpentSec: Math.round((Date.now() - startTime.current) / 1000), attemptsBeforeSuccess: totalTries.current, xpEarned: state.xp });
      }
      markModeDone(state.mode);
      dispatch({ type: "GO_TO_MISSION_COMPLETE" });
    };
    return (
      <div className={styles.doneZone}>
        <div className={styles.celebrationBanner}>
          <ChideraAvatar />
          <div className={styles.celebrationText}>
            <div className={styles.celebrationTitle}>
              {state.mode === "guided" ? "Well done! ✨" : state.mode === "practice" ? "Great work! 🌟" : "Solved it! 🔥"}
            </div>
            <div className={styles.celebrationSub}>
              {state.mode === "guided" ? "You followed every step — that builds real understanding." : "You worked it out yourself. That's the real test."}
            </div>
          </div>
        </div>
        <div className={styles.doneXp}>{xpLabel}</div>
        {hasMore
          ? <button className={styles.nextBtn} onClick={advance}>Next question →</button>
          : <button className={styles.nextBtn} onClick={finish}>🏆 Stage complete! →</button>
        }
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // CHALLENGE: think
  // ─────────────────────────────────────────────────────────────────────────────
  if (state.mode === "challenge" && chalPhase === "think") {
    return (
      <div className={styles.challengeRoot}>
        <div className={styles.playBg} />
        <Topbar />
        <div className={styles.scroll}>
          <MissionCard />

          {/* ── Challenge: try it yourself ── */}
          <div className={styles.chalTryZone}>
            <div className={styles.chalTryIcon}>🔥</div>
            <div className={styles.chalTryTitle}>Now you try</div>
            <div className={styles.chalTrySub}>Solve this on paper or in your head. Take your time.</div>

            <button className={styles.chalSolvedBtn}
              onClick={() => { if (dontUnderstandTimerRef.current) clearTimeout(dontUnderstandTimerRef.current); setChalPhase("pick"); }}>
              I have the solution →
            </button>

            {/* Appears after 12 seconds */}
            {dontUnderstandVisible && (
              <button className={styles.chalDontUnderstandBtn}
                onClick={() => { if (dontUnderstandTimerRef.current) clearTimeout(dontUnderstandTimerRef.current); dispatch({ type: "RESET_LIVES" }); setChalPhase("stepwise"); }}>
                I don&apos;t understand this one
              </button>
            )}
          </div>
        </div>
        <div className={styles.bottomSpacer} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHALLENGE: pick
  // ─────────────────────────────────────────────────────────────────────────────
  if (state.mode === "challenge" && chalPhase === "pick") {
    const choices = challengeChoices;
    if (choices.length === 0) {
      return (
        <div className={styles.challengeRoot}>
          <div className={styles.playBg} />
          <Topbar />
          <div className={styles.scroll}>
            <MissionCard />
            <div className={styles.unifiedZone}>
              <div className={styles.uzCoach}>
                <div className={styles.uzAvatar}><ChideraAvatar size={36} /></div>
                <div className={styles.uzCoachText}>
                  <span className={styles.uzWho}>Ms. Chidera</span>
                  <span className={styles.uzSpeech}>Answer options aren&apos;t set up yet. Let&apos;s work through it step by step!</span>
                </div>
              </div>
            </div>
            <div className={styles.thinkZone}>
              <button className={styles.thinkReadyBtn} onClick={() => { if (dontUnderstandTimerRef.current) clearTimeout(dontUnderstandTimerRef.current); dispatch({ type: "RESET_LIVES" }); setChalPhase("stepwise"); }}>
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
          <div className={styles.unifiedZone}>
            <div className={styles.uzCoach}>
              <div className={styles.uzAvatar}><ChideraAvatar size={36} /></div>
              <div className={styles.uzCoachText}>
                <span className={styles.uzWho}>Ms. Chidera</span>
                <span className={styles.uzSpeech}>Pick the correct answer. You solved it on paper — trust your working.</span>
                <div className={styles.uzMood}>Challenge</div>
              </div>
            </div>
            <div className={styles.challengePickZone}>
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
              {chalWrong === 1 && (
                <div className={styles.challengeWarning}>
                  ⚠️ Last chance — one more wrong and we&apos;ll solve it step by step (half points).
                </div>
              )}
            </div>
          </div>
        </div>
        <div className={styles.bottomSpacer} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHALLENGE: review_pick
  // ─────────────────────────────────────────────────────────────────────────────
  if (state.mode === "challenge" && chalPhase === "review_pick") {
    return (
      <div className={styles.playRoot}>
        <div className={styles.playBg} />
        <Topbar />
        <div className={styles.scroll}>
          <MissionCard />
          {reviewTrail.map((s, i) => (
            <div key={i} className={`${styles.stepRow} ${styles.stepRowVisible}`}>
              <div className={styles.stepLine}>
                <div className={`${styles.stepCircle} ${styles.stepDone}`}>✓</div>
                {i < reviewTrail.length - 1 && <div className={styles.stepTail} />}
              </div>
              <div className={styles.stepBody}>
                <div className={styles.stepLabel}>{s.label}</div>
                <div className={styles.trailDetail}>{s.detail}</div>
              </div>
            </div>
          ))}
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
  // ─────────────────────────────────────────────────────────────────────────────
  if (!activeStep && !questionDone) return null;

  // ─────────────────────────────────────────────────────────────────────────────
  // TRY-YOURSELF PHASE (every 3rd question in guided/practice)
  // ─────────────────────────────────────────────────────────────────────────────
  const tryXpLabel = state.mode === "guided" ? "+20 XP 🌟 Solved it yourself!" : "+40 XP 🔥 Independent solve!";
  const handleTryPick = (idx: number, correct: boolean) => {
    if (tryLocked) return;
    setTryLocked(true);
    if (correct) {
      setTryFeedback(prev => ({ ...prev, [idx]: "correct" }));
      const xpBonus = state.mode === "guided" ? 20 : 40;
      dispatch({ type: "EARN_XP", amount: xpBonus });
      if (currentQ) saveQuestionXp(currentQ, xpBonus);
      setTimeout(() => {
        const nextIdx = state.questionIdx + 1;
        saveProgress(state.mode, nextIdx);
        dispatch({ type: "NEXT_QUESTION", nextIdx });
      }, 1400);
    } else {
      setTryFeedback(prev => ({ ...prev, [idx]: "wrong" }));
      const newWrong = tryWrong + 1;
      setTryWrong(newWrong);
      setTimeout(() => {
        setTryFeedback({});
        setTryLocked(false);
        if (newWrong >= 2) { setTryPhase("off"); }
      }, 900);
    }
  };

  if (isTryQuestion && (tryPhase === "try" || tryPhase === "pick")) {
    return (
      <div className={styles.playRoot}>
        <div className={styles.playBg} />
        {HeartOutOverlay}
        <Topbar />
        <div className={styles.scroll}>
          <MissionCard />

          {tryPhase === "try" ? (
            // ── Show question + "I have the solution" ──
            <div className={styles.tryZone}>
              <div className={styles.tryBadge}>💡 Now you try</div>
              <div className={styles.trySub}>You've seen this concept twice. Try solving it on your own.</div>
              <button className={styles.tryHaveSolvedBtn}
                onClick={() => {
                  if (tryDontUnderstandTimerRef.current) clearTimeout(tryDontUnderstandTimerRef.current);
                  setTryPhase("pick");
                }}>
                I have the solution →
              </button>
              {tryDontUnderstand && (
                <button className={styles.tryDontUnderstandBtn}
                  onClick={() => {
                    if (tryDontUnderstandTimerRef.current) clearTimeout(tryDontUnderstandTimerRef.current);
                    setTryPhase("off");
                  }}>
                  I don't understand — show me the steps
                </button>
              )}
            </div>
          ) : (
            // ── Show MCQ options ──
            <div className={styles.tryZone}>
              <div className={styles.tryBadge}>Pick the correct answer</div>
              {tryWrong === 1 && (
                <div className={styles.tryWarning}>⚠️ One more attempt — get it right to earn double XP</div>
              )}
              <div className={styles.tryGrid}>
                {tryChoices.map((ch, i) => (
                  <button key={i}
                    className={[
                      styles.tryOptBtn,
                      tryFeedback[i] === "correct" ? styles.tryOptOk : "",
                      tryFeedback[i] === "wrong"   ? styles.tryOptNo : "",
                    ].join(" ")}
                    disabled={tryLocked}
                    onClick={() => handleTryPick(i, ch.correct)}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
              <button className={styles.tryDontUnderstandBtn}
                onClick={() => setTryPhase("off")}>
                I don't understand — walk me through it
              </button>
            </div>
          )}
        </div>
        <div className={styles.bottomSpacer} />
      </div>
    );
  }

  const xpLabel =
    state.mode === "guided"   ? "+10 XP 🎉" :
    state.mode === "practice" ? "+20 XP 🎉" :
    "+20 XP ⭐ (half points — solved with help)";

  // ── Stage card renderer ──
  const renderStage = (step: QuestionStep) => (
    <div className={styles.stage}>
      <div className={styles.stageLbl}>{step.lbl}</div>
      <div className={styles.stageBody}>
        {step.stageLines.map((row, ri) => (
          <div key={ri} className={styles.eqRow}>
            {row.map((token, ti) => {
              if ("op" in token) {
                return <span key={ti} className={styles.opSym}>{token.op}</span>;
              }
              // For multi steps: check if this term is locked or focused
              if (step.isMulti && step.termIndices) {
                const termPos = step.termIndices.indexOf(ti);
                if (termPos >= 0) {
                  const isLocked = multiLocked[ti] != null;
                  const isFocus  = !isLocked && termPos === multiDone;
                  return (
                    <span key={ti} className={[
                      styles.term,
                      isLocked ? styles.termLocked : "",
                      isFocus  ? styles.termFocus  : "",
                    ].join(" ")}>
                      {isLocked
                        ? <><span className={styles.termCheck}>✓</span>{multiLocked[ti]}</>
                        : <KaTeX tex={token.t} />}
                    </span>
                  );
                }
              }
              return <span key={ti} className={styles.term}><KaTeX tex={token.t} /></span>;
            })}
          </div>
        ))}
      </div>
      {/* Result reveal — slides in after correct */}
      <div className={`${styles.resultEq} ${resultRevealed ? styles.resultEqShow : ""}`}>
        <KaTeX tex={step.resultText} />
      </div>
    </div>
  );

  // ── Zone action body ──
  const renderAction = (step: QuestionStep) => {
    // Continue button — shown after correct pick, before next step loads
    if (showContinue) {
      const isLast = stepIdx >= effectiveSteps.length - 1;
      return (
        <div className={styles.zoneBody}>
          <button className={styles.ctaBtn} onClick={() => {
            setShowContinue(false);
            setResultRevealed(false);
            setPickedOpt(null);
            advanceStep(step);
          }}>
            {isLast ? "See the result →" : `Continue to step ${stepIdx + 2} →`}
          </button>
        </div>
      );
    }

    if (!beatsReady) {
      // Beats still playing — typing dots
      return (
        <div className={styles.dotsRow}>
          <span className={styles.dot} /><span className={styles.dot} /><span className={styles.dot} />
        </div>
      );
    }

    // ── isMulti: term-by-term opts ──
    if (step.isMulti && step.multiOpts) {
      const opts = step.multiOpts[multiDone];
      if (!opts) return null;
      return (
        <div className={styles.zoneBody}>
          <div className={styles.zoneLbl}>Simplify</div>
          <div className={styles.optRow}>
            {opts.map((opt, oi) => (
              <button key={oi}
                className={[
                  styles.optBtn,
                  pickedOpt?.idx === oi && pickedOpt.correct  ? styles.optOk : "",
                  pickedOpt?.idx === oi && !pickedOpt.correct ? styles.optNo : "",
                ].join(" ")}
                disabled={locked}
                onClick={() => {
                  if (locked) return;
                  if (opt.c) {
                    setPickedOpt({ idx: oi, correct: true });
                    setLocked(true);
                    const nextDone = multiDone + 1;
                    const termIdx  = step.termIndices![multiDone];
                    setTimeout(() => {
                      setMultiLocked(prev => ({ ...prev, [termIdx]: step.lockLabels![multiDone] }));
                      setPickedOpt(null);
                      if (nextDone < (step.multiOpts?.length ?? 0)) {
                        setMultiDone(nextDone);
                        setLocked(false);
                      } else {
                        handleCorrect(step);
                      }
                    }, 380);
                  } else {
                    setPickedOpt({ idx: oi, correct: false });
                    setTimeout(() => {
                      setPickedOpt(null);
                      setWrongNote(opt.n ?? "Not quite — try again.");
                      setCoachSpeech("Not quite — try again.");
                      setCoachMood("Try again");
                      if (state.mode !== "guided") dispatch({ type: "LOSE_LIFE" });
                    }, 350);
                  }
                }}
              >
                <KaTeX tex={opt.l} />
              </button>
            ))}
          </div>
          {wrongNote && <div className={styles.zoneNote}>{wrongNote}</div>}
        </div>
      );
    }

    // ── isOpts: compact value row ──
    if (step.isOpts && step.opts) {
      return (
        <div className={styles.zoneBody}>
          <div className={styles.zoneLbl}>Your move</div>
          <div className={styles.optRow}>
            {step.opts.map((opt, oi) => (
              <button key={oi}
                className={[
                  styles.optBtn,
                  pickedOpt?.idx === oi && pickedOpt.correct  ? styles.optOk  : "",
                  pickedOpt?.idx === oi && !pickedOpt.correct ? styles.optNo  : "",
                ].join(" ")}
                disabled={locked}
                onClick={() => {
                  if (locked) return;
                  if (opt.c) {
                    setPickedOpt({ idx: oi, correct: true });
                    setLocked(true);
                    setTimeout(() => handleCorrect(step), 400);
                  } else {
                    setPickedOpt({ idx: oi, correct: false });
                    setTimeout(() => { setPickedOpt(null); handleWrong(opt.n ?? ""); }, 350);
                  }
                }}
              >
                <KaTeX tex={opt.l} />
              </button>
            ))}
          </div>
          {wrongNote && <div className={styles.zoneNote}>{wrongNote}</div>}
        </div>
      );
    }

    // ── ops: full-width stacked operation buttons ──
    if (step.ops) {
      return (
        <div className={styles.zoneBody}>
          <div className={styles.zoneLbl}>Your move</div>
          <div className={styles.opBtns}>
            {step.ops.map((op, oi) => (
              <button key={oi}
                className={`${styles.opbBtn} ${op.correct && state.mode === "guided" ? styles.opbHi : ""}`}
                disabled={locked}
                onClick={() => {
                  if (locked) return;
                  if (op.correct) {
                    handleCorrect(step);
                  } else {
                    handleWrong(op.note ?? "");
                  }
                }}
              >
                <span className={styles.opbLabel}>{op.l}</span>
                <span className={styles.opbSym}>{op.s}</span>
              </button>
            ))}
          </div>
          {wrongNote && <div className={styles.zoneNote}>{wrongNote}</div>}
        </div>
      );
    }

    return null;
  };

  return (
    <div className={styles.playRoot}>
      <div className={styles.playBg} />
      {/* ── Hearts-out overlay — sits on top of everything ── */}
      {HeartOutOverlay}
      <Topbar />

      {isChallengeStepwise && (
        <div className={styles.chalStepwiseBanner}>
          <span>🔥 Challenge — work through the steps</span>
        </div>
      )}

      <div className={styles.scroll}>
        <MissionCard />

        {/* ── Solution trail — always visible ── */}
        <div className={styles.trailCollapse}>
          <button className={styles.trailCollapseBtn} onClick={() => setTrailOpen(o => !o)}>
            <span className={styles.trailCollapseChev}>{trailOpen ? "▲" : "⌄"}</span>
            Solution trail
            <span className={styles.trailCollapseBadge}>{completedSteps.length}</span>
          </button>
          {trailOpen && (
            <div className={styles.trailCollapseBody}>
              <div className={styles.trailHead}>Steps so far</div>
              {completedSteps.length === 0
                ? <div className={styles.trailEmpty}>Nothing yet.</div>
                : completedSteps.map((s, i) => (
                  <div key={i} className={styles.trailCollapseRow}>
                    <div className={styles.trailCollapseIc}>✓</div>
                    <div>
                      <div className={styles.trailCollapseLabel}>Step {i + 1}</div>
                      <div className={styles.trailCollapseTitle}>{s.label}</div>
                      <div className={styles.trailDetail}>{s.detail}</div>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        {/* ── Stage ── */}
        {activeStep && renderStage(activeStep)}

        {/* ── Thread connector ── */}
        {!questionDone && activeStep && beatsReady && !resultRevealed && !showContinue && (
          <div className={styles.thread}>
            <svg width="20" height="14" viewBox="0 0 20 14">
              <path d="M10 0 V14 M4 8 L10 14 L16 8" stroke="#ffb23c" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}

        {/* ── Unified coach + action zone ── */}
        {activeStep && (
          <div className={styles.unifiedZone}>
            <div className={styles.uzCoach}>
              <div className={styles.uzAvatar}><ChideraAvatar size={36} mood={coachMood === "Well done" ? "celebrate" : coachMood === "Try again" ? "wrong" : "explain"} /></div>
              <div className={styles.uzCoachText}>
                <span className={styles.uzWho}>
                  {isChallengeStepwise ? "Your turn" : "Ms. Chidera"}
                </span>
                <span key={`${stepIdx}-${coachSpeech}`} className={styles.uzSpeech}>
                  {isChallengeStepwise && !resultRevealed
                    ? (activeStep?.lbl || "What is the next step?")
                    : coachSpeech}
                </span>
                <div className={styles.uzMood}>
                  {isChallengeStepwise && !resultRevealed ? "Challenge" : coachMood}
                </div>
              </div>
            </div>
            {!questionDone && renderAction(activeStep)}
          </div>
        )}

        {/* ── Done — prototype style completion block ── */}
        {questionDone && (
          <>
            <div className={styles.compBlock}>
              <div className={styles.compCheck}>✓</div>
              <div className={styles.compTitle}>
                {state.mode === "guided" ? "System Solved" : state.mode === "practice" ? "Correct!" : "Solved!"}
              </div>
              <div className={styles.compAnswer}><KaTeX tex={currentQ.finalAnswer} /></div>
              <div className={styles.compXp}>{xpLabel}</div>
            </div>
            {hasMore
              ? <button className={styles.ctaBtn} onClick={() => { fallbackStepsRef.current = []; const nextIdx = state.questionIdx + 1; saveProgress(state.mode, nextIdx); dispatch({ type: "NEXT_QUESTION", nextIdx }); }}>Next question →</button>
              : <button className={styles.ctaBtn} onClick={() => { if (!completedReported.current) { completedReported.current = true; onComplete({ success: true, score: 100, timeSpentSec: Math.round((Date.now() - startTime.current) / 1000), attemptsBeforeSuccess: totalTries.current, xpEarned: state.xp }); } markModeDone(state.mode); dispatch({ type: "GO_TO_MISSION_COMPLETE" }); }}>🏆 Stage complete! →</button>
            }
          </>
        )}

      </div>
      <div className={styles.bottomSpacer} />
    </div>
  );
}