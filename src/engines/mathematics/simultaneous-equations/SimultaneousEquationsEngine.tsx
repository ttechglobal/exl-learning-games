"use client";
/**
 * SimultaneousEquationsEngine.tsx
 *
 * Simultaneous Equations — same notebook-paper world as Change of Subject.
 *
 * Visual system: identical to ChangeOfSubjectEngine — same --cos-* tokens,
 * same Kalam/Baloo 2/JetBrains Mono fonts, same notebook-paper background,
 * same red margin line, same mascot row, same MCQ tile animations.
 *
 * Mechanic:
 *   Phase 1 — PICK an operation card (Add / Subtract / Scale / Solve / Substitute)
 *   Phase 2 — CONFIRM the updated equations on the board
 *   Phase 3 — MCQ "what does this simplify to?"
 *   Repeat until both variables found → mission complete
 */

import React, { useState, useRef, useEffect } from "react";
import type { EngineRuntimeProps } from "@/engines/engine-types";
import {
  TIER_QUESTIONS,
  OPERATION_LABELS,
  type SimQuestion,
  type SimStep,
  type SimOp,
} from "./simultaneousEquationsQuestions";
import styles from "./SimultaneousEquationsEngine.module.css";

// Load same fonts as CoS
if (typeof window !== "undefined" && !document.getElementById("sim-fonts")) {
  const l = document.createElement("link");
  l.id = "sim-fonts"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Kalam:wght@700&family=Baloo+2:wght@700;800;900&family=JetBrains+Mono:wght@700&display=swap";
  document.head.appendChild(l);
}

// ── CSS variable set — same names as CoS so shared overrides work ──────────
const CSS_VARS = {
  "--cos-paper":      "#fbf6ea",
  "--cos-line":       "#c9d9ea",
  "--cos-margin":     "#e3a7a0",
  "--cos-ink":        "#2b2a28",
  "--cos-ink-soft":   "#6b6a66",
  "--cos-gold":       "#d98e3b",
  "--cos-gold-dark":  "#8f5a1e",
  "--cos-gold-light": "#fef3dc",
  "--cos-teal":       "#2f6f62",
  "--cos-teal-dark":  "#1c443b",
  "--cos-teal-light": "#e1f0ea",
  "--cos-coral":      "#c24c3f",
  "--cos-coral-bg":   "#fbe4e0",
  "--cos-card":       "#ffffff",
  touchAction: "pan-y",
} as React.CSSProperties;

// ── Types ──────────────────────────────────────────────────────────────────
type Tier   = "learn" | "challenge" | "master";
type Screen = "hub" | "question_intro" | "playing" | "mission_complete";
type Phase  = "pick" | "confirm" | "mcq" | "done";

interface MissionRecord { stars: number; score: number; completed: boolean; }

function calcStars(score: number) {
  if (score >= 90) return 3;
  if (score >= 60) return 2;
  return 1;
}
function shuffle<T>(arr: T[]): T[] { return [...arr].sort(() => Math.random() - 0.5); }

const STORAGE_KEY = "simEq_v1_records";

