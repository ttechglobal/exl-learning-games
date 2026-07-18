"use client";

/**
 * ParticleFieldEngine.tsx — Matter Lab v4
 *
 * WHAT CHANGED FROM v3:
 *
 * 1. PARTICLES ALWAYS MOVE — the animation loop no longer freezes during
 *    "intro". dtEff is only 0 when isPaused or during "picker"/"correct-flash"/
 *    "conservation" overlays. In every other phase particles respond to
 *    tempRef in real-time.
 *
 * 2. SLIDER ALWAYS WORKS — the slider gate was `enginePhase !== "playing"`.
 *    Now it only blocks during "picker" (student is choosing a label) and
 *    "correct-flash"/"conservation" (animation playing). During "intro" and
 *    "done" the student can still drag and explore freely.
 *
 * 3. ENGINE PHASE OUT OF ANIMATION DEPS — enginePhase was in the useEffect
 *    dependency array, causing the entire RAF loop to restart (and lose
 *    lastTimeRef) on every state change. It's now a ref (enginePhaseRef)
 *    that the loop reads directly, keeping one stable RAF loop for the
 *    entire session.
 *
 * 4. EXPLORE-FIRST FLOW — intro phase shows particles moving and lets the
 *    student drag freely. Dr. Adaobi says "explore first, then I'll ask you
 *    to name what you see." The mission questions only trigger after the
 *    student has had a chance to discover the behaviour themselves.
 *
 * 5. SPEED SCALING FIXED — speedMult was already computed correctly but
 *    particle velocity was nudged so slowly (6% per frame) that at low
 *    temperatures particles barely moved. The nudge factor is now 15% per
 *    frame so particles visibly respond within 1-2 seconds of a slider move.
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

// ─── Stage labels ─────────────────────────────────────────────────────────────
const STAGE_LABEL: Record<string, string> = {
  EASY:   "Guided Learning",
  MEDIUM: "Practice",
  HARD:   "Challenge",
};

// ─── RGB colour (avoids hex-alpha concat) ────────────────────────────────────
function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * Math.max(0, Math.min(1, t)));
}
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
interface RGB { r: number; g: number; b: number }
function getParticleRgb(
  temp: number,
  solidHex: string, liquidHex: string, gasHex: string,
  solidMax: number, liquidMax: number
): RGB {
  const [sr,sg,sb] = hexToRgb(solidHex);
  const [lr,lg,lb] = hexToRgb(liquidHex);
  const [gr,gg,gb] = hexToRgb(gasHex);
  if (temp <= solidMax) return { r:sr, g:sg, b:sb };
  if (temp <= liquidMax) {
    const t = (temp - solidMax) / (liquidMax - solidMax);
    return { r:lerp(sr,lr,t), g:lerp(sg,lg,t), b:lerp(sb,lb,t) };
  }
  const t = Math.min(1, (temp - liquidMax) / (100 - liquidMax));
  return { r:lerp(lr,gr,t), g:lerp(lg,gg,t), b:lerp(lb,gb,t) };
}

// ─── Phase type ───────────────────────────────────────────────────────────────
type EnginePhase =
  | "intro"          // particles move, slider free — student explores
  | "playing"        // slider active, transitions trigger
  | "slowing"        // slow-mo pause before picker
  | "picker"         // label choice — slider locked
  | "correct-flash"  // name burst — slider locked
  | "conservation"   // mass drag — slider locked
  | "done";          // mission complete — slider free again (replay/explore)

interface TransitionState {
  transition: Transition;
  options: string[];
  wrongAttempts: number;
  revealed: boolean;
  firstTry: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ParticleFieldEngine({
  config: rawConfig,
  onComplete,
  menu,
  isPaused,
}: EngineRuntimeProps) {
  const cfg        = rawConfig as ParticleFieldConfig;
  const { shared, mission } = cfg;
  const payload    = mission.payload;
  const difficulty = payload.difficulty ?? "MEDIUM";
  const transitions = payload.transitions;

  const solidMax  = shared.phases.solid.tempRange[1];
  const liquidMax = shared.phases.liquid.tempRange[1];

  // ── Refs — mutable values the RAF loop reads directly ────────────────────
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const rafRef           = useRef<number>(0);
  const lastTimeRef      = useRef<number>(0);
  const particlesRef     = useRef<Particle[]>([]);
  const tempRef          = useRef<number>(payload.startTemp);
  const prevTempRef      = useRef<number>(payload.startTemp);
  const firedKeys        = useRef<Set<string>>(new Set());
  const slowMoRef        = useRef<boolean>(false);
  const slowTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Phase as a ref so the animation loop doesn't need it as a dep
  const enginePhaseRef   = useRef<EnginePhase>("intro");

  // ── React state — drives UI rendering only ────────────────────────────────
  const [enginePhase,   setEnginePhase]   = useState<EnginePhase>("intro");
  const [temperature,   setTemperature]   = useState(payload.startTemp);
  const [currentTrans,  setCurrentTrans]  = useState<TransitionState | null>(null);
  const [adaobiLine,    setAdaobiLine]    = useState(() => {
    const s = payload.substanceName;
    return `I'm Dr. Adaobi. This is ${s}. Drag the slider to heat or cool it — explore freely first. Watch what the particles do.`;
  });
  const [feedbackText,  setFeedbackText]  = useState("");
  const [revealedLabel, setRevealedLabel] = useState("");
  const [formalFlash,   setFormalFlash]   = useState("");
  const [conservVis,    setConservVis]    = useState(false);
  const [isSlowing,     setIsSlowing]     = useState(false);

  // ── Outcome tracking ──────────────────────────────────────────────────────
  const startTime      = useRef(Date.now());
  const totalWrong     = useRef(0);
  const anyRevealed    = useRef(false);
  const firstTryCount  = useRef(0);

  // Keep enginePhaseRef in sync with state
  function setPhase(p: EnginePhase) {
    enginePhaseRef.current = p;
    setEnginePhase(p);
  }

  // ── Build particles once ──────────────────────────────────────────────────
  useEffect(() => {
    particlesRef.current = buildParticles(
      shared.particleCount, payload.startTemp, shared
    );
  }, []); // eslint-disable-line

  // ── Single stable animation loop — NO enginePhase in deps ─────────────────
  useEffect(() => {
    function tick(now: number) {
      rafRef.current = requestAnimationFrame(tick);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Size canvas lazily each frame
      const dpr  = window.devicePixelRatio || 1;
      const cssW = canvas.offsetWidth;
      const cssH = canvas.offsetHeight;
      if (cssW < 2 || cssH < 2) return;
      if (
        canvas.width  !== Math.round(cssW * dpr) ||
        canvas.height !== Math.round(cssH * dpr)
      ) {
        canvas.width  = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      const CW = cssW;
      const CH = cssH;

      const dt = Math.min((now - (lastTimeRef.current || now)) / 1000, 0.05);
      lastTimeRef.current = now;

      // FREEZE only while picker/flash/conservation are showing, or paused
      // Intro, playing, slowing, done → particles always move
      const phase = enginePhaseRef.current;
      const locked = isPaused
        || phase === "picker"
        || phase === "correct-flash"
        || phase === "conservation";
      const slow   = slowMoRef.current;
      // During "slowing" we keep slow-mo running but do NOT freeze
      const dtEff  = locked ? 0 : slow ? dt * 0.1 : dt;

      const temp   = tempRef.current;
      const pname  = getPhase(temp, shared);
      const speedM = getSpeedMult(temp, shared);
      const rgb    = getParticleRgb(
        temp,
        shared.particleColors.solid,
        shared.particleColors.liquid,
        shared.particleColors.gas,
        solidMax, liquidMax
      );
      const { r, g, b } = rgb;
      // Radius: bigger at gas (fast = big), smaller at solid (tight grid)
      const r2 = Math.max(3.5, Math.min(8.5, CW * 0.017));

      // ── Background ────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, CW, CH);
      const bg = ctx.createRadialGradient(CW*0.5, CH*0.4, 0, CW*0.5, CH*0.5, CW*0.9);
      bg.addColorStop(0, "#0d1f3c");
      bg.addColorStop(1, "#030a14");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CW, CH);

      // Chamber border — glows in subject colour, pulses amber in slow-mo
      const pulse = slow ? 0.4 + 0.35 * Math.sin(now * 0.007) : 0;
      ctx.strokeStyle = slow
        ? `rgba(255,200,60,${pulse})`
        : `rgba(${r},${g},${b},0.18)`;
      ctx.lineWidth = slow ? 2.5 : 1.5;
      ctx.strokeRect(1, 1, CW - 2, CH - 2);

      // ── Particles ──────────────────────────────────────────────────────────
      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (dtEff > 0) {
          if (pname === "solid" && p.homeX !== null && p.homeY !== null) {
            // Solid: jitter around fixed home position
            const amp = Math.max(0.004, speedM * 0.026);
            const t   = now * 0.003 + p.jitterPhase;
            p.x = p.homeX + Math.sin(t * 2.1) * amp;
            p.y = p.homeY + Math.cos(t * 1.7) * amp;
          } else {
            // Liquid / gas: free movement
            p.x += p.vx * dtEff;
            p.y += p.vy * dtEff;

            // Wall bounce
            const mx = r2 / CW;
            const my = r2 / CH;
            if (p.x < mx)     { p.x = mx;     p.vx =  Math.abs(p.vx); }
            if (p.x > 1 - mx) { p.x = 1 - mx; p.vx = -Math.abs(p.vx); }
            if (p.y < my)     { p.y = my;     p.vy =  Math.abs(p.vy); }
            if (p.y > 1 - my) { p.y = 1 - my; p.vy = -Math.abs(p.vy); }

            // Speed nudge toward target — 15% per frame (was 6%, too slow to feel)
            const tgt = speedM * 0.004 * (0.7 + Math.random() * 0.6);
            const cur = Math.hypot(p.vx, p.vy);
            if (cur > 0.00001) {
              const f = 1 + (tgt - cur) / cur * 0.15;
              p.vx *= f; p.vy *= f;
            } else {
              const a = Math.random() * Math.PI * 2;
              p.vx = Math.cos(a) * tgt;
              p.vy = Math.sin(a) * tgt;
            }

            // On phase transition solid→liquid: clear homeX so particle roams free
            if (pname !== "solid" && p.homeX !== null) {
              p.homeX = null; p.homeY = null;
              const a = Math.random() * Math.PI * 2;
              const s = speedM * 0.004;
              p.vx = Math.cos(a) * s;
              p.vy = Math.sin(a) * s;
            }
          }

          // On phase transition liquid→solid: assign home position
          if (pname === "solid" && p.homeX === null) {
            p.homeX = p.x;
            p.homeY = p.y;
          }
        }

        // ── Draw ────────────────────────────────────────────────────────────
        const px = p.x * CW;
        const py = p.y * CH;

        // Glow halo
        const grd = ctx.createRadialGradient(px, py, 0, px, py, r2 * 3.2);
        grd.addColorStop(0,   `rgba(${r},${g},${b},0.32)`);
        grd.addColorStop(0.5, `rgba(${r},${g},${b},0.10)`);
        grd.addColorStop(1,   `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(px, py, r2 * 3.2, 0, Math.PI * 2);
        ctx.fill();

        // Core dot
        ctx.shadowColor = `rgb(${r},${g},${b})`;
        ctx.shadowBlur  = slow ? 22 : 9;
        ctx.fillStyle   = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.arc(px, py, r2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Specular highlight
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.arc(px - r2 * 0.28, py - r2 * 0.28, r2 * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }

      // Temperature label inside canvas — top-right corner
      ctx.font = `bold ${Math.round(CW * 0.038)}px "Fredoka", sans-serif`;
      ctx.textAlign = "right";
      ctx.fillStyle = `rgba(${r},${g},${b},0.8)`;
      ctx.fillText(`${Math.round(temp)}°`, CW - 8, 22);
      ctx.textAlign = "left";
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  // ONLY isPaused and config values — NOT enginePhase — to keep loop stable
  }, [shared, solidMax, liquidMax, isPaused]); // eslint-disable-line

  // ── Slider drag — works in intro, playing, done. Locked only mid-question ─
  const sliderRef = useRef<HTMLDivElement>(null);
  const dragging  = useRef(false);

  function tempFromY(clientY: number): number {
    const el = sliderRef.current;
    if (!el) return tempRef.current;
    const rect = el.getBoundingClientRect();
    return Math.round((1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))) * 100);
  }

  const handleTempChange = useCallback((newTemp: number) => {
    // Allow dragging in intro, playing, done — lock only during picker/flash/conservation
    const ph = enginePhaseRef.current;
    if (ph === "picker" || ph === "correct-flash" || ph === "conservation") return;

    tempRef.current = newTemp;
    setTemperature(newTemp);

    // Only fire transitions when actively playing (not in intro explore mode)
    if (ph !== "playing") return;

    const fired = detectTransition(prevTempRef.current, newTemp, transitions, firedKeys.current);
    prevTempRef.current = newTemp;
    if (!fired) return;

    // Lock slider at threshold while we do slow-mo + show picker
    tempRef.current = fired.threshold;
    setTemperature(fired.threshold);
    slowMoRef.current = true;
    setIsSlowing(true);
    setAdaobiLine("Look closely — something is changing. What do you see the particles doing right now?");

    slowTimerRef.current = setTimeout(() => {
      slowMoRef.current = false;
      setIsSlowing(false);
      const opts = getOptionsForDifficulty(fired, difficulty);
      setCurrentTrans({ transition: fired, options: opts, wrongAttempts: 0, revealed: false, firstTry: true });
      setFeedbackText("");
      setRevealedLabel("");
      setPhase("picker");
      setAdaobiLine(difficulty === "EASY"
        ? "Tap the label that best describes what you see the particles doing."
        : "Name what you see — tap the correct description.");
    }, shared.transitionPauseMs);
  }, [transitions, difficulty, shared.transitionPauseMs]); // eslint-disable-line

  function onDown(e: React.PointerEvent) {
    const ph = enginePhaseRef.current;
    if (ph === "picker" || ph === "correct-flash" || ph === "conservation") return;
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleTempChange(tempFromY(e.clientY));
  }
  function onMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    handleTempChange(tempFromY(e.clientY));
  }
  function onUp() { dragging.current = false; }

  // ── Begin mission — switches from explore to question mode ────────────────
  function beginMission() {
    prevTempRef.current = tempRef.current; // reset detection from current position
    firedKeys.current.clear();
    setPhase("playing");
    setAdaobiLine(
      difficulty === "EASY"
        ? "Great. Now I'll ask you to name what you see each time something changes. Keep dragging."
        : "Now name every change of state you cause. Keep going."
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
          setAdaobiLine("Before we continue — what happened to the total mass during that change?");
        } else {
          afterDone();
        }
      }, 2400);
    } else {
      totalWrong.current++;
      const nw  = wrongAttempts + 1;
      const msg = transition.wrongFeedback?.[label]
        ?? "Watch the gaps between particles — getting closer together or further apart?";
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
              setAdaobiLine("Before we continue — what happened to the total mass during that change?");
            } else {
              afterDone();
            }
          }, 2200);
        }, 2000);
      }
    }
  }, [currentTrans, shared.maxWrongBeforeReveal]); // eslint-disable-line

  function afterDone() {
    setCurrentTrans(null);
    setFormalFlash("");
    setRevealedLabel("");
    setConservVis(false);
    const remaining = transitions.filter(t => !firedKeys.current.has(t.key));
    if (remaining.length === 0) {
      setPhase("done");
      setAdaobiLine("Excellent! You identified every state change. Feel free to keep exploring — the slider is still live.");
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
      setAdaobiLine(`Good — ${remaining.length} more change${remaining.length > 1 ? "s" : ""} to find. Keep dragging.`);
    }
  }

  // ── Derived UI values ─────────────────────────────────────────────────────
  const currentPhaseName = getPhase(temperature, shared);
  const PHASE_LABEL: Record<string, string> = {
    solid:  "❄️ Solid",
    liquid: "💧 Liquid",
    gas:    "💨 Gas",
  };
  const done = firedKeys.current.size;

  const sliderLocked =
    enginePhase === "picker" ||
    enginePhase === "correct-flash" ||
    enginePhase === "conservation";

  const stats = [
    { label: "Stage",   value: STAGE_LABEL[difficulty] ?? difficulty, tone: "gold" as const },
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
      <div className={styles.layout}>

        {/* ── SLIDER ────────────────────────────────────────────────────── */}
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
                className={[
                  styles.thresh,
                  firedKeys.current.has(tr.key) ? styles.threshDone : "",
                ].filter(Boolean).join(" ")}
                style={{ bottom: `${tr.threshold}%` }}
              />
            ))}
            <div className={styles.thumb} style={{ bottom: `calc(${temperature}% - 20px)` }}>
              <span className={styles.thumbVal}>{temperature}°</span>
            </div>
          </div>
          <span className={styles.sliderLabel}>COLD</span>

          {/* Ghost arrow — shown while slider hasn't been touched */}
          {(enginePhase === "intro") && temperature === payload.startTemp && (
            <div className={styles.ghost} aria-hidden="true">
              <span className={styles.ghostArr}>↕</span>
            </div>
          )}
        </div>

        {/* ── CANVAS WRAP ───────────────────────────────────────────────── */}
        <div className={styles.canvasWrap}>

          {/* Phase badge */}
          <div className={styles.phaseBadge}>{PHASE_LABEL[currentPhaseName]}</div>

          <canvas ref={canvasRef} className={styles.canvas} />

          {/* Slow-mo ring */}
          {isSlowing && <div className={styles.slowRing} aria-hidden="true" />}

          {/* Correct answer flash */}
          {enginePhase === "correct-flash" && formalFlash && (
            <div className={styles.formalFlash}>
              <span className={styles.formalName}>{formalFlash}!</span>
            </div>
          )}

          {/* ── DR. ADAOBI overlay — bottom of canvas ─────────────────── */}
          <div className={styles.adaobiStrip}>
            <div className={styles.adaobiAvatar} aria-hidden="true">
              <DrAdaobi />
            </div>
            <div className={styles.adaobiBubble}>
              <p className={styles.adaobiText}>{adaobiLine}</p>

              {/* Intro → "Begin mission" button */}
              {enginePhase === "intro" && (
                <button className={styles.beginBtn} onClick={beginMission}>
                  Ready — Ask Me Questions →
                </button>
              )}

              {/* Done → keep exploring nudge */}
              {enginePhase === "done" && (
                <div className={styles.doneChip}>✓ Mission Complete</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── PICKER CARD — below the chamber ──────────────────────────────── */}
      {enginePhase === "picker" && currentTrans && (
        <div className={styles.pickerCard}>
          <div className={styles.pickerPrompt}>What is happening to the particles?</div>
          {feedbackText && (
            <div className={styles.pickerFeedback} role="alert">💡 {feedbackText}</div>
          )}
          <div className={styles.labelGrid}>
            {currentTrans.options.map(opt => (
              <button
                key={opt}
                className={[
                  styles.labelBtn,
                  revealedLabel === opt    ? styles.labelCorrect : "",
                  revealedLabel && opt !== revealedLabel ? styles.labelFaded : "",
                ].filter(Boolean).join(" ")}
                onClick={() => handleLabelPick(opt)}
                disabled={!!revealedLabel}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── CONSERVATION DRAG ─────────────────────────────────────────────── */}
      {enginePhase === "conservation" && conservVis && (
        <div className={styles.pickerCard}>
          <div className={styles.pickerPrompt}>What happened to the mass of the substance?</div>
          <div className={styles.conservRow}>
            <div className={styles.conservScale}>
              <div className={styles.scaleLabel}>Before</div>
              <div style={{ fontSize: "1.6rem" }}>⚖️</div>
            </div>
            <div className={styles.conservArrow}>→</div>
            <div className={styles.conservScale}>
              <div className={styles.scaleLabel}>After</div>
              <div style={{ fontSize: "1.6rem" }}>⚖️</div>
            </div>
          </div>
          <p className={styles.conservHint}>
            Particles rearranged — none were created or destroyed.
          </p>
          <button className={styles.conservBtn} onClick={afterDone}>
            Mass stays the same ✓
          </button>
        </div>
      )}
    </GameplayShell>
  );
}

// ─── Dr. Adaobi inline SVG ────────────────────────────────────────────────────
function DrAdaobi() {
  return (
    <svg viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg"
      style={{ width:"100%", height:"100%" }} aria-hidden="true">
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
      <rect x="62" y="62" width="8" height="12" fill="#00c4e0" opacity="0.4" rx="2"/>
      <rect x="62" y="60" width="8" height="4" fill="#b8cce8" rx="1"/>
      <rect x="36" y="44" width="8" height="6" fill="#c8956a" rx="3"/>
      <ellipse cx="40" cy="32" rx="18" ry="21" fill="#c8956a"/>
      <ellipse cx="40" cy="14" rx="19" ry="10" fill="#1a0800"/>
      {[25,30,35,40,45,50,55].map((x,i) => (
        <ellipse key={i} cx={x} cy={16} rx={2.5} ry={6}
          fill={i%2===0?"#1a0800":"#2a0e00"}/>
      ))}
      <ellipse cx="22" cy="34" rx="4" ry="6" fill="#c8956a"/>
      <ellipse cx="58" cy="34" rx="4" ry="6" fill="#c8956a"/>
      <ellipse cx="33" cy="31" rx="5" ry="5" fill="#fff"/>
      <ellipse cx="47" cy="31" rx="5" ry="5" fill="#fff"/>
      <ellipse cx="34" cy="32" rx="3" ry="3" fill="#2a1808"/>
      <ellipse cx="48" cy="32" rx="3" ry="3" fill="#2a1808"/>
      <ellipse cx="33" cy="31" rx="1" ry="1" fill="#fff"/>
      <ellipse cx="47" cy="31" rx="1" ry="1" fill="#fff"/>
      <path d="M28 25 Q33 22 38 25" fill="none" stroke="#1a0800"
        strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M42 25 Q47 22 52 25" fill="none" stroke="#1a0800"
        strokeWidth="1.4" strokeLinecap="round"/>
      <ellipse cx="40" cy="40" rx="2" ry="1.5" fill="#b07050"/>
      <path d="M35 46 Q40 50 45 46" fill="none" stroke="#9a6040"
        strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
