"use client";

/**
 * ParticleFieldEngine.tsx — Matter Lab v6
 *
 * FIXES IN THIS VERSION:
 *
 * 1. CANVAS NO LONGER STRETCHES
 *    Root cause: canvas used height:100% in CSS, and its parent had flex:1
 *    with no fixed height, so offsetHeight grew each frame as the canvas
 *    itself expanded the layout. Fix: canvas parent gets a fixed height
 *    (240px, set in CSS via .canvasWrap { height: 240px }).
 *    The canvas element uses width:100%, height:100% inside that fixed box.
 *    offsetWidth/offsetHeight now return stable values every frame.
 *
 * 2. PARTICLES MOVE PROPORTIONALLY FAST AT HIGH TEMPERATURE
 *    Speed scale was 0.004 — too small. At gas phase (speedM≈2.2) this gave
 *    2.2 * 0.004 = 0.0088 units/sec ≈ 2.6px/sec on a 300px canvas. Invisible.
 *    New scale: 0.022. Gas particles now move at ~14px/sec. Solid still at 0.
 *    The nudge factor is also raised to 0.25 so particles respond to slider
 *    changes in ~1 second rather than ~6 seconds.
 *
 * 3. "LET ME TRY AGAIN" IN THE PICKER
 *    A "↩ Go back and try" button sits below the label grid during the picker.
 *    Tapping it dismisses the question, returns to "playing", and Dr. Adaobi
 *    says to try the slider again. The transition stays in firedKeys so it
 *    won't re-fire — but the student can observe freely before answering again
 *    via the "Ready — ask me" flow.
 *    Actually: we remove it from firedKeys so it CAN re-fire — giving the
 *    student a genuine second chance to observe and then answer.
 *
 * 4. STAGE-DIFFERENTIATED QUESTIONS (EASY/MEDIUM/HARD)
 *    The picker prompt changes per stage:
 *    EASY    — observation: "What are the particles doing?" (physical description)
 *    MEDIUM  — naming: "What change of state is this?" (formal term)
 *    HARD    — application: deeper question from the transition's hardPrompt
 *    Label options already vary by difficulty (3/4/6 options).
 *    The prompt text now also varies to match the stage intent.
 *
 * 5. INTRO INSTRUCTIONS ARE STAGE-SPECIFIC
 *    Dr. Adaobi's opening line and the begin-mission button text are tailored
 *    to the selected difficulty. Guided Learning gets maximum explanation;
 *    Challenge gets a brief mission statement.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { GameplayShell } from "@/components/gameplay/GameplayShell";
import type { EngineRuntimeProps } from "@/engines/engine-types";
import type {
  ParticleFieldConfig,
  ParticleFieldOutcome,
  Transition,
} from "./particleField.config";
import {
  buildParticles,
  detectTransition,
  getOptionsForDifficulty,
  getSpeedMult,
  getPhase,
  type Particle,
} from "./particleField.logic";
import styles from "./ParticleFieldEngine.module.css";

// ─── Stage labels + prompts ───────────────────────────────────────────────────

const STAGE_LABEL: Record<string, string> = {
  EASY:   "Guided Learning",
  MEDIUM: "Practice",
  HARD:   "Challenge",
};

/** The picker question varies by stage — observation → naming → application */
function getPickerPrompt(difficulty: string, formalName: string): string {
  if (difficulty === "EASY") {
    return "Look at the particles — what are they doing right now?";
  }
  if (difficulty === "MEDIUM") {
    return `This is a change of state. Which one?`;
  }
  // HARD — more demanding
  return `What is happening, and what is this change called?`;
}

/** Dr. Adaobi's intro line — stage-specific */
function getIntroLine(difficulty: string, substanceName: string): string {
  if (difficulty === "EASY") {
    return `Welcome. I'm Dr. Adaobi. You're looking at ${substanceName} — but you're seeing it at the particle level.\n\nDrag the slider upward to add heat. Watch what happens to the particles. When you're ready, tap the button below.`;
  }
  if (difficulty === "MEDIUM") {
    return `You're looking at ${substanceName} at the particle level. Drag the slider to heat or cool it. Once you've explored, I'll ask you to name what you observe.`;
  }
  return `${substanceName}. Particle level. Drag the slider through every state change and name each one correctly. No hints.`;
}