// ── Component ──────────────────────────────────────────────────────────────
export function SimultaneousEquationsEngine({
  config, onComplete, autoStartTier,
}: EngineRuntimeProps<Record<string,unknown>,Record<string,unknown>> & {
  autoStartTier?: Tier;
}) {
  const [missionRecords, setMissionRecords] = useState<Record<string,MissionRecord>>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(missionRecords)); } catch {}
  }, [missionRecords]);

  const [screen, setScreen]   = useState<Screen>("hub");
  const [tier, setTier]       = useState<Tier>("learn");
  const [questions, setQuestions] = useState<SimQuestion[]>([]);
  const [qIdx, setQIdx]       = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [phase, setPhase]     = useState<Phase>("pick");
  const [score, setScore]     = useState(0);
  const [retries, setRetries] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [mcqChosen, setMcqChosen] = useState<string | null>(null);
  const [mcqChoices, setMcqChoices] = useState<string[]>([]);
  const [wrongVisible, setWrongVisible] = useState(false);
  const [wrongMsg, setWrongMsg] = useState("");
  const [hintVisible, setHintVisible] = useState(false);
  const [resultBoard, setResultBoard] = useState<string[]>([]);

  const wrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef  = useRef(Date.now());
  const autoStartRef  = useRef(autoStartTier);

  const q    = questions[qIdx];
  const step: SimStep | undefined = q?.steps[stepIdx];
  const totalSteps = q?.steps.length ?? 0;
  const isLearn = tier === "learn";

  // MCQ setup
  useEffect(() => {
    if (phase !== "mcq" || !step) return;
    setMcqChoices(shuffle([step.mcqCorrect, ...step.mcqWrong.slice(0, 3)]));
    setMcqChosen(null);
  }, [phase, step]);

  // Auto-enter tier on mount
  useEffect(() => {
    if (autoStartRef.current) {
      const t = setTimeout(() => enterTier(autoStartRef.current!), 80);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tier entry ──────────────────────────────────────────────────────────
  function enterTier(t: Tier) {
    setTier(t);
    const qs = shuffle(TIER_QUESTIONS[t] ?? TIER_QUESTIONS.learn);
    setQuestions(qs);
    setQIdx(0); setStepIdx(0); setPhase("pick"); setScore(0); setRetries(0);
    setResultBoard([]); setWrongVisible(false); setHintVisible(false);
    startTimeRef.current = Date.now();
    setScreen("question_intro");
  }

  // ── Pick operation ──────────────────────────────────────────────────────
  function pickOperation(op: SimOp) {
    if (!step) return;
    if (op !== step.operation) {
      playTone(false);
      setWrongMsg("That's not the right move — try another operation.");
      setWrongVisible(true); setRetries(r => r + 1);
      if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = setTimeout(() => setWrongVisible(false), 2200);
      return;
    }
    playTone(true);
    setResultBoard(step.resultLines);
    setPhase("confirm");
  }

  function confirmResult() { setPhase("mcq"); }

  // ── MCQ ────────────────────────────────────────────────────────────────
  function pickMCQ(answer: string) {
    if (!step || mcqChosen !== null) return;
    setMcqChosen(answer);
    if (answer === step.mcqCorrect) {
      playTone(true);
      const pts = Math.max(5, 20 - retries * 4);
      setScore(s => s + pts);
      setTimeout(() => advanceStep(), 500);
    } else {
      playTone(false);
      setRetries(r => r + 1);
      setTimeout(() => setMcqChosen(null), 450);
    }
  }

  function advanceStep() {
    if (stepIdx === totalSteps - 1) {
      finishQuestion();
    } else {
      setStepIdx(s => s + 1); setPhase("pick");
      setResultBoard([]); setRetries(0); setHintVisible(false); setWrongVisible(false);
    }
  }

  function finishQuestion() {
    const maxPossible = questions.length * 60;
    const pct = Math.round((score / Math.max(1, maxPossible)) * 100);
    const stars = calcStars(pct);
    setMissionRecords(prev => ({ ...prev, [`${tier}_q${qIdx}`]: { stars, score: pct, completed: true } }));
    const xp = Math.round(((config as Record<string,number>).xpReward ?? 30) * Math.max(0.2, pct / 100));
    setXpEarned(Math.round(xp));
    if (qIdx === questions.length - 1) {
      setScreen("mission_complete");
    } else {
      setQIdx(q => q + 1); setStepIdx(0); setPhase("pick");
      setResultBoard([]); setRetries(0); setHintVisible(false);
    }
  }

  function getAvailableOps(): SimOp[] {
    if (!step) return [];
    const all: SimOp[] = ["add_eqs","sub_eq2","sub_eq1","scale_eq1","scale_eq2","solve","substitute"];
    if (isLearn) {
      const others = all.filter(op => op !== step.operation).slice(0, 3);
      return shuffle([step.operation, ...others]);
    }
    return shuffle(all);
  }

  function playTone(correct: boolean) {
    try {
      const ctx = new (window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = correct ? 660 : 220;
      g.gain.setValueAtTime(0.18, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.35);
    } catch {}
  }

  // ── SCREENS ────────────────────────────────────────────────────────────

  // HUB
  if (screen === "hub") {
    return (
      <div className={styles.root} style={CSS_VARS}>
        <div className={styles.hub}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🔍</div>
          <div className={styles.hubTitle}>Simultaneous Equations</div>
          <div className={styles.hubSub}>Eliminate variables. Solve the case.</div>
          <div className={styles.modeList}>
            {(["learn","challenge","master"] as Tier[]).map(t => {
              const meta: Record<Tier,{icon:string;name:string;desc:string;tag:string;tagCls:string}> = {
                learn:     { icon:"🦉", name:"Learn",     desc:"Guided — the owl walks you through every step", tag:"Guided",   tagCls: styles.tagLearn },
                challenge: { icon:"⚡", name:"Challenge", desc:"Independent — pick your own operations",        tag:"Timed",    tagCls: styles.tagChallenge },
                master:    { icon:"🔥", name:"Master",    desc:"Hard questions. No guidance. Beat the clock.",  tag:"Advanced", tagCls: styles.tagMaster },
              };
              const m = meta[t];
              return (
                <button key={t} className={styles.tierBtn} onClick={() => enterTier(t)}>
                  <span className={styles.tierBtnIcon}>{m.icon}</span>
                  <div className={styles.tierBtnBody}>
                    <div className={styles.tierBtnName}>{m.name}</div>
                    <div className={styles.tierBtnDesc}>{m.desc}</div>
                  </div>
                  <span className={`${styles.tierBtnTag} ${m.tagCls}`}>{m.tag}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // QUESTION INTRO
  if (screen === "question_intro" && q) {
    return (
      <div className={styles.root} style={CSS_VARS}>
        <div className={styles.game}>
          <div className={styles.card}>
            <div className={styles.introCase}>📂 Case {q.caseId}</div>
            <div className={styles.introTitle}>{q.goal}</div>
            <div className={styles.caseFileBox}>
              <div className={styles.caseFileLabel}>Given Equations</div>
              <div className={styles.caseEq}>{q.eq1}</div>
              <div className={styles.caseEq}>{q.eq2}</div>
            </div>
            <div className={styles.introDesc}>
              {tier === "learn"
                ? <><span>🦉</span> The owl will guide you through each step — just follow the clues.</>
                : tier === "challenge"
                ? <><span>⚡</span> Pick the right operations to eliminate variables and solve the case.</>
                : <><span>🔥</span> No guidance. Crack the case entirely on your own.</>
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

  // MISSION COMPLETE
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
              <div className={styles.starsRow}>
                {[1,2,3].map(n => (
                  <span key={n} className={styles.rStar}
                    style={{ opacity: n <= stars ? 1 : 0.18, animationDelay: `${(n-1)*.18}s` }}>⭐</span>
                ))}
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
                <button className={styles.btnPrimary} onClick={() => onComplete({ success: true, score: score / 100, finalScore: score, xpEarned })}>
                  🚀 Continue
                </button>
                <button className={styles.btnSecondary} onClick={() => setScreen("hub")}>
                  🏠 Back to Hub
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // PLAYING
  if (!q || !step) return null;
  const availableOps = getAvailableOps();

  return (
    <div className={styles.root} style={CSS_VARS}>
      <div className={styles.game}>

        {/* Top strip */}
        <div className={styles.strip}>
          <button className={styles.backBtn} onClick={() => setScreen("hub")}>← Hub</button>
          <div className={styles.stepDots}>
            {q.steps.map((_, i) => (
              <span key={i} className={styles.stepDot} style={{
                background: i < stepIdx ? "var(--cos-teal)"
                  : i === stepIdx ? "var(--cos-gold)"
                  : "var(--cos-line)",
                transform: i === stepIdx ? "scale(1.3)" : "scale(1)",
              }} />
            ))}
          </div>
          <span className={styles.scoreChip}>{score} pts</span>
        </div>

        {/* Mascot/instruction */}
        {renderInstruction()}

        {/* Wrong feedback */}
        {phase === "pick" && wrongVisible && (
          <div className={styles.wrongMsg}>{wrongMsg}</div>
        )}

        {/* Equation board */}
        <div className={styles.caseFile}>
          <div className={styles.caseFileLabel}>Case {q.caseId}</div>
          <div className={styles.eqBoard}>
            <div className={styles.eqRow}>
              <span className={styles.eqTag}>①</span>
              <span className={styles.eqText}>{q.eq1}</span>
            </div>
            <div className={styles.eqRow}>
              <span className={styles.eqTag}>②</span>
              <span className={styles.eqText}>{q.eq2}</span>
            </div>
            {resultBoard.length > 0 && (
              <div className={styles.resultSection}>
                <div className={styles.resultDivider} />
                {resultBoard.map((line, i) => (
                  <div key={i} className={`${styles.resultLine}${line.startsWith("──") ? " " + styles.resultRule : ""}`}>
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PICK phase */}
        {phase === "pick" && (
          <div className={styles.opSection}>
            <div className={styles.opSectionLabel}>
              Step {stepIdx + 1} of {totalSteps} — Pick the right operation:
            </div>
            <div className={styles.opGrid}>
              {availableOps.map(op => {
                const meta = OPERATION_LABELS[op];
                const label = op.startsWith("scale") && step.factor
                  ? `${meta.icon} ${op === "scale_eq1" ? "Scale Eq①" : "Scale Eq②"} ×${step.factor}`
                  : `${meta.icon} ${meta.label}`;
                return (
                  <button key={op} className={styles.opBtn} onClick={() => pickOperation(op)}>
                    <span className={styles.opBtnLabel}>{label}</span>
                    <span className={styles.opBtnSub}>{meta.sublabel}</span>
                  </button>
                );
              })}
            </div>
            {!hintVisible && retries >= (isLearn ? 2 : 1) && (
              <button className={styles.hintBtn} onClick={() => setHintVisible(true)}>
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

        {/* CONFIRM phase */}
        {phase === "confirm" && (
          <div className={styles.confirmSection}>
            <div className={styles.confirmMsg}>
              ✓ Operation applied — check the updated equations above.
            </div>
            <button className={styles.confirmBtn} onClick={confirmResult}>
              {stepIdx === totalSteps - 1 ? "Answer the final question →" : "Continue →"}
            </button>
          </div>
        )}

        {/* MCQ phase */}
        {phase === "mcq" && (
          <div className={styles.mcqSection}>
            <div className={styles.mcqExprBox}>
              <span className={styles.mcqQuestion}>{step.mcqQuestion}</span>
            </div>
            <div className={styles.mcqOpts}>
              {mcqChoices.map(c => {
                let cls = styles.mcqBtn;
                if (mcqChosen !== null) {
                  if (c === step.mcqCorrect) cls += " " + styles.mcqBtnCorrect;
                  else if (c === mcqChosen) cls += " " + styles.mcqBtnWrong;
                }
                return (
                  <button key={c} className={cls}
                    onClick={() => pickMCQ(c)}
                    disabled={mcqChosen !== null}>
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );

  function renderInstruction() {
    if (!step) return null;
    const showOwl = isLearn;

    if (phase === "pick") {
      return (
        <div className={styles.mascotRow} style={showOwl ? {} : {
          background: "var(--cos-gold-light)",
          borderLeft: "3px solid var(--cos-gold)",
        }}>
          <div className={styles.mascotAv}>{showOwl ? "🦉" : "💡"}</div>
          <div className={styles.mascotTxt}
            dangerouslySetInnerHTML={{ __html: showOwl ? step.mascot : step.hint }} />
        </div>
      );
    }
    if (phase === "confirm") {
      return (
        <div className={styles.mascotRow} style={{ background: "var(--cos-teal-light)", borderLeft: "3px solid var(--cos-teal)" }}>
          <div className={styles.mascotAv}>✓</div>
          <div className={styles.mascotTxt}>
            Read the updated equations above — see how the operation changed them?
          </div>
        </div>
      );
    }
    if (phase === "mcq") {
      return (
        <div className={styles.mascotRow} style={{ background: "var(--cos-teal-light)", borderLeft: "3px solid var(--cos-teal)" }}>
          <div className={styles.mascotAv}>❓</div>
          <div className={styles.mascotTxt}>
            <strong>What does the result simplify to?</strong> Tap the correct answer below.
          </div>
        </div>
      );
    }
    return null;
  }
}