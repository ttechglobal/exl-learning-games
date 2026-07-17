"use client";

// ─────────────────────────────────────────────────────────────
//  EXL Maths Canvas — MathsCanvas.tsx
//  Route: /maths-canvas
//
//  Architecture:
//  - MathsEngine.ts handles ALL intelligence (transformation
//    recognition, mistake diagnosis, scaffolding, coaching)
//  - This file handles UI only: rendering + keyboard + state
// ─────────────────────────────────────────────────────────────

import React, { useState, useRef, useCallback, useEffect } from "react";
import styles from "./MathCanvas.module.css";
import {
  evaluateStep,
  initialLearnerState,
  checkLineValid,
  checkTransitionValid,
  genParamSolutions,
  normExpr,
  splitEq,
  evalAt,
  type LearnerState,
  type ConceptualGoal,
  makeRemoveAdditiveConstant,
  makeRemoveMultCoefficient,
  makeClearFraction,
  makeCollectVariableTerms,
  makeIsolateVariable,
  makeFreeFormGoal,
} from "./MathsEngine";

// Re-export AuditStatus for this file's use
type AuditStatus = "ok" | "error" | "downstream";

// ════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════
type Mode = "guided" | "assisted" | "challenge";

interface WorkingLine {
  expr: string;
  auditStatus?: AuditStatus;
  auditMsg?: string;
}

interface AuditResult {
  line: string;
  status: AuditStatus;
  msg: string;
}

type FracFocus = "num" | "den" | null;
interface FracState { num: string; den: string; focus: FracFocus; }

type MixedFocus = "whole" | "num" | "den" | null;
interface MixedState { whole: string; num: string; den: string; focus: MixedFocus; }

interface Problem {
  id: string;
  topic: string;
  badge: string;
  text: string;
  goal: string;
  meta: string;
  given: string;
  knownAnswer: Record<string, number>;
  vars: string[];
  // NEW: goal sequence for the engine
  goalSequence: ConceptualGoal[];
  // Opening message before any lines are written
  coachOpening: string;
}

// ════════════════════════════════════════════════════
// AUDIT ENGINE (for Challenge / "Check my solution")
// ════════════════════════════════════════════════════
function auditWorking(
  given: string,
  lines: string[],
  knownAnswer: Record<string, number>,
  vars: string[]
): AuditResult[] {
  const allLines = [given, ...lines];
  const results: AuditResult[] = [];
  let firstErrIdx = -1;

  // Build param solutions once for multi-var problems
  const paramSols = vars.length > 1 ? genParamSolutions(given, vars, 8) : null;

  for (let i = 0; i < lines.length; i++) {
    const curr = lines[i], prev = allLines[i];

    // Layer 1
    let v1: { ok: boolean; msg: string };
    if (paramSols && paramSols.length >= 3) {
      const eq = splitEq(normExpr(curr));
      if (!eq) { v1 = { ok: false, msg: "No = sign." }; }
      else {
        v1 = { ok: true, msg: "" };
        for (const s of paramSols) {
          const lv = evalAt(eq.lhs, s), rv = evalAt(eq.rhs, s);
          if (lv === null || rv === null) { v1 = { ok: false, msg: "Could not evaluate." }; break; }
          if (Math.abs(lv - rv) > 1e-4) { v1 = { ok: false, msg: "Both sides are not equal." }; break; }
        }
      }
    } else {
      v1 = checkLineValid(curr, knownAnswer, given, vars);
    }

    // Layer 2
    const v2 = v1.ok ? checkTransitionValid(prev, curr, vars) : { ok: true };
    const isDS = firstErrIdx >= 0;

    if (!v1.ok || !v2.ok) {
      if (firstErrIdx < 0) firstErrIdx = i;
      results.push({
        line: curr,
        status: isDS ? "downstream" : "error",
        msg: isDS
          ? "This follows from an earlier line — check the error above."
          : (v2.ok ? v1.msg : "This does not follow from the previous line."),
      });
    } else {
      results.push({ line: curr, status: "ok", msg: "" });
    }
  }
  return results;
}

// ════════════════════════════════════════════════════
// EXPRESSION → REACT NODES
// ════════════════════════════════════════════════════
function ExprToken({ ch, type }: { ch: string; type: "num" | "var" | "op" | "eq" }) {
  const cls = type === "var" ? styles.tVar : type === "op" ? styles.tOp : type === "eq" ? styles.tEq : styles.tNum;
  return <span className={cls}>{ch}</span>;
}