/** Begin-mission button text — stage-specific */
function getBeginText(difficulty: string): string {
  if (difficulty === "EASY") return "I've explored — ask me questions →";
  if (difficulty === "MEDIUM") return "Ready — start the questions →";
  return "Begin Challenge →";
}

// ─── RGB colour ───────────────────────────────────────────────────────────────

function lerpN(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * Math.max(0, Math.min(1, t)));
}
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
interface RGB { r: number; g: number; b: number }
function getParticleRgb(temp: number, solidHex: string, liquidHex: string, gasHex: string, solidMax: number, liquidMax: number): RGB {
  const [sr,sg,sb] = hexToRgb(solidHex);
  const [lr,lg,lb] = hexToRgb(liquidHex);
  const [gr,gg,gb] = hexToRgb(gasHex);
  if (temp <= solidMax) return { r:sr, g:sg, b:sb };
  if (temp <= liquidMax) {
    const t = (temp - solidMax) / (liquidMax - solidMax);
    return { r:lerpN(sr,lr,t), g:lerpN(sg,lg,t), b:lerpN(sb,lb,t) };
  }
  const t = Math.min(1, (temp - liquidMax) / (100 - liquidMax));
  return { r:lerpN(lr,gr,t), g:lerpN(lg,gg,t), b:lerpN(lb,gb,t) };
}

// ─── Extended Particle ────────────────────────────────────────────────────────

interface ParticleExt extends Particle {
  gridX: number;
  gridY: number;
}

// ─── Engine phase ─────────────────────────────────────────────────────────────

type EnginePhase = "intro" | "playing" | "slowing" | "picker" | "correct-flash" | "conservation" | "done";

