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
import { ChideraAvatar } from "./ChideraAvatar";
import { StepwiseHub } from "./StepwiseHub";
import { StepwiseMissionComplete } from "./StepwiseMissionComplete";
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
  caseHints?: string[];
  // mission metadata — used for per-question XP saving
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function payloadToQuestion(m: MissionEntry): StepwiseQuestion | null {
  const p = m.payload;
  const formula = p.formula as string | undefined;
  const steps   = p.steps   as QuestionStep[] | undefined;
  // Only match the legacy format where steps already have `choices` built in.
  // CoSoF steps have `operation` instead — those are handled by payloadToFormulaQuestion.
  if (!formula || !steps || steps.length === 0) return null;
  if (!steps[0].choices) return null; // not the legacy format — let next translator handle it
  return {
    goal:          (p.goal        as string) ?? "Solve",
    formula,
    topic:         (p.topic       as string) ?? "",
    finalAnswer:   (p.finalAnswer as string) ?? "",
    steps,
    answerChoices: p.answerChoices as { label: string; correct: boolean }[] | undefined,
    missionId:   m.id,
    topicId:     m.topicId,
    subtopicId:  m.subtopicId,
    xpReward:    m.xpReward,
  };
}

// ─── Formula/Steps payload translator ─────────────────────────────────────────
// Reads the Change-of-Subject JSON format:
//   { formula, goal, topic, finalAnswer, steps: [{label, eq, operation, isFinal, workingLines}] }
// and converts each step into a full QuestionStep with choices, coach text, etc.