function FracDisplay({ num, den }: { num: string; den: string }) {
  return (
    <span className={styles.fracInline}>
      <span className={styles.fracNum}>{num || "□"}</span>
      <span className={styles.fracDen}>{den || "□"}</span>
    </span>
  );
}

let _key = 0;
function renderExpr(expr: string, vars: string[]): React.ReactNode {
  const varSet = new Set(vars.map(v => v.toLowerCase()).concat(["π", "√", "²", "³"]));
  const fracRx = /\(([^)]*)\)\/\(([^)]*)\)/g;
  const parts: React.ReactNode[] = [];
  let last = 0, m: RegExpExecArray | null;

  const renderText = (s: string): React.ReactNode[] => {
    const tokens: React.ReactNode[] = [];
    let buf = "";
    const flush = () => {
      if (!buf) return;
      const isVar = buf.length === 1 && varSet.has(buf.toLowerCase()) && isNaN(Number(buf));
      tokens.push(<ExprToken key={_key++} ch={buf} type={isVar ? "var" : "num"} />);
      buf = "";
    };
    for (const c of s) {
      if ("+-×÷*/−()".includes(c)) { flush(); tokens.push(<ExprToken key={_key++} ch={c} type="op" />); }
      else if (c === "=") { flush(); tokens.push(<ExprToken key={_key++} ch="=" type="eq" />); }
      else buf += c;
    }
    flush();
    return tokens;
  };

  fracRx.lastIndex = 0;
  while ((m = fracRx.exec(expr)) !== null) {
    if (m.index > last) parts.push(...renderText(expr.slice(last, m.index)));
    parts.push(<FracDisplay key={_key++} num={m[1]} den={m[2]} />);
    last = m.index + m[0].length;
  }
  parts.push(...renderText(expr.slice(last)));
  return <>{parts}</>;
}

