// ─────────────────────────────────────────────────────────────
//  EXL Maths Engine — MathsEngine.ts
//  Pure functions. No React. No UI.
//
//  Implements the Maths Coach decision loop:
//  PARSE → COMPARE → CHECK EQUIVALENCE →
//  INFER TRANSFORMATION → VALIDATE → DIAGNOSE MISTAKE →
//  EVALUATE PROGRESS → SELECT SCAFFOLDING → GENERATE RESPONSE
// ─────────────────────────────────────────────────────────────

// ════════════════════════════════════════════════════
// TRANSFORMATION TYPES
// ════════════════════════════════════════════════════
export type TransformationType =
  | "ADD_BOTH_SIDES"
  | "SUBTRACT_BOTH_SIDES"
  | "MULTIPLY_BOTH_SIDES"
  | "DIVIDE_BOTH_SIDES"
  | "SIMPLIFY"
  | "EXPAND"
  | "FACTOR"
  | "COLLECT_LIKE_TERMS"
  | "REORDER_EQUATION"
  | "MOVE_TERM"
  | "SUBSTITUTE"
  | "CROSS_MULTIPLY"
  | "UNKNOWN";

// ════════════════════════════════════════════════════
// MISTAKE TYPES
// ════════════════════════════════════════════════════
export type MistakeType =
  | "INVERSE_OPERATION_ERROR"
  | "ONE_SIDE_ONLY"
  | "SIGN_ERROR"
  | "ARITHMETIC_ERROR"
  | "DISTRIBUTION_ERROR"
  | "LIKE_TERMS_ERROR"
  | "DIVISION_ERROR"
  | "VARIABLE_DROPPED"
  | "TERM_DROPPED"
  | "INVALID_CANCELLATION"
  | "WRONG_SUBSTITUTION"
  | "PREMATURE_OPERATION"
  | "UNPRODUCTIVE_VALID"
  | "UNKNOWN_MATHEMATICAL_ERROR";

// ════════════════════════════════════════════════════
// CONCEPTUAL GOALS
// ════════════════════════════════════════════════════
export type ConceptualGoalType =
  | "REMOVE_ADDITIVE_CONSTANT"
  | "REMOVE_MULTIPLICATIVE_COEFFICIENT"
  | "COLLECT_VARIABLE_TERMS"
  | "CLEAR_FRACTION"
  | "CLEAR_BRACKET"
  | "ISOLATE_VARIABLE"
  | "FACTORISE"
  | "APPLY_ZERO_FACTOR_LAW"
  | "FREE_FORM";        // challenge / assisted — no prescribed goal

export interface ConceptualGoal {
  type: ConceptualGoalType;
  // Human-readable description for the coach
  description: string;
  // What the target mathematical state looks like numerically
  // Condition function: given the current equation's lhs/rhs evaluated at a point,
  // does it represent the desired state?
  // e.g., REMOVE_ADDITIVE_CONSTANT = lhs has no additive constant when evaluated without the variable
  isSatisfied: (lhs: string, rhs: string, vars: string[], knownAnswer: Record<string, number>) => boolean;
  // Preferred transformation types to achieve this goal
  preferredTransforms: TransformationType[];
  // Coach message when the goal is first introduced
  intro: string;
  // What the coach says when this goal is achieved
  achieved: string;
}

// ════════════════════════════════════════════════════
// SCAFFOLDING LEVELS
// ════════════════════════════════════════════════════
export type ScaffoldLevel = 0 | 1 | 2 | 3 | 4;
// 0 = OBSERVE, 1 = PROMPT, 2 = CONCEPT CLUE, 3 = ACTION GUIDANCE, 4 = DEMONSTRATE

// ════════════════════════════════════════════════════
// STEP EVALUATION RESULT
// ════════════════════════════════════════════════════
export type StepValidity = "VALID_PRODUCTIVE" | "VALID_UNPRODUCTIVE" | "INVALID";

export interface StepEvaluation {
  validity: StepValidity;
  transformation: TransformationType;
  mistake?: MistakeType;
  coachMessage: string;
  newScaffoldLevel: ScaffoldLevel;
  goalAchieved: boolean;
  nextGoalIntro?: string;
}

// ════════════════════════════════════════════════════
// NUMERICAL HELPERS (shared with Canvas)
// ════════════════════════════════════════════════════
export function normExpr(s: string): string {
  return s.trim()
    .replace(/[−–—\u2212\u2010\u2011\u2012\u2013\u2014]/g, "-")
    .replace(/[×·]/g, "*").replace(/÷/g, "/")
    .replace(/²/g, "^2").replace(/³/g, "^3")
    .replace(/π/g, "3.14159265358979")
    .replace(/√/g, "Math.sqrt")
    .toLowerCase().replace(/\s+/g, "");
}