interface TransitionState {
  transition: Transition;
  options: string[];
  wrongAttempts: number;
  revealed: boolean;
  firstTry: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ParticleFieldEngine({ config: rawConfig, onComplete, menu, isPaused }: EngineRuntimeProps) {
  const cfg         = rawConfig as ParticleFieldConfig;
  const { shared, mission } = cfg;
  const payload     = mission.payload;
  const difficulty  = payload.difficulty ?? "MEDIUM";
  const transitions = payload.transitions;

  const solidMax  = shared.phases.solid.tempRange[1];
  const liquidMax = shared.phases.liquid.tempRange[1];

  // ── Refs ──────────────────────────────────────────────────────────────────
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const rafRef         = useRef<number>(0);
  const lastTimeRef    = useRef<number>(0);
  const particlesRef   = useRef<ParticleExt[]>([]);
  const tempRef        = useRef<number>(payload.startTemp);
  const prevTempRef    = useRef<number>(payload.startTemp);
  const firedKeys      = useRef<Set<string>>(new Set());
  const slowMoRef      = useRef<boolean>(false);
  const slowTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enginePhaseRef = useRef<EnginePhase>("intro");

  // ── React state ────────────────────────────────────────────────────────────
  const [enginePhase,   setEnginePhase]   = useState<EnginePhase>("intro");
  const [temperature,   setTemperature]   = useState(payload.startTemp);
  const [currentTrans,  setCurrentTrans]  = useState<TransitionState | null>(null);
  const [adaobiLine,    setAdaobiLine]    = useState(() => getIntroLine(difficulty, payload.substanceName));
  const [feedbackText,  setFeedbackText]  = useState("");
  const [revealedLabel, setRevealedLabel] = useState("");
  const [formalFlash,   setFormalFlash]   = useState("");
  const [conservVis,    setConservVis]    = useState(false);
  const [isSlowing,     setIsSlowing]     = useState(false);

  // ── Outcome ───────────────────────────────────────────────────────────────
  const startTime     = useRef(Date.now());
  const totalWrong    = useRef(0);
  const anyRevealed   = useRef(false);
  const firstTryCount = useRef(0);

  function setPhase(p: EnginePhase) {
    enginePhaseRef.current = p;
    setEnginePhase(p);
  }

  // ── Build particles ────────────────────────────────────────────────────────
  useEffect(() => {
    const base = buildParticles(shared.particleCount, payload.startTemp, shared);
    particlesRef.current = base.map(p => ({
      ...p,
      gridX: p.homeX ?? p.x,
      gridY: p.homeY ?? p.y,
    })) as ParticleExt[];
  }, []); // eslint-disable-line

  // ── Stable animation loop ──────────────────────────────────────────────────
  useEffect(() => {
    function tick(now: number) {
      rafRef.current = requestAnimationFrame(tick);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // SIZE THE CANVAS — reads offsetWidth/offsetHeight which are now stable
      // because the CSS wrapper has a fixed height (240px), not flex:1.
      const dpr  = window.devicePixelRatio || 1;
      const cssW = canvas.offsetWidth;
      const cssH = canvas.offsetHeight;
      if (cssW < 2 || cssH < 2) return;
      if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
        canvas.width  = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      const CW = cssW;
      const CH = cssH;

      const dt = Math.min((now - (lastTimeRef.current || now)) / 1000, 0.05);
      lastTimeRef.current = now;

      const ephs   = enginePhaseRef.current;
      const locked = isPaused || ephs === "picker" || ephs === "correct-flash" || ephs === "conservation";
      const slow   = slowMoRef.current;
      const dtEff  = locked ? 0 : slow ? dt * 0.1 : dt;

      const temp   = tempRef.current;
      const pname  = getPhase(temp, shared);
      const speedM = getSpeedMult(temp, shared);
      const { r, g, b } = getParticleRgb(temp,
        shared.particleColors.solid, shared.particleColors.liquid, shared.particleColors.gas,
        solidMax, liquidMax);
      const r2 = Math.max(3.5, Math.min(8, CW * 0.016));

      // Background
      ctx.clearRect(0, 0, CW, CH);
      const bg = ctx.createRadialGradient(CW*0.5, CH*0.4, 0, CW*0.5, CH*0.5, CW*0.9);
      bg.addColorStop(0, "#0d1f3c");
      bg.addColorStop(1, "#030a14");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CW, CH);

      // Chamber border
      const pulse = slow ? 0.4 + 0.35 * Math.sin(now * 0.007) : 0;
      ctx.strokeStyle = slow ? `rgba(255,200,60,${pulse})` : `rgba(${r},${g},${b},0.22)`;
      ctx.lineWidth   = slow ? 2.5 : 1.5;
      ctx.strokeRect(1, 1, CW - 2, CH - 2);

      const particles = particlesRef.current as ParticleExt[];

      // ── SPEED SCALE: 0.022 (was 0.004 — 5.5× larger, particles now visibly fast)
      const SPEED_SCALE = 0.022;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (dtEff > 0) {
          if (pname === "solid") {
            // Jitter amplitude = speedM * 0.028; NO floor → 0 at temp=0
            const amp = speedM * 0.028;
            if (amp < 0.0001) {
              p.x = p.gridX;
              p.y = p.gridY;
            } else {
              const t = now * 0.003 + p.jitterPhase;
              p.x = p.gridX + Math.sin(t * 2.1) * amp;
              p.y = p.gridY + Math.cos(t * 1.7) * amp;
            }
            p.homeX = p.gridX;
            p.homeY = p.gridY;
          } else {
            // Free movement
            p.x += p.vx * dtEff;
            p.y += p.vy * dtEff;

            const mx = r2 / CW;
            const my = r2 / CH;
            if (p.x < mx)     { p.x = mx;     p.vx =  Math.abs(p.vx); }
            if (p.x > 1 - mx) { p.x = 1 - mx; p.vx = -Math.abs(p.vx); }
            if (p.y < my)     { p.y = my;     p.vy =  Math.abs(p.vy); }
            if (p.y > 1 - my) { p.y = 1 - my; p.vy = -Math.abs(p.vy); }

            // Target speed — SPEED_SCALE replaces the old 0.004
            // Per-particle variety: slight variation in speed
            const variety = 0.75 + ((i * 137 + 1) % 50) / 100;
            const tgt = speedM * SPEED_SCALE * variety;
            const cur = Math.hypot(p.vx, p.vy);

            if (cur > 0.00001) {
              // NUDGE FACTOR 0.25 per frame (was 0.18) — responds in ~1 second
              const f = 1 + (tgt - cur) / cur * 0.25;
              p.vx *= f;
              p.vy *= f;
            } else {
              // Kick particle in a unique direction so not all start aligned
              const a = (i / particles.length) * Math.PI * 2 + p.jitterPhase;
              p.vx = Math.cos(a) * tgt;
              p.vy = Math.sin(a) * tgt;
            }

            // On entering liquid from solid: immediate velocity burst
            if (p.homeX !== null) {
              p.homeX = null;
              p.homeY = null;
              const a = p.jitterPhase; // unique per particle
              p.vx = Math.cos(a) * speedM * SPEED_SCALE;
              p.vy = Math.sin(a) * speedM * SPEED_SCALE;
            }
          }
        }

        // Draw particle
        const px = p.x * CW;
        const py = p.y * CH;

        // Glow halo
        const grd = ctx.createRadialGradient(px, py, 0, px, py, r2 * 3);
        grd.addColorStop(0,   `rgba(${r},${g},${b},0.35)`);
        grd.addColorStop(0.5, `rgba(${r},${g},${b},0.12)`);
        grd.addColorStop(1,   `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(px, py, r2 * 3, 0, Math.PI * 2);
        ctx.fill();

        // Core dot
        ctx.shadowColor = `rgb(${r},${g},${b})`;
        ctx.shadowBlur  = slow ? 22 : 8;
        ctx.fillStyle   = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.arc(px, py, r2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Specular highlight
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath();
        ctx.arc(px - r2 * 0.28, py - r2 * 0.28, r2 * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Temperature readout — top-right inside canvas
      const fontSize = Math.max(11, Math.round(CW * 0.038));
      ctx.font        = `bold ${fontSize}px "Fredoka", sans-serif`;
      ctx.textAlign   = "right";
      ctx.fillStyle   = `rgba(${r},${g},${b},0.9)`;
      ctx.fillText(`${Math.round(temp)}°`, CW - 8, fontSize + 4);
      ctx.textAlign   = "left";
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [shared, solidMax, liquidMax, isPaused]); // eslint-disable-line

  // ── Slider ────────────────────────────────────────────────────────────────
  const sliderRef = useRef<HTMLDivElement>(null);
  const dragging  = useRef(false);

  function tempFromY(clientY: number): number {
    const el = sliderRef.current;
    if (!el) return tempRef.current;
    const rect = el.getBoundingClientRect();
    return Math.round((1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))) * 100);
  }

  const handleTempChange = useCallback((newTemp: number) => {
    const ph = enginePhaseRef.current;
    if (ph === "picker" || ph === "correct-flash" || ph === "conservation") return;

    tempRef.current = newTemp;
    setTemperature(newTemp);

    if (ph !== "playing") return;

    const fired = detectTransition(prevTempRef.current, newTemp, transitions, firedKeys.current);
    prevTempRef.current = newTemp;
    if (!fired) return;

    tempRef.current = fired.threshold;
    setTemperature(fired.threshold);
    slowMoRef.current = true;
    setIsSlowing(true);

    const pauseNarration = difficulty === "EASY"
      ? "Something is changing. Look carefully at the particles. What are they doing right now?"
      : difficulty === "MEDIUM"
      ? "A change of state is happening. Watch and then name it."
      : "Identify this change of state.";
    setAdaobiLine(pauseNarration);

    slowTimerRef.current = setTimeout(() => {
      slowMoRef.current = false;
      setIsSlowing(false);
      const opts = getOptionsForDifficulty(fired, difficulty);
      setCurrentTrans({ transition: fired, options: opts, wrongAttempts: 0, revealed: false, firstTry: true });
      setFeedbackText("");
      setRevealedLabel("");
      setPhase("picker");
      setAdaobiLine(getPickerPrompt(difficulty, fired.formalName));
    }, shared.transitionPauseMs);
  }, [transitions, difficulty, shared.transitionPauseMs]); // eslint-disable-line

  function onDown(e: React.PointerEvent) {
    const ph = enginePhaseRef.current;
    if (ph === "picker" || ph === "correct-flash" || ph === "conservation") return;
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleTempChange(tempFromY(e.clientY));
  }
  function onMove(e: React.PointerEvent) { if (dragging.current) handleTempChange(tempFromY(e.clientY)); }
  function onUp() { dragging.current = false; }

  // ── Begin mission ─────────────────────────────────────────────────────────
  function beginMission() {
    prevTempRef.current = tempRef.current;
    firedKeys.current.clear();
    setPhase("playing");
    const playLine = difficulty === "EASY"
      ? "Drag the slider slowly upward. Each time the particles change behaviour, I'll pause and ask you what you see."
      : difficulty === "MEDIUM"
      ? "Drag the slider. When a change of state occurs, name it correctly."
      : "Drive the sample through every change of state. Name each one.";
    setAdaobiLine(playLine);
  }

  // ── "Try again" — dismiss picker, go back to slider, re-enable transition ─
  function tryAgain() {
    // Remove the transition from firedKeys so it can fire again
    if (currentTrans) {
      firedKeys.current.delete(currentTrans.transition.key);
    }
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    slowMoRef.current = false;
    setIsSlowing(false);
    setCurrentTrans(null);
    setFeedbackText("");
    setRevealedLabel("");
    setPhase("playing");
    setAdaobiLine(
      difficulty === "EASY"
        ? "Take your time — drag the slider and watch what the particles do. Then come back and answer."
        : "Go back to the slider and observe. When you're ready, drag through the threshold again."
    );
  }

  // ── Label pick ────────────────────────────────────────────────────────────
  const handleLabelPick = useCallback((label: string) => {
    if (!currentTrans) return;
    const { transition, wrongAttempts, firstTry } = currentTrans;

    if (label === transition.correctLabel) {
      firedKeys.current.add(transition.key);
      if (firstTry) firstTryCount.current++;
      setPhase("correct-flash");
      setFormalFlash(transition.formalName);
      setAdaobiLine(transition.confirmationNarration);
      setFeedbackText("");

      setTimeout(() => {
        if (transition.showConservationDrag) {
          setConservVis(true);
          setPhase("conservation");
          setAdaobiLine("One more thing — what happened to the total mass during that change?");
        } else {
          afterTransition();
        }
      }, 2400);
    } else {
      totalWrong.current++;
      const nw  = wrongAttempts + 1;
      const msg = transition.wrongFeedback?.[label]
        ?? "Not quite. Look at the gap between particles — getting closer together or further apart?";
      setFeedbackText(msg);
      setAdaobiLine(msg);
      setCurrentTrans(prev => prev ? { ...prev, wrongAttempts: nw, firstTry: false } : prev);

      if (nw >= shared.maxWrongBeforeReveal) {
        anyRevealed.current = true;
        setRevealedLabel(transition.correctLabel);
        setAdaobiLine(`Here — "${transition.correctLabel}" is ${transition.formalName}.`);
        setTimeout(() => {
          firedKeys.current.add(transition.key);
          setPhase("correct-flash");
          setFormalFlash(transition.formalName);
          setTimeout(() => {
            if (transition.showConservationDrag) {
              setConservVis(true);
              setPhase("conservation");
              setAdaobiLine("One more thing — what happened to the total mass during that change?");
            } else {
              afterTransition();
            }
          }, 2200);
        }, 2000);
      }
    }
  }, [currentTrans, shared.maxWrongBeforeReveal]); // eslint-disable-line

  function afterTransition() {
    setCurrentTrans(null);
    setFormalFlash("");
    setRevealedLabel("");
    setConservVis(false);
    const remaining = transitions.filter(t => !firedKeys.current.has(t.key));
    if (remaining.length === 0) {
      setPhase("done");
      setAdaobiLine("Well done! You identified every change of state. Keep exploring if you like — the slider is still live.");
      const outcome: ParticleFieldOutcome = {
        success: true,
        transitionsTotal: transitions.length,
        transitionsFirstTry: firstTryCount.current,
        totalWrongAttempts: totalWrong.current,
        anyRevealed: anyRevealed.current,
        timeSpentSec: Math.round((Date.now() - startTime.current) / 1000),
      };
      setTimeout(() => onComplete(outcome as never), 2200);
    } else {
      setPhase("playing");
      setAdaobiLine(`Good. ${remaining.length} more change${remaining.length > 1 ? "s" : ""} to find — keep dragging.`);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const currentPhaseName = getPhase(temperature, shared);
  const PHASE_LABEL: Record<string, string> = {
    solid:  "❄️ Solid — particles vibrate in place",
    liquid: "💧 Liquid — particles slide past each other",
    gas:    "💨 Gas — particles fly freely",
  };
  const done = firedKeys.current.size;

  const sliderLocked = enginePhase === "picker" || enginePhase === "correct-flash" || enginePhase === "conservation";

  const stats = [
    { label: "Stage",   value: STAGE_LABEL[difficulty] ?? difficulty, tone: "gold" as const },
    { label: "Changes", value: `${done}/${transitions.length}`, tone: done === transitions.length ? "success" as const : "default" as const },
  ];

  return (
    <GameplayShell
      fallbackGradient="linear-gradient(160deg, #030a14 0%, #0a1a2e 100%)"
      accentColor="#38c0f0"
      stats={stats}
      menu={menu!}
      isPaused={isPaused}
      gameTitle="Matter Lab"
      missionPrompt={{ label: "Substance", text: payload.substanceName }}
    >
      <div className={styles.outer}>

        {/* ── SIMULATION ROW ────────────────────────────────────────────── */}
        <div className={styles.simRow}>

          {/* Slider */}
          <div className={styles.sliderWrap}>
            <span className={styles.sliderLabel}>HOT</span>
            <div
              ref={sliderRef}
              className={[styles.sliderTrack, sliderLocked ? styles.sliderOff : ""].filter(Boolean).join(" ")}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={onUp}
            >
              <div className={styles.sliderFill} style={{ height: `${temperature}%` }} />
              {transitions.map(tr => (
                <div
                  key={tr.key}
                  className={[styles.thresh, firedKeys.current.has(tr.key) ? styles.threshDone : ""].filter(Boolean).join(" ")}
                  style={{ bottom: `${tr.threshold}%` }}
                />
              ))}
              <div className={styles.thumb} style={{ bottom: `calc(${temperature}% - 20px)` }}>
                <span className={styles.thumbVal}>{temperature}°</span>
              </div>
            </div>
            <span className={styles.sliderLabel}>COLD</span>
            {enginePhase === "intro" && temperature === payload.startTemp && (
              <div className={styles.ghost}><span className={styles.ghostArr}>↕</span></div>
            )}
          </div>

          {/* Canvas — FIXED HEIGHT so no stretching */}
          <div className={styles.canvasWrap}>
            <div className={styles.phaseBadge}>{PHASE_LABEL[currentPhaseName]}</div>
            <canvas ref={canvasRef} className={styles.canvas} />
            {isSlowing && <div className={styles.slowRing} />}

            {enginePhase === "correct-flash" && formalFlash && (
              <div className={styles.formalFlash}>
                <span className={styles.formalName}>{formalFlash}!</span>
              </div>
            )}

            {/* Dr. Adaobi bubble */}
            <div className={styles.adaobiStrip}>
              <div className={styles.adaobiAvatar}><DrAdaobi /></div>
              <div className={styles.adaobiBubble}>
                <p className={styles.adaobiText}>{adaobiLine}</p>
                {enginePhase === "intro" && (
                  <button className={styles.beginBtn} onClick={beginMission}>
                    {getBeginText(difficulty)}
                  </button>
                )}
                {enginePhase === "done" && (
                  <div className={styles.doneChip}>✓ Mission Complete</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── PICKER CARD ─────────────────────────────────────────────────── */}
        {enginePhase === "picker" && currentTrans && (
          <div className={styles.pickerCard}>
            <div className={styles.pickerPrompt}>
              {getPickerPrompt(difficulty, currentTrans.transition.formalName)}
            </div>

            {feedbackText && (
              <div className={styles.pickerFeedback} role="alert">💡 {feedbackText}</div>
            )}

            <div className={styles.labelGrid}>
              {currentTrans.options.map(opt => (
                <button
                  key={opt}
                  className={[
                    styles.labelBtn,
                    revealedLabel === opt ? styles.labelCorrect : "",
                    revealedLabel && opt !== revealedLabel ? styles.labelFaded : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => handleLabelPick(opt)}
                  disabled={!!revealedLabel}
                >
                  {opt}
                </button>
              ))}
            </div>

            {/* Try again — dismiss question, go back to explore */}
            {!revealedLabel && (
              <button className={styles.tryAgainBtn} onClick={tryAgain}>
                ↩ Not sure? Go back and observe the particles
              </button>
            )}
          </div>
        )}

        {/* ── CONSERVATION ─────────────────────────────────────────────────── */}
        {enginePhase === "conservation" && conservVis && (
          <div className={styles.pickerCard}>
            <div className={styles.pickerPrompt}>What happened to the mass of the substance?</div>
            <div className={styles.conservRow}>
              <div className={styles.conservScale}><div className={styles.scaleLabel}>Before</div><div style={{fontSize:"1.6rem"}}>⚖️</div></div>
              <div className={styles.conservArrow}>→</div>
              <div className={styles.conservScale}><div className={styles.scaleLabel}>After</div><div style={{fontSize:"1.6rem"}}>⚖️</div></div>
            </div>
            <p className={styles.conservHint}>Particles rearranged — none were created or destroyed.</p>
            <button className={styles.conservBtn} onClick={afterTransition}>Mass stays the same ✓</button>
          </div>
        )}
      </div>
    </GameplayShell>
  );
}

// ─── Dr. Adaobi ───────────────────────────────────────────────────────────────
function DrAdaobi() {
  return (
    <svg viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%"}} aria-hidden="true">
      <ellipse cx="40" cy="97" rx="22" ry="4" fill="rgba(0,0,0,0.3)"/>
      <rect x="27" y="74" width="10" height="18" fill="#1a2a4a" rx="3"/>
      <rect x="43" y="74" width="10" height="18" fill="#1a2a4a" rx="3"/>
      <ellipse cx="32" cy="92" rx="7" ry="4" fill="#0e1828"/>
      <ellipse cx="48" cy="92" rx="7" ry="4" fill="#0e1828"/>
      <rect x="19" y="48" width="42" height="30" fill="#dde8f8" rx="6"/>
      <path d="M34 48 L40 64 L46 48Z" fill="#b8cce8"/>
      <rect x="35" y="48" width="10" height="14" fill="#2a4a8a"/>
      <rect x="10" y="50" width="10" height="28" fill="#dde8f8" rx="5"/>
      <rect x="60" y="50" width="10" height="28" fill="#dde8f8" rx="5"/>
      <ellipse cx="15" cy="79" rx="6" ry="5" fill="#c8956a"/>
      <ellipse cx="65" cy="78" rx="6" ry="5" fill="#c8956a"/>
      <rect x="36" y="44" width="8" height="6" fill="#c8956a" rx="3"/>
      <ellipse cx="40" cy="32" rx="18" ry="21" fill="#c8956a"/>
      <ellipse cx="40" cy="14" rx="19" ry="10" fill="#1a0800"/>
      {[25,30,35,40,45,50,55].map((x,i)=>(
        <ellipse key={i} cx={x} cy={16} rx={2.5} ry={6} fill={i%2===0?"#1a0800":"#2a0e00"}/>
      ))}
      <ellipse cx="22" cy="34" rx="4" ry="6" fill="#c8956a"/>
      <ellipse cx="58" cy="34" rx="4" ry="6" fill="#c8956a"/>
      <ellipse cx="33" cy="31" rx="5" ry="5" fill="#fff"/>
      <ellipse cx="47" cy="31" rx="5" ry="5" fill="#fff"/>
      <ellipse cx="34" cy="32" rx="3" ry="3" fill="#2a1808"/>
      <ellipse cx="48" cy="32" rx="3" ry="3" fill="#2a1808"/>
      <ellipse cx="33" cy="31" rx="1" ry="1" fill="#fff"/>
      <ellipse cx="47" cy="31" rx="1" ry="1" fill="#fff"/>
      <path d="M28 25 Q33 22 38 25" fill="none" stroke="#1a0800" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M42 25 Q47 22 52 25" fill="none" stroke="#1a0800" strokeWidth="1.4" strokeLinecap="round"/>
      <ellipse cx="40" cy="40" rx="2" ry="1.5" fill="#b07050"/>
      <path d="M35 46 Q40 50 45 46" fill="none" stroke="#9a6040" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