// ════════════════════════════════════════════════════
// PROBLEM DATABASE
// Now uses goalSequence instead of coachReact
// ════════════════════════════════════════════════════
const PROBLEMS: Problem[] = [
  {
    id: "l1", topic: "Linear Equations", badge: "Algebra · WAEC",
    text: 'Solve for <b>x</b>:\n<eq>3x + 7 = 22</eq>',
    goal: "Find x", meta: "Linear equation",
    given: "3x + 7 = 22",
    knownAnswer: { x: 5 }, vars: ["x"],
    coachOpening: "Our goal is to get <b>x</b> by itself. Look at the left side — there's a <b>+7</b> attached to the 3x. What operation would remove it?",
    goalSequence: [
      makeRemoveAdditiveConstant(["x"], 7),
      makeRemoveMultCoefficient(["x"]),
      makeIsolateVariable(["x"]),
    ],
  },
  {
    id: "l2", topic: "Linear Equations", badge: "Algebra · WAEC",
    text: 'Solve for <b>y</b>:\n<eq>5y − 3 = 2y + 9</eq>',
    goal: "Find y", meta: "Variables on both sides",
    given: "5y − 3 = 2y + 9",
    knownAnswer: { y: 4 }, vars: ["y"],
    coachOpening: "There are <b>y</b> terms on both sides of the equation. Our first goal is to collect all y terms on one side. Which side would you move them to?",
    goalSequence: [
      makeCollectVariableTerms(["y"]),
      makeRemoveAdditiveConstant(["y"], 3),
      makeRemoveMultCoefficient(["y"]),
      makeIsolateVariable(["y"]),
    ],
  },
  {
    id: "l3", topic: "Linear Equations", badge: "Algebra",
    text: 'Solve for <b>n</b>:\n<eq>(3n − 1) ÷ 2 = 7</eq>',
    goal: "Find n", meta: "Fractional equation",
    given: "(3n − 1) ÷ 2 = 7",
    knownAnswer: { n: 5 }, vars: ["n"],
    coachOpening: "The expression is divided by 2. What operation clears a division from both sides?",
    goalSequence: [
      makeClearFraction(["n"]),
      makeRemoveAdditiveConstant(["n"], 1),
      makeRemoveMultCoefficient(["n"]),
      makeIsolateVariable(["n"]),
    ],
  },
  {
    id: "s1", topic: "Change of Subject", badge: "Formula · WAEC",
    text: 'Make <b>a</b> the subject of:\n<eq>v² = u² + 2as</eq>',
    goal: "Make a the subject", meta: "Kinematics",
    given: "v² = u² + 2as",
    knownAnswer: { v: 5, u: 3, a: 2, s: 4 },
    vars: ["v", "u", "a", "s"],
    coachOpening: "We want <b>a</b> on its own. The right side has <b>u²</b> added to the <b>2as</b> term. What would you do first?",
    goalSequence: [
      makeRemoveAdditiveConstant(["a", "v", "u", "s"], 0),
      makeRemoveMultCoefficient(["a"]),
      makeIsolateVariable(["a"]),
    ],
  },
  {
    id: "s2", topic: "Change of Subject", badge: "Formula",
    text: 'Make <b>u</b> the subject of:\n<eq>v = u + at</eq>',
    goal: "Make u the subject", meta: "Motion formula",
    given: "v = u + at",
    knownAnswer: { v: 10, u: 4, a: 3, t: 2 },
    vars: ["v", "u", "a", "t"],
    coachOpening: "We need <b>u</b> alone. The right side shows <b>u + at</b>. What is attached to u that shouldn't be there?",
    goalSequence: [
      makeRemoveAdditiveConstant(["u", "v", "a", "t"], 0),
      makeIsolateVariable(["u"]),
    ],
  },
  {
    id: "q1", topic: "Quadratic Equations", badge: "Quadratic · WAEC",
    text: 'Factorise and solve:\n<eq>x² + 5x + 6 = 0</eq>',
    goal: "Find x", meta: "Factorisation",
    given: "x² + 5x + 6 = 0",
    knownAnswer: { x: -2 }, vars: ["x"],
    coachOpening: "Find two numbers that <b>multiply to 6</b> and <b>add to 5</b>. Write the factorised form.",
    goalSequence: [makeFreeFormGoal()],
  },
  {
    id: "sim1", topic: "Simultaneous Eq.", badge: "Systems · WAEC",
    text: 'Solve simultaneously:\n<eq>x + y = 10</eq>\n<eq>x − y = 4</eq>',
    goal: "Find x and y", meta: "Elimination",
    given: "x + y = 10",
    knownAnswer: { x: 7, y: 3 }, vars: ["x", "y"],
    coachOpening: "You have two equations. Adding them eliminates y. Try it.",
    goalSequence: [makeFreeFormGoal()],
  },
  {
    id: "w1", topic: "Word Problem", badge: "Applied · WAEC",
    text: 'A bag of rice costs <b>₦x</b>. Three bags cost <b>₦2,700 more</b> than one bag.\nForm an equation and find x.',
    goal: "Find x", meta: "Applied algebra",
    given: "3x = x + 2700",
    knownAnswer: { x: 1350 }, vars: ["x"],
    coachOpening: "The equation is set up: <b>3x = x + 2700</b>. There are x terms on both sides — collect them first.",
    goalSequence: [
      makeCollectVariableTerms(["x"]),
      makeRemoveMultCoefficient(["x"]),
      makeIsolateVariable(["x"]),
    ],
  },
];

