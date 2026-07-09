"use client";

/**
 * ChangeOfSubjectEngine.tsx
 *
 * A drag-and-drop equation-manipulation engine for "Change of Subject of
 * Formula". Three tiers:
 *   Learn    — owl-guided, wrong-tile explanations, no timer
 *   Practice — instruction only, timer from Q3
 *   Challenge — no guide, timer from Q1, hint costs time + points
 *
 * The equation IS the interactive surface. The student drags an operation
 * tile directly onto the left or right side of the equation — no separate
 * drop zones below. After both sides are filled, a focused MCQ confirms
 * the simplification before the step advances.
 *
 * Mounts as a standalone full-page experience (not inside GameplayShell)
 * because it needs the notebook-paper background across the whole viewport.
 * The in-game menu prop is ignored — this engine is self-contained.
 */

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import type { EngineRuntimeProps } from "@/engines/engine-types";
import type {
  ChangeOfSubjectConfig,
  ChangeOfSubjectOutcome,
  CosQuestion,
  CosStep,
} from "./changeOfSubject.config";
import { ChangeOfSubjectMissionPayloadSchema } from "./changeOfSubject.config";
import { MISSIONS, MISSIONS_BY_TIER, randomMissionForTier, BUILTIN_QUESTIONS } from "./changeOfSubjectQuestions";
import { renderTokens, tokenHTML, answerHTML } from "./mathRender";
import styles from "./ChangeOfSubjectEngine.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier = "learn" | "practice" | "challenge";

// Phase within a single question-step
type StepPhase =
  | "drag"       // waiting for tile to be dragged to both sides
  | "mcq_left"   // MCQ for left side simplification
  | "mcq_right"  // MCQ for right side simplification
  | "result";    // showing the new equation before advancing

// Top-level screen
type Screen =
  | "hub"            // tier selection
  | "question_intro" // "Make t the subject" callout before Q starts
  | "playing"        // active gameplay
  | "level_complete" // all questions done — prompt to next tier
  | "all_done";      // all tiers done

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

const TIER_LABELS: Record<Tier, string> = {
  learn: "📖 Learn",
  practice: "✏️ Practice",
  challenge: "⚡ Challenge",
};

const TIER_STYLES: Record<
  Tier,
  { bg: string; color: string; tagClass: string }
> = {
  learn: {
    bg: "var(--cos-teal-light)",
    color: "var(--cos-teal-dark)",
    tagClass: styles.tagLearn,
  },
  practice: {
    bg: "var(--cos-gold-light)",
    color: "var(--cos-gold-dark)",
    tagClass: styles.tagPractice,
  },
  challenge: {
    bg: "#EEE9FF",
    color: "#5B3FA6",
    tagClass: styles.tagChallenge,
  },
};

const LEVEL_COMPLETE_CONFIG: Record<
  Tier,
  {
    icon: string;
    title: string;
    msg: string;
    nextTier: Tier | null;
    nextLabel: string;
  }