function payloadToFormulaQuestion(m: MissionEntry): StepwiseQuestion | null {
  const p = m.payload;
  const formula     = p.formula as string | undefined;
  const goal        = p.goal    as string | undefined;
  const finalAnswer = p.finalAnswer as string | undefined;
  const rawSteps    = p.steps as Array<{
    label: string;
    eq: string;
    operation: string;
    isFinal?: boolean;
    workingLines?: WorkingLine[];
  }> | undefined;

  if (!formula) return null;
  // Challenge/Mastery missions have no steps — student solves on paper.
  // Still return a valid question so the MCQ pick phase works.
  if (!rawSteps || rawSteps.length === 0) {
    if (!p.answerChoices) return null; // nothing to show at all
    return {
      goal:        goal ?? "Make the subject",
      formula,
      topic:       (p.topic as string) ?? "Change of Subject",
      finalAnswer: finalAnswer ?? "",
      steps:       [],
      answerChoices: p.answerChoices as { label: string; correct: boolean }[],
      caseHints:   p.caseHints as string[] | undefined,
      missionId:   m.id,
      topicId:     m.topicId,
      subtopicId:  m.subtopicId,
      xpReward:    m.xpReward,
    };
  }
  // Only match if steps have the `operation` field — that's the CoSoF format.
  if (!(rawSteps[0] as Record<string, unknown>).operation) return null;

  const opDef = (op: string) =>
    OPERATION_DEFS[op] ?? { icon: "🔢", label: op, sub: "" };

  const steps: QuestionStep[] = rawSteps.map((s) => {
    // Build a specific label for this exact step, not the generic operation name
    const specificLabel = s.label; // e.g. "Subtract at from both sides"
    const specificIcon = (OPERATION_DEFS[s.operation] ?? { icon: "🔢" }).icon;

    // Wrong options: use the same operation category but with wrong-direction labels
    const wrongLabels: Record<string, string[]> = {
      subtract: ["Add to both sides", "Multiply both sides"],
      add:      ["Subtract from both sides", "Divide both sides"],
      divide:   ["Multiply both sides", "Add to both sides"],
      multiply: ["Divide both sides", "Subtract from both sides"],
      square:   ["Square root both sides", "Multiply both sides"],
      sqrt:     ["Square both sides", "Divide both sides"],
      rewrite:  ["Divide both sides", "Subtract from both sides"],
      solve:    ["Substitute back", "Add to both sides"],
    };
    const wrongIconMap: Record<string, string[]> = {
      subtract: ["➕","✖️"], add: ["➖","➗"], divide: ["✖️","➕"],
      multiply: ["➗","➖"], square: ["√","✖️"], sqrt: ["²","➗"],
      rewrite: ["➗","➖"], solve: ["🔄","➕"],
    };
    const wLabels = wrongLabels[s.operation] ?? ["Add to both sides", "Divide both sides"];
    const wIcons  = wrongIconMap[s.operation] ?? ["➕","➗"];

    const choices: StepChoice[] = shuffle([
      { label: specificLabel, sub: `Use this to isolate the target`, icon: specificIcon, correct: true, operation: s.operation },
      { label: wLabels[0], sub: `This would move things the wrong way`, icon: wIcons[0], correct: false, operation: "" },
      { label: wLabels[1], sub: `This is not the right inverse here`, icon: wIcons[1], correct: false, operation: "" },
    ]);

    const coachLines: Record<string, string> = {
      subtract: "We need to move things away from our target. Subtraction undoes addition — use it on both sides.",
      add:      "Something has been subtracted from our target. Add it to both sides to cancel it out.",
      divide:   "Our target is being multiplied by something. Divide both sides to undo that multiplication.",
      multiply: "Our target is being divided. Multiply both sides to clear that denominator.",
      square:   "There's a square root wrapping our target. Squaring both sides removes it — the root and the square cancel.",
      sqrt:     "Our target is squared. Take the square root of both sides — that undoes the square.",
      rewrite:  "The subject is isolated — just write it on the left to make it clear.",
      solve:    "We can now divide to find the value of our target variable.",
      substitute: "We know one variable — substitute it back into an equation to find the other.",
    };
    const coachWrongLines: Record<string, string> = {
      subtract: "Not quite. Look at what's connected to your target — is something being added to it? Undo that first.",
      add:      "Not quite. Something is being taken away from your target — what undoes subtraction?",
      divide:   "Not quite. Your target is being multiplied. What operation cancels multiplication?",
      multiply: "Not quite. Your target is in a denominator. Multiply both sides to bring it up.",
      square:   "Not quite. There's a square root here. What undoes a square root?",
      sqrt:     "Not quite. Your target is squared. What undoes squaring?",
      rewrite:  "Nearly there — just swap the sides so the subject is on the left.",
      solve:    "Not quite — we have one variable times a number. What undoes multiplication?",
      substitute: "Not quite — we know one variable already. Put it into the equation.",
    };

    return {
      trailLabel:     s.label,
      resultEq:       s.eq,
      coach:          coachLines[s.operation] ?? `${specificIcon} ${s.label}`,
      coachWrong:     coachWrongLines[s.operation] ?? "Not quite — think about the inverse of what's happening to the subject.",
      hint:           `Try: ${specificLabel}`,
      choiceQuestion: `${goal ?? "Make the subject"} — what's the next step?`,
      choices,
      workingLines:   s.workingLines,
    };
  });

  return {
    goal:        goal ?? "Make the subject",
    formula,
    topic:       (p.topic as string) ?? "Change of Subject",
    finalAnswer: finalAnswer ?? "",
    steps,
    answerChoices: p.answerChoices as { label: string; correct: boolean }[] | undefined,
    missionId:   m.id,
    topicId:     m.topicId,
    subtopicId:  m.subtopicId,
    xpReward:    m.xpReward,
  };
}

// Reads the simultaneous-equations-detective.json format (equations + solutionSteps)
// and converts it into the StepwiseQuestion shape the engine expects.
// This is completely additive — the original payloadToQuestion still handles
// content authored in the formula/steps format.

