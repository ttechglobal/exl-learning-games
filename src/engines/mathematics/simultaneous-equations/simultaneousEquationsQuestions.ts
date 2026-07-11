/**
 * simultaneousEquationsQuestions.ts
 *
 * Question bank for the Simultaneous Equations Detective engine.
 *
 * STRUCTURE per question:
 *   - Two equations displayed at the top
 *   - Steps: each step is one "operation" (multiply/add/subtract/solve/substitute)
 *     The student picks the operation, confirms, then an MCQ asks what the
 *     result equation is after applying it.
 *
 * TIERS:
 *   learn      — coefficients already match for direct elimination
 *   challenge  — one scaling step needed before elimination
 *   master     — both equations may need scaling; student chooses variable to eliminate
 */

export interface SimStep {
  /** What the student must choose */
  operation: SimOp;
  /** Multiply factor (if operation is scale_eq1 or scale_eq2) */
  factor?: number;
  /** Equation that changes after this operation */
  changedEq?: "eq1" | "eq2" | "result";
  /** Text shown in the equation board after applying this step */
  resultLines: string[];
  /** Owl guidance (Learn tier) */
  mascot: string;
  /** Compact hint for Challenge/Master */
  hint: string;
  /** MCQ: what does the result simplify to? */
  mcqQuestion: string;   // e.g. "What does 2y = 6 simplify to?"
  mcqCorrect: string;    // correct answer
  mcqWrong: string[];    // 2–3 distractors
}

export type SimOp =
  | "add_eqs"       // Add Eq1 + Eq2
  | "sub_eq2"       // Eq1 − Eq2
  | "sub_eq1"       // Eq2 − Eq1
  | "scale_eq1"     // Multiply Eq1 by factor
  | "scale_eq2"     // Multiply Eq2 by factor
  | "solve"         // Divide to isolate one variable
  | "substitute";   // Sub found value back in

export interface SimQuestion {
  /** Short label shown above equations */
  caseId: string;
  /** The two equations as display strings */
  eq1: string;
  eq2: string;
  /** What to find */
  goal: string;
  /** Final answer: x = ?, y = ? */
  finalAnswer: string;
  /** Step sequence */
  steps: SimStep[];
}

// ── Helper ────────────────────────────────────────────────────────────────────
const q = (data: SimQuestion): SimQuestion => data;

// ════════════════════════════════════════════════════════════════════════════
// LEARN TIER — direct elimination, no scaling needed
// ════════════════════════════════════════════════════════════════════════════