// ════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════
export function MathsCanvas() {
  const [mode, setModeState] = useState<Mode>("guided");
  const [probIdx, setProbIdx] = useState(0);
  const [xp, setXp] = useState(0);

  // Working paper
  const [lines, setLines] = useState<WorkingLine[]>([]);
  const [input, setInput] = useState("");
  const [curPos, setCurPos] = useState(0);

  // Fraction box
  const [fracOpen, setFracOpen] = useState(false);
  const [frac, setFrac] = useState<FracState>({ num: "", den: "", focus: "num" });

  // Mixed number box
  const [mixedOpen, setMixedOpen] = useState(false);
  const [mixed, setMixed] = useState<MixedState>({ whole: "", num: "", den: "", focus: "whole" });

  // Audit (challenge / check solution)
  const [audited, setAudited] = useState(false);
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);

  // Coach
  const [coachMsg, setCoachMsg] = useState("");
  const [coachHighlight, setCoachHighlight] = useState<"neutral" | "good" | "warn" | "error">("neutral");

  // Engine learner state (guided mode only)
  const [learnerState, setLearnerState] = useState<LearnerState>(initialLearnerState());

  const canvasRef = useRef<HTMLDivElement>(null);
  const prob = PROBLEMS[probIdx];

  const reset = useCallback((idx: number, m?: Mode) => {
    setProbIdx(idx);
    setLines([]);
    setInput("");
    setCurPos(0);
    setFracOpen(false);
    setMixedOpen(false);
    setAudited(false);
    setAuditResults([]);
    setCoachMsg(PROBLEMS[idx].coachOpening);
    setCoachHighlight("neutral");
    setLearnerState(initialLearnerState());
    if (m) setModeState(m);
  }, []);

  useEffect(() => { reset(0); }, [reset]);
  useEffect(() => { setCoachMsg(prob.coachOpening); setCoachHighlight("neutral"); setLearnerState(initialLearnerState()); }, [prob]);

  useEffect(() => {
    setTimeout(() => {
      if (canvasRef.current) canvasRef.current.scrollTop = canvasRef.current.scrollHeight;
    }, 80);
  }, [lines, input, audited]);

  // ── PAD ──
  const insertAt = (ch: string) => {
    setInput(s => s.slice(0, curPos) + ch + s.slice(curPos));
    setCurPos(p => p + ch.length);
  };
  const deleteAt = () => {
    if (curPos === 0) return;
    setInput(s => s.slice(0, curPos - 1) + s.slice(curPos));
    setCurPos(p => p - 1);
  };
  const moveCursor = (d: number) => setCurPos(p => Math.max(0, Math.min(input.length, p + d)));

  // ── CONFIRM LINE ──
  const confirmLine = () => {
    const str = input.trim();
    if (!str) return;

    const prevLine = lines.length > 0 ? lines[lines.length - 1].expr : prob.given;
    let newLine: WorkingLine = { expr: str };

    if (mode === "guided") {
      // Run the full engine pipeline
      const { evaluation, newLearnerState } = evaluateStep(
        prevLine,
        str,
        prob.goalSequence,
        learnerState,
        prob.knownAnswer,
        prob.given,
        prob.vars
      );

      setLearnerState(newLearnerState);
      setCoachMsg(evaluation.coachMessage);

      const highlight =
        evaluation.validity === "VALID_PRODUCTIVE" ? "good"
        : evaluation.validity === "VALID_UNPRODUCTIVE" ? "warn"
        : "error";
      setCoachHighlight(highlight);

      // Only commit valid lines to the paper in guided mode
      // (invalid lines shown briefly then removed)
      if (evaluation.validity !== "INVALID") {
        newLine = { expr: str };
        setLines(prev => [...prev, newLine]);
        setInput("");
        setCurPos(0);
        setAudited(false);
        setAuditResults([]);
      } else {
        // Wrong line stays on the paper — student can see it and tap to edit
        setLines(prev => [...prev, { expr: str, auditStatus: "error", auditMsg: evaluation.coachMessage }]);
        setInput("");
        setCurPos(0);
      }
    } else {
      // Assisted / Challenge: accept all, audit on "Check my solution"
      setLines(prev => [...prev, { expr: str }]);
      setInput("");
      setCurPos(0);
      setAudited(false);
      setAuditResults([]);

      if (mode === "assisted") {
        // Give a minimal nudge
        const v1 = checkLineValid(str, prob.knownAnswer, prob.given, prob.vars);
        setCoachMsg(v1.ok ? "Good step. Keep going." : "That step doesn't look right — check both sides.");
        setCoachHighlight(v1.ok ? "good" : "error");
      }
    }
  };

  const insertFrac = () => {
    if (!frac.num.trim() && !frac.den.trim()) { setFracOpen(false); return; }
    insertAt(`(${frac.num || "?"})/(${frac.den || "?"})`);
    setFracOpen(false);
    setFrac({ num: "", den: "", focus: "num" });
  };

  const insertMixed = () => {
    const str = mixed.whole
      ? `${mixed.whole}(${mixed.num || "?"})/(${mixed.den || "?"})`
      : `(${mixed.num || "?"})/(${mixed.den || "?"})`;
    insertAt(str);
    setMixedOpen(false);
    setMixed({ whole: "", num: "", den: "", focus: "whole" });
  };

  // ── CHECK SOLUTION ──
  const checkSolution = () => {
    if (lines.length === 0) return;
    const validLines = lines.filter(l => l.auditStatus !== "error");
    const results = auditWorking(prob.given, validLines.map(l => l.expr), prob.knownAnswer, prob.vars);
    setAuditResults(results);
    setAudited(true);
    const allOk = results.every(r => r.status === "ok");
    if (allOk) {
      setXp(x => x + 20);
      setCoachMsg(`All steps valid — well done! 🎉`);
      setCoachHighlight("good");
    } else {
      setCoachMsg("There's an error in your working — the highlighted line is where things went wrong.");
      setCoachHighlight("warn");
    }
  };

  const modeClasses: Record<Mode, string> = {
    guided: styles.modeGuided,
    assisted: styles.modeAssisted,
    challenge: styles.modeChallenge,
  };

  const topicNeedsPow = prob.topic.includes("Quadratic") || prob.topic.includes("Change");
  const topicNeedsSqrt = prob.topic.includes("Change");

  // Coach card highlight class
  const coachHighlightClass =
    coachHighlight === "good" ? styles.coachGood
    : coachHighlight === "warn" ? styles.coachWarn
    : coachHighlight === "error" ? styles.coachError
    : "";

  return (
    <div className={styles.shell}>

      {/* TOP BAR */}
      <div className={styles.topbar}>
        <div className={styles.tbLeft}>
          <div className={styles.mark}>E</div>
          <span className={styles.tbName}>Maths Canvas</span>
          <span className={styles.beta}>BETA</span>
        </div>
        <div className={styles.tbRight}>
          <span className={styles.xpChip}>⭐ {xp} XP</span>
        </div>
      </div>

      {/* BODY */}
      <div className={styles.body}>

        {/* CANVAS */}
        <div className={styles.canvas} ref={canvasRef}>

          {/* Problem picker */}
          <div className={styles.picker}>
            {PROBLEMS.map((p, i) => (
              <button
                key={p.id}
                className={`${styles.ppBtn} ${i === probIdx ? styles.ppActive : ""}`}
                onClick={() => reset(i)}
              >
                {p.badge.split("·")[0].trim()}
              </button>
            ))}
          </div>

          {/* Question card */}
          <div className={styles.qCard}>
            <div className={styles.qBadge}>{prob.badge}</div>
            <div
              className={styles.qText}
              dangerouslySetInnerHTML={{
                __html: prob.text
                  .replace(/<eq>(.*?)<\/eq>/g, '<span class="exl-eq">$1</span>')
                  .replace(/\n/g, "<br>"),
              }}
            />
            <div className={styles.qFoot}>
              <span className={styles.qMeta}>{prob.meta}</span>
              <span className={styles.goalTag}>{prob.goal}</span>
            </div>
          </div>



          {/* Working paper */}
          <div className={styles.paper}>
            <div className={styles.paperHdr}>
              <span className={styles.paperLbl}>Working</span>
              <span className={styles.paperHint}>
                {audited ? "Audited ✓" : `Line ${lines.filter(l => l.auditStatus !== "error").length + 1}`}
              </span>
            </div>

            {/* Given */}
            <div className={`${styles.wline} ${styles.wlGiven}`}>
              <div className={styles.wlNum}>1</div>
              <div className={styles.wlExpr}>{renderExpr(prob.given, prob.vars)}</div>
              <div className={styles.wlStat} />
            </div>

            {/* Student lines */}
            {lines.map((l, i) => {
              const ar = audited ? auditResults[i] : undefined;
              const isErrFlash = l.auditStatus === "error" && !audited;
              const cls = isErrFlash ? styles.wlErr
                : ar
                  ? (ar.status === "ok" ? styles.wlOk : ar.status === "downstream" ? styles.wlDs : styles.wlErr)
                  : styles.wlDraft;
              const statEl = isErrFlash ? <span className={`${styles.wsDot} ${styles.wsErr}`}>✗</span>
                : ar
                  ? ar.status === "ok" ? <span className={`${styles.wsDot} ${styles.wsOk}`}>✓</span>
                    : ar.status === "downstream" ? <span className={`${styles.wsDot} ${styles.wsDs}`}>○</span>
                    : <span className={`${styles.wsDot} ${styles.wsErr}`}>✗</span>
                : <span className={`${styles.wsDot} ${styles.wsDraft}`}>·</span>;

              return (
                <React.Fragment key={i}>
                  <div className={`${styles.wline} ${cls}`}>
                    <div className={styles.wlNum}>{i + 2}</div>
                    <div
                      className={styles.wlExpr}
                      onClick={() => {
                        // Any line can be tapped to edit — including wrong ones
                        setInput(l.expr);
                        setCurPos(l.expr.length);
                        setLines(prev => prev.slice(0, i));
                        setAudited(false);
                        setAuditResults([]);
                        setCoachMsg("Line restored — correct it and press Done ✓");
                        setCoachHighlight("neutral");
                      }}
                    >
                      {renderExpr(l.expr, prob.vars)}
                    </div>
                    <div className={styles.wlStat}>{statEl}</div>
                  </div>
                  {ar && ar.status !== "ok" && (
                    <div className={`${styles.wlFb} ${ar.status === "downstream" ? styles.fbDs : styles.fbErr}`}>
                      {ar.status === "downstream" ? "○ " : "✗ "}{ar.msg}
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {/* Active input line */}
            {!audited && (
              <div className={`${styles.wline} ${styles.wlActive}`}>
                <div className={styles.wlNum}>{lines.filter(l => !l.auditStatus).length + 2}</div>
                <div className={styles.wlExpr}>
                  {input ? (
                    <>
                      {renderExpr(input.slice(0, curPos), prob.vars)}
                      <span className={styles.cur} />
                      {curPos < input.length && (
                        <span style={{ opacity: 0.5 }}>{renderExpr(input.slice(curPos), prob.vars)}</span>
                      )}
                    </>
                  ) : (
                    <span className={styles.wlPh}>write your next step…</span>
                  )}
                  {!input && <span className={styles.cur} />}
                </div>
                <div className={styles.wlStat} />
              </div>
            )}
          </div>

          {/* Check button (assisted + challenge) */}
          {!audited && mode !== "guided" && (
            <button
              className={styles.checkBtn}
              onClick={checkSolution}
              disabled={lines.filter(l => !l.auditStatus).length === 0}
            >
              ✓ Check my solution
            </button>
          )}

          {/* Guided: coach handles feedback inline, but also show Check when done */}
          {!audited && mode === "guided" && lines.filter(l => !l.auditStatus).length >= 2 && (
            <button
              className={`${styles.checkBtn} ${styles.checkBtnSecondary}`}
              onClick={checkSolution}
            >
              Check my working so far
            </button>
          )}

          {/* Audit panel */}
          {audited && (
            <div className={styles.auditPanel}>
              <div className={styles.auditHdr}>
                <span className={styles.auditIcon}>
                  {auditResults.every(r => r.status === "ok") ? "🎉" : "🔍"}
                </span>
                <div>
                  <div className={styles.auditTitle}>
                    {auditResults.every(r => r.status === "ok") ? "All steps correct!" : "Check your working"}
                  </div>
                  <div className={styles.auditSub}>
                    {auditResults.filter(r => r.status === "ok").length}/{auditResults.length} steps valid
                  </div>
                </div>
              </div>
              <div className={styles.auditFoot}>
                <button className={styles.btnGhost} onClick={() => reset(probIdx)}>Try again</button>
                <button className={styles.btnPrimary} onClick={() => reset((probIdx + 1) % PROBLEMS.length)}>
                  Next →
                </button>
              </div>
            </div>
          )}

          <div style={{ height: 8 }} />
        </div>

        {/* DOCK */}
        <div className={styles.dock}>

          {/* Preview bar */}
          <div className={styles.prevBar}>
            <div className={`${styles.prevExpr} ${input ? styles.prevHas : ""}`}>
              {input
                ? renderExpr(input, prob.vars)
                : <span className={styles.prevPh}>tap keys to write</span>
              }
            </div>
            {mode === "assisted" && !audited && (
              <button
                className={styles.hintBtn}
                onClick={() => {
                  setCoachMsg("💡 Think about what operation would move you closer to isolating the variable. What's attached to it?");
                  setCoachHighlight("neutral");
                }}
              >💡</button>
            )}
          </div>

          {/* Fraction boxes */}
          {fracOpen && (
            <div className={styles.fracPanel}>
              <div className={styles.fracLabel}>Fraction — tap a box, then type</div>
              <div className={styles.fracBoxes}>
                <input
                  className={`${styles.fracBox} ${frac.focus === "num" ? styles.fracBoxActive : ""}`}
                  placeholder="numerator (top)"
                  value={frac.num}
                  readOnly
                  onClick={() => setFrac(f => ({ ...f, focus: "num" }))}
                />
                <div className={styles.fracLine} />
                <input
                  className={`${styles.fracBox} ${frac.focus === "den" ? styles.fracBoxActive : ""}`}
                  placeholder="denominator (bottom)"
                  value={frac.den}
                  readOnly
                  onClick={() => setFrac(f => ({ ...f, focus: "den" }))}
                />
              </div>
              <div className={styles.fracActions}>
                <button className={styles.fracCancel} onClick={() => setFracOpen(false)}>Cancel</button>
                <button className={styles.fracInsert} onClick={insertFrac}>Insert ✓</button>
              </div>
            </div>
          )}

          {/* Mixed number boxes */}
          {mixedOpen && (
            <div className={styles.fracPanel}>
              <div className={styles.fracLabel}>Mixed number — tap a box, then type</div>
              <div className={styles.mixedBoxes}>
                <input
                  className={`${styles.fracBox} ${styles.fracBoxSm} ${mixed.focus === "whole" ? styles.fracBoxActive : ""}`}
                  placeholder="whole"
                  value={mixed.whole}
                  readOnly
                  onClick={() => setMixed(m => ({ ...m, focus: "whole" }))}
                />
                <div className={styles.mixedFrac}>
                  <input
                    className={`${styles.fracBox} ${styles.fracBoxSm} ${mixed.focus === "num" ? styles.fracBoxActive : ""}`}
                    placeholder="top"
                    value={mixed.num}
                    readOnly
                    onClick={() => setMixed(m => ({ ...m, focus: "num" }))}
                  />
                  <div className={styles.fracLine} />
                  <input
                    className={`${styles.fracBox} ${styles.fracBoxSm} ${mixed.focus === "den" ? styles.fracBoxActive : ""}`}
                    placeholder="bottom"
                    value={mixed.den}
                    readOnly
                    onClick={() => setMixed(m => ({ ...m, focus: "den" }))}
                  />
                </div>
              </div>
              <div className={styles.fracActions}>
                <button className={styles.fracCancel} onClick={() => setMixedOpen(false)}>Cancel</button>
                <button className={styles.fracInsert} onClick={insertMixed}>Insert ✓</button>
              </div>
            </div>
          )}

          {/* KEYBOARD */}
          {!audited && (
            <div className={styles.kbd}>

              {/* Row 0: variable keys + contextual */}
              <div className={styles.kr}>
                {[...new Set([...prob.vars, "x", "y", "n", "a"])].slice(0, 5).map(v => (
                  <button
                    key={v}
                    className={`${styles.k} ${styles.kVar}`}
                    onClick={() => {
                      if (fracOpen) {
                        if (frac.focus === "num") setFrac(f => ({ ...f, num: f.num + v }));
                        else setFrac(f => ({ ...f, den: f.den + v }));
                      } else if (mixedOpen) {
                        if (mixed.focus === "whole") setMixed(m => ({ ...m, whole: m.whole + v }));
                        else if (mixed.focus === "num") setMixed(m => ({ ...m, num: m.num + v }));
                        else setMixed(m => ({ ...m, den: m.den + v }));
                      } else { insertAt(v); }
                    }}
                  >{v}</button>
                ))}
                {topicNeedsPow && <button className={`${styles.k} ${styles.kOp}`} onClick={() => insertAt("²")} style={{ fontSize: 11 }}>x²</button>}
                {topicNeedsSqrt && <button className={`${styles.k} ${styles.kOp}`} onClick={() => insertAt("√")}>√</button>}
                <button className={`${styles.k} ${styles.kOp}`} onClick={() => insertAt("(")}>( )</button>
              </div>

              {/* Row 1: fraction + mixed + = + ⌫ */}
              <div className={styles.kr}>
                <button
                  className={`${styles.k} ${styles.kFrac} ${fracOpen ? styles.kFracActive : ""}`}
                  onClick={() => { setMixedOpen(false); setFracOpen(o => !o); setFrac({ num: "", den: "", focus: "num" }); }}
                >
                  <div className={styles.kFracInner}>
                    <span className={styles.kFracN}>a</span>
                    <span className={styles.kFracD}>b</span>
                  </div>
                </button>
                <button
                  className={`${styles.k} ${styles.kFrac} ${mixedOpen ? styles.kFracActive : ""}`}
                  onClick={() => { setFracOpen(false); setMixedOpen(o => !o); setMixed({ whole: "", num: "", den: "", focus: "whole" }); }}
                  style={{ flex: 1.4 }}
                >
                  <div className={styles.kMixedInner}>
                    <span className={styles.kFracWhole}>n</span>
                    <div className={styles.kFracInner}>
                      <span className={styles.kFracN}>a</span>
                      <span className={styles.kFracD}>b</span>
                    </div>
                  </div>
                </button>
                <button className={`${styles.k} ${styles.kEq}`} onClick={() => insertAt("=")}>=</button>
                <button className={`${styles.k} ${styles.kDel}`} onClick={() => {
                  if (fracOpen) {
                    if (frac.focus === "num") setFrac(f => ({ ...f, num: f.num.slice(0, -1) }));
                    else setFrac(f => ({ ...f, den: f.den.slice(0, -1) }));
                  } else if (mixedOpen) {
                    if (mixed.focus === "whole") setMixed(m => ({ ...m, whole: m.whole.slice(0, -1) }));
                    else if (mixed.focus === "num") setMixed(m => ({ ...m, num: m.num.slice(0, -1) }));
                    else setMixed(m => ({ ...m, den: m.den.slice(0, -1) }));
                  } else deleteAt();
                }}>⌫</button>
              </div>

              <div className={styles.kbdSep} />

              {/* Digits + ops */}
              {[
                ["7", "8", "9", "+", "−"],
                ["4", "5", "6", "×", "÷"],
                ["1", "2", "3", "◀", "▶"],
              ].map((row, ri) => (
                <div className={styles.kr} key={ri}>
                  {row.map(d => {
                    const isOp = ["+", "−", "×", "÷"].includes(d);
                    const isNav = ["◀", "▶"].includes(d);
                    const cls = `${styles.k} ${isOp ? styles.kOp : isNav ? styles.kNav : ""}`;
                    return (
                      <button key={d} className={cls} onClick={() => {
                        if (isNav) { moveCursor(d === "◀" ? -1 : 1); return; }
                        const ch = d;
                        if (fracOpen) {
                          if (frac.focus === "num") setFrac(f => ({ ...f, num: f.num + ch }));
                          else setFrac(f => ({ ...f, den: f.den + ch }));
                        } else if (mixedOpen) {
                          if (mixed.focus === "whole") setMixed(m => ({ ...m, whole: m.whole + ch }));
                          else if (mixed.focus === "num") setMixed(m => ({ ...m, num: m.num + ch }));
                          else setMixed(m => ({ ...m, den: m.den + ch }));
                        } else insertAt(ch);
                      }}>{d}</button>
                    );
                  })}
                </div>
              ))}

              {/* Row: 0 + . + Done */}
              <div className={styles.kr}>
                <button className={styles.k} style={{ flex: 2 }} onClick={() => {
                  if (fracOpen) { if (frac.focus === "num") setFrac(f => ({ ...f, num: f.num + "0" })); else setFrac(f => ({ ...f, den: f.den + "0" })); }
                  else if (mixedOpen) { if (mixed.focus === "whole") setMixed(m => ({ ...m, whole: m.whole + "0" })); else if (mixed.focus === "num") setMixed(m => ({ ...m, num: m.num + "0" })); else setMixed(m => ({ ...m, den: m.den + "0" })); }
                  else insertAt("0");
                }}>0</button>
                <button className={styles.k} onClick={() => insertAt(".")}>.</button>
                <button
                  className={`${styles.k} ${styles.kDone}`}
                  onClick={fracOpen ? insertFrac : mixedOpen ? insertMixed : confirmLine}
                  disabled={!fracOpen && !mixedOpen && !input.trim()}
                  style={{ flex: 2 }}
                >
                  {fracOpen || mixedOpen ? "Insert ✓" : "Done ✓"}
                </button>
              </div>

            </div>
          )}
        </div>
      </div>

      <style>{`.exl-eq{font-family:'JetBrains Mono','Courier New',monospace;font-size:15px;font-weight:600;color:#8A3FD1;display:block;margin:3px 0;}`}</style>
    </div>
  );
}