const OPERATION_DEFS: Record<string, { icon: string; label: string; sub: string }> = {
  // Simultaneous equations operations
  add:          { icon: "➕", label: "Add the equations",         sub: "Adds both equations together" },
  subtract:     { icon: "➖", label: "Subtract the equations",    sub: "Subtracts one equation from the other" },
  multiply_eq1: { icon: "✖️",  label: "Multiply equation 1",       sub: "Scales equation 1 by a factor" },
  multiply_eq2: { icon: "✖️",  label: "Multiply equation 2",       sub: "Scales equation 2 by a factor" },
  solve:        { icon: "🔢", label: "Divide to solve",            sub: "Isolates the variable" },
  substitute:   { icon: "🔄", label: "Substitute back",           sub: "Replaces a known value" },
  // Change of subject operations
  divide:       { icon: "➗", label: "Divide both sides",         sub: "Divides the whole expression on both sides" },
  multiply:     { icon: "✖️",  label: "Multiply both sides",       sub: "Multiplies the whole expression on both sides" },
  square:       { icon: "²",  label: "Square both sides",         sub: "Removes a square root by squaring" },
  sqrt:         { icon: "√",  label: "Square root both sides",    sub: "Removes a square by taking the root" },
  rewrite:      { icon: "✏️", label: "Rewrite with subject first", sub: "Swaps sides so the subject is on the left" },
};