export const LEARN_QUESTIONS: SimQuestion[] = [

  q({
    caseId: "L1",
    eq1: "x + y = 8",
    eq2: "x − y = 2",
    goal: "Find x and y",
    finalAnswer: "x = 5,  y = 3",
    steps: [
      {
        operation: "add_eqs",
        resultLines: ["x + y = 8", "+ x − y = 2", "──────────", "2x = 10"],
        mascot: "Look! <strong>y</strong> and <strong>−y</strong> are opposites — adding the equations makes y disappear! Let's <strong>add</strong> them.",
        hint: "y coefficients are +1 and −1 — adding cancels y.",
        mcqQuestion: "After adding, what does 2x simplify to?",
        mcqCorrect: "x = 5",
        mcqWrong: ["x = 4", "x = 10", "x = 3"],
      },
      {
        operation: "solve",
        changedEq: "result",
        resultLines: ["2x = 10", "x = 5"],
        mascot: "2x = 10. Divide both sides by 2 to find <strong>x</strong>.",
        hint: "Divide 2x = 10 by 2.",
        mcqQuestion: "2x = 10, so x = ?",
        mcqCorrect: "5",
        mcqWrong: ["2", "10", "20"],
      },
      {
        operation: "substitute",
        resultLines: ["x + y = 8", "5 + y = 8", "y = 3"],
        mascot: "x = 5. Put it into the first equation. <strong>5 + y = 8</strong> — now solve for y.",
        hint: "Sub x = 5 into x + y = 8.",
        mcqQuestion: "5 + y = 8, so y = ?",
        mcqCorrect: "3",
        mcqWrong: ["13", "2", "4"],
      },
    ],
  }),

  q({
    caseId: "L2",
    eq1: "2x + y = 7",
    eq2: "2x − y = 3",
    goal: "Find x and y",
    finalAnswer: "x = 2.5,  y = 2",
    steps: [
      {
        operation: "add_eqs",
        resultLines: ["2x + y = 7", "+ 2x − y = 3", "──────────", "4x = 10"],
        mascot: "<strong>y</strong> and <strong>−y</strong> cancel when we add. Use <strong>Add Equations</strong>.",
        hint: "Add to cancel y.",
        mcqQuestion: "After adding, 4x = ?",
        mcqCorrect: "4x = 10",
        mcqWrong: ["4x = 4", "4x = 21", "2x = 10"],
      },
      {
        operation: "solve",
        changedEq: "result",
        resultLines: ["4x = 10", "x = 2.5"],
        mascot: "Divide 4x = 10 by 4 to get x.",
        hint: "4x = 10 ÷ 4.",
        mcqQuestion: "4x = 10, so x = ?",
        mcqCorrect: "2.5",
        mcqWrong: ["4", "5", "2"],
      },
      {
        operation: "substitute",
        resultLines: ["2(2.5) + y = 7", "5 + y = 7", "y = 2"],
        mascot: "Put x = 2.5 into equation 1. <strong>5 + y = 7</strong>.",
        hint: "Sub x = 2.5 into 2x + y = 7.",
        mcqQuestion: "5 + y = 7, so y = ?",
        mcqCorrect: "2",
        mcqWrong: ["12", "3", "1"],
      },
    ],
  }),

  q({
    caseId: "L3",
    eq1: "3x + 2y = 11",
    eq2: "x + 2y = 5",
    goal: "Find x and y",
    finalAnswer: "x = 3,  y = 1",
    steps: [
      {
        operation: "sub_eq2",
        resultLines: ["3x + 2y = 11", "− x + 2y = 5", "──────────", "2x = 6"],
        mascot: "<strong>2y</strong> appears in both equations — subtracting Eq2 from Eq1 removes it.",
        hint: "2y matches — subtract to eliminate.",
        mcqQuestion: "After subtracting, 2x = ?",
        mcqCorrect: "2x = 6",
        mcqWrong: ["2x = 16", "4x = 6", "2x = 8"],
      },
      {
        operation: "solve",
        resultLines: ["2x = 6", "x = 3"],
        mascot: "Divide both sides by 2.",
        hint: "2x = 6, divide by 2.",
        mcqQuestion: "2x = 6, so x = ?",
        mcqCorrect: "3",
        mcqWrong: ["6", "2", "12"],
      },
      {
        operation: "substitute",
        resultLines: ["3 + 2y = 5", "2y = 2", "y = 1"],
        mascot: "Sub x = 3 into x + 2y = 5.",
        hint: "Replace x with 3 in Eq2.",
        mcqQuestion: "2y = 2, so y = ?",
        mcqCorrect: "1",
        mcqWrong: ["4", "2", "0"],
      },
    ],
  }),

];

// ════════════════════════════════════════════════════════════════════════════
// CHALLENGE TIER — one scaling step needed
// ════════════════════════════════════════════════════════════════════════════

