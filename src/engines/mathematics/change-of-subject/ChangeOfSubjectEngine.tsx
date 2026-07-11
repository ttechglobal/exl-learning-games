"use client";

import React from "react";

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
import cosAudio from "./cosaudio";
import { MicroGameWhackAMole } from "./MicroGameWhackAMole";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier = "learn" | "challenge" | "master";

// Phase within a single question-step
type StepPhase =
  | "drag"       // waiting for tile to be dragged to both sides
  | "mcq_left"   // MCQ for left side simplification
  | "mcq_right"  // MCQ for right side simplification
  | "result";    // showing the new equation before advancing

// Top-level screen
type Screen =
  | "hub"               // tier selection
  | "mission_select"    // mission grid for practice/challenge
  | "question_intro"    // "Make t the subject" callout before Q starts
  | "playing"           // active gameplay
  | "mission_complete"  // this mission is done — show score + next mission CTA
  | "micro_game";       // 30-second fun burst before next mission

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

const TIER_LABELS: Record<Tier, string> = {
  learn: "📖 Learn",
  challenge: "✏️ Challenge",
  master: "⚡ Master",
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
  challenge: {
    bg: "var(--cos-gold-light)",
    color: "var(--cos-gold-dark)",
    tagClass: styles.tagPractice,
  },
  master: {
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
    title: "You've got it!",
    msg: "Now try the same questions without the guide. No timer — just you and the equation.",
    nextTier: "challenge",
    nextLabel: "Practice on your own →",
  },
  challenge: {
    icon: "✏️",
    title: "Challenge complete!",
    msg: "Solid work. Ready for Master level? These are harder, real-exam questions — SS2/SS3 level.",
    nextTier: "master",
    nextLabel: "Try Master →",
  },
  master: {
    icon: "🏆",
    title: "Master complete!",
    msg: "Exceptional. You've tackled the hardest Change of Subject questions. You're ready for any exam.",
    nextTier: null,
    nextLabel: "",
  },
};

// ─── Math global styles ──────────────────────────────────────────────────────
const MATH_STYLES = `
  .cos-frac{display:inline-flex;flex-direction:column;align-items:center;
    font-family:'JetBrains Mono',monospace;font-weight:700;vertical-align:middle;line-height:1.1}
  .cos-num{border-bottom:2.5px solid currentColor;padding:0 4px 2px;text-align:center;display:block}
  .cos-den{padding:2px 4px 0;text-align:center;display:block}
  .cos-term{font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--cos-ink,#2b2a28)}
  .cos-op{color:var(--cos-ink-soft,#6b6a66)!important}
  .cos-sqrt{display:inline-flex;align-items:center;font-family:'JetBrains Mono',monospace;font-weight:700}
  .cos-rad{line-height:.88;padding-right:1px;font-size:1.18em}
  .cos-ri{border-top:2.5px solid currentColor;padding:2px 4px 0}
  .cos-block{display:inline-flex;flex-direction:column;align-items:center;
    background:var(--cos-coral-bg,#fbe4e0);border:1.5px dashed var(--cos-coral,#c24c3f);
    border-radius:5px;padding:2px 7px;color:var(--cos-coral,#c24c3f);
    font-family:'JetBrains Mono',monospace;font-weight:700;vertical-align:middle}
  .cos-block-row{flex-direction:row}
  .cos-tile-ghost{position:fixed;z-index:300;pointer-events:none;touch-action:none;
    font-family:'JetBrains Mono',monospace;font-size:17px;font-weight:700;
    background:var(--cos-gold,#D98E3B);color:#fff;padding:12px 22px;border-radius:8px;
    box-shadow:0 8px 20px rgba(0,0,0,.22);transform:scale(1.06)}
`;

// ─── Mission metadata ─────────────────────────────────────────────────────────
interface MissionRecord { score:number; stars:number; completed:boolean; avgTimeSec?:number; }

const MISSION_META: Record<string,{name:string;subtitle:string;diff:1|2|3;missionKey:string}> = {
  practice_m1:  {name:"Motion Formulae",  subtitle:"v = u + at, y = mx + c",        diff:2, missionKey:"practice_m1"},
  practice_m2:  {name:"Area & Volume",    subtitle:"A = πr², V = lwh, A = ½bh",     diff:2, missionKey:"practice_m2"},
  challenge_m1: {name:"The Hard Stuff",   subtitle:"s = ut + ½at², T = 2π√(l/g)",  diff:3, missionKey:"challenge_m1"},
  challenge_m2: {name:"Physics Boss",     subtitle:"E = ½mv², v² = u² + 2as",       diff:3, missionKey:"challenge_m2"},
};