function insertImplicitMul(s: string): string {
  let prev = "", r = s, i = 0;
  while (r !== prev && i < 12) {
    prev = r;
    r = r
      .replace(/([0-9])\(/g, "$1*(")
      .replace(/\)([0-9a-z(])/g, ")*$1")
      .replace(/([0-9])([a-z])/g, "$1*$2")
      .replace(/([a-z])([a-z])/g, "$1*$2")
      .replace(/([a-z])([0-9])/g, "$1*$2")
      .replace(/([a-z])\(/g, "$1*(");
    i++;
  }
  return r;
}

function toEvalStr(expr: string, subs: Record<string, number>): string {
  let s = normExpr(expr);
  s = insertImplicitMul(s);
  Object.keys(subs).sort((a, b) => b.length - a.length).forEach(v => {
    const re = new RegExp("(?<![a-z])" + v.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![a-z])", "g");
    s = s.replace(re, "(" + subs[v] + ")");
  });
  s = s.replace(/(?<![0-9.*+\-/(])([a-z])(?![a-z0-9.*+\-/(])/g, "1");
  s = s.replace(/\^/g, "**");
  return s;
}

export function evalAt(expr: string, subs: Record<string, number>): number | null {
  try {
    // eslint-disable-next-line no-new-func
    const v = Function('"use strict"; return (' + toEvalStr(expr, subs) + ')')() as unknown;
    return (typeof v === "number" && isFinite(v)) ? (v as number) : null;
  } catch { return null; }
}

export function splitEq(n: string): { lhs: string; rhs: string } | null {
  const i = n.indexOf("=");
  return i < 0 ? null : { lhs: n.slice(0, i), rhs: n.slice(i + 1) };
}

// Evaluate both sides of an equation at given substitution
function evalBothSides(raw: string, subs: Record<string, number>) {
  const eq = splitEq(normExpr(raw));
  if (!eq) return null;
  const l = evalAt(eq.lhs, subs), r = evalAt(eq.rhs, subs);
  if (l === null || r === null) return null;
  return { l, r, diff: l - r };
}

// ════════════════════════════════════════════════════
// GENERATE PARAMETRIC SOLUTION FAMILY
// For multi-variable equations — fixes free vars randomly,
// solves for primary variable via bisection.
// ════════════════════════════════════════════════════
export function genParamSolutions(givenRaw: string, vars: string[], count = 10): Record<string, number>[] {
  const eq = splitEq(normExpr(givenRaw));
  if (!eq) return [];
  const sols: Record<string, number>[] = [];
  const pv = vars[0].toLowerCase();

  for (let att = 0; att < 500 && sols.length < count; att++) {
    const fixed: Record<string, number> = {};
    vars.slice(1).forEach(x => { fixed[x.toLowerCase()] = 0.5 + Math.random() * 9; });

    const f = (x: number) => {
      const vv = { ...fixed }; vv[pv] = x;
      const lv = evalAt(eq.lhs, vv), rv = evalAt(eq.rhs, vv);
      return (lv !== null && rv !== null) ? lv - rv : null;
    };

    let lo = -30, hi = 30, flo = f(lo), fhi = f(hi);
    if (flo === null || fhi === null) continue;
    if (Math.sign(flo) === Math.sign(fhi)) continue;

    for (let j = 0; j < 60; j++) {
      const mid = (lo + hi) / 2, fm = f(mid);
      if (fm === null) break;
      if (Math.abs(fm) < 1e-8) { lo = hi = mid; break; }
      if (Math.sign(fm) === Math.sign(flo)) { lo = mid; flo = fm; } else { hi = mid; }
    }
    const sol = { ...fixed }; sol[pv] = lo;
    const r = evalBothSides(givenRaw, sol);
    if (!r || Math.abs(r.diff) > 1e-4) continue;
    sols.push(sol);
  }
  return sols;
}

// ════════════════════════════════════════════════════
// LAYER 1: LINE VALIDITY
// ════════════════════════════════════════════════════
export function checkLineValid(
  raw: string,
  knownAnswer: Record<string, number>,
  givenRaw: string,
  vars: string[]
): { ok: boolean; msg: string } {
  const n = normExpr(raw), eq = splitEq(n);
  if (!eq) return { ok: false, msg: "no_eq" };
  if (!eq.lhs.trim() || !eq.rhs.trim()) return { ok: false, msg: "empty_side" };

  const testSubs: Record<string, number>[] = vars.length > 1
    ? genParamSolutions(givenRaw, vars, 8)
    : [knownAnswer];

  if (testSubs.length < 1) return { ok: true, msg: "" };

  for (const s of testSubs) {
    const lv = evalAt(eq.lhs, s), rv = evalAt(eq.rhs, s);
    if (lv === null || rv === null) return { ok: false, msg: "cant_eval" };
    if (Math.abs(lv - rv) > 1e-4) return { ok: false, msg: "not_equal" };
  }
  return { ok: true, msg: "" };
}

// ════════════════════════════════════════════════════
// LAYER 2: TRANSITION VALIDITY
// Checks: LHS_B = k*LHS_A + c AND RHS_B = k*RHS_A + c
// for same k and c across many random points.
// ════════════════════════════════════════════════════
export function checkTransitionValid(
  lineA: string, lineB: string, vars: string[]
): { ok: boolean } {
  const eA = splitEq(normExpr(lineA)), eB = splitEq(normExpr(lineB));
  if (!eA || !eB) return { ok: true };

  let k: number | null = null, c: number | null = null, counted = 0;

  for (let t = 0; t < 80 && counted < 14; t++) {
    const vals: Record<string, number> = {};
    vars.forEach(v => { vals[v.toLowerCase()] = ((t * 7 + counted * 3) % 19) - 9 + Math.random() * 0.3; });

    const lA = evalAt(eA.lhs, vals), rA = evalAt(eA.rhs, vals);
    const lB = evalAt(eB.lhs, vals), rB = evalAt(eB.rhs, vals);
    if ([lA, rA, lB, rB].some(v => v === null || !isFinite(v as number))) continue;

    const dA = (lA as number) - (rA as number);
    const dB = (lB as number) - (rB as number);

    if (k === null) {
      if (Math.abs(dA) < 1e-8) { counted++; continue; }
      k = dB / dA;
      c = (lB as number) - k * (lA as number);
      counted++; continue;
    }

    if (Math.abs(dA) > 1e-8 && Math.abs(dB - k * dA) > 1e-4 * (1 + Math.abs(dB)))
      return { ok: false };
    const cL = (lB as number) - k * (lA as number);
    const cR = (rB as number) - k * (rA as number);
    if (Math.abs(cL - (c as number)) > 1e-4 * (1 + Math.abs(c as number)) ||
        Math.abs(cR - (c as number)) > 1e-4 * (1 + Math.abs(c as number)))
      return { ok: false };
    counted++;
  }
  return { ok: true };
}

// ════════════════════════════════════════════════════
// TRANSFORMATION RECOGNISER
// Infers what algebraic operation the student applied.
// ════════════════════════════════════════════════════
interface TransformInfo {
  type: TransformationType;
  operand?: number;   // e.g. the value added/subtracted/multiplied
  direction?: "lhs_to_rhs" | "rhs_to_lhs"; // which direction a term moved
}

export function inferTransformation(
  lineA: string,
  lineB: string,
  vars: string[]
): TransformInfo {
  const eA = splitEq(normExpr(lineA));
  const eB = splitEq(normExpr(lineB));
  if (!eA || !eB) return { type: "UNKNOWN" };

  // Sample several points to infer the transformation numerically
  const pts: Array<{ vA: Record<string, number>; lA: number; rA: number; lB: number; rB: number }> = [];

  for (let t = 0; t < 30 && pts.length < 8; t++) {
    const v: Record<string, number> = {};
    vars.forEach(x => { v[x.toLowerCase()] = 1.3 + t * 1.1 + Math.random() * 0.4; });
    const lA = evalAt(eA.lhs, v), rA = evalAt(eA.rhs, v);
    const lB = evalAt(eB.lhs, v), rB = evalAt(eB.rhs, v);
    if ([lA, rA, lB, rB].some(x => x === null)) continue;
    pts.push({ vA: v, lA: lA!, rA: rA!, lB: lB!, rB: rB! });
  }
  if (pts.length < 3) return { type: "UNKNOWN" };

  // Detect ADD/SUBTRACT BOTH SIDES
  // Pattern: lB = lA + c, rB = rA + c (same constant c)
  const addConsts = pts.map(p => p.lB - p.lA);
  const addConstsR = pts.map(p => p.rB - p.rA);
  const addL = addConsts[0], addR = addConstsR[0];
  if (
    Math.abs(addL - addR) < 1e-4 &&
    addConsts.every(c => Math.abs(c - addL) < 1e-4) &&
    addConstsR.every(c => Math.abs(c - addR) < 1e-4) &&
    Math.abs(addL) > 1e-6
  ) {
    return {
      type: addL > 0 ? "ADD_BOTH_SIDES" : "SUBTRACT_BOTH_SIDES",
      operand: Math.abs(addL),
    };
  }

  // Detect MULTIPLY/DIVIDE BOTH SIDES
  // Pattern: lB = k*lA, rB = k*rA
  const mulRatiosL = pts.map(p => Math.abs(p.lA) > 1e-6 ? p.lB / p.lA : null).filter(x => x !== null) as number[];
  const mulRatiosR = pts.map(p => Math.abs(p.rA) > 1e-6 ? p.rB / p.rA : null).filter(x => x !== null) as number[];
  if (mulRatiosL.length >= 3 && mulRatiosR.length >= 3) {
    const kL = mulRatiosL[0], kR = mulRatiosR[0];
    if (
      Math.abs(kL - kR) < 1e-4 &&
      mulRatiosL.every(r => Math.abs(r - kL) < 1e-4) &&
      mulRatiosR.every(r => Math.abs(r - kR) < 1e-4) &&
      Math.abs(kL) > 1e-6 && Math.abs(kL - 1) > 1e-6
    ) {
      return {
        type: Math.abs(kL) > 1 ? "MULTIPLY_BOTH_SIDES" : "DIVIDE_BOTH_SIDES",
        operand: kL > 0 ? kL : -kL,
      };
    }
  }

  // Detect SIMPLIFY (residuals match, but expression changed — same equation, different form)
  const residualsA = pts.map(p => p.lA - p.rA);
  const residualsB = pts.map(p => p.lB - p.rB);
  const ratios = residualsA.map((rA, i) => Math.abs(rA) > 1e-6 ? residualsB[i] / rA : null).filter(x => x !== null) as number[];
  if (ratios.length >= 3 && ratios.every(r => Math.abs(r - ratios[0]) < 1e-4) && Math.abs(ratios[0] - 1) < 1e-4) {
    return { type: "SIMPLIFY" };
  }

  // Detect REORDER (LHS and RHS swapped)
  if (pts.every(p => Math.abs(p.lB - p.rA) < 1e-4 && Math.abs(p.rB - p.lA) < 1e-4)) {
    return { type: "REORDER_EQUATION" };
  }

  return { type: "UNKNOWN" };
}

// ════════════════════════════════════════════════════
// MISTAKE DIAGNOSE
// Given a VALID prev line and an INVALID student line,
// try to identify what went wrong.
// ════════════════════════════════════════════════════
export function diagnoseMistake(
  lineA: string,
  lineB: string,
  vars: string[],
  knownAnswer: Record<string, number>
): MistakeType {
  const eA = splitEq(normExpr(lineA));
  const eB = splitEq(normExpr(lineB));
  if (!eA || !eB) return "UNKNOWN_MATHEMATICAL_ERROR";

  // Test at known answer
  const lA_ans = evalAt(eA.lhs, knownAnswer);
  const rA_ans = evalAt(eA.rhs, knownAnswer);
  const lB_ans = evalAt(eB.lhs, knownAnswer);
  const rB_ans = evalAt(eB.rhs, knownAnswer);

  if (lA_ans === null || rA_ans === null) return "UNKNOWN_MATHEMATICAL_ERROR";

  // ONE_SIDE_ONLY: operation applied to one side only
  // Pattern: one side matches the expected transformation, the other doesn't
  const pts: Array<{ lA: number; rA: number; lB: number; rB: number }> = [];
  for (let t = 0; t < 30 && pts.length < 6; t++) {
    const v: Record<string, number> = {};
    vars.forEach(x => { v[x.toLowerCase()] = 1 + t * 1.3; });
    const lA = evalAt(eA.lhs, v), rA = evalAt(eA.rhs, v);
    const lB = evalAt(eB.lhs, v), rB = evalAt(eB.rhs, v);
    if ([lA, rA, lB, rB].some(x => x === null)) continue;
    pts.push({ lA: lA!, rA: rA!, lB: lB!, rB: rB! });
  }

  if (pts.length >= 3) {
    // Check if LHS changed but RHS stayed the same (or vice versa)
    const lhsChanged = pts.some(p => Math.abs(p.lB - p.lA) > 1e-4);
    const rhsChanged = pts.some(p => Math.abs(p.rB - p.rA) > 1e-4);
    if (lhsChanged && !rhsChanged) return "ONE_SIDE_ONLY";
    if (!lhsChanged && rhsChanged) return "ONE_SIDE_ONLY";

    // SIGN_ERROR: the magnitude is right but the sign is wrong
    // Pattern: |lB - lA| ≈ |expected change| but wrong sign
    const lDiffs = pts.map(p => p.lB - p.lA);
    const rDiffs = pts.map(p => p.rB - p.rA);
    if (lDiffs.length > 0 && rDiffs.length > 0) {
      const avgLDiff = lDiffs.reduce((s, v) => s + v, 0) / lDiffs.length;
      const avgRDiff = rDiffs.reduce((s, v) => s + v, 0) / rDiffs.length;
      // If both sides changed by the same magnitude but opposite sign to expected
      if (Math.abs(avgLDiff + avgRDiff) < 1e-4 && Math.abs(avgLDiff) > 1e-4) {
        return "SIGN_ERROR";
      }
    }

    // ARITHMETIC_ERROR: transition structure is right (proportional changes) but wrong value
    const addL = pts[0].lB - pts[0].lA;
    const addR = pts[0].rB - pts[0].rA;
    // If LHS changes by same constant each time, and RHS changes by same constant each time,
    // but they're different values — wrong arithmetic
    const lConsistent = pts.every(p => Math.abs((p.lB - p.lA) - addL) < 1e-4);
    const rConsistent = pts.every(p => Math.abs((p.rB - p.rA) - addR) < 1e-4);
    if (lConsistent && rConsistent && Math.abs(addL - addR) > 1e-4) {
      return "ARITHMETIC_ERROR";
    }
  }

  // INVERSE_OPERATION_ERROR: student applied the WRONG inverse
  // e.g., had +7 on left, added 7 instead of subtracting
  // Detect: if we can infer what transformation they attempted and it's the wrong direction
  const inferred = inferTransformation(lineA, lineB, vars);
  if (inferred.type === "ADD_BOTH_SIDES" || inferred.type === "SUBTRACT_BOTH_SIDES") {
    // The transformation is structurally valid (both sides changed by same amount)
    // but the DIRECTION is wrong relative to what's needed
    // This actually means it IS a valid step — flag as UNPRODUCTIVE
    return "INVERSE_OPERATION_ERROR";
  }

  // VARIABLE_DROPPED: the variable term disappeared from student's equation
  // Check if the variable appears in A's LHS/RHS but not in B
  const nA = normExpr(lineA), nB = normExpr(lineB);
  for (const v of vars) {
    const vl = v.toLowerCase();
    if (nA.includes(vl) && !nB.includes(vl)) return "VARIABLE_DROPPED";
  }

  // TERM_DROPPED: a term that should be there is missing
  // Heuristic: B is shorter/simpler than expected from A
  if (lB_ans !== null && rB_ans !== null) {
    // If student's equation is internally consistent but wrong value — arithmetic error
    if (Math.abs(lB_ans - rB_ans) > 1e-4) {
      return "ARITHMETIC_ERROR";
    }
  }

  return "UNKNOWN_MATHEMATICAL_ERROR";
}

// ════════════════════════════════════════════════════
// PRODUCTIVENESS EVALUATOR
// Given a valid step, is it making progress toward the current goal?
// ════════════════════════════════════════════════════
function isProductive(
  lineB: string,
  goal: ConceptualGoal,
  vars: string[],
  knownAnswer: Record<string, number>,
  transformation: TransformInfo
): boolean {
  const eq = splitEq(normExpr(lineB));
  if (!eq) return false;

  // Check if the preferred transformation was used
  const usedPreferred = goal.preferredTransforms.includes(transformation.type);

  // Check if the goal is now closer to satisfied
  const satisfied = goal.isSatisfied(eq.lhs, eq.rhs, vars, knownAnswer);

  // If using a preferred transform OR goal is now satisfied → productive
  return usedPreferred || satisfied || transformation.type === "SIMPLIFY";
}

// ════════════════════════════════════════════════════
// COACH MESSAGE GENERATOR
// Produces natural language from the analysis.
// Never exposes internal codes to the student.
// ════════════════════════════════════════════════════
function buildCoachMessage(
  validity: StepValidity,
  transformation: TransformInfo,
  mistake: MistakeType | undefined,
  goal: ConceptualGoal,
  scaffoldLevel: ScaffoldLevel,
  mistakeCount: number,
  lineA: string,
  lineB: string,
  vars: string[],
  knownAnswer: Record<string, number>
): string {

  // ── VALID + PRODUCTIVE ──
  if (validity === "VALID_PRODUCTIVE") {
    const eq = splitEq(normExpr(lineB));
    const goalNowSatisfied = eq ? goal.isSatisfied(eq.lhs, eq.rhs, vars, knownAnswer) : false;

    if (goalNowSatisfied) {
      return goal.achieved;
    }

    // Reaction based on what they did
    switch (transformation.type) {
      case "SUBTRACT_BOTH_SIDES":
        return `Correct — subtracting ${transformation.operand !== undefined ? transformation.operand : "that value"} from both sides keeps the equation balanced. ${scaffoldLevel <= 1 ? "Now look at what's left on the left side." : ""}`;
      case "ADD_BOTH_SIDES":
        return `Good — adding ${transformation.operand !== undefined ? transformation.operand : "that value"} to both sides keeps it balanced. What do you need to do next?`;
      case "MULTIPLY_BOTH_SIDES":
        return `That's right — multiplying both sides by ${transformation.operand !== undefined ? transformation.operand : "that value"} clears the fraction. What's next?`;
      case "DIVIDE_BOTH_SIDES":
        return `Correct — dividing both sides by ${transformation.operand !== undefined ? transformation.operand : "the coefficient"} isolates the variable term. What does that give you?`;
      case "SIMPLIFY":
        return `Good simplification. The equation is equivalent — keep going.`;
      case "COLLECT_LIKE_TERMS":
        return `Good — you've collected the like terms. Now continue isolating ${vars[0]}.`;
      case "REORDER_EQUATION":
        return `Fine — you've rearranged the equation. It's still balanced. Continue.`;
      default:
        return `Valid step. Keep going.`;
    }
  }

  // ── VALID + UNPRODUCTIVE ──
  if (validity === "VALID_UNPRODUCTIVE") {
    switch (transformation.type) {
      case "MULTIPLY_BOTH_SIDES":
        return `That keeps the equation balanced — you've multiplied both sides by ${transformation.operand !== undefined ? transformation.operand : "something"}. But look at the equation now: has it become simpler? Our goal is to <b>${goal.description}</b>. Try a different operation.`;
      case "ADD_BOTH_SIDES":
        return `You've added ${transformation.operand !== undefined ? transformation.operand : "something"} to both sides — the equation is still balanced, but we're not making progress. Think about <b>${goal.description}</b>. What operation would move you toward that goal?`;
      case "SUBTRACT_BOTH_SIDES":
        return `Subtracting ${transformation.operand !== undefined ? transformation.operand : "something"} from both sides keeps it balanced, but look at the left side — has it become simpler? Focus on <b>${goal.description}</b>.`;
      default:
        return `That's mathematically valid, but it isn't moving us toward the goal: <b>${goal.description}</b>. Try a different approach.`;
    }
  }

  // ── INVALID ──
  // Build message based on mistake type AND scaffolding level
  return buildInvalidMessage(mistake, goal, scaffoldLevel, mistakeCount, lineA, lineB, vars, transformation);
}

function buildInvalidMessage(
  mistake: MistakeType | undefined,
  goal: ConceptualGoal,
  scaffoldLevel: ScaffoldLevel,
  mistakeCount: number,
  lineA: string,
  lineB: string,
  vars: string[],
  transformation: TransformInfo
): string {

  const escalated = (
    l0: string,
    l1: string,
    l2: string,
    l3: string,
    l4: string
  ): string => {
    const msgs = [l0, l1, l2, l3, l4];
    return msgs[Math.min(scaffoldLevel, 4)];
  };

  switch (mistake) {

    case "INVERSE_OPERATION_ERROR":
      return escalated(
        "Think about that operation. Is it moving you toward the goal?",
        `What operation is the opposite of what's in the equation? If something is being <i>added</i>, what would undo that?`,
        "Addition and subtraction are inverse operations. If the equation shows <i>+7</i>, subtracting 7 from both sides cancels it.",
        `Subtract the constant from both sides — that's the inverse of adding.`,
        `The +7 is being added, so we subtract 7 from both sides: the +7 and −7 cancel, leaving just the variable term.`
      );

    case "ONE_SIDE_ONLY":
      return escalated(
        "Check both sides of your equation.",
        "You seem to have changed one side only. What rule says what you must do to both sides?",
        "Whatever you do to one side of an equation, you must do to the other side too — to keep it balanced.",
        "Apply that same operation to <b>both</b> the left side and the right side.",
        `When you subtract from the left side, you must also subtract the same amount from the right side. Write it on both sides.`
      );

    case "SIGN_ERROR":
      return escalated(
        "Check the sign on that term.",
        "Look carefully at the sign — is it positive or negative?",
        "Be careful with negative signs. When a term moves across the equals sign, its sign changes.",
        "Check whether you need to add or subtract — a +7 on the left becomes −7 when you move it to the right.",
        `The +7 is positive. To remove it, we subtract 7 from both sides — not add. That gives us 3x = 22 − 7.`
      );

    case "ARITHMETIC_ERROR":
      return escalated(
        "Check your arithmetic on that step.",
        "The method looks right, but check the calculation again.",
        "Try computing the right side again carefully.",
        "Recalculate that value — the approach is correct but the number doesn't look right.",
        `Let's check: what is 22 − 7? And what is 15 ÷ 3?`
      );

    case "VARIABLE_DROPPED":
      return escalated(
        "Where did the variable go?",
        `Check your line — where is ${vars[0]} in your equation?`,
        `Every valid step must still contain ${vars[0]} until it's been isolated. Make sure it appears on one side.`,
        `Include ${vars[0]} in your equation. You can't drop it from the working.`,
        `The equation must still show ${vars[0]}. Write both sides — the left with the variable term and the right with the constant.`
      );

    case "TERM_DROPPED":
      return escalated(
        "Check all the terms in your equation.",
        "It looks like a term may have disappeared. Compare your line with the previous one carefully.",
        "Every term from the previous line must still be accounted for on one side or the other.",
        "Write out all the terms — don't drop any when you rearrange.",
        `Compare the previous line with yours: every term must appear somewhere in the new line.`
      );

    default:
      return escalated(
        "That step doesn't look right — compare it with the previous line.",
        `Go back to <i>${lineA}</i>. What operation did you apply, and did you apply it to both sides?`,
        "For every valid step, both sides of the equation must remain equal. Apply the same operation to both sides.",
        `Starting from ${lineA}, try: what single operation would bring you closer to <b>${goal.description}</b>?`,
        `From ${lineA}, the next step is to ${goal.preferredTransforms[0]?.replace(/_/g, " ").toLowerCase()} — write that on a new line.`
      );
  }
}

// ════════════════════════════════════════════════════
// GOAL SATISFICATION HELPERS
// ════════════════════════════════════════════════════

// Check if the variable term still has an additive constant
// (i.e., LHS evaluated at var=0 is non-zero)
function hasAdditiveConstant(lhs: string, vars: string[]): boolean {
  const zeroSubs: Record<string, number> = {};
  vars.forEach(v => { zeroSubs[v.toLowerCase()] = 0; });
  const val = evalAt(lhs, zeroSubs);
  return val !== null && Math.abs(val) > 1e-6;
}

// Check if the variable still has a coefficient ≠ 1 and ≠ 0
function hasMultCoefficient(lhs: string, rhs: string, vars: string[]): boolean {
  // The LHS coefficient of the variable: evaluate at var=1 and var=0, difference = coeff
  const sub0: Record<string, number> = {}, sub1: Record<string, number> = {};
  vars.forEach(v => { sub0[v.toLowerCase()] = 0; sub1[v.toLowerCase()] = 1; });
  const lAt0 = evalAt(lhs, sub0), lAt1 = evalAt(lhs, sub1);
  if (lAt0 === null || lAt1 === null) return false;
  const coeff = lAt1 - lAt0;
  return Math.abs(Math.abs(coeff) - 1) > 1e-4 && Math.abs(coeff) > 1e-6;
}

// Check if the equation is already solved (var = constant)
function isVariableIsolated(lhs: string, rhs: string, vars: string[], knownAnswer: Record<string, number>): boolean {
  const n = normExpr(lhs);
  const vl = vars[0].toLowerCase();
  // LHS should just be the variable letter
  if (n === vl) return true;
  // Or RHS = variable
  if (normExpr(rhs) === vl) return true;
  return false;
}

// ════════════════════════════════════════════════════
// BUILT-IN GOAL LIBRARY
// ════════════════════════════════════════════════════
export function makeRemoveAdditiveConstant(vars: string[], constantValue: number): ConceptualGoal {
  return {
    type: "REMOVE_ADDITIVE_CONSTANT",
    description: `remove the constant so the ${vars[0]} term is alone on one side`,
    preferredTransforms: ["SUBTRACT_BOTH_SIDES", "ADD_BOTH_SIDES"],
    intro: `Good start. Now we need to get <b>${vars[0]}</b> on its own. First, deal with the constant term.`,
    achieved: `The constant is gone from the ${vars[0]} side. Now you need to deal with the coefficient of ${vars[0]}.`,
    isSatisfied: (lhs, rhs, v) => {
      // The variable's side no longer has an additive constant
      // i.e., evaluating LHS at var=0 gives 0 (no constant term)
      const sub0: Record<string, number> = {};
      v.forEach(x => { sub0[x.toLowerCase()] = 0; });
      const lAt0 = evalAt(lhs, sub0), rAt0 = evalAt(rhs, sub0);
      // Check if lhs has no constant (var=0 gives 0) OR rhs has no constant
      const lhsHasNoConst = lAt0 !== null && Math.abs(lAt0) < 1e-4;
      const rhsHasNoConst = rAt0 !== null && Math.abs(rAt0) < 1e-4;
      return lhsHasNoConst || rhsHasNoConst;
    },
  };
}

export function makeRemoveMultCoefficient(vars: string[]): ConceptualGoal {
  return {
    type: "REMOVE_MULTIPLICATIVE_COEFFICIENT",
    description: `divide both sides to isolate ${vars[0]}`,
    preferredTransforms: ["DIVIDE_BOTH_SIDES", "MULTIPLY_BOTH_SIDES"],
    intro: `The constant is dealt with. Now the ${vars[0]} term has a coefficient. How do you remove a coefficient?`,
    achieved: `${vars[0]} is isolated. Now check your answer satisfies the original equation.`,
    isSatisfied: (lhs, rhs, v, ans) => isVariableIsolated(lhs, rhs, v, ans),
  };
}

export function makeClearFraction(vars: string[]): ConceptualGoal {
  return {
    type: "CLEAR_FRACTION",
    description: `multiply both sides to clear the fraction`,
    preferredTransforms: ["MULTIPLY_BOTH_SIDES"],
    intro: `There's a fraction here. Multiplying both sides by the denominator will clear it.`,
    achieved: `The fraction is cleared. Now continue solving.`,
    isSatisfied: (lhs, rhs) => {
      // No division sign in the expression
      const combined = normExpr(lhs) + normExpr(rhs);
      return !combined.includes("/") && !combined.includes("÷");
    },
  };
}

export function makeCollectVariableTerms(vars: string[]): ConceptualGoal {
  return {
    type: "COLLECT_VARIABLE_TERMS",
    description: `collect all ${vars[0]} terms on one side`,
    preferredTransforms: ["SUBTRACT_BOTH_SIDES", "ADD_BOTH_SIDES", "COLLECT_LIKE_TERMS"],
    intro: `There are ${vars[0]} terms on both sides. Move them all to one side first.`,
    achieved: `All ${vars[0]} terms are on one side now. Continue.`,
    isSatisfied: (lhs, rhs, v) => {
      // Check if only ONE side contains the variable
      const nLhs = normExpr(lhs), nRhs = normExpr(rhs);
      const vl = v[0].toLowerCase();
      const lhsHas = nLhs.includes(vl);
      const rhsHas = nRhs.includes(vl);
      return (lhsHas && !rhsHas) || (!lhsHas && rhsHas);
    },
  };
}

export function makeIsolateVariable(vars: string[]): ConceptualGoal {
  return {
    type: "ISOLATE_VARIABLE",
    description: `isolate ${vars[0]}`,
    preferredTransforms: ["DIVIDE_BOTH_SIDES", "SUBTRACT_BOTH_SIDES", "ADD_BOTH_SIDES"],
    intro: `Continue working towards isolating ${vars[0]}.`,
    achieved: `${vars[0]} is isolated. Well done! 🎉`,
    isSatisfied: (lhs, rhs, v, ans) => isVariableIsolated(lhs, rhs, v, ans),
  };
}

export function makeFreeFormGoal(): ConceptualGoal {
  return {
    type: "FREE_FORM",
    description: "solve the equation",
    preferredTransforms: ["SUBTRACT_BOTH_SIDES", "ADD_BOTH_SIDES", "MULTIPLY_BOTH_SIDES", "DIVIDE_BOTH_SIDES", "SIMPLIFY"],
    intro: "",
    achieved: "Solved! 🎉",
    isSatisfied: (lhs, rhs, v, ans) => isVariableIsolated(lhs, rhs, v, ans),
  };
}

// ════════════════════════════════════════════════════
// LEARNER STATE
// Tracks the coach's internal model of where the student is.
// ════════════════════════════════════════════════════
export interface LearnerState {
  currentGoalIndex: number;
  scaffoldLevel: ScaffoldLevel;
  mistakeCount: number;         // mistakes on current goal
  consecutiveMistakes: number;  // for escalation
  lastTransformation: TransformationType;
}

export function initialLearnerState(): LearnerState {
  return {
    currentGoalIndex: 0,
    scaffoldLevel: 0,
    mistakeCount: 0,
    consecutiveMistakes: 0,
    lastTransformation: "UNKNOWN",
  };
}

// ════════════════════════════════════════════════════
// MAIN COACH PIPELINE
// Call this for every line the student submits in Guided mode.
// ════════════════════════════════════════════════════
export function evaluateStep(
  prevLine: string,           // the previous equation (or the given)
  studentLine: string,        // what the student just wrote
  goals: ConceptualGoal[],    // ordered list of conceptual goals for this problem
  learnerState: LearnerState,
  knownAnswer: Record<string, number>,
  givenRaw: string,
  vars: string[]
): { evaluation: StepEvaluation; newLearnerState: LearnerState } {

  const goal = goals[Math.min(learnerState.currentGoalIndex, goals.length - 1)];

  // ── PARSE ──
  const eq = splitEq(normExpr(studentLine));
  if (!eq) {
    return {
      evaluation: {
        validity: "INVALID",
        transformation: "UNKNOWN",
        mistake: "UNKNOWN_MATHEMATICAL_ERROR",
        coachMessage: "Write a complete equation with an equals sign on both sides.",
        newScaffoldLevel: learnerState.scaffoldLevel,
        goalAchieved: false,
      },
      newLearnerState: {
        ...learnerState,
        consecutiveMistakes: learnerState.consecutiveMistakes + 1,
        mistakeCount: learnerState.mistakeCount + 1,
      },
    };
  }

  // ── LAYER 1: Line validity ──
  const v1 = checkLineValid(studentLine, knownAnswer, givenRaw, vars);

  // ── LAYER 2: Transition validity ──
  const v2 = v1.ok ? checkTransitionValid(prevLine, studentLine, vars) : { ok: true };

  // ── INFER TRANSFORMATION ──
  const transform = inferTransformation(prevLine, studentLine, vars);

  const isValid = v1.ok && v2.ok;

  if (!isValid) {
    // ── DIAGNOSE MISTAKE ──
    const mistake = diagnoseMistake(prevLine, studentLine, vars, knownAnswer);

    // Escalate scaffold level on consecutive mistakes
    const newConsec = learnerState.consecutiveMistakes + 1;
    const newScaffold = Math.min(4, learnerState.scaffoldLevel + (newConsec >= 2 ? 1 : 0)) as ScaffoldLevel;

    const msg = buildCoachMessage(
      "INVALID",
      transform,
      mistake,
      goal,
      newScaffold,
      learnerState.mistakeCount + 1,
      prevLine,
      studentLine,
      vars,
      knownAnswer
    );

    return {
      evaluation: {
        validity: "INVALID",
        transformation: transform.type,
        mistake,
        coachMessage: msg,
        newScaffoldLevel: newScaffold,
        goalAchieved: false,
      },
      newLearnerState: {
        ...learnerState,
        scaffoldLevel: newScaffold,
        mistakeCount: learnerState.mistakeCount + 1,
        consecutiveMistakes: newConsec,
        lastTransformation: transform.type,
      },
    };
  }

  // ── PRODUCTIVE CHECK ──
  const productive = isProductive(studentLine, goal, vars, knownAnswer, transform);
  const validity: StepValidity = productive ? "VALID_PRODUCTIVE" : "VALID_UNPRODUCTIVE";

  // ── CHECK IF GOAL IS NOW SATISFIED ──
  const goalSatisfied = goal.isSatisfied(eq.lhs, eq.rhs, vars, knownAnswer);

  // ── ADVANCE TO NEXT GOAL IF SATISFIED ──
  const nextGoalIndex = goalSatisfied
    ? Math.min(learnerState.currentGoalIndex + 1, goals.length - 1)
    : learnerState.currentGoalIndex;
  const goalActuallyAdvanced = goalSatisfied && nextGoalIndex > learnerState.currentGoalIndex;
  const nextGoal = goals[nextGoalIndex];
  const nextGoalIntro = goalActuallyAdvanced ? nextGoal.intro : undefined;

  // Reset scaffold on success
  const newScaffold: ScaffoldLevel = productive ? 0 : learnerState.scaffoldLevel;

  const msg = buildCoachMessage(
    validity,
    transform,
    undefined,
    goal,
    newScaffold,
    0,
    prevLine,
    studentLine,
    vars,
    knownAnswer
  );

  return {
    evaluation: {
      validity,
      transformation: transform.type,
      coachMessage: nextGoalIntro ? `${msg} ${nextGoalIntro}` : msg,
      newScaffoldLevel: newScaffold,
      goalAchieved: goalActuallyAdvanced,
      nextGoalIntro,
    },
    newLearnerState: {
      currentGoalIndex: nextGoalIndex,
      scaffoldLevel: newScaffold,
      mistakeCount: productive ? 0 : learnerState.mistakeCount,
      consecutiveMistakes: productive ? 0 : learnerState.consecutiveMistakes,
      lastTransformation: transform.type,
    },
  };
}