// Wrong operation distractors per correct operation
const WRONG_OPS: Record<string, string[]> = {
  add:          ["subtract", "multiply_eq1", "multiply_eq2"],
  subtract:     ["add", "multiply_eq1", "multiply_eq2"],
  multiply_eq1: ["multiply_eq2", "add", "subtract"],
  multiply_eq2: ["multiply_eq1", "subtract", "add"],
  solve:        ["substitute", "add", "subtract"],
  substitute:   ["solve", "add", "subtract"],
  divide:       ["multiply", "subtract", "add"],
  multiply:     ["divide", "subtract", "add"],
  square:       ["sqrt", "multiply", "divide"],
  sqrt:         ["square", "divide", "multiply"],
  rewrite:      ["divide", "subtract", "add"],
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

  // answerChoices lives on the payload root for HARD missions — must be
  // forwarded here or the challenge pick phase always shows "not set up".
  const answerChoices = p.answerChoices as { label: string; correct: boolean }[] | undefined;

  return {
    goal: `Solve the simultaneous equations`,
    formula,
    topic: "Simultaneous Equations",
    finalAnswer,
    steps,
    answerChoices,
    missionId:  m.id,
    topicId:    m.topicId,
    subtopicId: m.subtopicId,
    xpReward:   m.xpReward,
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
      const q = payloadToQuestion(m) ?? payloadToFormulaQuestion(m) ?? payloadToDetectiveQuestion(m);
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

// ─── Working-line renderer — converts plain text fractions to KaTeX ───────────
// Converts "a / b" → \frac{a}{b}, ² → ^{2}, × → \times etc.
function toKaTeX(text: string): string {
  if (text.includes("\\")) return text; // already LaTeX
  let t = text
    .replace(/×/g, "\\times ")
    .replace(/÷/g, "\\div ")
    .replace(/([A-Za-z])\²/g, "$1^{2}")
    .replace(/([A-Za-z])\³/g, "$1^{3}");
  // Convert simple a / b patterns to \frac{a}{b}
  // Match: word(s)/word(s) but not ─── separators
  t = t.replace(/([A-Za-z0-9()π]+)\s*\/\s*([A-Za-z0-9()π]+)/g, (_, n, d) => `\\frac{${n}}{${d}}`);
  return t;
}

function WorkingLineText({ text }: { text: string }) {
  const hasMath = /[/×÷²³]|[A-Za-z]\d/.test(text) && !text.trim().startsWith("─");
  if (hasMath) return <KaTeX tex={toKaTeX(text)} />;
  return <span>{text}</span>;
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



type Screen = "hub" | "playing" | "missionComplete";

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

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function StepwiseSolverEngine({ config, onComplete }: EngineRuntimeProps) {
  const [state, dispatch] = useReducer(reduce, INITIAL_STATE);

  const shared             = ((config as Record<string, unknown>).shared as Record<string, unknown>) ?? {};
  const allMissions        = (shared._allMissions as MissionEntry[] | undefined) ?? [];
  const onBack             = (shared._onBack as (() => void) | undefined) ?? (() => {});
  const studentId          = (shared._studentId as string | undefined) ?? "anon";
  const gameId             = (shared._gameId    as string | undefined) ?? "game";
  // Read the locally-stored player display name for the hub welcome message.
  // Avoid importing localPlayerName at module level (SSR-safe; this component
  // is "use client" so window is available when this executes).
  const playerName = typeof window !== "undefined"
    ? (window.localStorage.getItem("exl:playerName") ?? undefined)
    : undefined;

  // ── Resume: read per-student progress from localStorage ──
  // Key: "exl_progress_{studentId}_{gameId}_{mode}"
  // Value: index of the next question to show (0-based)
  const progressKey = (mode: StepMode) => `exl_progress_${studentId}_${gameId}_${mode}`;
  // Sentinel stored when a mode is fully completed — value is intentionally
  // very large so getResume(mode, total) returns exactly `total` regardless
  // of how many questions exist (all questions show as done in the hub).
  const DONE_SENTINEL = 9999;
  const getResume = (mode: StepMode, total: number): number => {
    if (typeof window === "undefined") return 0;
    const saved = parseInt(localStorage.getItem(progressKey(mode)) ?? "0", 10);
    if (isNaN(saved)) return 0;
    // Clamp to total (not total-1) so a completed mode returns exactly `total`,
    // making every question's `done: i < resumeI` check true in makeHubQ.
    return Math.min(saved, total);
  };
  const saveProgress = (mode: StepMode, idx: number) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(progressKey(mode), String(idx));
  };
  // FIX: was clearProgress (removed the key → reset to 0 on return).
  // Now marks the mode as fully done so completed questions stay shown.
  const markModeDone = (mode: StepMode) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(progressKey(mode), String(DONE_SENTINEL));
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
  const wrongPickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTime  = useRef(Date.now());
  const totalTries = useRef(0);
  const completedReported = useRef(false);
  // Holds generated fallback steps for challenge questions that have no authored steps.
  // Populated when student gets 2 wrong picks — shows case hints as tap-through reveal.
  const fallbackStepsRef = useRef<QuestionStep[]>([]);

  const currentQ   = questions.length
    ? questions[Math.min(state.questionIdx, questions.length - 1)]
    : undefined;
  // Use fallback steps if the question has none (challenge/mastery MCQ format)
  const effectiveSteps = (currentQ?.steps.length ?? 0) > 0
    ? (currentQ?.steps ?? [])
    : fallbackStepsRef.current;
  const activeStep = effectiveSteps[stepIdx];
  const isFirstVisit = !state.seenFormulas.has(currentQ?.formula ?? "");
  const isTellMode   = state.mode === "guided" && isFirstVisit;
  const correctIdx   = activeStep?.choices?.findIndex(c => c.correct) ?? -1;
  const hasMore      = state.questionIdx + 1 < questions.length;

  // Challenge MCQ choices — shuffled once per question, stable across re-renders.
  // Must be declared here (not inside the conditional block below) so hook order is always the same.
  const challengeChoices = React.useMemo(
    () => shuffle([...(currentQ?.answerChoices ?? [])]),
    [state.questionIdx] // eslint-disable-line
  );

  const nextMode: StepMode | null =
    state.mode === "guided"   ? (practiceQ.length  > 0 ? "practice"  : null) :
    state.mode === "practice" ? (challengeQ.length > 0 ? "challenge" : null) : null;

  const isChallengeStepwise = state.mode === "challenge" && chalPhase === "stepwise";
  const showHearts = state.mode === "practice" || state.mode === "challenge";

  // Shuffle choices per step for practice + challenge stepwise
  useEffect(() => {
    if (!activeStep) return;
    const choices = activeStep.choices ?? [];
    const shouldShuffle = state.mode === "practice" || isChallengeStepwise;
    setShuffledChoices(shouldShuffle ? shuffle(choices) : choices);
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
      // Cancel any pending wrong-pick unlock timeout — it would corrupt state
      // if it fired while the heart-out screen is showing, causing the black freeze.
      if (wrongPickTimeoutRef.current) {
        clearTimeout(wrongPickTimeoutRef.current);
        wrongPickTimeoutRef.current = null;
      }
      setLocked(false);
      setFeedback({});
      setShowHeartOut(true);
    }
  }, [state.lives, showHearts, questionDone]);

  const restartQuestion = useCallback(() => {
    if (wrongPickTimeoutRef.current) {
      clearTimeout(wrongPickTimeoutRef.current);
      wrongPickTimeoutRef.current = null;
    }
    fallbackStepsRef.current = [];
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

  // ── Per-question XP: fire-and-forget POST immediately when a question
  // completes. This means the student sees their XP grow even if they
  // never finish the full mode. The final onComplete() call at mode end
  // sends the session total xpEarned too, but the server's LocalDbAdapter
  // uses the first recorded xpEarned (the per-question posts) as an
  // additive tally — duplicate prevention is handled by only posting the
  // delta for THAT question, not the running total.
  const saveQuestionXp = useCallback((q: StepwiseQuestion, xpAmount: number) => {
    if (!q.missionId || !q.topicId) return; // can't save without identifiers
    const body = {
      studentId,
      gameId,
      missionId: q.missionId,
      topicId: q.topicId,
      subtopicId: q.subtopicId,
      success: true,
      rawOutcome: { xpEarned: xpAmount, perQuestion: true },
      completedAt: new Date().toISOString(),
    };
    fetch("/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {
      // Offline — the main onComplete() will handle it at mode end via attemptQueue
    });
  }, [studentId, gameId]);

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
      saveQuestionXp(currentQ, xpAmount);
    } else {
      setCompletedSteps(prev => [...prev, newStep]);
      setStepIdx(prev => prev + 1);
      setLocked(false);
      setFeedback({});
    }
  }, [currentQ, state, saveQuestionXp]); // eslint-disable-line

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
        const isLast  = stepIdx >= effectiveSteps.length - 1;

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
      wrongPickTimeoutRef.current = setTimeout(() => { setFeedback({}); setLocked(false); }, 1400);
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
      saveQuestionXp(currentQ, 40);
      const trail = effectiveSteps.map(s => ({ label: s.trailLabel, eq: s.resultEq }));
      setReviewTrail(trail);
      setTimeout(() => { setChalPhase("review_pick"); setChalLocked(false); }, 600);
    } else {
      setChalFeedback(prev => ({ ...prev, [idx]: "wrong" }));
      dispatch({ type: "LOSE_LIFE" });
      const newWrong = chalWrong + 1;
      setChalWrong(newWrong);
      if (newWrong >= 2) {
        dispatch({ type: "RESET_LIVES" });
        if (effectiveSteps.length === 0) {
          // Challenge mission has no authored steps — build a reveal-only walkthrough
          // from caseHints + finalAnswer so the student sees the solution method.
          const hints = currentQ.caseHints ?? [];
          fallbackStepsRef.current = [
            ...hints.map((hint, i) => ({
              trailLabel:     `Step ${i + 1}`,
              resultEq:       hint,
              coach:          hint,
              coachWrong:     "",
              hint:           "",
              choiceQuestion: "Tap to continue",
              choices:        [{ icon: "→", label: "Continue", sub: "", correct: true, operation: "next" }],
              workingLines:   undefined,
            })),
            {
              trailLabel:     "Final answer",
              resultEq:       currentQ.finalAnswer,
              coach:          `The correct answer is: ${currentQ.finalAnswer}`,
              coachWrong:     "",
              hint:           "",
              choiceQuestion: "Tap to confirm",
              choices:        [{ icon: "✓", label: "Got it", sub: "", correct: true, operation: "next" }],
              workingLines:   undefined,
            },
          ];
        }
        setTimeout(() => { setChalPhase("stepwise"); setChalLocked(false); setStepIdx(0); }, 1000);
      } else {
        setTimeout(() => setChalLocked(false), 1200);
      }
    }
  }, [chalLocked, currentQ, chalWrong, saveQuestionXp]);

  // ── Hub ──
  if (state.screen === "hub") {
    const modeQ = state.mode === "guided" ? guidedQ : state.mode === "practice" ? practiceQ : challengeQ;
    const rawResumeIdx = getResume(state.mode, modeQ.length);
    const isModeDone = rawResumeIdx >= modeQ.length;
    const resumeIdx = isModeDone ? 0 : rawResumeIdx;
    const resumeLabel = !isModeDone && resumeIdx > 0 ? `Continue from Q${resumeIdx + 1} →` : undefined;
    const handleStart = () => dispatch({ type: "START_PLAY", resumeIdx });
    const makeHubQ = (qs: StepwiseQuestion[], mode: StepMode) => {
      const resumeI = getResume(mode, qs.length);
      return qs.map((q, i) => ({
        title: q.goal || q.formula,
        missionKey: `${mode}-${i}`,
        done: i < resumeI,
      }));
    };
    return (
      <StepwiseHub
        currentMode={state.mode}
        onSelectMode={(mode) => dispatch({ type: "SELECT_MODE", mode })}
        hasPractice={practiceQ.length > 0}
        hasChallenge={challengeQ.length > 0}
        onBack={onBack}
        onStart={handleStart}
        resumeLabel={resumeLabel}
        studentName={playerName}
        guidedQuestions={makeHubQ(guidedQ, "guided")}
        practiceQuestions={makeHubQ(practiceQ, "practice")}
        challengeQuestions={makeHubQ(challengeQ, "challenge")}
      />
    );
  }

  // ── Mission Complete (stage finished) ──
  if (state.screen === "missionComplete") {
    const makeHubQ = (qs: StepwiseQuestion[], mode: StepMode) => {
      const resumeI = getResume(mode, qs.length);
      return qs.map((q, i) => ({
        title: q.goal || q.formula,
        missionKey: `${mode}-${i}`,
        done: i < resumeI,
      }));
    };
    const nextMode: StepMode | null =
      state.mode === "guided" ? (practiceQ.length > 0 ? "practice" : null) :
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
          const resumeIdx = rawIdx >= targetTotal ? 0 : rawIdx;
          dispatch({ type: "GO_TO_MODE", mode: nextMode, resumeIdx });
        }}
        onReplay={() => {
          dispatch({ type: "START_PLAY", resumeIdx: 0 });
        }}
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
      fallbackStepsRef.current = [];
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
          xpEarned: state.xp,
        });
      }
      if (goToMode) {
        const targetTotal = goToMode === "practice" ? practiceQ.length : goToMode === "challenge" ? challengeQ.length : guidedQ.length;
        const rawIdx = getResume(goToMode, targetTotal);
        const resumeIdx = rawIdx >= targetTotal ? 0 : rawIdx;
        dispatch({ type: "GO_TO_MODE", mode: goToMode, resumeIdx });
      } else {
        // Show the maths-specific mission complete screen
        markModeDone(state.mode);
        dispatch({ type: "GO_TO_MISSION_COMPLETE" });
      }
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
          <button className={styles.nextBtn} onClick={() => {
            markModeDone(state.mode);
            finish();
          }}>
            🏆 Stage complete! →
          </button>
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
    const choices = challengeChoices;

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
            Step <strong>{questionDone ? effectiveSteps.length : stepIdx + 1}/{effectiveSteps.length}</strong>
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
            {(shuffledChoices ?? []).map((ch, i) => (
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
                      : `Complete the missing value — ${activeStep?.trailLabel?.toLowerCase() ?? "fill in the step"}`}
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
                            <WorkingLineText text={line.text.replace("?", line.blank!.answer)} />
                          </div>
                        );
                      }
                      return <div key={i} className={styles.wpContextLine}><WorkingLineText text={line.text} /></div>;
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
                      <WorkingLineText text={question} />{question.trimEnd().endsWith("=") ? " " : " = "}<span className={styles.wpQuestionSlot}>
                        {blankDone ? activeLine.blank.answer : "?"}
                      </span>
                    </div>
                    {/* Options — shuffled so correct answer isn't always first */}
                    <div className={styles.wpOptions}>
                      {shuffle([...activeLine.blank.options]).map((opt, oi) => (
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
                      <div className={styles.wpWrong}>Not quite — look at both sides carefully</div>
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