const TIER_MISSIONS: Record<string,string[]> = {
  challenge: ["practice_m1",  "practice_m2"],
  master:    ["challenge_m1", "challenge_m2"],
};

function isMissionUnlocked(key:string, records:Record<string,MissionRecord>, orderedKeys:string[]):boolean {
  const idx = orderedKeys.indexOf(key);
  if (idx <= 0) return true; // first mission (or unknown) is always unlocked
  return !!(records[orderedKeys[idx-1]]?.completed);
}

function calcStars(score:number):number {
  if (score >= 90) return 3;
  if (score >= 60) return 2;
  return 1;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ChangeOfSubjectEngine({
  config,
  onComplete,
  menu,
}: EngineRuntimeProps<ChangeOfSubjectConfig, ChangeOfSubjectOutcome>) {
  // ── Config resolution ──────────────────────────────────────────────────
  const shared = config.shared;

  // All DB missions + context injected via sharedConfig by PlayClient
  const sharedRaw = shared as Record<string,unknown>;
  const dbMissions = sharedRaw._allMissions as Array<{
    id: string; missionKey: string; title: string;
    difficulty: string; sequenceIndex: number; xpReward: number;
    payload: Record<string,unknown>;
  }> | undefined;
  const _studentId = sharedRaw._studentId as string | undefined;
  const _gameId    = sharedRaw._gameId    as string | undefined;
  const _topicId   = sharedRaw._topicId   as string | undefined;

  const payloadParse = ChangeOfSubjectMissionPayloadSchema.safeParse(
    config.mission.payload
  );

  // Get questions for a specific DB mission payload
  function getQuestionsFromPayload(payload: Record<string,unknown>): CosQuestion[] | null {
    const p = ChangeOfSubjectMissionPayloadSchema.safeParse(payload);
    if (p.success && p.data.questions.length > 0) return p.data.questions;
    return null;
  }

  // questions resolved per-tier when enterTier() is called
  const getQuestionsForTier = (t: string): CosQuestion[] => {
    if (payloadParse.success && payloadParse.data.questions.length > 0)
      return payloadParse.data.questions;
    // Map new tier names to question bank keys
    const bankKey = t === "master" ? "challenge" : t === "challenge" ? "practice" : "learn";
    return randomMissionForTier(bankKey);
  };
  const [questions, setQuestions] = useState<CosQuestion[]>(() => getQuestionsForTier("learn"));
  // Storage key: stable per game (uses the game's first mission id or a fixed fallback)
  const storageKey = `cos-records-${config.mission.id ?? "default"}`;

  const [missionRecords, setMissionRecords] = useState<Record<string,MissionRecord>>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
      return raw ? (JSON.parse(raw) as Record<string,MissionRecord>) : {};
    } catch { return {}; }
  });
  const [activeMissionKey, setActiveMissionKey] = useState<string>("learn_m1");

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
  const [xpEarnedThisMission, setXpEarnedThisMission] = useState(0);
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
  const [showExitWarning, setShowExitWarning] = useState(false);

  // Start ambient music on first interaction (Web Audio requires a gesture)
  const musicStartedRef = React.useRef(false);
  function ensureMusic() {
    if (musicStartedRef.current) return;
    musicStartedRef.current = true;
    cosAudio.startMusic();
  }

  // MCQ choices (shuffled once per MCQ render)
  const [mcqChoices, setMcqChoices] = useState<string[]>([]);
  const [mcqChosen, setMcqChosen] = useState<string | null>(null);
  const [musicMuted, setMusicMuted] = useState(false);
  // Tile choices (shuffled once per step, stored so re-renders don't reshuffle)
  const [tileChoices, setTileChoices] = useState<string[]>([]);

  // Wrong-line auto-hide timer
  const wrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ordered mission keys for current tier — set when mission_select renders
  const tierMissionKeysRef = useRef<string[]>([]);

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

  // ── Direct attempt post (awards XP per mission without triggering GameRuntime reflection) ──
  async function postMissionAttempt(missionId: string, xpEarned: number, pct: number) {
    if (!_studentId || !_gameId) return; // not in a full game context
    try {
      await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: _studentId,
          gameId: _gameId,
          missionId,
          topicId: _topicId ?? "change-of-subject-formula",
          success: true,
          score: pct,
          rawOutcome: { xpEarned, success: true, score: pct },
          completedAt: new Date().toISOString(),
        }),
      });
    } catch { /* offline — silent fail */ }
  }

  // ── Timer logic ────────────────────────────────────────────────────────
  function needsTimer(): boolean {
    return tier === "challenge" || tier === "master";
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
        // Audio cues: warn under 8s, gentle tick otherwise
        if (prev <= 8) cosAudio.timerWarn();
        else if (prev % 10 === 0) cosAudio.tick(); // every 10s
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

  // Cleanup on unmount — stop timer AND music
  useEffect(() => () => {
    stopTimer();
    cosAudio.stopMusic();
  }, []);

  // Persist mission records to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(missionRecords));
    } catch { /* storage full or unavailable */ }
  }, [missionRecords, storageKey]);

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
    ensureMusic();
    setTier(t);
    startTimeRef.current = Date.now();
    if (t === "learn") {
      // Learn goes straight to questions
      const newQs = getQuestionsForTier(t);
      setQuestions(newQs);
      setActiveMissionKey("learn_m1");
      resetForNewQuestion(newQs, 0);
      setScreen("question_intro");
    } else {
      // Challenge / Master show mission select first
      setScreen("mission_select");
    }
  }

  function resetForNewQuestion(qs: CosQuestion[], idx: number) {
    setQIdx(idx);
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
    if (qs[idx]) setTileChoices(shuffle([qs[idx].steps[0].tileOk, ...qs[idx].steps[0].tilesNo]));
  }

  function enterMission(missionKey: string) {
    // Try DB mission payload first, then hardcoded bank, then tier fallback
    const dbM = dbMissions?.find(m => m.missionKey === missionKey);
    const fromDb = dbM ? getQuestionsFromPayload(dbM.payload) : null;
    const fromBank = MISSIONS[missionKey as keyof typeof MISSIONS];
    const newQs = fromDb ?? fromBank ?? getQuestionsForTier(tier);
    setQuestions(newQs);
    setActiveMissionKey(missionKey);
    resetForNewQuestion(newQs, 0);
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
    ensureMusic();
    cosAudio.place();

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
        cosAudio.drop();
        setLApplied(true);
        markSide("left", capturedOp);
        checkBothApplied("left", capturedOp);
      } else if (landed === "right" && !rAppliedRef2.current) {
        cosAudio.drop();
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

    if (lAppliedRef.current && rAppliedRef.current) {
      // Both sides done — NOW grey out tiles
      document.querySelectorAll<HTMLButtonElement>("[data-cos-tile]").forEach(
        (t) => t.classList.add(styles.tileUsed)
      );
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
    if (chosen === correct) {
      setMcqChosen(chosen);
      setTimeout(() => {
        if (isLeft) openMCQ("right");
        else advanceStep();
      }, 480);
    } else {
      // Flash red briefly then reset — student can try again immediately
      setMcqChosen(chosen);
      setTimeout(() => setMcqChosen(null), 450);
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

  function saveMissionRecord(finalScore: number) {
    const maxPossible = questions.length * (shared.pointsPerQuestion ?? 20);
    const pct = Math.round((finalScore / maxPossible) * 100);
    const stars = calcStars(pct);
    const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
    const avgSec = Math.round(timeTaken / Math.max(1, questions.length));
    setMissionRecords(prev => {
      const existing = prev[activeMissionKey];
      if (existing && existing.score >= pct) return prev;
      return { ...prev, [activeMissionKey]: { score: pct, stars, completed: true, avgTimeSec: avgSec } };
    });
  }

  function goNextQuestion() {
    const isLast = qIdx === questions.length - 1;
    if (isLast) {
      stopTimer();
      saveMissionRecord(score);
      // Post attempt directly to award XP now (without triggering GameRuntime reflection)
      const maxPossible = questions.length * (shared.pointsPerQuestion ?? 20);
      const pct = maxPossible > 0 ? score / maxPossible : 0;
      const dbM = dbMissions?.find(m => m.missionKey === activeMissionKey);
      const missionId = dbM?.id ?? config.mission.id;
      const xpForThisMission = Math.round((dbM?.xpReward ?? config.mission.xpReward ?? 20) * Math.max(0.1, pct));
      postMissionAttempt(missionId, xpForThisMission, pct);
      setXpEarnedThisMission(xpForThisMission);
      cosAudio.missionDone();
      setScreen("mission_complete");
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

  // ── Go to next mission within tier ─────────────────────────────────────
  function goNextMission() {
    // Use the ref that was populated when mission_select rendered
    const tierMissions = tierMissionKeysRef.current.length > 0
      ? tierMissionKeysRef.current
      : (TIER_MISSIONS[tier] ?? []);
    const currentIdx = tierMissions.indexOf(activeMissionKey);
    const nextKey = currentIdx >= 0 ? tierMissions[currentIdx + 1] : undefined;
    if (nextKey) {
      // Enter next mission directly
      enterMission(nextKey);
    } else {
      // All missions done — trigger final reflection screen
      // XP was already awarded per-mission via postMissionAttempt, so xpEarned:0 here
      const maxPossible = questions.length * (shared.pointsPerQuestion ?? 20);
      const pct = maxPossible > 0 ? score / maxPossible : 0;
      onComplete({
        success: true,
        score: pct,
        finalScore: score,
        timeSpentSec: Math.round((Date.now() - startTimeRef.current) / 1000),
        hintsUsed: totalHints,
        attemptsBeforeSuccess: totalRetries,
        xpEarned: 0, // already awarded per-mission above
      });
    }
  }

  function goToMissionSelect() {
    setScreen(tier === "learn" ? "hub" : "mission_select");
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
    // Show "drop here" hint only on the first question so students learn the mechanic once
    const showLeftHint  = stepPhase === "drag" && !lApplied  && qIdx === 0;
    const showRightHint = stepPhase === "drag" && !rApplied  && qIdx === 0;

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
              (showLeftHint
                ? '<div style="font-size:10px;color:var(--cos-gold-dark);font-weight:700;margin-top:4px;letter-spacing:.04em">▼ DROP TILE HERE</div>'
                : '') +
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
              (showRightHint
                ? '<div style="font-size:10px;color:var(--cos-gold-dark);font-weight:700;margin-top:4px;letter-spacing:.04em">▼ DROP TILE HERE</div>'
                : '') +
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

    return (
      <div className={styles.mcqWrap}>
        {/*
          Math expression display — shows the side expression in a framed
          box so the student clearly sees WHAT they are simplifying.
          Rendered at a generous size so fractions/roots are readable.
        */}
        <div className={styles.mcqExprBox}>
          <div
            className={styles.mcqExprInner}
            dangerouslySetInnerHTML={{ __html: renderTokens(qTokens, 22) }}
          />
          <span className={styles.mcqExprEquals}>=&nbsp;?</span>
        </div>

        {/* Answer option buttons */}
        <div className={styles.mcqOpts}>
          {mcqChoices.map((c) => {
            let cls = styles.mcqBtn;
            if (mcqChosen !== null) {
              if (c === correct && c === mcqChosen) cls += " " + styles.mcqBtnCorrect;
              else if (c === mcqChosen && c !== correct) cls += " " + styles.mcqBtnWrong;
            }
            return (
              <button
                key={c}
                className={cls}
                onClick={() => pickMCQ(c)}
                dangerouslySetInnerHTML={{ __html: answerHTML(c) }}
              />
            );
          })}
        </div>
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
                {isFinalQ ? "Complete Mission →" : "Next question →"}
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

  // ── Context-aware instruction panel ────────────────────────────────────
  //
  // Shows on EVERY tier — the content adapts by tier and phase:
  //   drag phase  → tells the student exactly which tile to drag and where
  //   mcq_left    → tells them to pick what the left side simplifies to
  //   mcq_right   → confirms left side answer, prompts for right side
  //   result      → brief encouragement before they advance
  //
  // Learn: full owl explanation with step.mascot text + explicit action.
  // Challenge / Master: compact one-liner — still tells them what to do,
  //   but assumes they know the mechanic. No step.mascot verbose text.
  //
  // The key insight from user feedback: students were confused because
  // they didn't know (a) that they needed to drag to BOTH sides, and
  // (b) what the MCQ was asking after the drag. The instruction panel
  // must answer the "what do I do RIGHT NOW?" question at every moment.
  //
  function renderInstruction() {
    const isLearn = tier === "learn";

    // ── DRAG phase ──────────────────────────────────────────────────────
    if (stepPhase === "drag") {
      const dragMsg = isLearn
        ? step.mascot  // the per-step owl explanation (already great for learn)
        : `Drag the correct tile to <strong>both sides</strong> of the equation to keep it balanced.`;

      return (
        <div className={styles.mascotRow} style={isLearn ? {} : {
          background: "var(--cos-gold-light)",
          borderLeft: "3px solid var(--cos-gold)",
          borderRadius: "0 8px 8px 0",
        }}>
          {isLearn && <div className={styles.mascotAv}>🦉</div>}
          {!isLearn && <div className={styles.mascotAv} style={{ background: "var(--cos-gold-light)", fontSize: 14 }}>💡</div>}
          <div
            className={styles.mascotTxt}
            dangerouslySetInnerHTML={{ __html: highlightVars(dragMsg) }}
          />
        </div>
      );
    }

    // ── MCQ left side ────────────────────────────────────────────────────
    if (stepPhase === "mcq_left") {
      const prompt = isLearn
        ? `You applied the operation to both sides. Now — <strong>what does the left side simplify to?</strong> Pick the answer below.`
        : `<strong>What does the left side simplify to?</strong> Tap the correct answer.`;
      return (
        <div className={styles.mascotRow} style={isLearn ? {} : {
          background: "var(--cos-teal-light)", borderLeft: "3px solid var(--cos-teal)", borderRadius: "0 8px 8px 0",
        }}>
          {isLearn && <div className={styles.mascotAv}>🦉</div>}
          {!isLearn && <div className={styles.mascotAv} style={{ background: "var(--cos-teal-light)", fontSize: 14 }}>👈</div>}
          <div className={styles.mascotTxt} dangerouslySetInnerHTML={{ __html: prompt }} />
        </div>
      );
    }

    // ── MCQ right side ───────────────────────────────────────────────────
    if (stepPhase === "mcq_right") {
      const prompt = isLearn
        ? `Left side = <strong>${step.lAns}</strong> ✓ &nbsp; Now what does the <strong>right side</strong> simplify to? Pick below.`
        : `Left = <strong>${step.lAns}</strong> ✓ &nbsp; <strong>What does the right side simplify to?</strong>`;
      return (
        <div className={styles.mascotRow} style={isLearn ? {} : {
          background: "var(--cos-teal-light)", borderLeft: "3px solid var(--cos-teal)", borderRadius: "0 8px 8px 0",
        }}>
          {isLearn && <div className={styles.mascotAv}>🦉</div>}
          {!isLearn && <div className={styles.mascotAv} style={{ background: "var(--cos-teal-light)", fontSize: 14 }}>👉</div>}
          <div className={styles.mascotTxt} dangerouslySetInnerHTML={{ __html: prompt }} />
        </div>
      );
    }

    // ── Result phase ─────────────────────────────────────────────────────
    if (stepPhase === "result") {
      const isFinalStep = sIdx === totalSteps - 1;
      const msg = isLearn
        ? isFinalStep
          ? "<strong>Done!</strong> The variable is now the subject. ✓"
          : "Step complete — the equation is simpler. Ready for the next step?"
        : isFinalStep
          ? "Variable isolated! ✓"
          : "Step done. Keep going →";
      return (
        <div className={styles.mascotRow} style={{ background: "var(--cos-teal-light)", borderLeft: "3px solid var(--cos-teal)", borderRadius: "0 8px 8px 0" }}>
          {isLearn && <div className={styles.mascotAv}>🦉</div>}
          {!isLearn && <div className={styles.mascotAv} style={{ background: "var(--cos-teal-light)", fontSize: 14 }}>✓</div>}
          <div className={styles.mascotTxt} dangerouslySetInnerHTML={{ __html: msg }} />
        </div>
      );
    }

    return null;
  }

  // ── Screens ────────────────────────────────────────────────────────────

  // The hub uses the host app's back navigation (router.back / onBack from PlayClient)
  // We expose a goBack helper that calls onBack if available
  if (screen === "hub") {
    return (
      <div className={styles.root} style={{"--cos-paper":"#fbf6ea","--cos-line":"#c9d9ea","--cos-margin":"#e3a7a0","--cos-ink":"#2b2a28","--cos-ink-soft":"#6b6a66","--cos-gold":"#d98e3b","--cos-gold-dark":"#8f5a1e","--cos-gold-light":"#fef3dc","--cos-teal":"#2f6f62","--cos-teal-dark":"#1c443b","--cos-teal-light":"#e1f0ea","--cos-coral":"#c24c3f","--cos-coral-bg":"#fbe4e0","--cos-card":"#ffffff","touchAction":"pan-y"} as React.CSSProperties}>
      <style dangerouslySetInnerHTML={{__html:MATH_STYLES}} />
        <div className={styles.hub}>
          {menu && <div style={{ marginBottom: 8 }}>{menu}</div>}
          <div className={styles.hubTitle}>Change of Subject</div>
          <div className={styles.hubSub}>
            Make a variable the subject of a formula
          </div>
          <div className={styles.modeList}>
            {(["learn", "challenge", "master"] as Tier[]).map((t) => {
              const cfg = TIER_STYLES[t];
              const descs: Record<Tier, string> = {
                learn: "Guided — the owl walks you through every step.",
                challenge: "Work independently with a timer and hints.",
                master: "Harder questions. No guidance. Beat the clock.",
              };
              const tags: Record<Tier, string> = {
                learn: "Guided",
                challenge: "Timed",
                master: "Advanced",
              };
              return (
                <button
                  key={t}
                  className={styles.modeBtn}
                  onClick={() => enterTier(t)}
                >
                  <span className={styles.modeIcon}>
                    {t === "learn" ? "📖" : t === "challenge" ? "✏️" : "⚡"}
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

  if (screen === "mission_select") {
    // Use DB missions if available, filtered by tier; otherwise use hardcoded bank
    const tierDiffMap: Record<string, string> = { learn: "EASY", challenge: "MEDIUM", master: "HARD" };
    const tierDiff = tierDiffMap[tier] ?? "EASY";
    const missionKeys = dbMissions && dbMissions.length > 0 && tier !== "learn"
      ? dbMissions
          .filter(m => m.difficulty === tierDiff)
          .sort((a,b) => a.sequenceIndex - b.sequenceIndex)
          .map(m => m.missionKey)
      : (TIER_MISSIONS[tier] ?? []);
    // Store ordered keys so goNextMission can use the same order
    tierMissionKeysRef.current = missionKeys;
    const dbMissionMap = dbMissions
      ? Object.fromEntries(dbMissions.map(m => [m.missionKey, m]))
      : {};
    return (
      <div className={styles.root} style={{"--cos-paper":"#fbf6ea","--cos-line":"#c9d9ea","--cos-margin":"#e3a7a0","--cos-ink":"#2b2a28","--cos-ink-soft":"#6b6a66","--cos-gold":"#d98e3b","--cos-gold-dark":"#8f5a1e","--cos-gold-light":"#fef3dc","--cos-teal":"#2f6f62","--cos-teal-dark":"#1c443b","--cos-teal-light":"#e1f0ea","--cos-coral":"#c24c3f","--cos-coral-bg":"#fbe4e0","--cos-card":"#ffffff","touchAction":"pan-y"} as React.CSSProperties}>
      <style dangerouslySetInnerHTML={{__html:MATH_STYLES}} />
        <div className={styles.game}>
          <div className={styles.strip}>
            <button className={styles.backBtn} onClick={() => setScreen("hub")}>← Back</button>
            <span className={styles.tierChip} style={{ background: TIER_STYLES[tier].bg, color: TIER_STYLES[tier].color }}>
              {TIER_LABELS[tier]}
            </span>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div className={styles.hubTitle}>
              {tier === "challenge" ? "Challenge Missions" : "Master Missions"}
            </div>
            <div className={styles.hubSub}>
              {"Complete each mission to unlock the next — timed."}
            </div>
          </div>
          <div className={styles.missionGrid}>
            {missionKeys.map((key, mIdx) => {
              const dbM = dbMissionMap[key];
              const meta = MISSION_META[key] ?? {
                name: dbM?.title ?? key,
                subtitle: "",
                diff: (tier === "master" ? 3 : tier === "challenge" ? 2 : 1) as 1|2|3,
                missionKey: key,
              };
              const record = missionRecords[key];
              const unlocked = isMissionUnlocked(key, missionRecords, missionKeys);
              const starCount = record?.stars ?? 0;
              const pctScore = record?.score ?? 0;
              return (
                <div
                  key={key}
                  className={[styles.missionCard, !unlocked ? styles.missionLocked : "", record?.completed ? styles.missionDone : ""].filter(Boolean).join(" ")}
                  onClick={() => unlocked && enterMission(key)}
                >
                  <div className={styles.missionCardTop}>
                    <span className={styles.missionStatus}>
                      {!unlocked ? "🔒" : record?.completed ? "✓" : ""}
                    </span>
                    <span className={styles.missionDiff}>{"⭐".repeat(meta.diff)}</span>
                  </div>
                  <div className={styles.missionName}>{meta.name}</div>
                  {record?.completed && (
                    <div className={styles.missionResult}>
                      <span className={styles.missionStars}>
                        {[1,2,3].map(n => <span key={n} style={{ opacity: n <= starCount ? 1 : 0.25 }}>★</span>)}
                      </span>
                      <div className={styles.missionResultRight}>
                        <span className={styles.missionScore}>{pctScore}%</span>
                        {record.avgTimeSec && (
                          <span className={styles.missionTime}>~{record.avgTimeSec}s/Q</span>
                        )}
                      </div>
                    </div>
                  )}
                  {unlocked && (
                    <div className={styles.missionCta}>
                      {record?.completed
                        ? "↩ Play again"
                        : tier === "master" ? "⚡ Start" : "Start →"}
                    </div>
                  )}
                  {!unlocked && (
                    <div className={styles.missionLockMsg}>Complete Mission {mIdx} first</div>
                  )}
                </div>
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
      <style dangerouslySetInnerHTML={{__html:MATH_STYLES}} />
        <div className={styles.game}>
          <div className={styles.strip}>
            <button className={styles.backBtn} onClick={() => setScreen(tier === "learn" ? "hub" : "mission_select")}>
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
                lineHeight: 1.6,
              }}
            >
              {tier === "learn"
                ? <>🦉 The owl will guide you through <strong>each step</strong>.<br/>Drag a tile to <strong>both sides</strong> of the equation to keep it balanced.</>
                : tier === "challenge"
                ? <>⚖️ Drag a tile to <strong>both sides</strong> to keep the equation balanced.<br/>Then simplify each side. Timer starts now.</>
                : <>⚡ No hints. Drag tiles to both sides, simplify, and beat the clock.</>
              }
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

  if (screen === "mission_complete") {
    // Find next mission in this tier
    const tierMissions = tierMissionKeysRef.current.length > 0
      ? tierMissionKeysRef.current
      : (TIER_MISSIONS[tier] ?? []);
    const currentIdx = tierMissions.indexOf(activeMissionKey);
    const nextMissionKey = currentIdx >= 0 ? tierMissions[currentIdx + 1] : undefined;
    const nextMeta = nextMissionKey ? MISSION_META[nextMissionKey] : null;
    const record = missionRecords[activeMissionKey];
    const starCount = record?.stars ?? 0;
    const pctScore = record?.score ?? 0;
    const isLastMission = !nextMissionKey;

    return (
      <div className={styles.root} style={{"--cos-paper":"#fbf6ea","--cos-line":"#c9d9ea","--cos-margin":"#e3a7a0","--cos-ink":"#2b2a28","--cos-ink-soft":"#6b6a66","--cos-gold":"#d98e3b","--cos-gold-dark":"#8f5a1e","--cos-gold-light":"#fef3dc","--cos-teal":"#2f6f62","--cos-teal-dark":"#1c443b","--cos-teal-light":"#e1f0ea","--cos-coral":"#c24c3f","--cos-coral-bg":"#fbe4e0","--cos-card":"#ffffff","touchAction":"pan-y"} as React.CSSProperties}>
        <style dangerouslySetInnerHTML={{__html:MATH_STYLES}} />
        <div className={styles.game}>
          <div className={styles.card}>
            <div className={styles.levelComplete}>

              {/* Hero icon */}
              <div className={styles.lcIcon} style={{ fontSize: 56 }}>🎉</div>
              <div className={styles.lcTitle}>Mission Complete!</div>

              {/* Stars */}
              <div style={{ fontSize: 30, color: "var(--cos-gold)", letterSpacing: 6, margin: "10px 0 6px" }}>
                {[1,2,3].map(n => (
                  <span key={n} style={{ opacity: n <= starCount ? 1 : 0.18 }}>★</span>
                ))}
              </div>

              {/* XP earned chip — the dopamine hit */}
              {xpEarnedThisMission > 0 && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  background: "linear-gradient(135deg,#fef3c7,#fde68a)",
                  border: "2px solid #d97706",
                  borderRadius: 999, padding: "8px 20px", margin: "6px 0 10px",
                  animation: "rise 0.4s ease"
                }}>
                  <span style={{ fontSize: 20 }}>⭐</span>
                  <span style={{ fontFamily: "var(--eg-font-display,'Baloo 2',sans-serif)", fontSize: 22, fontWeight: 900, color: "#92400e", letterSpacing: "-0.01em" }}>
                    +{xpEarnedThisMission} XP
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#b45309" }}>earned!</span>
                </div>
              )}

              {/* Score percentage — record.score is already 0-100, never multiply again */}
              <div className={styles.lcScore} style={{ marginTop: 4 }}>{Math.round(record?.score ?? 0)}%</div>
              <div className={styles.lcScoreLbl}>accuracy</div>

              {/* Next mission name preview */}
              {nextMeta && (
                <div style={{
                  margin: "14px 0 6px",
                  padding: "10px 16px",
                  background: "var(--cos-teal-light)",
                  border: "1.5px solid var(--cos-teal)",
                  borderRadius: 10,
                  fontSize: 13, color: "var(--cos-teal-dark)", fontWeight: 600,
                  textAlign: "center"
                }}>
                  Up next: <strong>{nextMeta.name}</strong>
                </div>
              )}

              <div className={styles.actRow} style={{ marginTop: 16, flexDirection: "column", gap: 10 }}>
                {/* PRIMARY — go to micro-game first, then next mission */}
                <button
                  className={styles.btnTeal}
                  onClick={() => setScreen("micro_game")}
                  style={{ width: "100%", fontSize: 16, padding: "14px 20px", borderRadius: 12,
                           boxShadow: "0 5px 0 #1c443b", transition: "transform .1s, box-shadow .1s",
                           display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  {isLastMission
                    ? <><span>🏆</span> You&apos;re Done!</>
                    : <><span>🚀</span> Let&apos;s Continue</>
                  }
                </button>

                {/* SECONDARY — back to pick */}
                <button className={styles.btnGold} onClick={goToMissionSelect}
                  style={{ width: "100%", padding: "12px 20px", borderRadius: 12, fontSize: 14 }}>
                  📋 Mission Select
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Micro-game: Whack-a-Mole ────────────────────────────────────────────
  // Pure fun, zero maths. Fires between mission_complete and the next mission.
  // 20 seconds, moles pop from 9 holes, tap to whack. Bonus XP for score ≥ 5.
  // Skip button always visible so no one feels trapped.
  if (screen === "micro_game") {
    return (
      <MicroGameWhackAMole
        onFinish={(_bonusXp: number) => {
          // Bonus XP from micro-game noted — future: could award via separate lightweight call
          // For now: proceed directly to next mission to keep the flow seamless
          goNextMission();
        }}
      />
    );
  }

  // ── Playing screen ──────────────────────────────────────────────────────
  const isMCQ = stepPhase === "mcq_left" || stepPhase === "mcq_right";

  return (
    <div className={styles.root} style={{"--cos-paper":"#fbf6ea","--cos-line":"#c9d9ea","--cos-margin":"#e3a7a0","--cos-ink":"#2b2a28","--cos-ink-soft":"#6b6a66","--cos-gold":"#d98e3b","--cos-gold-dark":"#8f5a1e","--cos-gold-light":"#fef3dc","--cos-teal":"#2f6f62","--cos-teal-dark":"#1c443b","--cos-teal-light":"#e1f0ea","--cos-coral":"#c24c3f","--cos-coral-bg":"#fbe4e0","--cos-card":"#ffffff","touchAction":"pan-y"} as React.CSSProperties}>
      <style dangerouslySetInnerHTML={{__html:MATH_STYLES}} />
      {/* Exit warning modal */}
      {showExitWarning && (
        <div className={styles.goOverlay}>
          <div className={styles.goCard}>
            <div className={styles.goIcon}>⚠️</div>
            <div className={styles.goTitle} style={{ color: "var(--cos-gold-dark)" }}>Leave this mission?</div>
            <div className={styles.goBody}>
              Your progress on this mission will be lost.<br/>
              Any points earned <strong>will not be saved</strong>.
            </div>
            <div className={styles.actRow}>
              <button
                className={styles.btnTeal}
                onClick={() => setShowExitWarning(false)}
              >
                Keep playing
              </button>
              <button
                className={styles.btnGold}
                onClick={() => {
                  stopTimer();
                  setShowExitWarning(false);
                  setScreen(tier === "learn" ? "hub" : "mission_select");
                }}
              >
                Leave anyway
              </button>
            </div>
          </div>
        </div>
      )}

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
            onClick={() => setShowExitWarning(true)}
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
          {/* Sticky question reference — centered, Kalam, always visible */}
          <div className={styles.questionRef}>
            <div className={styles.questionRefLabel}>{q.qLabel}</div>
            <div className={styles.questionRefFormula}>{q.formula}</div>
          </div>

          {/* Instruction / mascot */}
          {renderInstruction()}

          {/* After-first-drop nudge: left done, right still needs tile */}
          {stepPhase === "drag" && lApplied && !rApplied && (
            <div style={{
              textAlign: "center",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--cos-gold-dark)",
              padding: "4px 0 6px",
              animation: "fadeUp .25s ease",
            }}>
              ✓ Left side done — now drag the same tile to the <strong>right side</strong> too ▶
            </div>
          )}
          {/* Equation — the interactive surface */}
          {stepPhase === "result"
            ? null /* equation shown in result row */
            : renderEquation()}

          {/* Tile bank OR MCQ OR result */}
          {stepPhase === "drag" && renderTiles()}
          {isMCQ && renderMCQ()}
          {stepPhase === "result" && renderResult()}

          {/* Hint BELOW options (challenge only) */}
          {tier === "challenge" && stepPhase === "drag" && !hintUsedThisQ && (
            <div className={styles.hintRow}>
              <button className={styles.hintBtn} onClick={useHint}>
                💡 Hint{" "}
                <span style={{ fontSize: 10, opacity: 0.65 }}>
                  −{shared.hintPenalty ?? 5}pts / −{shared.hintTimePenalty ?? 5}s
                </span>
              </button>
            </div>
          )}
          {tier === "challenge" && hintVisible && (
            <div className={styles.hintRow}>
              <div className={styles.hintTxt}>{step.hint}</div>
            </div>
          )}

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