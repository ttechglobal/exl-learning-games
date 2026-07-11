"use client";
/**
 * SimultaneousEquationsEngine.tsx
 *
 * "Math Detective" — Solve the case by eliminating variables.
 *
 * ARCHITECTURE: mirrors Change-of-Subject engine exactly.
 *   Screens: hub → mission_select → question_intro → playing → mission_complete → micro_game
 *   Tiers:   learn | challenge | master
 *
 * MECHANIC (new — designed for simultaneous equations):
 *   Phase 1 — PICK: student taps an Operation Card (Add / Subtract / Scale)
 *   Phase 2 — CONFIRM: equation board updates live showing the result
 *   Phase 3 — MCQ: "what does the result simplify to?" (same as CoS)
 *   Repeat until both variables found → mission complete
 *
 * UI LANGUAGE: notebook paper + warm cream — identical palette to CoS so
 * both games feel like the same world.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import type { EngineRuntimeProps } from "@/engines/engine-types";
import { MicroGameWhackAMole } from "@/engines/mathematics/change-of-subject/MicroGameWhackAMole";
import {
  TIER_QUESTIONS,
  OPERATION_LABELS,
  type SimQuestion,
  type SimStep,
  type SimOp,
} from "./simultaneousEquationsQuestions";
import styles from "./SimultaneousEquationsEngine.module.css";

// ── Types ──────────────────────────────────────────────────────────────────────

type Tier   = "learn" | "challenge" | "master";
type Screen =
  | "hub"
  | "playing"
  | "question_intro"
  | "mission_complete"
  | "micro_game";

type Phase =
  | "pick"      // student picks an operation card
  | "confirm"   // board updated, student reads result, taps Continue
  | "mcq"       // "what does this simplify to?"
  | "done";     // all steps solved

interface MissionRecord {
  stars: number;
  score: number;  // 0-100
  completed: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcStars(score: number) {
  if (score >= 90) return 3;
  if (score >= 60) return 2;
  return 1;
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

const STORAGE_KEY = "simEq_v1_records";

// ── Engine Component ───────────────────────────────────────────────────────────

export function SimultaneousEquationsEngine({ config, onComplete }: EngineRuntimeProps<Record<string,unknown>,Record<string,unknown>>) {
  // ── persisted records ────────────────────────────────────────────────────
  const [missionRecords, setMissionRecords] = useState<Record<string, MissionRecord>>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); } catch { return {}; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(missionRecords)); } catch {}
  }, [missionRecords]);

  // ── screen / tier state ──────────────────────────────────────────────────
  const [screen, setScreen]   = useState<Screen>("hub");
  const [tier, setTier]       = useState<Tier>("learn");

  // ── mission state ─────────────────────────────────────────────────────────
  const [questions, setQuestions]         = useState<SimQuestion[]>([]);
  const [qIdx, setQIdx]                   = useState(0);
  const [stepIdx, setStepIdx]             = useState(0);
  const [phase, setPhase]                 = useState<Phase>("pick");
  const [score, setScore]                 = useState(0);
  const [retries, setRetries]             = useState(0);
  const [xpEarned, setXpEarned]           = useState(0);
  const [mcqChosen, setMcqChosen]         = useState<string | null>(null);
  const [mcqChoices, setMcqChoices]       = useState<string[]>([]);
  const [wrongMsg, setWrongMsg]           = useState("");
  const [wrongVisible, setWrongVisible]   = useState(false);
  const [hintVisible, setHintVisible]     = useState(false);
  const [resultBoard, setResultBoard]     = useState<string[]>([]);
  const [musicMuted, setMusicMuted]       = useState(false);

  const wrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef  = useRef(Date.now());

  const q = questions[qIdx];
  const step: SimStep | undefined = q?.steps[stepIdx];
  const totalSteps = q?.steps.length ?? 0;
  const isLearn = tier === "learn";

  // ── MCQ setup when entering MCQ phase ────────────────────────────────────
  useEffect(() => {
    if (phase !== "mcq" || !step) return;
    const choices = shuffle([step.mcqCorrect, ...step.mcqWrong.slice(0, 3)]);
    setMcqChoices(choices);
    setMcqChosen(null);
  }, [phase, step]);

  // ── start a tier ─────────────────────────────────────────────────────────
  function enterTier(t: Tier) {
    setTier(t);
    const qs = shuffle(TIER_QUESTIONS[t] ?? TIER_QUESTIONS.learn);
    setQuestions(qs);
    setQIdx(0);
    setStepIdx(0);
    setPhase("pick");
    setScore(0);
    setRetries(0);
    setResultBoard([]);
    setWrongVisible(false);
    setHintVisible(false);
    startTimeRef.current = Date.now();
    setScreen("question_intro");
  }

  // ── pick operation ────────────────────────────────────────────────────────
  function pickOperation(op: SimOp) {
    if (!step) return;
    if (op !== step.operation) {
      // Wrong choice
      playHit(false);
      setWrongMsg("That's not the right move here — try another operation.");
      setWrongVisible(true);
      setRetries(r => r + 1);
      if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = setTimeout(() => setWrongVisible(false), 2200);
      return;
    }
    // Correct operation chosen
    playHit(true);
    setResultBoard(step.resultLines);
    setPhase("confirm");
  }

  // ── confirm (student has read result) ────────────────────────────────────
  function confirmResult() {
    setPhase("mcq");
  }

  // ── MCQ answer ────────────────────────────────────────────────────────────
  function pickMCQ(answer: string) {
    if (!step || mcqChosen !== null) return;
    setMcqChosen(answer);

    if (answer === step.mcqCorrect) {
      playHit(true);
      // Award points
      const maxPts = 20;
      const pts = Math.max(5, maxPts - retries * 4);
      setScore(s => s + pts);
      setTimeout(() => {
        advanceStep();
      }, 500);
    } else {
      playHit(false);
      setRetries(r => r + 1);
      setTimeout(() => setMcqChosen(null), 450);
    }
  }

  // ── advance to next step or finish ───────────────────────────────────────
  function advanceStep() {
    const isLastStep = stepIdx === totalSteps - 1;
    if (isLastStep) {
      finishQuestion();
    } else {
      setStepIdx(s => s + 1);
      setPhase("pick");
      setResultBoard([]);
      setRetries(0);
      setHintVisible(false);
      setWrongVisible(false);
    }
  }

  // ── finish one question → next question or mission complete ───────────────
  function finishQuestion() {
    const isLastQ = qIdx === questions.length - 1;
    const maxPossible = questions.length * 60;
    const pct = Math.round((score / maxPossible) * 100);
    const stars = calcStars(pct);
    const missionKey = `${tier}_q${qIdx}`;

    setMissionRecords(prev => ({
      ...prev,
      [missionKey]: { stars, score: pct, completed: true },
    }));

    const xpTotal = Math.round((config as Record<string, number>).xpReward ?? 30) * Math.max(0.2, pct / 100);
    setXpEarned(Math.round(xpTotal));

    if (isLastQ) {
      setScreen("mission_complete");
    } else {
      setQIdx(q => q + 1);
      setStepIdx(0);
      setPhase("pick");
      setResultBoard([]);
      setRetries(0);
      setHintVisible(false);
    }
  }

  // ── operation tiles available per step / tier ─────────────────────────────
  function getAvailableOps(): SimOp[] {
    if (!step) return [];
    if (isLearn) {
      // Learn: only show the correct op + 1–2 plausible distractors
      const all: SimOp[] = ["add_eqs", "sub_eq2", "sub_eq1", "scale_eq1", "scale_eq2", "solve", "substitute"];
      const others = all.filter(op => op !== step.operation).slice(0, 3);
      return shuffle([step.operation, ...others]);
    }
    // Challenge / Master: show all relevant ops
    return shuffle(["add_eqs", "sub_eq2", "sub_eq1", "scale_eq1", "scale_eq2", "solve", "substitute"]);
  }

  // ── tiny inline sounds ────────────────────────────────────────────────────
  function playHit(correct: boolean) {
    try {
      const ctx = new (window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = correct ? 660 : 220;
      g.gain.setValueAtTime(0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (correct ? 0.3 : 0.15));
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.35);
    } catch {}
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  const CSS_VARS = {
    "--se-paper":     "#f8f6f0",
    "--se-line":      "#c5d8e8",
    "--se-margin":    "#e8b4b0",
    "--se-ink":       "#1e2a3a",
    "--se-ink-soft":  "#5a6a7a",
    "--se-teal":      "#1e6b74",
    "--se-teal-dark": "#0f3d42",
    "--se-teal-light":"#dff0f2",
    "--se-gold":      "#c8861a",
    "--se-gold-dark": "#7a4e08",
    "--se-gold-light":"#fef5dc",
    "--se-coral":     "#c44040",
    "--se-coral-bg":  "#fce4e4",
  } as React.CSSProperties;

  // ── HUB ──────────────────────────────────────────────────────────────────
  if (screen === "hub") {
    return (
      <div className={styles.root} style={CSS_VARS}>
        <div className={styles.game}>
          <div className={styles.card}>
            <div className={styles.hubHeader}>
              <div className={styles.hubIcon}>🔍</div>
              <div className={styles.hubTitle}>Simultaneous Equations</div>
              <div className={styles.hubSub}>Eliminate variables. Solve the case.</div>
            </div>
            <div className={styles.hubTiers}>
              {(["learn","challenge","master"] as Tier[]).map(t => {
                const labels: Record<Tier, { icon: string; name: string; desc: string }> = {
                  learn:     { icon: "🦉", name: "Learn",     desc: "Guided — owl walks you through every step" },
                  challenge: { icon: "⚡", name: "Challenge", desc: "Independent — pick your own operations" },
                  master:    { icon: "🔥", name: "Master",    desc: "Timed — no guidance, beat the clock" },
                };
                const meta = labels[t];
                return (
                  <button key={t} className={styles.tierBtn} onClick={() => enterTier(t)}>
                    <span className={styles.tierBtnIcon}>{meta.icon}</span>
                    <div className={styles.tierBtnBody}>
                      <div className={styles.tierBtnName}>{meta.name}</div>
                      <div className={styles.tierBtnDesc}>{meta.desc}</div>
                    </div>
                    <span className={styles.tierBtnArrow}>→</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── QUESTION INTRO ────────────────────────────────────────────────────────
  if (screen === "question_intro" && q) {
    return (
      <div className={styles.root} style={CSS_VARS}>
        <div className={styles.game}>
          <div className={styles.card}>
            <div className={styles.introCase}>📂 Case {q.caseId}</div>
            <div className={styles.introTitle}>{q.goal}</div>

            {/* Display equations like a case file */}
            <div className={styles.caseFileBox}>
              <div className={styles.caseFileLabel}>Equations</div>
              <div className={styles.caseEq}>{q.eq1}</div>
              <div className={styles.caseEq}>{q.eq2}</div>
            </div>

            <div className={styles.introDesc}>
              {tier === "learn"
                ? <><span>🦉</span> The owl will guide you through each operation — just follow the clues.</>
                : tier === "challenge"
                ? <><span>⚡</span> Pick the right operations to eliminate variables and solve the case.</>
                : <><span>🔥</span> No guidance. Crack the case on your own.</>
              }
            </div>

            <button className={styles.startBtn} onClick={() => setScreen("playing")}>
              🕵️ Start Investigation →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── MICRO GAME ────────────────────────────────────────────────────────────
  if (screen === "micro_game") {
    return (
      <MicroGameWhackAMole onFinish={(_bonus) => {
        // After micro-game, call onComplete to advance in the platform
        onComplete({ success: true, score: score / 100, finalScore: score, xpEarned });
      }} />
    );
  }

  // ── MISSION COMPLETE ──────────────────────────────────────────────────────
  if (screen === "mission_complete") {
    const pct = Math.round(score / Math.max(1, questions.length * 60) * 100);
    const stars = calcStars(pct);
    return (
      <div className={styles.root} style={CSS_VARS}>
        <div className={styles.game}>
          <div className={styles.card}>
            <div className={styles.levelComplete}>
              <div style={{ fontSize: 52 }}>🎉</div>
              <div className={styles.lcTitle}>Case Solved!</div>
              <div style={{ fontSize: 28, color: "var(--se-gold)", letterSpacing: 6, margin: "10px 0 6px" }}>
                {[1,2,3].map(n => <span key={n} style={{ opacity: n <= stars ? 1 : 0.18 }}>★</span>)}
              </div>

              {xpEarned > 0 && (
                <div className={styles.xpChip}>
                  <span>⭐</span>
                  <span className={styles.xpAmt}>+{xpEarned} XP</span>
                  <span className={styles.xpLbl}>earned!</span>
                </div>
              )}

              <div className={styles.lcScore}>{Math.min(100, pct)}%</div>
              <div className={styles.lcScoreLbl}>accuracy</div>

              <div className={styles.actRow}>
                <button className={styles.btnTeal} onClick={() => setScreen("micro_game")}>
                  🚀 Let&apos;s Continue
                </button>
                <button className={styles.btnGold} onClick={() => setScreen("hub")}>
                  🏠 Back to Hub
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── PLAYING ───────────────────────────────────────────────────────────────
  if (!q || !step) return null;

  const availableOps = getAvailableOps();
  const stepNum  = stepIdx + 1;
  const totalNum = totalSteps;

  return (
    <div className={styles.root} style={CSS_VARS}>
      <div className={styles.game}>

        {/* ── Strip: case info + step dots + score ── */}
        <div className={styles.strip}>
          <button className={styles.backBtn} onClick={() => setScreen("hub")}>← Hub</button>
          <div className={styles.stepDots}>
            {q.steps.map((_, i) => (
              <span
                key={i}
                className={styles.stepDot}
                style={{
                  background: i < stepIdx ? "var(--se-teal)"
                    : i === stepIdx ? "var(--se-gold)"
                    : "var(--se-line)",
                  transform: i === stepIdx ? "scale(1.3)" : "scale(1)",
                }}
              />
            ))}
          </div>
          <span className={styles.scoreChip}>{score} pts</span>
        </div>

        {/* ── INSTRUCTION / MASCOT ── */}
        {renderInstruction()}

        {/* ── AFTER-PICK NUDGE ── */}
        {phase === "pick" && wrongVisible && (
          <div className={styles.wrongMsg}>{wrongMsg}</div>
        )}

        {/* ── EQUATION BOARD (always visible) ── */}
        <div className={styles.caseFile}>
          <div className={styles.caseFileLabel}>Case {q.caseId}</div>
          <div className={styles.eqBoard}>
            {/* Original equations */}
            <div className={styles.eqRow}>
              <span className={styles.eqTag}>①</span>
              <span className={styles.eqText}>{q.eq1}</span>
            </div>
            <div className={styles.eqRow}>
              <span className={styles.eqTag}>②</span>
              <span className={styles.eqText}>{q.eq2}</span>
            </div>

            {/* Live result board */}
            {resultBoard.length > 0 && (
              <div className={styles.resultSection}>
                <div className={styles.resultDivider} />
                {resultBoard.map((line, i) => (
                  <div
                    key={i}
                    className={[
                      styles.resultLine,
                      line.startsWith("──") ? styles.resultRule : "",
                    ].filter(Boolean).join(" ")}
                  >
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── PHASE: PICK OPERATION ── */}
        {phase === "pick" && (
          <div className={styles.opSection}>
            <div className={styles.opSectionLabel}>
              Step {stepNum} of {totalNum} — Pick the right operation:
            </div>
            <div className={styles.opGrid}>
              {availableOps.map(op => {
                const meta = OPERATION_LABELS[op];
                const displayLabel = op.startsWith("scale") && step.factor
                  ? `${meta.icon} ${op === "scale_eq1" ? "Scale Eq1" : "Scale Eq2"} × ${step.factor}`
                  : `${meta.icon} ${meta.label}`;
                return (
                  <button
                    key={op}
                    className={styles.opBtn}
                    onClick={() => pickOperation(op)}
                  >
                    <span className={styles.opBtnLabel}>{displayLabel}</span>
                    <span className={styles.opBtnSub}>{meta.sublabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Hint (Challenge/Master: on demand; Learn: auto after 2 wrong) */}
            {!hintVisible && retries >= (isLearn ? 2 : 1) && (
              <button
                className={styles.hintBtn}
                onClick={() => setHintVisible(true)}
              >
                💡 Show hint
              </button>
            )}
            {hintVisible && (
              <div className={styles.hintBox}>
                <span>💡</span> {step.hint}
              </div>
            )}
          </div>
        )}

        {/* ── PHASE: CONFIRM RESULT ── */}
        {phase === "confirm" && (
          <div className={styles.confirmSection}>
            <div className={styles.confirmMsg}>
              ✓ Operation applied — check the result above.
            </div>
            <button className={styles.confirmBtn} onClick={confirmResult}>
              {stepIdx === totalSteps - 1 ? "Answer the final question →" : "Continue →"}
            </button>
          </div>
        )}

        {/* ── PHASE: MCQ ── */}
        {phase === "mcq" && (
          <div className={styles.mcqSection}>
            <div className={styles.mcqExprBox}>
              <span className={styles.mcqQuestion}>{step.mcqQuestion}</span>
            </div>
            <div className={styles.mcqOpts}>
              {mcqChoices.map(c => {
                let cls = styles.mcqBtn;
                if (mcqChosen !== null) {
                  if (c === step.mcqCorrect && c === mcqChosen) cls += " " + styles.mcqBtnCorrect;
                  else if (c === mcqChosen && c !== step.mcqCorrect) cls += " " + styles.mcqBtnWrong;
                }
                return (
                  <button key={c} className={cls} onClick={() => pickMCQ(c)}>{c}</button>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );

  // ── Instruction renderer ─────────────────────────────────────────────────
  function renderInstruction() {
    if (!step) return null;
    const showOwl = isLearn;

    if (phase === "pick") {
      return (
        <div className={styles.mascotRow} style={showOwl ? {} : {
          background: "var(--se-gold-light)",
          borderLeft: "3px solid var(--se-gold)",
        }}>
          <div className={styles.mascotAv}>{showOwl ? "🦉" : "💡"}</div>
          <div
            className={styles.mascotTxt}
            dangerouslySetInnerHTML={{ __html: showOwl ? step.mascot : step.hint }}
          />
        </div>
      );
    }

    if (phase === "confirm") {
      return (
        <div className={styles.mascotRow} style={{ background: "var(--se-teal-light)", borderLeft: "3px solid var(--se-teal)" }}>
          <div className={styles.mascotAv}>✓</div>
          <div className={styles.mascotTxt}>
            Read the updated equations above — see how the operation changed them?
          </div>
        </div>
      );
    }

    if (phase === "mcq") {
      const isLeft = stepIdx % 2 === 0;
      return (
        <div className={styles.mascotRow} style={{ background: "var(--se-teal-light)", borderLeft: "3px solid var(--se-teal)" }}>
          <div className={styles.mascotAv}>{isLeft ? "👈" : "👉"}</div>
          <div className={styles.mascotTxt}>
            <strong>What does the result simplify to?</strong> Tap the correct answer below.
          </div>
        </div>
      );
    }

    return null;
  }
}