> = {
  learn: {
    icon: "🎓",
    title: "You've learnt it!",
    msg: "You now know how to make a variable the subject of a formula. Time to put it into practice — no guide this time.",
    nextTier: "practice",
    nextLabel: "Go to Practice →",
  },
  practice: {
    icon: "⚡",
    title: "Practice complete!",
    msg: "You can do this on your own. Now try it against the clock — the Challenge awaits.",
    nextTier: "challenge",
    nextLabel: "Try the Challenge →",
  },
  challenge: {
    icon: "🏆",
    title: "Challenge complete!",
    msg: "Outstanding. You've mastered Change of Subject of Formula.",
    nextTier: null,
    nextLabel: "",
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function ChangeOfSubjectEngine({
  config,
  onComplete,
}: EngineRuntimeProps<ChangeOfSubjectConfig, ChangeOfSubjectOutcome>) {
  // ── Config resolution ──────────────────────────────────────────────────
  const shared = config.shared;
  const payloadParse = ChangeOfSubjectMissionPayloadSchema.safeParse(
    config.mission.payload
  );
  // questions resolved per-tier when enterTier() is called
  const getQuestionsForTier = (t: string): CosQuestion[] => {
    if (payloadParse.success) return payloadParse.data.questions;
    return randomMissionForTier(t);
  };
  const [questions, setQuestions] = useState<CosQuestion[]>(() => getQuestionsForTier("learn"));

  // ── State ──────────────────────────────────────────────────────────────
  const [screen, setScreen] = useState<Screen>("hub");
  const [tier, setTier] = useState<Tier>("learn");
  const [qIdx, setQIdx] = useState(0);
  const [sIdx, setSIdx] = useState(0);
  const [stepPhase, setStepPhase] = useState<StepPhase>("drag");

  // Per-question state
  const [lApplied, setLApplied] = useState(false);
  const [rApplied, setRApplied] = useState(false);
  const [wrongMsg, setWrongMsg] = useState("");
  const [wrongVisible, setWrongVisible] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [hintUsedThisQ, setHintUsedThisQ] = useState(false);

  // Scoring
  const [score, setScore] = useState(0);
  const [retries, setRetries] = useState(0); // retries on current question
  const [totalHints, setTotalHints] = useState(0);
  const [totalRetries, setTotalRetries] = useState(0);

  // Timer
  const [timerSec, setTimerSec] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef(60); // set when timer starts
  const startTimeRef = useRef(Date.now());

  // Game-over overlay
  const [showGameOver, setShowGameOver] = useState(false);

  // MCQ choices (shuffled once per MCQ render)
  const [mcqChoices, setMcqChoices] = useState<string[]>([]);
  const [mcqChosen, setMcqChosen] = useState<string | null>(null);
  // Tile choices (shuffled once per step, stored so re-renders don't reshuffle)
  const [tileChoices, setTileChoices] = useState<string[]>([]);

  // Wrong-line auto-hide timer
  const wrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drag state (imperative — lives outside React state to avoid lag)
  const dragStateRef = useRef<{
    ghost: HTMLElement;
    ox: number;
    oy: number;
    op: string;
  } | null>(null);

  // Mirror refs so native event handlers always read current values
  // (native listeners capture closures at attachment time, not call time)
  const stepPhaseRef   = useRef(stepPhase);
  const stepRef        = useRef<CosStep | null>(null);
  const tierRef        = useRef(tier);
  const lAppliedRef2   = useRef(false);   // renamed to avoid collision
  const rAppliedRef2   = useRef(false);

  // Refs to the two droppable side divs
  const leftSideRef = useRef<HTMLDivElement | null>(null);
  const rightSideRef = useRef<HTMLDivElement | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────
  const q = questions[qIdx];
  const step: CosStep = q.steps[sIdx];
  // Keep stepRef current — used by native drag handler to avoid stale closure
  stepRef.current = step;
  const totalSteps = q.steps.length;

  // ── Timer logic ────────────────────────────────────────────────────────
  function needsTimer(): boolean {
    if (tier === "challenge") return true;
    if (tier === "practice")
      return qIdx >= (shared.practiceTimerFromQ ?? 2);
    return false;
  }

  function startTimer() {
    if (!needsTimer()) return;
    const max = Math.max(
      shared.minTimerSecs ?? 20,
      (shared.baseTimerSecs ?? 60) - retries * (shared.retryTimerCut ?? 15)
    );
    maxTimerRef.current = max;
    setTimerSec(max);
    setTimerRunning(true);
    clearInterval(timerRef.current ?? undefined);
    timerRef.current = setInterval(() => {
      setTimerSec((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current ?? undefined);
          setTimerRunning(false);
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerRef.current ?? undefined);
    setTimerRunning(false);
  }

  function handleTimeUp() {
    setRetries((r) => r + 1);
    setTotalRetries((r) => r + 1);
    setShowGameOver(true);
  }

  // Cleanup on unmount
  useEffect(() => () => stopTimer(), []);

  // Keep mirror refs in sync with state
  useEffect(() => { stepPhaseRef.current = stepPhase; }, [stepPhase]);
  useEffect(() => { tierRef.current = tier; }, [tier]);
  useEffect(() => { lAppliedRef2.current = lApplied; }, [lApplied]);
  useEffect(() => { rAppliedRef2.current = rApplied; }, [rApplied]);

  // Prevent page scroll while dragging on mobile
  useEffect(() => {
    const prevent = (e: TouchEvent) => {
      if (dragStateRef.current) e.preventDefault();
    };
    document.addEventListener("touchmove", prevent, { passive: false });
    return () => document.removeEventListener("touchmove", prevent);
  }, []);

  // Wire native pointer listeners on tiles.
  // Runs whenever step/phase/choices change so closures are always fresh.
  useEffect(() => {
    if (stepPhase !== "drag") return;
    const container = tileBankRef.current;
    if (!container) return;

    const cleanups: (() => void)[] = [];

    const buttons = container.querySelectorAll<HTMLButtonElement>("button[data-cos-tile]");
    buttons.forEach((btn) => {
      const op = btn.dataset.cosOp ?? "";
      const handler = (e: PointerEvent) => nativeTilePointerDown(e, btn, op);
      btn.addEventListener("pointerdown", handler, { passive: false });
      cleanups.push(() => btn.removeEventListener("pointerdown", handler));
    });

    return () => cleanups.forEach(fn => fn());
  // Re-wire whenever the step, phase, or choices change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepPhase, sIdx, qIdx, tileChoices, tier]);

  // ── Wrong-line ─────────────────────────────────────────────────────────
  function showWrong(msg: string) {
    clearTimeout(wrongTimerRef.current ?? undefined);
    setWrongMsg(msg);
    setWrongVisible(true);
    wrongTimerRef.current = setTimeout(() => setWrongVisible(false), 2400);
  }

  // ── Question intro ─────────────────────────────────────────────────────
  function enterTier(t: Tier) {
    const newQs = getQuestionsForTier(t);
    setQuestions(newQs);
    setTier(t);
    setQIdx(0);
    setSIdx(0);
    setScore(0);
    setRetries(0);
    setTotalRetries(0);
    setTotalHints(0);
    setLApplied(false);
    setRApplied(false);
    setStepPhase("drag");
    setWrongVisible(false);
    setHintVisible(false);
    setHintUsedThisQ(false);
    setMcqChosen(null);
    setTileChoices(shuffle([newQs[0].steps[0].tileOk, ...newQs[0].steps[0].tilesNo]));
    startTimeRef.current = Date.now();
    setScreen("question_intro");
  }

  function startQuestion() {
    setLApplied(false);
    setRApplied(false);
    setStepPhase("drag");
    setWrongVisible(false);
    setHintVisible(false);
    setHintUsedThisQ(false);
    setMcqChosen(null);
    setTileChoices(shuffle([questions[qIdx].steps[0].tileOk, ...questions[qIdx].steps[0].tilesNo]));
    setScreen("playing");
    // Timer starts fresh per question
    if (needsTimer()) startTimer();
  }

  function retryQuestion() {
    setShowGameOver(false);
    setSIdx(0);
    setLApplied(false);
    setRApplied(false);
    setStepPhase("drag");
    setHintVisible(false);
    setHintUsedThisQ(false);
    setMcqChosen(null);
    setTileChoices(shuffle([q.steps[0].tileOk, ...q.steps[0].tilesNo]));
    // Timer with reduced time
    if (needsTimer()) startTimer();
  }

  // ── Tile drag ──────────────────────────────────────────────────────────
  // Uses pointer capture on the button so events track correctly on mobile.
  // The ghost is an absolutely-positioned clone that follows the pointer.
  function nativeTilePointerDown(e: PointerEvent, btn: HTMLButtonElement, op: string) {
    // Read from refs — not closed-over state — so this is always current
    if (stepPhaseRef.current !== "drag") return;
    const currentStep = stepRef.current;
    if (!currentStep) return;

    e.preventDefault();

    // Wrong tile
    if (op !== currentStep.tileOk) {
      btn.style.animation = "none";
      void btn.offsetWidth;
      btn.style.animation = "shake 0.3s ease";
      setTimeout(() => { btn.style.animation = ""; }, 360);
      showWrong(
        tierRef.current !== "challenge"
          ? (currentStep.whyNot[op] ?? "That doesn't isolate the variable here.")
          : "Not quite — try another."
      );
      return;
    }

    setWrongVisible(false);

    const pointerId = e.pointerId;
    const clientX = e.clientX;
    const clientY = e.clientY;
    const rect = btn.getBoundingClientRect();
    const ox = clientX - rect.left;
    const oy = clientY - rect.top;

    const ghost = document.createElement("div");
    ghost.className = "cos-tile-ghost";
    ghost.textContent = op;
    ghost.style.position = "fixed";
    ghost.style.zIndex = "300";
    ghost.style.pointerEvents = "none";
    ghost.style.touchAction = "none";
    ghost.style.fontFamily = "'JetBrains Mono',monospace";
    ghost.style.fontSize = "17px";
    ghost.style.fontWeight = "700";
    ghost.style.background = "var(--cos-gold,#D98E3B)";
    ghost.style.color = "#fff";
    ghost.style.padding = "12px 22px";
    ghost.style.borderRadius = "8px";
    ghost.style.boxShadow = "0 8px 20px rgba(0,0,0,.22)";
    ghost.style.left = (clientX - ox) + "px";
    ghost.style.top = (clientY - oy) + "px";
    ghost.style.width = rect.width + "px";
    document.body.appendChild(ghost);
    dragStateRef.current = { ghost, ox, oy, op };
    btn.style.opacity = "0.3";

    btn.setPointerCapture(pointerId);

    const onMove = (ev: PointerEvent) => {
      ghost.style.left = (ev.clientX - ox) + "px";
      ghost.style.top  = (ev.clientY - oy) + "px";
      updateHover(ghost);
    };

    const cleanup = () => {
      btn.removeEventListener("pointermove",   onMove);
      btn.removeEventListener("pointerup",     cleanup);
      btn.removeEventListener("pointercancel", cleanup);
      if (!dragStateRef.current) return;
      clearHover();
      const landed = getZone(ghost);
      ghost.remove();
      btn.style.opacity = "";
      const capturedOp = dragStateRef.current.op;
      dragStateRef.current = null;

      // Read from refs for current applied state
      if (landed === "left" && !lAppliedRef2.current) {
        setLApplied(true);
        markSide("left", capturedOp);
        checkBothApplied("left", capturedOp);
      } else if (landed === "right" && !rAppliedRef2.current) {
        setRApplied(true);
        markSide("right", capturedOp);
        checkBothApplied("right", capturedOp);
      }
    };

    btn.addEventListener("pointermove",   onMove);
    btn.addEventListener("pointerup",     cleanup);
    btn.addEventListener("pointercancel", cleanup);
  }

  function updateHover(ghost: HTMLElement) {
    const lr = leftSideRef.current;
    const rr = rightSideRef.current;
    if (lr) lr.classList.toggle(styles.eqSideHover, overlaps(ghost, lr));
    if (rr) rr.classList.toggle(styles.eqSideHover, overlaps(ghost, rr));
  }

  function clearHover() {
    leftSideRef.current?.classList.remove(styles.eqSideHover);
    rightSideRef.current?.classList.remove(styles.eqSideHover);
  }

  function getZone(ghost: HTMLElement): "left" | "right" | null {
    if (leftSideRef.current && overlaps(ghost, leftSideRef.current))
      return "left";
    if (rightSideRef.current && overlaps(ghost, rightSideRef.current))
      return "right";
    return null;
  }

  function overlaps(a: HTMLElement, b: HTMLElement): boolean {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return !(
      ar.right < br.left ||
      ar.left > br.right ||
      ar.bottom < br.top ||
      ar.top > br.bottom
    );
  }

  function markSide(side: "left" | "right", op: string) {
    const ref = side === "left" ? leftSideRef : rightSideRef;
    if (!ref.current) return;
    ref.current.classList.add(styles.eqSideApplied);
    // Show the expression with the operation applied inline
    const exprEl = ref.current.querySelector<HTMLElement>("[data-side-expr]");
    const badge = ref.current.querySelector<HTMLElement>("[data-applied-badge]");
    if (exprEl) {
      // Append the op token visually to the expression
      exprEl.innerHTML = exprEl.innerHTML +
        `<span class="cos-op" style="font-size:22px;color:var(--cos-gold-dark);font-family:'JetBrains Mono',monospace;font-weight:700"> ${op}</span>`;
    }
    if (badge) {
      badge.style.display = "none"; // expression update is enough
    }
  }

  // track which sides have been applied without waiting for setState flush
  const lAppliedRef = useRef(false);
  const rAppliedRef = useRef(false);

  function checkBothApplied(justApplied: "left" | "right", op: string) {
    if (justApplied === "left") lAppliedRef.current = true;
    if (justApplied === "right") rAppliedRef.current = true;

    // Mark all tiles used visually
    document.querySelectorAll<HTMLButtonElement>("[data-cos-tile]").forEach(
      (t) => t.classList.add(styles.tileUsed)
    );

    if (lAppliedRef.current && rAppliedRef.current) {
      // Brief pause then go to MCQ
      setTimeout(() => {
        lAppliedRef.current = false;
        rAppliedRef.current = false;
        openMCQ("left");
      }, 300);
    }
  }

  // ── MCQ ────────────────────────────────────────────────────────────────
  function openMCQ(side: "left" | "right") {
    const ans = side === "left" ? step.lAns : step.rAns;
    const wrong = side === "left" ? step.lWrong : step.rWrong;
    setMcqChoices(shuffle([ans, ...wrong]));
    setMcqChosen(null);
    setStepPhase(side === "left" ? "mcq_left" : "mcq_right");
  }

  function pickMCQ(chosen: string) {
    const isLeft = stepPhase === "mcq_left";
    const correct = isLeft ? step.lAns : step.rAns;
    setMcqChosen(chosen);
    if (chosen === correct) {
      setTimeout(() => {
        if (isLeft) openMCQ("right");
        else advanceStep();
      }, 480);
    }
  }

  // ── Step / Question advance ─────────────────────────────────────────────
  function advanceStep() {
    const isFinalStep = sIdx === totalSteps - 1;
    if (isFinalStep) {
      setStepPhase("result");
      stopTimer();
      // Award points
      const maxPts = Math.max(
        5,
        (shared.pointsPerQuestion ?? 20) -
          retries * (shared.retryPenalty ?? 5)
      );
      setScore((s) => s + maxPts);
      setRetries(0);
    } else {
      setStepPhase("result");
    }
  }

  function goNextStep() {
    const nextIdx = sIdx + 1;
    setSIdx(nextIdx);
    setLApplied(false);
    setRApplied(false);
    setStepPhase("drag");
    setWrongVisible(false);
    setHintVisible(false);
    setHintUsedThisQ(false);
    setMcqChosen(null);
    const nextStep = q.steps[nextIdx];
    if (nextStep) setTileChoices(shuffle([nextStep.tileOk, ...nextStep.tilesNo]));
  }

  function goNextQuestion() {
    const isLast = qIdx === questions.length - 1;
    if (isLast) {
      // Level complete
      stopTimer();
      setScreen("level_complete");
      return;
    }
    setQIdx((i) => i + 1);
    setSIdx(0);
    setRetries(0);
    setLApplied(false);
    setRApplied(false);
    setStepPhase("drag");
    setWrongVisible(false);
    setHintVisible(false);
    setHintUsedThisQ(false);
    setMcqChosen(null);
    // Show question intro for next Q
    setScreen("question_intro");
  }

  // ── Hint ───────────────────────────────────────────────────────────────
  function useHint() {
    if (hintUsedThisQ) return;
    setHintUsedThisQ(true);
    setHintVisible(true);
    setTotalHints((h) => h + 1);
    setScore((s) => Math.max(0, s - (shared.hintPenalty ?? 5)));
    setTimerSec((t) => Math.max(3, t - (shared.hintTimePenalty ?? 5)));
  }

  // ── Level complete → next tier ─────────────────────────────────────────
  function goNextTier() {
    const cfg = LEVEL_COMPLETE_CONFIG[tier];
    if (!cfg.nextTier) {
      // All tiers done — call onComplete
      onComplete({
        success: true,
        score: score / (questions.length * (shared.pointsPerQuestion ?? 20)),
        finalScore: score,
        timeSpentSec: Math.round((Date.now() - startTimeRef.current) / 1000),
        hintsUsed: totalHints,
        attemptsBeforeSuccess: totalRetries,
        xpEarned: config.mission.xpReward,
      });
      return;
    }
    enterTier(cfg.nextTier);
  }

  // ── Timer fill % ───────────────────────────────────────────────────────
  const timerPct = maxTimerRef.current > 0
    ? Math.max(0, (timerSec / maxTimerRef.current) * 100)
    : 100;
  const timerClass =
    timerSec <= 8
      ? `${styles.timerFill} ${styles.timerDanger}`
      : timerSec <= 20
      ? `${styles.timerFill} ${styles.timerWarn}`
      : styles.timerFill;

  // ── Render helpers ─────────────────────────────────────────────────────

  // Progress dots
  function renderDots() {
    const dots = [];
    for (let i = 0; i <= totalSteps; i++) {
      dots.push(
        <div
          key={i}
          className={[
            styles.dot,
            i < sIdx ? styles.dotDone : i === sIdx ? styles.dotActive : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      );
    }
    return <div className={styles.dots}>{dots}</div>;
  }

  // The equation sides — these are the drop targets
  function renderEquation(leftToks = step.leftToks, rightToks = step.rightToks) {
    return (
      <div className={styles.eqWrap}>
        <div
          ref={leftSideRef}
          className={[
            styles.eqSide,
            stepPhase === "drag" ? styles.eqSideDroppable : "",
            lApplied ? styles.eqSideApplied : "",
          ]
            .filter(Boolean)
            .join(" ")}
          dangerouslySetInnerHTML={{
            __html:
              '<div data-side-expr>' + renderTokens(leftToks, 27) + '</div>' +
              '<div data-applied-badge class="' +
              styles.appliedBadge +
              '" style="display:none"></div>',
          }}
        />
        <span className={styles.eqEquals}>=</span>
        <div
          ref={rightSideRef}
          className={[
            styles.eqSide,
            stepPhase === "drag" ? styles.eqSideDroppable : "",
            rApplied ? styles.eqSideApplied : "",
          ]
            .filter(Boolean)
            .join(" ")}
          dangerouslySetInnerHTML={{
            __html:
              '<div data-side-expr>' + renderTokens(rightToks, 27) + '</div>' +
              '<div data-applied-badge class="' +
              styles.appliedBadge +
              '" style="display:none"></div>',
          }}
        />
      </div>
    );
  }

  // Tile bank — plain div ref; listeners wired in useEffect below
  const tileBankRef = useRef<HTMLDivElement | null>(null);

  function renderTiles() {
    const tiles = tileChoices.length ? tileChoices : [step.tileOk, ...step.tilesNo];
    return (
      <div className={styles.tileBank} ref={tileBankRef}>
        {tiles.map((op) => (
          <button
            key={op}
            data-cos-tile
            data-cos-op={op}
            className={styles.tile}
          >
            {op}
          </button>
        ))}
      </div>
    );
  }

  // MCQ
  function renderMCQ() {
    const isLeft = stepPhase === "mcq_left";
    const correct = isLeft ? step.lAns : step.rAns;
    const qTokens = isLeft ? step.lqT : step.rqT;

    const prompt = isLeft
      ? "What does the <strong>left side</strong> simplify to?"
      : `Left = <strong>${step.lAns}</strong> ✓ &nbsp; What does the <strong>right side</strong> simplify to?`;

    return (
      <div className={styles.mcqWrap}>
        {/* MCQ prompt via mascot slot */}
        <div
          className={styles.mcqQ}
          dangerouslySetInnerHTML={{
            __html:
              renderTokens(qTokens, 20) + " = ?",
          }}
        />
        <div className={styles.mcqOpts}>
          {mcqChoices.map((c) => {
            let cls = styles.mcqBtn;
            if (mcqChosen !== null) {
              if (c === correct) cls += " " + styles.mcqBtnCorrect;
              else if (c === mcqChosen) cls += " " + styles.mcqBtnWrong;
              else cls += " " + styles.mcqBtnOff;
            }
            return (
              <button
                key={c}
                className={cls}
                onClick={() => mcqChosen === null && pickMCQ(c)}
                dangerouslySetInnerHTML={{ __html: answerHTML(c) }}
              />
            );
          })}
        </div>
        {/* Update mascot prompt */}
        <style>{`#cos-mascot-dynamic{display:block!important}`}</style>
        <div
          id="cos-mascot-dynamic"
          style={{ display: "none" }}
          dangerouslySetInnerHTML={{ __html: prompt }}
        />
      </div>
    );
  }

  // Step result
  function renderResult() {
    const isFinalStep = sIdx === totalSteps - 1;
    const isFinalQ = qIdx === questions.length - 1;
    const maxPts = Math.max(
      5,
      (shared.pointsPerQuestion ?? 20) - retries * (shared.retryPenalty ?? 5)
    );

    return (
      <>
        <div
          className={styles.resultEq}
          dangerouslySetInnerHTML={{
            __html:
              renderTokens(step.newLeft, 24) +
              '<span style="font-family:\'JetBrains Mono\',monospace;font-weight:700;font-size:24px;color:var(--cos-ink-soft);padding:0 6px">=</span>' +
              renderTokens(step.newRight, 24),
          }}
        />
        {isFinalStep ? (
          <div className={styles.celebrate}>
            <div className={styles.celTitle}>Solved! ✓</div>
            <div className={styles.celAns}>{q.finalAnswer}</div>
            {tier !== "learn" && (
              <div className={styles.ptsPill}>+{maxPts} pts</div>
            )}
            <div className={styles.actRow}>
              <button className={styles.btnTeal} onClick={goNextQuestion}>
                {isFinalQ ? "Finish →" : "Next question →"}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.nextStepRow}>
            <button className={styles.btnTeal} onClick={goNextStep}>
              Next step →
            </button>
          </div>
        )}
      </>
    );
  }


  // Wrap single-letter variable names in instruction text with styled spans
  function highlightVars(text: string): string {
    // Match bold tags first (keep them), then wrap standalone variable letters
    return text.replace(
      /<strong>([^<]+)<\/strong>/g,
      (_, inner) => `<strong><span class="${styles.varHighlight}">${inner}</span></strong>`
    ).replace(
      /\b([a-zA-Z])\b(?![^<]*>)/g,
      (match, letter) => `<span class="${styles.varHighlight}">${letter}</span>`
    );
  }

  // Mascot / instruction slot
  function renderInstruction() {
    if (stepPhase === "mcq_left" || stepPhase === "mcq_right") {
      const isLeft = stepPhase === "mcq_left";
      const prompt = isLeft
        ? "What does the <strong>left side</strong> simplify to?"
        : `Left = <strong>${step.lAns}</strong> ✓ &nbsp; Now simplify the <strong>right side</strong>.`;
      return (
        <div className={styles.mascotRow}>
          <div className={styles.mascotAv}>🦉</div>
          <div
            className={styles.mascotTxt}
            dangerouslySetInnerHTML={{ __html: prompt }}
          />
        </div>
      );
    }
    if (stepPhase === "result") {
      const isFinalStep = sIdx === totalSteps - 1;
      const msg = tier === "learn"
        ? isFinalStep
          ? "<strong>Done!</strong> Variable is the subject. ✓"
          : "Nice. Equation is simpler now — ready for the next step?"
        : isFinalStep
        ? "Variable isolated! ✓"
        : "Good — next step.";
      return (
        <div className={styles.mascotRow}>
          <div className={styles.mascotAv}>🦉</div>
          <div
            className={styles.mascotTxt}
            dangerouslySetInnerHTML={{ __html: msg }}
          />
        </div>
      );
    }

    if (tier === "learn") {
      return (
        <div className={styles.mascotRow}>
          <div className={styles.mascotAv}>🦉</div>
          <div
            className={styles.mascotTxt}
            dangerouslySetInnerHTML={{ __html: highlightVars(step.mascot) }}
          />
        </div>
      );
    }
    if (tier === "practice") {
      return (
        <div className={styles.mascotRow}>
          <div className={styles.mascotAv}>✏️</div>
          <div className={styles.mascotTxt} dangerouslySetInnerHTML={{ __html: highlightVars(step.instPrac) }} />
        </div>
      );
    }
    // challenge
    return (
      <div className={styles.mascotRow}>
        <div className={styles.mascotAv}>⚡</div>
        <div className={styles.mascotTxt} style={{ fontSize: 12, color: "var(--cos-ink-soft)" }} dangerouslySetInnerHTML={{ __html: highlightVars(step.instChall) }} />
      </div>
    );
  }

  // ── Screens ────────────────────────────────────────────────────────────

  if (screen === "hub") {
    return (
      <div className={styles.root} style={{"--cos-paper":"#fbf6ea","--cos-line":"#c9d9ea","--cos-margin":"#e3a7a0","--cos-ink":"#2b2a28","--cos-ink-soft":"#6b6a66","--cos-gold":"#d98e3b","--cos-gold-dark":"#8f5a1e","--cos-gold-light":"#fef3dc","--cos-teal":"#2f6f62","--cos-teal-dark":"#1c443b","--cos-teal-light":"#e1f0ea","--cos-coral":"#c24c3f","--cos-coral-bg":"#fbe4e0","--cos-card":"#ffffff","touchAction":"pan-y"} as React.CSSProperties}>
        <div className={styles.hub}>
          <div className={styles.hubTitle}>Change of Subject</div>
          <div className={styles.hubSub}>
            Make a variable the subject of a formula
          </div>
          <div className={styles.modeList}>
            {(["learn", "practice", "challenge"] as Tier[]).map((t) => {
              const cfg = TIER_STYLES[t];
              const descs: Record<Tier, string> = {
                learn: "Guided — owl walks you through each step",
                practice: "Work independently — timer from Q3",
                challenge: "Timer from Q1 — hints cost time and points",
              };
              const tags: Record<Tier, string> = {
                learn: "Guided",
                practice: "Timed",
                challenge: "No guide",
              };
              return (
                <button
                  key={t}
                  className={styles.modeBtn}
                  onClick={() => enterTier(t)}
                >
                  <span className={styles.modeIcon}>
                    {t === "learn" ? "📖" : t === "practice" ? "✏️" : "⚡"}
                  </span>
                  <div>
                    <div className={styles.modeName}>{TIER_LABELS[t]}</div>
                    <div className={styles.modeDesc}>{descs[t]}</div>
                  </div>
                  <span
                    className={[styles.modeTag, cfg.tagClass]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {tags[t]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (screen === "question_intro") {
    return (
      <div className={styles.root} style={{"--cos-paper":"#fbf6ea","--cos-line":"#c9d9ea","--cos-margin":"#e3a7a0","--cos-ink":"#2b2a28","--cos-ink-soft":"#6b6a66","--cos-gold":"#d98e3b","--cos-gold-dark":"#8f5a1e","--cos-gold-light":"#fef3dc","--cos-teal":"#2f6f62","--cos-teal-dark":"#1c443b","--cos-teal-light":"#e1f0ea","--cos-coral":"#c24c3f","--cos-coral-bg":"#fbe4e0","--cos-card":"#ffffff","touchAction":"pan-y"} as React.CSSProperties}>
        <div className={styles.game}>
          <div className={styles.strip}>
            <button className={styles.backBtn} onClick={() => setScreen("hub")}>
              ← Back
            </button>
            <div className={styles.stripRight}>
              <span
                className={styles.tierChip}
                style={{
                  background: TIER_STYLES[tier].bg,
                  color: TIER_STYLES[tier].color,
                }}
              >
                {TIER_LABELS[tier]}
              </span>
              {tier !== "learn" && (
                <span className={styles.scoreChip}>{score} pts</span>
              )}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.questionHeader}>
              <div className={styles.questionLabel}>
                Question {qIdx + 1} of {questions.length}
              </div>
              <div className={styles.questionGoalLarge}>{q.qLabel}</div>
              <div className={styles.questionFormulaLarge}>{q.formula}</div>
            </div>

            <div
              style={{
                textAlign: "center",
                padding: "16px 0 8px",
                color: "var(--cos-ink-soft)",
                fontSize: 13,
              }}
            >
              {tier === "learn"
                ? "The owl will guide you step by step."
                : tier === "practice"
                ? "Work through the steps on your own."
                : "No hints — timer is running. Go!"}
            </div>

            <div className={styles.actRow} style={{ marginTop: 20 }}>
              <button className={styles.btnTeal} onClick={startQuestion}>
                Start →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "level_complete") {
    const cfg = LEVEL_COMPLETE_CONFIG[tier];
    return (
      <div className={styles.root} style={{"--cos-paper":"#fbf6ea","--cos-line":"#c9d9ea","--cos-margin":"#e3a7a0","--cos-ink":"#2b2a28","--cos-ink-soft":"#6b6a66","--cos-gold":"#d98e3b","--cos-gold-dark":"#8f5a1e","--cos-gold-light":"#fef3dc","--cos-teal":"#2f6f62","--cos-teal-dark":"#1c443b","--cos-teal-light":"#e1f0ea","--cos-coral":"#c24c3f","--cos-coral-bg":"#fbe4e0","--cos-card":"#ffffff","touchAction":"pan-y"} as React.CSSProperties}>
        <div className={styles.game}>
          <div className={styles.card}>
            <div className={styles.levelComplete}>
              <div className={styles.lcIcon}>{cfg.icon}</div>
              <div className={styles.lcTitle}>{cfg.title}</div>
              <div className={styles.lcMsg}>{cfg.msg}</div>
              {tier !== "learn" && (
                <>
                  <div className={styles.lcScore}>{score}</div>
                  <div className={styles.lcScoreLbl}>points earned</div>
                </>
              )}
              <div className={styles.actRow}>
                {cfg.nextTier ? (
                  <button className={styles.btnTeal} onClick={goNextTier}>
                    {cfg.nextLabel}
                  </button>
                ) : (
                  <button className={styles.btnTeal} onClick={goNextTier}>
                    Finish
                  </button>
                )}
                <button
                  className={styles.btnGold}
                  onClick={() => setScreen("hub")}
                >
                  Back to menu
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Playing screen ──────────────────────────────────────────────────────
  const isMCQ = stepPhase === "mcq_left" || stepPhase === "mcq_right";

  return (
    <div className={styles.root} style={{"--cos-paper":"#fbf6ea","--cos-line":"#c9d9ea","--cos-margin":"#e3a7a0","--cos-ink":"#2b2a28","--cos-ink-soft":"#6b6a66","--cos-gold":"#d98e3b","--cos-gold-dark":"#8f5a1e","--cos-gold-light":"#fef3dc","--cos-teal":"#2f6f62","--cos-teal-dark":"#1c443b","--cos-teal-light":"#e1f0ea","--cos-coral":"#c24c3f","--cos-coral-bg":"#fbe4e0","--cos-card":"#ffffff","touchAction":"pan-y"} as React.CSSProperties}>
      {/* Game-over overlay */}
      {showGameOver && (
        <div className={styles.goOverlay}>
          <div className={styles.goCard}>
            <div className={styles.goIcon}>⏱</div>
            <div className={styles.goTitle}>Time&apos;s up</div>
            <div className={styles.goBody}>
              Retry with a shorter clock.
              <br />
              Max points this question:{" "}
              <strong>
                {Math.max(
                  5,
                  (shared.pointsPerQuestion ?? 20) -
                    (retries + 1) * (shared.retryPenalty ?? 5)
                )}
              </strong>
            </div>
            <div className={styles.goTime}>
              {Math.max(
                shared.minTimerSecs ?? 20,
                (shared.baseTimerSecs ?? 60) -
                  (retries + 1) * (shared.retryTimerCut ?? 15)
              )}
              s
            </div>
            <div className={styles.goLbl}>on retry</div>
            <div className={styles.actRow}>
              <button className={styles.btnTeal} onClick={retryQuestion}>
                Try again
              </button>
              <button
                className={styles.btnGold}
                onClick={() => setScreen("hub")}
              >
                Menu
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.game}>
        {/* Strip */}
        <div className={styles.strip}>
          <button
            className={styles.backBtn}
            onClick={() => {
              stopTimer();
              setScreen("hub");
            }}
          >
            ← Back
          </button>
          {renderDots()}
          <div className={styles.stripRight}>
            <span
              className={styles.tierChip}
              style={{
                background: TIER_STYLES[tier].bg,
                color: TIER_STYLES[tier].color,
              }}
            >
              {TIER_LABELS[tier]}
            </span>
            {tier !== "learn" && (
              <span className={styles.scoreChip}>{score} pts</span>
            )}
          </div>
        </div>

        {/* Timer bar */}
        {needsTimer() && !showGameOver && (
          <div className={styles.timerBar}>
            <div
              className={timerClass}
              style={{ width: `${timerPct}%` }}
            />
          </div>
        )}

        <div className={styles.card}>
          {/* Instruction / mascot */}
          {renderInstruction()}

          {/* Equation — the interactive surface */}
          {stepPhase === "result"
            ? null /* equation shown in result row */
            : renderEquation()}

          {/* Hint (challenge only) */}
          {tier === "challenge" &&
            stepPhase === "drag" &&
            !hintUsedThisQ && (
              <div className={styles.hintRow}>
                <button className={styles.hintBtn} onClick={useHint}>
                  💡 Hint{" "}
                  <span style={{ fontSize: 10, opacity: 0.65 }}>
                    −{shared.hintPenalty ?? 5}pts / −
                    {shared.hintTimePenalty ?? 5}s
                  </span>
                </button>
              </div>
            )}
          {tier === "challenge" && hintVisible && (
            <div className={styles.hintRow}>
              <div className={styles.hintTxt}>{step.hint}</div>
            </div>
          )}

          {/* Tile bank OR MCQ OR result */}
          {stepPhase === "drag" && renderTiles()}
          {isMCQ && renderMCQ()}
          {stepPhase === "result" && renderResult()}

          {/* Wrong feedback */}
          <div
            className={[
              styles.wrongLine,
              wrongVisible ? styles.wrongLineShow : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {wrongMsg}
          </div>
        </div>
      </div>
    </div>
  );
}