export const CHALLENGE_QUESTIONS: SimQuestion[] = [

  q({
    caseId: "C1",
    eq1: "x + y = 5",
    eq2: "2x + y = 8",
    goal: "Find x and y",
    finalAnswer: "x = 3,  y = 2",
    steps: [
      {
        operation: "sub_eq1",
        resultLines: ["2x + y = 8", "− x + y = 5", "──────────", "x = 3"],
        mascot: "<strong>y</strong> matches in both. Subtract Eq1 from Eq2 to cancel y — and you get x directly!",
        hint: "y matches — subtract Eq1 from Eq2.",
        mcqQuestion: "After subtracting, what do you get directly?",
        mcqCorrect: "x = 3",
        mcqWrong: ["x = 2", "2x = 6", "y = 3"],
      },
      {
        operation: "substitute",
        resultLines: ["3 + y = 5", "y = 2"],
        mascot: "x = 3. Put it back into Eq1 to find y.",
        hint: "Sub x = 3 into x + y = 5.",
        mcqQuestion: "3 + y = 5, so y = ?",
        mcqCorrect: "2",
        mcqWrong: ["8", "3", "1"],
      },
    ],
  }),

  q({
    caseId: "C2",
    eq1: "2x + 3y = 12",
    eq2: "x + y = 5",
    goal: "Find x and y",
    finalAnswer: "x = 3,  y = 2",
    steps: [
      {
        operation: "scale_eq2",
        factor: 2,
        resultLines: ["2x + 3y = 12", "2x + 2y = 10  (Eq2 × 2)"],
        mascot: "x coefficients need to match before we can eliminate. Multiply <strong>Eq2 × 2</strong> to make both 2x.",
        hint: "Multiply Eq2 by 2 to match the x coefficient.",
        mcqQuestion: "After ×2, Eq2 becomes?",
        mcqCorrect: "2x + 2y = 10",
        mcqWrong: ["2x + 3y = 10", "4x + 2y = 10", "2x + 2y = 12"],
      },
      {
        operation: "sub_eq2",
        resultLines: ["2x + 3y = 12", "− 2x + 2y = 10", "──────────", "y = 2"],
        mascot: "Now 2x matches — subtract to cancel x. You get y directly!",
        hint: "Subtract new Eq2 from Eq1.",
        mcqQuestion: "After subtracting, what do you get?",
        mcqCorrect: "y = 2",
        mcqWrong: ["y = 1", "2y = 4", "x = 2"],
      },
      {
        operation: "substitute",
        resultLines: ["x + 2 = 5", "x = 3"],
        mascot: "y = 2. Sub back into x + y = 5.",
        hint: "Put y = 2 into Eq2.",
        mcqQuestion: "x + 2 = 5, so x = ?",
        mcqCorrect: "3",
        mcqWrong: ["7", "2", "4"],
      },
    ],
  }),

  q({
    caseId: "C3",
    eq1: "3x − 2y = 4",
    eq2: "x + y = 7",
    goal: "Find x and y",
    finalAnswer: "x = 18/5,  y = 17/5",
    steps: [
      {
        operation: "scale_eq2",
        factor: 2,
        resultLines: ["3x − 2y = 4", "2x + 2y = 14  (Eq2 × 2)"],
        mascot: "y coefficients are −2 and +1. Multiply <strong>Eq2 × 2</strong> to get +2y — then they cancel when added.",
        hint: "Multiply Eq2 by 2 to get ±2y, then add.",
        mcqQuestion: "Eq2 × 2 gives?",
        mcqCorrect: "2x + 2y = 14",
        mcqWrong: ["2x + 2y = 7", "3x + 2y = 14", "2x + y = 14"],
      },
      {
        operation: "add_eqs",
        resultLines: ["3x − 2y = 4", "+ 2x + 2y = 14", "──────────", "5x = 18"],
        mascot: "−2y and +2y cancel! Add to eliminate y.",
        hint: "Add: −2y + 2y = 0.",
        mcqQuestion: "After adding, 5x = ?",
        mcqCorrect: "5x = 18",
        mcqWrong: ["5x = 10", "5x = 8", "3x = 18"],
      },
      {
        operation: "solve",
        resultLines: ["5x = 18", "x = 18/5 = 3.6"],
        mascot: "Divide both sides by 5.",
        hint: "5x = 18, divide by 5.",
        mcqQuestion: "5x = 18, so x = ?",
        mcqCorrect: "3.6",
        mcqWrong: ["5", "2.8", "4"],
      },
      {
        operation: "substitute",
        resultLines: ["3.6 + y = 7", "y = 3.4"],
        mascot: "Sub x = 3.6 back into x + y = 7.",
        hint: "Put x = 3.6 into Eq2.",
        mcqQuestion: "3.6 + y = 7, so y = ?",
        mcqCorrect: "3.4",
        mcqWrong: ["2.4", "4.4", "3.6"],
      },
    ],
  }),

];

// ════════════════════════════════════════════════════════════════════════════
// MASTER TIER — both equations may need scaling, student chooses strategy
// ════════════════════════════════════════════════════════════════════════════

