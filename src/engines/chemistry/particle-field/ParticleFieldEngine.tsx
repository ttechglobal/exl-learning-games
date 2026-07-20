"use client";

/**
 * ParticleFieldEngine.tsx — Matter Lab v7
 *
 * NEW: Guided interaction mode
 *   interactionMode = "guided" (Guided Learning missions)
 *     - Slider is locked until student taps "Begin"
 *     - At each NarrationStop temperature, slider auto-locks
 *     - Dr. Adaobi delivers her scripted line + optional instruction
 *     - Student taps "Continue →" to unlock slider for the next segment
 *     - After all stops, transitions fire normally with guidedPrePickerLine
 *       shown before the label picker (so concept is named before question)
 *
 *   interactionMode = "free" (Practice / Challenge / Mastery)
 *     - Original behaviour: student drags freely, transitions fire questions
 *
 * NEW: Surface evaporation visual
 *   When mission payload has surfaceEscape defined:
 *   - A separate surface layer (top 18% of canvas) shows particles
 *     drifting upward and disappearing one at a time as temp rises
 *   - This is distinct from the full-canvas phase transition
 *   - Visually distinguishes evaporation (surface only) from boiling (all)
 *
 * FIXED: Canvas no longer stretches — .canvasWrap has fixed 240px height
 * FIXED: Speed scale 0.022 (was 0.004) — particles visibly fast at gas
 * FIXED: Solid at temp=0 is completely still — no Math.max floor on jitter
 * FIXED: Grid re-forms on cooling using stored gridX/gridY
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { GameplayShell } from "@/components/gameplay/GameplayShell";
import type { EngineRuntimeProps } from "@/engines/engine-types";
import type {
  ParticleFieldConfig,
  ParticleFieldOutcome,
  NarrationStop,
} from "./particleField.config";
import {
  buildParticles,
  detectTransition,
  detectNarrationStop,
  getNarrationStopIndex,
  getOptionsForDifficulty,
  getSpeedMult,
  getParticleRgb,
  getPhase,
  type Particle,
} from "./particleField.logic";
import styles from "./ParticleFieldEngine.module.css";

const STAGE_LABEL: Record<string, string> = {
  EASY:   "Guided Learning",
  MEDIUM: "Practice",
  HARD:   "Challenge",
};

const PHASE_LABEL: Record<string, string> = {
  solid:  "❄️ Solid — particles vibrate in place",
  liquid: "💧 Liquid — particles slide past each other",
  gas:    "💨 Gas — particles fly freely",
};

// Stage-differentiated picker prompt
function pickerPrompt(difficulty: string): string {
  if (difficulty === "EASY")   return "Look at the particles — what are they doing right now?";
  if (difficulty === "MEDIUM") return "A change of state occurred. Which one?";
  return "Identify this change of state and explain what you observe.";
}

type EnginePhase =
  | "intro"           // before student taps Begin
  | "narration-stop"  // guided: slider locked at a waypoint, Dr. Adaobi speaking
  | "playing"         // slider free, transitions fire
  | "slowing"         // slow-mo before picker
  | "picker"          // label question visible
  | "correct-flash"   // name burst
  | "conservation"
  | "done";

interface TransitionState {
  transition: ReturnType<typeof detectTransition> & object;
  options: string[];
  wrongAttempts: number;
  revealed: boolean;
  firstTry: boolean;
}

// ─── Escaped surface particle tracker ────────────────────────────────────────
interface EscapeParticle {
  id: number;
  x: number;       // normalised 0–1
  y: number;       // starts in top 18%, goes negative (off screen)
  opacity: number;
}

export function ParticleFieldEngine({ config: rawConfig, onComplete, menu, isPaused }: EngineRuntimeProps) {
  const cfg = rawConfig as ParticleFieldConfig;
  const { shared, mission } = cfg;
  const payload = mission.payload;
  const difficulty    = payload.difficulty ?? "MEDIUM";
  const isGuided      = (payload.interactionMode ?? "free") === "guided";
  const narStops      = payload.narrationStops ?? [];
  const surfEsc       = payload.surfaceEscape;
  const transitions   = payload.transitions;
  const solidMax      = shared.phases.solid.tempRange[1];
  const liquidMax     = shared.phases.liquid.tempRange[1];

  // ── Refs ──────────────────────────────────────────────────────────────────
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const rafRef         = useRef<number>(0);
  const lastTimeRef    = useRef<number>(0);
  const particlesRef   = useRef<Particle[]>([]);
  const tempRef        = useRef<number>(payload.startTemp);
  const prevTempRef    = useRef<number>(payload.startTemp);
  const firedKeys      = useRef<Set<string>>(new Set());
  const shownStops     = useRef<Set<number>>(new Set());
  const slowMoRef      = useRef<boolean>(false);
  const slowTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enginePhaseRef = useRef<EnginePhase>("intro");
  const escapeParticles = useRef<EscapeParticle[]>([]);
  const nextEscapeId   = useRef(0);
  const escapeAccum    = useRef(0); // fractional escape counter

  // ── State ─────────────────────────────────────────────────────────────────
  const [enginePhase,     setEnginePhase]     = useState<EnginePhase>("intro");
  const [temperature,     setTemperature]     = useState(payload.startTemp);
  const [currentTrans,    setCurrentTrans]    = useState<TransitionState | null>(null);
  const [currentStop,     setCurrentStop]     = useState<NarrationStop | null>(null);
  const [adaobiLine,      setAdaobiLine]      = useState(() => {
    if (payload.missionContext) return payload.missionContext;
    return isGuided
      ? `I'm Dr. Adaobi. Look at the sample — ${payload.substanceName} at the particle level. I'll guide you through every change step by step.`
      : `${payload.substanceName} — drag the slider to heat or cool the sample and name every change of state you cause.`;
  });
  const [feedbackText,    setFeedbackText]    = useState("");
  const [revealedLabel,   setRevealedLabel]   = useState("");
  const [formalFlash,     setFormalFlash]     = useState("");
  const [conservVis,      setConservVis]      = useState(false);
  const [isSlowing,       setIsSlowing]       = useState(false);

  // ── Outcome ───────────────────────────────────────────────────────────────
  const startTime      = useRef(Date.now());
  const totalWrong     = useRef(0);
  const anyRevealed    = useRef(false);
  const firstTryCount  = useRef(0);

  function setPhase(p: EnginePhase) {
    enginePhaseRef.current = p;
    setEnginePhase(p);
  }

  // ── Build particles ────────────────────────────────────────────────────────
  useEffect(() => {
    particlesRef.current = buildParticles(
      shared.particleCount, payload.startTemp, shared,
      surfEsc?.surfaceFraction ?? 0.18,
    );
  }, []); // eslint-disable-line

  // ── Animation loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    function tick(now: number) {
      rafRef.current = requestAnimationFrame(tick);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Stable canvas sizing — fixed 240px height prevents stretch loop
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

      const ep     = enginePhaseRef.current;
      const locked = isPaused || ep === "picker" || ep === "correct-flash"
                  || ep === "conservation" || ep === "narration-stop" || ep === "intro";
      const slow   = slowMoRef.current;
      const dtEff  = locked ? 0 : slow ? dt * 0.1 : dt;

      const temp    = tempRef.current;
      const pname   = getPhase(temp, shared);
      const speedM  = getSpeedMult(temp, shared);
      const { r, g, b } = getParticleRgb(temp,
        shared.particleColors.solid, shared.particleColors.liquid, shared.particleColors.gas,
        solidMax, liquidMax);
      const r2 = Math.max(3.5, Math.min(8, CW * 0.016));
      const SPEED_SCALE = 0.022;

      // ── Background ────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, CW, CH);
      const bg = ctx.createRadialGradient(CW*0.5, CH*0.4, 0, CW*0.5, CH*0.5, CW*0.9);
      bg.addColorStop(0, "#0d1f3c");
      bg.addColorStop(1, "#030a14");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CW, CH);

      // Surface zone indicator (guided evaporation mission)
      if (surfEsc && pname === "liquid") {
        const surfH = (surfEsc.surfaceFraction ?? 0.18) * CH;
        const grad = ctx.createLinearGradient(0, 0, 0, surfH);
        grad.addColorStop(0, "rgba(255,178,60,0.08)");
        grad.addColorStop(1, "rgba(255,178,60,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CW, surfH);
        ctx.strokeStyle = "rgba(255,178,60,0.22)";
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, surfH);
        ctx.lineTo(CW, surfH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255,178,60,0.55)";
        ctx.font = `bold ${Math.max(9, Math.round(CW * 0.03))}px "Fredoka", sans-serif`;
        ctx.fillText("surface", 6, surfH - 3);
      }

      // Chamber border
      const pulse = slow ? 0.4 + 0.35 * Math.sin(now * 0.007) : 0;
      ctx.strokeStyle = slow ? `rgba(255,200,60,${pulse})` : `rgba(${r},${g},${b},0.22)`;
      ctx.lineWidth   = slow ? 2.5 : 1.5;
      ctx.strokeRect(1, 1, CW - 2, CH - 2);

      // ── Update + draw bulk particles ─────────────────────────────────────
      const particles = particlesRef.current as Array<Particle & { gridX: number; gridY: number }>;
      const surfFrac  = surfEsc?.surfaceFraction ?? 0.18;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (dtEff > 0) {
          if (pname === "solid") {
            const amp = speedM * 0.028;
            if (amp < 0.0001) { p.x = p.gridX; p.y = p.gridY; }
            else {
              const t = now * 0.003 + p.jitterPhase;
              p.x = p.gridX + Math.sin(t * 2.1) * amp;
              p.y = p.gridY + Math.cos(t * 1.7) * amp;
            }
            p.homeX = p.gridX; p.homeY = p.gridY;
          } else {
            p.x += p.vx * dtEff;
            p.y += p.vy * dtEff;
            const mx = r2/CW; const my = r2/CH;
            if (p.x < mx)     { p.x = mx;     p.vx =  Math.abs(p.vx); }
            if (p.x > 1-mx)   { p.x = 1-mx;   p.vx = -Math.abs(p.vx); }
            if (p.y < my)     { p.y = my;     p.vy =  Math.abs(p.vy); }
            if (p.y > 1-my)   { p.y = 1-my;   p.vy = -Math.abs(p.vy); }

            const variety = 0.75 + ((i * 137 + 1) % 50) / 100;
            const tgt = speedM * SPEED_SCALE * variety;
            const cur = Math.hypot(p.vx, p.vy);
            if (cur > 0.00001) {
              const f = 1 + (tgt - cur) / cur * 0.25;
              p.vx *= f; p.vy *= f;
            } else {
              const a = p.jitterPhase + i * 0.4;
              p.vx = Math.cos(a) * tgt; p.vy = Math.sin(a) * tgt;
            }
            if (p.homeX !== null) {
              p.homeX = null; p.homeY = null;
              const a = p.jitterPhase;
              p.vx = Math.cos(a) * speedM * SPEED_SCALE;
              p.vy = Math.sin(a) * speedM * SPEED_SCALE;
            }
          }
          if (pname === "solid" && p.homeX === null) { p.homeX = p.gridX; p.homeY = p.gridY; }
        }

        // Draw
        const px = p.x * CW;
        const py = p.y * CH;
        const grd = ctx.createRadialGradient(px, py, 0, px, py, r2 * 3);
        grd.addColorStop(0,   `rgba(${r},${g},${b},0.35)`);
        grd.addColorStop(0.5, `rgba(${r},${g},${b},0.12)`);
        grd.addColorStop(1,   `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(px, py, r2 * 3, 0, Math.PI * 2); ctx.fill();
        ctx.shadowColor = `rgb(${r},${g},${b})`; ctx.shadowBlur = slow ? 22 : 8;
        ctx.fillStyle   = `rgb(${r},${g},${b})`;
        ctx.beginPath(); ctx.arc(px, py, r2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur  = 0;
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath(); ctx.arc(px - r2*0.28, py - r2*0.28, r2*0.3, 0, Math.PI*2); ctx.fill();
      }

      // ── Surface escape particles (evaporation visual) ─────────────────────
      if (surfEsc && pname === "liquid" && dtEff > 0) {
        const startT = surfEsc.startTemp;
        if (temp > startT) {
          // Accumulate escape rate
          const rate = surfEsc.escapeRateBase * ((temp - startT) / 15);
          escapeAccum.current += rate * dtEff;
          while (escapeAccum.current >= 1) {
            escapeAccum.current -= 1;
            // Pick a random x in the top fraction of canvas
            escapeParticles.current.push({
              id: nextEscapeId.current++,
              x: 0.05 + Math.random() * 0.9,
              y: surfFrac * (0.5 + Math.random() * 0.5),
              opacity: 1,
            });
          }
        }
        // Animate each escape particle upward
        escapeParticles.current = escapeParticles.current.filter(ep => ep.opacity > 0.02);
        for (const ep of escapeParticles.current) {
          ep.y -= 0.008 * dtEff * 60;  // drift upward
          ep.opacity -= 0.018 * dtEff * 60; // fade out
          const [lr2, lg2, lb2] = [255, 178, 60]; // amber — escaping
          const epx = ep.x * CW;
          const epy = ep.y * CH;
          ctx.globalAlpha = Math.max(0, ep.opacity);
          ctx.shadowColor = `rgb(${lr2},${lg2},${lb2})`; ctx.shadowBlur = 10;
          ctx.fillStyle   = `rgb(${lr2},${lg2},${lb2})`;
          ctx.beginPath(); ctx.arc(epx, epy, r2 * 0.85, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;
      }

      // Guided stop progress indicator
      if (isGuided && narStops.length > 0) {
        const shown = shownStops.current.size;
        const total = narStops.length;
        if (shown < total) {
          const nextStop = narStops.find((_, i) => !shownStops.current.has(i));
          if (nextStop) {
            const frac = Math.min(1, (temp - payload.startTemp) / (nextStop.temp - payload.startTemp + 0.001));
            ctx.strokeStyle = "rgba(255,200,60,0.35)";
            ctx.lineWidth   = 3;
            ctx.strokeRect(1, 1, CW * frac - 2, 3);
          }
        }
      }

      // Temp readout
      const fz = Math.max(11, Math.round(CW * 0.038));
      ctx.font = `bold ${fz}px "Fredoka", sans-serif`;
      ctx.textAlign = "right";
      ctx.fillStyle = `rgba(${r},${g},${b},0.9)`;
      ctx.fillText(`${Math.round(temp)}°`, CW - 8, fz + 4);
      ctx.textAlign = "left";
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [shared, solidMax, liquidMax, isPaused, isGuided, narStops, surfEsc, payload.startTemp]); // eslint-disable-line

  // ── Slider drag ───────────────────────────────────────────────────────────
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
    if (ph !== "playing") return;

    tempRef.current = newTemp;
    setTemperature(newTemp);

    // ── Guided: check narration stops first ──────────────────────────────
    if (isGuided && narStops.length > 0) {
      const stop = detectNarrationStop(prevTempRef.current, newTemp, narStops, shownStops.current);
      if (stop) {
        const idx = getNarrationStopIndex(stop, narStops);
        shownStops.current.add(idx);
        tempRef.current = stop.temp;
        setTemperature(stop.temp);
        prevTempRef.current = stop.temp;
        setCurrentStop(stop);
        setAdaobiLine(stop.line);
        setPhase("narration-stop");
        return;
      }
    }

    // ── Check transitions ────────────────────────────────────────────────
    const fired = detectTransition(prevTempRef.current, newTemp, transitions, firedKeys.current);
    prevTempRef.current = newTemp;
    if (!fired) return;

    tempRef.current = fired.threshold;
    setTemperature(fired.threshold);
    slowMoRef.current = true;
    setIsSlowing(true);

    const pauseLine = isGuided
      ? (fired.guidedPrePickerLine ?? "Something just changed. Look carefully at what the particles are doing.")
      : difficulty === "EASY"
        ? "Something changed — look carefully and then name it."
        : "A change of state occurred. Identify it.";
    setAdaobiLine(pauseLine);

    slowTimer.current = setTimeout(() => {
      slowMoRef.current = false;
      setIsSlowing(false);
      const opts = getOptionsForDifficulty(fired, difficulty);
      setCurrentTrans({ transition: fired, options: opts, wrongAttempts: 0, revealed: false, firstTry: true });
      setFeedbackText("");
      setRevealedLabel("");
      setPhase("picker");
      if (!isGuided) setAdaobiLine(pickerPrompt(difficulty));
    }, shared.transitionPauseMs);
  }, [isGuided, narStops, transitions, difficulty, shared.transitionPauseMs]); // eslint-disable-line

  function onDown(e: React.PointerEvent) {
    if (enginePhaseRef.current !== "playing") return;
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
    shownStops.current.clear();
    escapeParticles.current = [];
    escapeAccum.current = 0;
    setPhase("playing");
    setAdaobiLine(
      isGuided
        ? "Drag the slider slowly upward. I'll stop you at key moments — watch what changes."
        : difficulty === "EASY"
          ? "Drag the slider slowly. When the particles change behaviour, I'll ask you to name it."
          : "Drag the slider. Name every change of state you cause."
    );
  }

  // ── Continue from narration stop ─────────────────────────────────────────
  function continueFromStop() {
    setCurrentStop(null);
    setPhase("playing");
    const allShown = shownStops.current.size >= narStops.length;
    if (allShown && narStops.length > 0) {
      setAdaobiLine("Good. Now keep dragging — when the particles change state, I'll ask you to name what you see.");
    }
  }

  // ── "Try again" — remove transition from fired, go back to slider ─────────
  function tryAgain() {
    if (currentTrans) firedKeys.current.delete(currentTrans.transition.key);
    if (slowTimer.current) clearTimeout(slowTimer.current);
    slowMoRef.current = false;
    setIsSlowing(false);
    setCurrentTrans(null);
    setFeedbackText("");
    setRevealedLabel("");
    setPhase("playing");
    setAdaobiLine(
      isGuided
        ? "Take your time — drag back through that temperature and observe what happens. Then drag through again to answer."
        : "Go back and observe. Drag the slider through that threshold again when you're ready."
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
          setConservVis(true); setPhase("conservation");
          setAdaobiLine("Before we continue — what happened to the total mass during that change?");
        } else afterTransition();
      }, 2400);
    } else {
      totalWrong.current++;
      const nw  = wrongAttempts + 1;
      const msg = transition.wrongFeedback?.[label]
        ?? "Watch the gaps between particles — getting closer or further apart?";
      setFeedbackText(msg);
      setAdaobiLine(msg);
      setCurrentTrans(prev => prev ? { ...prev, wrongAttempts: nw, firstTry: false } : prev);
      if (nw >= shared.maxWrongBeforeReveal) {
        anyRevealed.current = true;
        setRevealedLabel(transition.correctLabel);
        setAdaobiLine(`The answer is highlighted: "${transition.correctLabel}" — that's ${transition.formalName}.`);
        setTimeout(() => {
          firedKeys.current.add(transition.key);
          setPhase("correct-flash"); setFormalFlash(transition.formalName);
          setTimeout(() => {
            if (transition.showConservationDrag) {
              setConservVis(true); setPhase("conservation");
              setAdaobiLine("Before we continue — what happened to the total mass?");
            } else afterTransition();
          }, 2200);
        }, 2000);
      }
    }
  }, [currentTrans, shared.maxWrongBeforeReveal]); // eslint-disable-line

  function afterTransition() {
    setCurrentTrans(null); setFormalFlash(""); setRevealedLabel(""); setConservVis(false);
    const remaining = transitions.filter(t => !firedKeys.current.has(t.key));
    if (remaining.length === 0) {
      setPhase("done");
      setAdaobiLine("Excellent work. You identified every change of state. The slider is still live — keep exploring if you want.");
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
  const done = firedKeys.current.size;
  const sliderLocked = enginePhase === "picker" || enginePhase === "correct-flash"
                    || enginePhase === "conservation" || enginePhase === "narration-stop"
                    || enginePhase === "intro";

  const stats = [
    { label: "Stage",   value: STAGE_LABEL[difficulty] ?? difficulty, tone: "gold"    as const },
    { label: "Changes", value: `${done}/${transitions.length}`,
      tone: done === transitions.length ? "success" as const : "default" as const },
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
        <div className={styles.simRow}>

          {/* ── SLIDER ──────────────────────────────────────────────────── */}
          <div className={styles.sliderWrap}>
            <span className={styles.sliderLabel}>HOT</span>
            <div
              ref={sliderRef}
              className={[styles.sliderTrack, sliderLocked ? styles.sliderOff : ""].filter(Boolean).join(" ")}
              onPointerDown={onDown} onPointerMove={onMove}
              onPointerUp={onUp}    onPointerLeave={onUp}
            >
              <div className={styles.sliderFill} style={{ height: `${temperature}%` }} />
              {transitions.map(tr => (
                <div key={tr.key}
                  className={[styles.thresh, firedKeys.current.has(tr.key) ? styles.threshDone : ""].filter(Boolean).join(" ")}
                  style={{ bottom: `${tr.threshold}%` }}
                />
              ))}
              <div className={styles.thumb} style={{ bottom: `calc(${temperature}% - 20px)` }}>
                <span className={styles.thumbVal}>{temperature}°</span>
              </div>
            </div>
            <span className={styles.sliderLabel}>COLD</span>
            {(enginePhase === "intro") && (
              <div className={styles.ghost}><span className={styles.ghostArr}>↕</span></div>
            )}
          </div>

          {/* ── CANVAS ──────────────────────────────────────────────────── */}
          <div className={styles.canvasWrap}>
            <div className={styles.phaseBadge}>{PHASE_LABEL[currentPhaseName]}</div>
            <canvas ref={canvasRef} className={styles.canvas} />
            {isSlowing && <div className={styles.slowRing} />}

            {enginePhase === "correct-flash" && formalFlash && (
              <div className={styles.formalFlash}>
                <span className={styles.formalName}>{formalFlash}!</span>
              </div>
            )}

            {/* Dr. Adaobi bubble — inside canvas, bottom overlay */}
            <div className={styles.adaobiStrip}>
              <div className={styles.adaobiAvatar}><DrAdaobi /></div>
              <div className={styles.adaobiBubble}>
                <p className={styles.adaobiText}>{adaobiLine}</p>

                {/* Intro: Begin button */}
                {enginePhase === "intro" && (
                  <button className={styles.beginBtn} onClick={beginMission}>
                    {isGuided ? "Let's begin →" : "Start →"}
                  </button>
                )}

                {/* Guided narration stop: Continue button + optional instruction */}
                {enginePhase === "narration-stop" && (
                  <>
                    {currentStop?.instruction && (
                      <div className={styles.stopInstruction}>{currentStop.instruction}</div>
                    )}
                    <button className={styles.continueBtn} onClick={continueFromStop}>
                      Continue →
                    </button>
                  </>
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
              {pickerPrompt(difficulty)}
            </div>
            {feedbackText && (
              <div className={styles.pickerFeedback} role="alert">💡 {feedbackText}</div>
            )}
            <div className={styles.labelGrid}>
              {currentTrans.options.map(opt => (
                <button key={opt}
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
            {!revealedLabel && (
              <button className={styles.tryAgainBtn} onClick={tryAgain}>
                ↩ Not sure? Go back and observe
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
            <p className={styles.conservHint}>The particles rearranged — none were created or destroyed.</p>
            <button className={styles.conservBtn} onClick={afterTransition}>Mass stays the same ✓</button>
          </div>
        )}
      </div>
    </GameplayShell>
  );
}

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