export const MASTER_QUESTIONS: SimQuestion[] = [

  q({
    caseId: "M1",
    eq1: "2x + 3y = 13",
    eq2: "3x − y = 3",
    goal: "Find x and y",
    finalAnswer: "x = 2,  y = 3",
    steps: [
      {
        operation: "scale_eq2",
        factor: 3,
        resultLines: ["2x + 3y = 13", "9x − 3y = 9  (Eq2 × 3)"],
        mascot: "3y in Eq1, −y in Eq2. Multiply Eq2 by 3 to get −3y — adding cancels y.",
        hint: "×3 Eq2 to match y coefficients.",
        mcqQuestion: "Eq2 × 3 becomes?",
        mcqCorrect: "9x − 3y = 9",
        mcqWrong: ["6x − 3y = 9", "9x − y = 9", "9x − 3y = 3"],
      },
      {
        operation: "add_eqs",
        resultLines: ["2x + 3y = 13", "+ 9x − 3y = 9", "──────────", "11x = 22"],
        mascot: "+3y and −3y cancel. Add!",
        hint: "3y + (−3y) = 0.",
        mcqQuestion: "After adding, what is 11x?",
        mcqCorrect: "11x = 22",
        mcqWrong: ["11x = 4", "11x = 9", "10x = 22"],
      },
      {
        operation: "solve",
        resultLines: ["11x = 22", "x = 2"],
        mascot: "Divide by 11.",
        hint: "11x = 22 ÷ 11.",
        mcqQuestion: "11x = 22, x = ?",
        mcqCorrect: "2",
        mcqWrong: ["11", "4", "22"],
      },
      {
        operation: "substitute",
        resultLines: ["3(2) − y = 3", "6 − y = 3", "y = 3"],
        mascot: "Sub x = 2 into Eq2.",
        hint: "Put x = 2 into 3x − y = 3.",
        mcqQuestion: "6 − y = 3, so y = ?",
        mcqCorrect: "3",
        mcqWrong: ["9", "2", "1"],
      },
    ],
  }),

  q({
    caseId: "M2",
    eq1: "5x − 2y = 1",
    eq2: "3x + 4y = 13",
    goal: "Find x and y",
    finalAnswer: "x = 1,  y = 2",
    steps: [
      {
        operation: "scale_eq1",
        factor: 2,
        resultLines: ["10x − 4y = 2  (Eq1 × 2)", "3x + 4y = 13"],
        mascot: "−2y in Eq1, +4y in Eq2. Multiply Eq1 by 2 to get −4y — then adding cancels y.",
        hint: "×2 Eq1 to get −4y.",
        mcqQuestion: "Eq1 × 2 becomes?",
        mcqCorrect: "10x − 4y = 2",
        mcqWrong: ["10x − 2y = 2", "5x − 4y = 2", "10x − 4y = 1"],
      },
      {
        operation: "add_eqs",
        resultLines: ["10x − 4y = 2", "+ 3x + 4y = 13", "──────────", "13x = 15"],
        mascot: "−4y and +4y cancel. Add!",
        hint: "−4y + 4y = 0. Add both equations.",
        mcqQuestion: "After adding, 13x = ?",
        mcqCorrect: "13x = 15",
        mcqWrong: ["13x = 14", "13x = 11", "13x = 2"],
      },
      {
        operation: "solve",
        resultLines: ["13x = 15", "x ≈ 1.15"],
        mascot: "Divide 13x = 15 by 13. (This one is a decimal!)",
        hint: "15 ÷ 13 ≈ 1.15.",
        mcqQuestion: "13x = 15, x ≈ ?",
        mcqCorrect: "1.15",
        mcqWrong: ["1.5", "0.87", "2"],
      },
      {
        operation: "substitute",
        resultLines: ["5(1.15) − 2y = 1", "5.75 − 2y = 1", "2y = 4.75", "y ≈ 2.38"],
        mascot: "Sub x ≈ 1.15 into Eq1 and solve for y.",
        hint: "Put x into 5x − 2y = 1.",
        mcqQuestion: "After substituting, y ≈ ?",
        mcqCorrect: "2.38",
        mcqWrong: ["1.9", "3.1", "2"],
      },
    ],
  }),

];

// ── Tier lookup ───────────────────────────────────────────────────────────────

export const TIER_QUESTIONS: Record<string, SimQuestion[]> = {
  learn:     LEARN_QUESTIONS,
  challenge: CHALLENGE_QUESTIONS,
  master:    MASTER_QUESTIONS,
};

export const OPERATION_LABELS: Record<SimOp, { label: string; icon: string; sublabel: string }> = {
  add_eqs:    { icon: "⊕", label: "Add Equations",         sublabel: "Eq1 + Eq2" },
  sub_eq2:    { icon: "⊖", label: "Subtract Eq2",          sublabel: "Eq1 − Eq2" },
  sub_eq1:    { icon: "⊖", label: "Subtract Eq1",          sublabel: "Eq2 − Eq1" },
  scale_eq1:  { icon: "×", label: "Scale Equation 1",      sublabel: "× factor" },
  scale_eq2:  { icon: "×", label: "Scale Equation 2",      sublabel: "× factor" },
  solve:      { icon: "÷", label: "Solve for Variable",    sublabel: "isolate one var" },
  substitute: { icon: "→", label: "Substitute Back",       sublabel: "find 2nd variable" },
};