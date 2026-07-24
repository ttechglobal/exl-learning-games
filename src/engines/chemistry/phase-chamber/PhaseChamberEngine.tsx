"use client";

/**
 * PhaseChamberEngine.tsx — Matter Lab
 *
 * Dispatcher + BoundaryDrag + HeatControl implementations.
 * PressureChamberEngine lives in its own file and is imported below.
 *
 * Modes:
 *   boundary-drag    — Interaction 1: State & Arrangement        ✓
 *   heat-control     — Interaction 2: Change of State & Energy   ✓
 *   pressure-chamber — Interaction 3: Pressure & Container       ✓ (separate file)
 *   diffusion        — Interaction 4: Diffusion                  TODO
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { GameplayShell } from "@/components/gameplay/GameplayShell";
import type { EngineRuntimeProps } from "@/engines/engine-types";
import type {
  PhaseChamberConfig,
  PhaseChamberOutcome,
  BoundaryDragPayload,
  HeatControlPayload,
} from "./phaseChamber.config";
import {
  buildParticles,
  updateParticle,
  drawBackground,
  drawContainerBorder,
  drawAmbientGlow,
  drawParticle,
  drawBondAnimation,
  getParticleRgb,
  getPhaseFromWall,
  getSpeedMultFromWall,
  isGuidedStepComplete,
  PHASE_LABELS,
  PROPERTY_BADGES,
  DENSITY_LABELS,
  BOND_DURATION_MS,
  getHeatPhaseLabel,
  isOnPlateau,
  getSpeedMultFromTemp,
  getEnergyViewSplit,
  drawHeatingCurve,
  drawEscapeParticles,
  drawSurfaceZone,
  updateEscapeParticles,
  maybeEmitEscape,
  MAX_CURVE_POINTS,
  type Particle,
  type PhaseState,
  type BondAnimation,
  type HeatPhaseLabel,
  type CurvePoint,
  type EscapeParticle,
} from "./phaseChamber.logic";
// import { PressureChamberEngine } from "./PressureChamberEngine";
import styles from "./PhaseChamberEngine.module.css";
import { DiffusionEngine } from "./DiffusionEngine";

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export function PhaseChamberEngine(props: EngineRuntimeProps) {
  const cfg  = props.config as PhaseChamberConfig;
  const mode = cfg.mission.payload.mode;

  if (mode === "boundary-drag")    return <BoundaryDragEngine    {...props} />;
  if (mode === "heat-control")     return <HeatControlEngine     {...props} />;
  if (mode === "diffusion") return <DiffusionEngine {...props} />;

  // if (mode === "pressure-chamber") return <PressureChamberEngine {...props} />;

  return (
    <div style={{ color: "#fff", padding: 24 }}>
      Mode &quot;{mode}&quot; is not yet implemented.
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTION 1 — BOUNDARY DRAG
// ─────────────────────────────────────────────────────────────────────────────

type BDPhase = "intro" | "playing" | "identify" | "correct-flash" | "done";

const STATE_CHIPS: PhaseState[]                 = ["solid", "liquid", "gas"];
const STATE_DISPLAY: Record<PhaseState, string> = { solid: "Solid", liquid: "Liquid", gas: "Gas" };

function BoundaryDragEngine({
  config: rawConfig, onComplete, menu, isPaused, gameTitle,
}: EngineRuntimeProps) {
  const cfg     = rawConfig as PhaseChamberConfig;
  const shared  = cfg.shared;
  const payload = cfg.mission.payload as BoundaryDragPayload;

  const isGuided    = Boolean(payload.guidedSteps?.length);
  const guidedSteps = payload.guidedSteps ?? [];
  const bondEnabled = payload.bondTapEnabled ?? true;
  const solidMax    = payload.stateZones?.solidMax ?? 35;
  const gasMin      = payload.stateZones?.gasMin   ?? 65;
  const startNorm   = (payload.startWall ?? 15) / 100;

  // ── Refs ──────────────────────────────────────────────────────────────────
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const rafRef         = useRef<number>(0);
  const lastTimeRef    = useRef<number>(0);
  const particlesRef   = useRef<Particle[]>([]);
  const wallPosRef     = useRef<number>(startNorm);
  const epRef          = useRef<BDPhase>("intro");
  const stepRef        = useRef<number>(0);
  const holdStartRef   = useRef<number | null>(null);
  const bondDoneRef    = useRef<boolean>(false);
  const bondAnimRef    = useRef<BondAnimation | null>(null);
  const startTimeRef   = useRef<number>(Date.now());
  const totalWrongRef  = useRef<number>(0);
  const anyRevRef      = useRef<boolean>(false);
  const firstTryRef    = useRef<number>(0);
  const firstTryQRef   = useRef<boolean>(true);
  const labelTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepTickRef    = useRef<number>(0); // incremented on each step advance to restart interval

  // ── State ─────────────────────────────────────────────────────────────────
  const [enginePhase, setEnginePhase] = useState<BDPhase>("intro");
  const [wallPos,     setWallPos]     = useState<number>(startNorm);
  const [curPhase,    setCurPhase]    = useState<PhaseState>(getPhaseFromWall(startNorm, solidMax, gasMin));
  const [adaobiLine,  setAdaobiLine]  = useState<string>(
    payload.missionContext ?? "Three samples are waiting. Drag the container wall and I'll show you what happens to the particles inside."
  );
  const [showLabel,   setShowLabel]   = useState(false);
  const [showBadge,   setShowBadge]   = useState(false);
  const [bondResult,  setBondResult]  = useState("");
  const [showNext,    setShowNext]    = useState(false);
  const [stepTick,    setStepTick]    = useState(0);
  const [adaobiMinimised, setAdaobiMinimised] = useState(false); // triggers interval restart on step change
  const [revState,    setRevState]    = useState<PhaseState | null>(null);
  const [feedback,    setFeedback]    = useState("");
  const [wrongCount,  setWrongCount]  = useState(0);

  function setEP(p: BDPhase) { epRef.current = p; setEnginePhase(p); }

  // ── Init particles ────────────────────────────────────────────────────────
  useEffect(() => {
    particlesRef.current = buildParticles(shared.particleCount, startNorm, shared);
  }, []); // eslint-disable-line

  // ── State label (1.5s stable in zone) ────────────────────────────────────
  const scheduleLabel = useCallback((phase: PhaseState) => {
    if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
    labelTimerRef.current = setTimeout(() => {
      setShowLabel(true);
      if (isGuided) setShowBadge(true);
    }, 1500);
  }, [isGuided]);

  const clearLabel = useCallback(() => {
    if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
    setShowLabel(false);
    setShowBadge(false);
  }, []);

  // ── RAF loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    function tick(now: number) {
      rafRef.current = requestAnimationFrame(tick);
      const canvas = canvasRef.current; if (!canvas) return;
      const ctx = canvas.getContext("2d"); if (!ctx) return;

      const dpr  = window.devicePixelRatio || 1;
      const cssW = canvas.offsetWidth; const cssH = canvas.offsetHeight;
      if (cssW < 2 || cssH < 2) return;
      if (canvas.width !== Math.round(cssW*dpr) || canvas.height !== Math.round(cssH*dpr)) {
        canvas.width = Math.round(cssW*dpr); canvas.height = Math.round(cssH*dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      const CW = cssW; const CH = cssH;
      const dt    = Math.min((now-(lastTimeRef.current||now))/1000, 0.05);
      lastTimeRef.current = now;

      // Wall is ALWAYS free to move except in intro and done
      const locked = isPaused || epRef.current === "intro" || epRef.current === "done";
      const dtEff  = locked ? 0 : dt;

      const wall   = wallPosRef.current;
      const phase  = getPhaseFromWall(wall, solidMax, gasMin);
      const speedM = getSpeedMultFromWall(wall);
      const r2     = Math.max(4, Math.min(10, CW * 0.018));
      const { r, g, b } = getParticleRgb(
        wall,
        shared.particleColors.solid,
        shared.particleColors.liquid,
        shared.particleColors.gas,
        solidMax / 100,
        gasMin / 100
      );

      ctx.clearRect(0, 0, CW, CH);
      drawBackground(ctx, CW, CH);
      drawAmbientGlow(ctx, CW, CH, r, g, b, speedM);
      drawContainerBorder(ctx, CW, CH, r, g, b, false, now);

      for (let i = 0; i < particlesRef.current.length; i++) {
        updateParticle(particlesRef.current[i], phase, speedM, dtEff, now, i, CW, CH, r2);
        drawParticle(ctx, particlesRef.current[i].x*CW, particlesRef.current[i].y*CH, r2, r, g, b, false);
      }

      if (bondAnimRef.current) {
        const elapsed = now - bondAnimRef.current.startTime;
        bondAnimRef.current.progress = Math.min(1, elapsed / BOND_DURATION_MS);
        drawBondAnimation(ctx, bondAnimRef.current, CW, CH);
        if (bondAnimRef.current.progress >= 1) bondAnimRef.current = null;
      }

      const wallPct = Math.round(wallPosRef.current * 100);
      const fz = Math.max(11, Math.round(CW * 0.038));
      ctx.font = `bold ${fz}px "Fredoka", sans-serif`;
      ctx.textAlign = "right";
      ctx.fillStyle = `rgba(${r},${g},${b},0.9)`;
      ctx.fillText(`${wallPct}%`, CW - 8, fz + 6);
      ctx.textAlign = "left";
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [shared, solidMax, gasMin, isPaused]); // eslint-disable-line

  // ── Wall drag — allowed in all phases except intro/done ──────────────────
  const sliderRef = useRef<HTMLDivElement>(null);
  const dragging  = useRef(false);

  function wallFromX(clientX: number) {
    const el = sliderRef.current; if (!el) return wallPosRef.current;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  const handleWall = useCallback((v: number) => {
    // Only block in intro and done — allow dragging during guided play
    if (epRef.current === "intro" || epRef.current === "done") return;
    wallPosRef.current = v;
    setWallPos(v);
    const phase = getPhaseFromWall(v, solidMax, gasMin);
    setCurPhase(phase);
    clearLabel();
    scheduleLabel(phase);
    setBondResult("");
  }, [solidMax, gasMin, clearLabel, scheduleLabel]);

  function onPD(e: React.PointerEvent) {
    if (epRef.current === "intro" || epRef.current === "done") return;
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleWall(wallFromX(e.clientX));
  }
  function onPM(e: React.PointerEvent) { if (dragging.current) handleWall(wallFromX(e.clientX)); }
  function onPU() { dragging.current = false; }

  // ── Guided hold interval — fixed step advance logic ───────────────────────
  useEffect(() => {
    if (!isGuided) return;
    if (enginePhase !== "playing") {
      if (holdIntRef.current) { clearInterval(holdIntRef.current); holdIntRef.current = null; }
      return;
    }

    holdIntRef.current = setInterval(() => {
      const idx = stepRef.current;
      if (idx >= guidedSteps.length) return;
      const step = guidedSteps[idx];

      if (!step.targetZone) {
        // No zone required — advance when bond tap condition is met (or immediately if no tap needed)
        if (!step.requiresBondTap || bondDoneRef.current) {
          setShowNext(true);
          clearInterval(holdIntRef.current!);
          holdIntRef.current = null;
        }
        return;
      }

      // Zone required — check student is holding in the right zone
      const phase = getPhaseFromWall(wallPosRef.current, solidMax, gasMin);
      if (phase !== step.targetZone) {
        holdStartRef.current = null;
        return;
      }
      if (holdStartRef.current === null) {
        holdStartRef.current = Date.now();
        return;
      }
      const held = Date.now() - holdStartRef.current;
      if (held >= (step.holdMs ?? 2000)) {
        if (step.requiresBondTap && !bondDoneRef.current) return;
        setShowNext(true);
        clearInterval(holdIntRef.current!);
        holdIntRef.current = null;
      }
    }, 150);

    return () => { if (holdIntRef.current) clearInterval(holdIntRef.current); };
  }, [enginePhase, isGuided, guidedSteps, solidMax, gasMin, stepTick]); // eslint-disable-line

  // ── Begin / advance guided steps ──────────────────────────────────────────
  function beginStep(idx: number) {
    if (idx >= guidedSteps.length) { finishMission(); return; }
    bondDoneRef.current  = false;
    holdStartRef.current = null;
    setShowNext(false);
    setAdaobiLine(guidedSteps[idx].narration);
  }

  function advanceStep() {
    setShowNext(false);
    const next = stepRef.current + 1;
    stepRef.current = next;
    stepTickRef.current++;
    setStepTick(t => t + 1); // restart the hold interval for the new step
    if (next >= guidedSteps.length) {
      setAdaobiLine(
        "Three states, one substance, one difference: spacing and attraction. " +
        "That's the particle model. You'll use it for everything in this lab."
      );
    } else {
      beginStep(next);
    }
  }

  function beginMission() {
    startTimeRef.current = Date.now();
    setEP("playing");
    if (isGuided) {
      beginStep(0);
    } else {
      setAdaobiLine(
        payload.difficulty === "EASY"
          ? "Drag the wall slowly. Watch what the particles do."
          : "Drag the wall. Identify the state when you're ready."
      );
    }
  }

  // ── Bond tap ──────────────────────────────────────────────────────────────
  function handleTap(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!bondEnabled) return;
    const ep = epRef.current;
    if (ep === "intro" || ep === "identify" || ep === "done") return;
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const tapX = (e.clientX - rect.left) / rect.width;
    const tapY = (e.clientY - rect.top)  / rect.height;

    const particles = particlesRef.current;
    let c1 = -1; let c2 = -1; let d1 = Infinity; let d2 = Infinity;
    for (let i = 0; i < particles.length; i++) {
      const d = Math.hypot(particles[i].x - tapX, particles[i].y - tapY);
      if (d < d1) { d2 = d1; c2 = c1; d1 = d; c1 = i; }
      else if (d < d2) { d2 = d; c2 = i; }
    }
    if (c1 === -1 || c2 === -1 || d1 > 0.20) return;

    bondDoneRef.current = true;
    const phase = getPhaseFromWall(wallPosRef.current, solidMax, gasMin);
    bondAnimRef.current = {
      x1: particles[c1].x, y1: particles[c1].y,
      x2: particles[c2].x, y2: particles[c2].y,
      progress: 0,
      strength: phase === "solid" ? "strong" : phase === "liquid" ? "moderate" : "none",
      startTime: performance.now(),
    };

    const labels: Record<PhaseState, string> = {
      solid:  "Strong attraction — particles held in place",
      liquid: "Moderate attraction — particles stay close but can move",
      gas:    "No attraction — particles are free",
    };
    setBondResult(labels[phase]);
    setTimeout(() => setBondResult(""), 3000);

    // Bond tap may satisfy a guided step
    if (isGuided) {
      const step = guidedSteps[stepRef.current];
      if (step?.requiresBondTap && !step.targetZone) {
        setTimeout(() => setShowNext(true), 500);
      }
    }
  }

  // ── State identification chips ────────────────────────────────────────────
  function handleChip(tapped: PhaseState) {
    const correct = getPhaseFromWall(wallPosRef.current, solidMax, gasMin);
    if (tapped === correct) {
      if (firstTryQRef.current) firstTryRef.current++;
      firstTryQRef.current = true;
      setEP("correct-flash");
      setRevState(correct);
      setFeedback("");
      const lines: Record<PhaseState, string> = {
        solid:  "Particles locked in their grid — correct. That's a solid.",
        liquid: "Particles sliding past each other — correct. That's a liquid.",
        gas:    "Particles flying freely — correct. That's a gas.",
      };
      setAdaobiLine(lines[correct]);
      setTimeout(() => { setRevState(null); finishMission(); }, 2000);
    } else {
      totalWrongRef.current++;
      firstTryQRef.current = false;
      setWrongCount(w => w + 1);
      const hints: Record<PhaseState, string> = {
        solid:  "Look at the spacing — when they're locked in place, what state is that?",
        liquid: "Can they pass through each other? Do they stay in one place?",
        gas:    "Are the particles touching? Are they filling every part of the container?",
      };
      setAdaobiLine(hints[correct]);
      setFeedback("Look carefully at the particle behaviour, then try again.");
      if (wrongCount + 1 >= shared.maxWrongBeforeReveal) {
        anyRevRef.current = true;
        setRevState(correct);
        setTimeout(() => { setRevState(null); finishMission(); }, 3000);
      }
    }
  }

  // ── Finish ────────────────────────────────────────────────────────────────
  function finishMission() {
    setEP("done");
    setAdaobiLine(
      "Three states, one substance, one difference: spacing and attraction. " +
      "That's the particle model. You'll use it for everything in this lab."
    );
    const outcome: PhaseChamberOutcome = {
      success: true, mode: "boundary-drag",
      timeSpentSec: Math.round((Date.now() - startTimeRef.current) / 1000),
      totalWrongAttempts: totalWrongRef.current,
      anyRevealed: anyRevRef.current,
      firstTryCount: firstTryRef.current,
    };
    setTimeout(() => onComplete(outcome as never), 2200);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const currentStep = isGuided ? guidedSteps[stepRef.current] ?? null : null;
  const showChips   = !isGuided && enginePhase === "playing" && payload.completionType === "identify-state";
  const showComplete = enginePhase === "playing" && isGuided && stepRef.current >= guidedSteps.length;
  const stats = [{ label: "State", value: PHASE_LABELS[curPhase], tone: "gold" as const }];

  return (
    <GameplayShell
      fallbackGradient="linear-gradient(160deg,#030a14 0%,#0a1a2e 100%)"
      accentColor="#9b7ae0"
      stats={stats}
      menu={menu!}
      isPaused={isPaused}
      gameTitle={gameTitle ?? "Matter Lab"}
      // missionPrompt removed — substance is shown in canvas phase badge, cleaner header
    >
      <div className={styles.outer}>

        {/* Horizontal wall slider */}
        <div className={styles.sliderArea}>
          <span className={styles.sliderLabel}>COMPACT</span>
          <div
            ref={sliderRef}
            className={[
              styles.sliderTrack,
              // Only lock during intro and done — NEVER during guided play
              (enginePhase === "intro" || enginePhase === "done") ? styles.sliderLocked : "",
            ].join(" ")}
            onPointerDown={onPD}
            onPointerMove={onPM}
            onPointerUp={onPU}
            onPointerLeave={onPU}
          >
            <div className={styles.sliderFill} style={{ width: `${wallPos * 100}%` }} />
            <div className={styles.sliderThumb} style={{ left: `calc(${wallPos * 100}% - 20px)` }}>
              <span className={styles.thumbIcon}>⟺</span>
            </div>
          </div>
          <span className={styles.sliderLabel}>SPREAD</span>
        </div>

        {/* Canvas */}
        <div className={styles.canvasWrap}>
          {showLabel && (
            <div
              className={styles.stateLabel}
              style={
                curPhase === "solid"
                  ? { background:"rgba(176,200,240,0.13)", color:"#b0c8f0", border:"1px solid rgba(176,200,240,0.3)" }
                  : curPhase === "liquid"
                  ? { background:"rgba(155,122,224,0.13)", color:"#b8a0f8", border:"1px solid rgba(155,122,224,0.3)" }
                  : { background:"rgba(196,175,240,0.13)", color:"#d4c0ff", border:"1px solid rgba(196,175,240,0.3)" }
              }
            >
              {curPhase === "solid" ? "❄️ " : curPhase === "liquid" ? "💧 " : "💨 "}
              {PHASE_LABELS[curPhase]}
            </div>
          )}
          {showBadge && isGuided && <div className={styles.propertyBadge}>{PROPERTY_BADGES[curPhase]}</div>}
          {bondResult && <div className={styles.bondResult}>{bondResult}</div>}
          {!isGuided && enginePhase === "playing" && <div className={styles.densityLabel}>{DENSITY_LABELS[curPhase]}</div>}
          {enginePhase === "intro" && <div className={styles.dragHint}>drag the wall ⟺</div>}

          <canvas ref={canvasRef} className={styles.canvas} onClick={handleTap} />
        </div>

        {/* Dr. Adaobi — in-game guided narration strip */}
        <div className={[styles.adaobiStrip, adaobiMinimised ? styles.adaobiStripMinimised : ""].filter(Boolean).join(" ")}>

          {/* Step badge — floats above */}
          {isGuided && guidedSteps.length > 0 && (
            <div className={styles.adaobiStepBadge}>
              Step {Math.min(stepRef.current + 1, guidedSteps.length)} / {guidedSteps.length}
            </div>
          )}

          {/* Minimise handle */}
          <div className={styles.adaobiMinimise} onClick={() => setAdaobiMinimised(v => !v)} />

          {/* Minimised peek */}
          <div className={styles.adaobiMinimisedPeek} onClick={() => setAdaobiMinimised(false)}>
            <span className={styles.adaobiMinimisedIcon}>🔬</span>
            <span className={styles.adaobiMinimisedText}>Dr. Adaobi has a tip — tap to see</span>
            <span className={styles.adaobiMinimisedExpand}>↑ expand</span>
          </div>

          {/* Full content */}
          <div className={styles.adaobiInner}>
            <div className={styles.adaobiAvatar}><DrAdaobiSvg /></div>
            <div className={styles.adaobiBubble}>
              <div className={styles.adaobiName}>Dr. Adaobi</div>
              <p className={styles.adaobiText}>{adaobiLine}</p>
              {enginePhase === "intro" && (
                <button className={styles.beginBtn} onClick={beginMission}>
                  {isGuided ? "Let's begin →" : "Start →"}
                </button>
              )}
              {enginePhase === "done" && (
                <div className={styles.doneChip}>✓ Mission complete</div>
              )}
            </div>
          </div>

          {/* Footer: progress dots + action pill / next button */}
          {(isGuided && guidedSteps.length > 0) && (
            <div className={styles.adaobiFooter}>
              <div className={styles.adaobiDots}>
                {guidedSteps.map((_, i) => (
                  <div
                    key={i}
                    className={[
                      styles.adaobiDot,
                      i < stepRef.current ? styles.adaobiDotDone : "",
                      i === stepRef.current ? styles.adaobiDotNow : "",
                    ].filter(Boolean).join(" ")}
                  />
                ))}
              </div>
              {showNext && enginePhase === "playing" ? (
                <button className={styles.nextBtn} onClick={advanceStep}>Next →</button>
              ) : enginePhase === "playing" && currentStep?.instruction ? (
                <div className={styles.adaobiActionPill}>
                  <span className={styles.adaobiActionIcon}>→</span>
                  <span>{currentStep.instruction}</span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* State ID chips */}
        {showChips && (
          <div className={styles.identifyRow}>
            <p className={styles.identifyPrompt}>What state is this substance in?</p>
            <div className={styles.chipsRow}>
              {STATE_CHIPS.map(s => (
                <button
                  key={s}
                  className={[
                    styles.stateChip,
                    revState === s ? styles.chipCorrect : "",
                    revState && revState !== s ? styles.chipFaded : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => handleChip(s)}
                  disabled={!!revState}
                >
                  {STATE_DISPLAY[s]}
                </button>
              ))}
            </div>
            {feedback && <p className={styles.feedbackText}>{feedback}</p>}
          </div>
        )}

        {showComplete && (
          <button className={styles.completeBtn} onClick={finishMission}>
            Complete Mission
          </button>
        )}
      </div>
    </GameplayShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTION 2 — HEAT CONTROL
// ─────────────────────────────────────────────────────────────────────────────

type HCPhase = "intro" | "playing" | "done";

const HEAT_PHASE_LABEL: Record<HeatPhaseLabel, string> = {
  solid:   "SOLID",
  melting: "MELTING...",
  liquid:  "LIQUID",
  boiling: "BOILING...",
  gas:     "GAS",
};

const HEAT_RATE = 18;   // °C/sec at full slider
const COOL_RATE = 3;    // °C/sec ambient cooling

function HeatControlEngine({
  config: rawConfig, onComplete, menu, isPaused, gameTitle,
}: EngineRuntimeProps) {
  const cfg     = rawConfig as PhaseChamberConfig;
  const shared  = cfg.shared;
  const payload = cfg.mission.payload as HeatControlPayload;

  const meltC      = payload.meltingPointC ?? 0;
  const boilC      = payload.boilingPointC ?? 100;
  const startC     = payload.startTempC    ?? -20;
  const maxC       = payload.maxTempC      ?? 120;
  const isGuided   = Boolean(payload.guidedSteps?.length);
  const guidedSteps = payload.guidedSteps ?? [];

  // ── Refs ──────────────────────────────────────────────────────────────────
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const curveCanvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef          = useRef<number>(0);
  const lastTimeRef     = useRef<number>(0);
  const particlesRef    = useRef<Particle[]>([]);
  const tempRef         = useRef<number>(startC);
  const heatInputRef    = useRef<number>(0);
  const epRef           = useRef<HCPhase>("intro");
  const stepRef         = useRef<number>(0);
  const curvePointsRef  = useRef<CurvePoint[]>([]);
  const elapsedRef      = useRef<number>(0);
  const escapeParticles = useRef<EscapeParticle[]>([]);
  const escapeAccum     = useRef({ current: 0 });
  const escapeNextId    = useRef({ current: 0 });
  const shownMeltRef    = useRef(false);
  const shownBoilRef    = useRef(false);
  const startTimeRef    = useRef(Date.now());
  const totalWrongRef   = useRef(0);
  const stepHoldRef     = useRef<number | null>(null);
  const inactiveRef     = useRef<number>(0);
  const flagsRef        = useRef<Array<{ tempC: number; label: string }>>([]);

  // ── State ─────────────────────────────────────────────────────────────────
  const [enginePhase,    setEnginePhase]    = useState<HCPhase>("intro");
  const [temperature,    setTemperature]    = useState(startC);
  const [heatInput,      setHeatInput]      = useState(0);
  const [heatPhaseLabel, setHeatPhaseLabel] = useState<HeatPhaseLabel>("solid");
  const [adaobiLine,     setAdaobiLine]     = useState(
    payload.missionContext ?? "Drag the heat slider upward to start warming the sample."
  );
  const [showNext,       setShowNext]       = useState(false);
  const [plateauCallout, setPlateauCallout] = useState(false);
  const [energySplit,    setEnergySplit]    = useState({ tempFraction: 0, bondsFraction: 0 });
  const [pendingFlag,    setPendingFlag]    = useState(false);
  const [placedFlags,    setPlacedFlags]    = useState<Array<{ tempC: number; label: string }>>([]);

  function setEP(p: HCPhase) { epRef.current = p; setEnginePhase(p); }

  useEffect(() => {
    particlesRef.current = buildParticles(shared.particleCount, 0, shared);
  }, []); // eslint-disable-line

  // ── RAF loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    function tick(now: number) {
      rafRef.current = requestAnimationFrame(tick);
      const canvas  = canvasRef.current;
      const cCanvas = curveCanvasRef.current;
      if (!canvas || !cCanvas) return;
      const ctx  = canvas.getContext("2d");
      const cCtx = cCanvas.getContext("2d");
      if (!ctx || !cCtx) return;

      const dpr  = window.devicePixelRatio || 1;
      const cssW = canvas.offsetWidth; const cssH = canvas.offsetHeight;
      if (cssW > 2 && cssH > 2) {
        if (canvas.width !== Math.round(cssW*dpr) || canvas.height !== Math.round(cssH*dpr)) {
          canvas.width = Math.round(cssW*dpr); canvas.height = Math.round(cssH*dpr);
          ctx.setTransform(dpr,0,0,dpr,0,0);
        }
      }
      const ccssW = cCanvas.offsetWidth; const ccssH = cCanvas.offsetHeight;
      if (ccssW > 2 && ccssH > 2) {
        if (cCanvas.width !== Math.round(ccssW*dpr) || cCanvas.height !== Math.round(ccssH*dpr)) {
          cCanvas.width = Math.round(ccssW*dpr); cCanvas.height = Math.round(ccssH*dpr);
          cCtx.setTransform(dpr,0,0,dpr,0,0);
        }
      }
      const CW = cssW; const CH = cssH;
      const CCW = ccssW; const CCH = ccssH;
      const dt   = Math.min((now-(lastTimeRef.current||now))/1000, 0.05);
      lastTimeRef.current = now;

      const locked = isPaused || epRef.current === "intro" || epRef.current === "done";
      const dtEff  = locked ? 0 : dt;

      if (dtEff > 0) {
        const heat    = heatInputRef.current;
        const onPlat  = isOnPlateau(tempRef.current, meltC, boilC);
        if (onPlat) {
          tempRef.current = tempRef.current > (meltC + boilC) / 2 ? boilC : meltC;
        } else {
          const netRate = (heat / 100) * HEAT_RATE - (heat < 10 ? COOL_RATE : 0);
          tempRef.current = Math.max(startC, Math.min(maxC, tempRef.current + netRate * dtEff));
        }

        if (tempRef.current >= meltC - 1.5 && !shownMeltRef.current) shownMeltRef.current = true;
        if (tempRef.current >= boilC - 1.5 && !shownBoilRef.current) shownBoilRef.current = true;

        elapsedRef.current += dtEff;
        const pts = curvePointsRef.current;
        if (pts.length === 0 || elapsedRef.current - (pts[pts.length-1]?.x ?? 0) >= 0.25) {
          pts.push({ x: elapsedRef.current, y: tempRef.current });
          if (pts.length > MAX_CURVE_POINTS) pts.splice(0, pts.length - MAX_CURVE_POINTS);
        }

        if (heat < 5) { inactiveRef.current += dtEff; } else { inactiveRef.current = 0; }
        if (inactiveRef.current > 30 && epRef.current === "playing") {
          inactiveRef.current = 0;
          setAdaobiLine("Try moving the heat slider upward. The curve only plots while you're actively heating.");
        }

        setEnergySplit(getEnergyViewSplit(heat, onPlat));
        setTemperature(Math.round(tempRef.current));
        setHeatPhaseLabel(getHeatPhaseLabel(tempRef.current, meltC, boilC));

        if (isGuided && onPlat && epRef.current === "playing" && !plateauCallout) {
          setPlateauCallout(true);
        }

        const ep2 = maybeEmitEscape(escapeAccum.current, tempRef.current, boilC, dtEff, escapeNextId.current);
        if (ep2) escapeParticles.current.push(ep2);
        escapeParticles.current = updateEscapeParticles(escapeParticles.current, dtEff);

        if (isGuided && epRef.current === "playing") {
          const idx  = stepRef.current;
          if (idx < guidedSteps.length) {
            const step    = guidedSteps[idx];
            const reached = step.targetTempC != null
              ? tempRef.current >= step.targetTempC - 2
              : false;
            if (reached || step.targetTempC == null) {
              if (stepHoldRef.current === null) stepHoldRef.current = Date.now();
              if (Date.now() - stepHoldRef.current >= (step.holdMs ?? 2000)) {
                stepHoldRef.current = null;
                if (step.requiresFlagPlacement) { setPendingFlag(true); }
                else { setShowNext(true); }
              }
            } else { stepHoldRef.current = null; }
          }
        }
      }

      // ── Particles ─────────────────────────────────────────────────────
      const temp      = tempRef.current;
      const speedM    = getSpeedMultFromTemp(temp, startC, maxC);
      const heatLabel = getHeatPhaseLabel(temp, meltC, boilC);
      const particlePhase: PhaseState =
        heatLabel === "solid"   ? "solid"  :
        heatLabel === "melting" ? (Math.random() > 0.5 ? "solid" : "liquid") :
        heatLabel === "liquid"  ? "liquid" :
        heatLabel === "boiling" ? "liquid" : "gas";

      const r2 = Math.max(4, Math.min(10, CW * 0.018));
      const { r, g, b } = getParticleRgb(speedM, shared.particleColors.solid, shared.particleColors.liquid, shared.particleColors.gas, 0.3, 0.65);

      ctx.clearRect(0, 0, CW, CH);
      drawBackground(ctx, CW, CH);
      drawAmbientGlow(ctx, CW, CH, r, g, b, speedM);

      if ((heatLabel === "boiling" || heatLabel === "gas") && payload.surfaceEscapeEnabled !== false) {
        drawSurfaceZone(ctx, CW, CH);
      }
      drawContainerBorder(ctx, CW, CH, r, g, b, false, now);

      for (let i = 0; i < particlesRef.current.length; i++) {
        updateParticle(particlesRef.current[i], particlePhase, speedM, dtEff, now, i, CW, CH, r2);
        drawParticle(ctx, particlesRef.current[i].x*CW, particlesRef.current[i].y*CH, r2, r, g, b, false);
      }
      drawEscapeParticles(ctx, escapeParticles.current, CW, CH, r2);

      const fz = Math.max(11, Math.round(CW * 0.042));
      ctx.font = `bold ${fz}px "Fredoka", sans-serif`;
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffb23c";
      ctx.fillText(`${Math.round(temp)}°C`, CW - 8, fz + 6);
      ctx.textAlign = "left";

      // ── Heating curve ──────────────────────────────────────────────────
      if (CCW > 2 && CCH > 2) {
        cCtx.clearRect(0, 0, CCW, CCH);
        drawHeatingCurve(
          cCtx, curvePointsRef.current, CCW, CCH,
          startC, maxC, meltC, boilC,
          isOnPlateau(tempRef.current, meltC, boilC),
          shownMeltRef.current, shownBoilRef.current
        );

        for (const flag of flagsRef.current) {
          const PAD_L=28; const PAD_R=6; const PAD_T=8; const PAD_B=18;
          const plotW=CCW-PAD_L-PAD_R; const plotH=CCH-PAD_T-PAD_B;
          const pts=curvePointsRef.current;
          if (pts.length===0) continue;
          const lastX=pts[pts.length-1].x;
          const winSec=Math.max(60,lastX+5);
          const xStart=Math.max(0,lastX-winSec+5);
          const flagPt=pts.find(p=>Math.abs(p.y-flag.tempC)<3);
          if (!flagPt) continue;
          const sx=PAD_L+((flagPt.x-xStart)/winSec)*plotW;
          const sy=PAD_T+plotH-((flag.tempC-startC)/(maxC-startC))*plotH;
          cCtx.strokeStyle="#24c96e"; cCtx.lineWidth=1.5;
          cCtx.beginPath(); cCtx.moveTo(sx,sy); cCtx.lineTo(sx,PAD_T+plotH); cCtx.stroke();
          cCtx.fillStyle="#24c96e"; cCtx.font=`bold 10px "Fredoka",sans-serif`;
          cCtx.fillText(flag.label, Math.min(sx+2,CCW-60), sy-3);
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [shared, meltC, boilC, startC, maxC, isGuided, guidedSteps, isPaused, plateauCallout, payload.surfaceEscapeEnabled]); // eslint-disable-line

  // ── Heat slider ───────────────────────────────────────────────────────────
  const sliderRef = useRef<HTMLDivElement>(null);
  const dragging  = useRef(false);
  function heatFromY(clientY: number) {
    const el=sliderRef.current; if(!el) return heatInputRef.current;
    const r=el.getBoundingClientRect();
    return Math.round((1-Math.max(0,Math.min(1,(clientY-r.top)/r.height)))*100);
  }
  function handleHeat(v: number) { if(epRef.current!=="playing") return; heatInputRef.current=v; setHeatInput(v); }
  function onSliderDown(e: React.PointerEvent) { if(epRef.current!=="playing") return; dragging.current=true; (e.target as HTMLElement).setPointerCapture(e.pointerId); handleHeat(heatFromY(e.clientY)); }
  function onSliderMove(e: React.PointerEvent) { if(dragging.current) handleHeat(heatFromY(e.clientY)); }
  function onSliderUp() { dragging.current=false; }

  // ── Flag placement ────────────────────────────────────────────────────────
  const FLAG_OPTIONS = ["Melting begins", "Melting ends", "Boiling begins", "Boiling ends"];

  function handleCurveTap() {
    if (!payload.flagPlacementEnabled) return;
    if (epRef.current !== "playing" && !pendingFlag) return;
    setPendingFlag(true);
  }

  function placeFlag(label: string) {
    const flag = { tempC: Math.round(tempRef.current), label };
    flagsRef.current = [...flagsRef.current, flag];
    setPlacedFlags([...flagsRef.current]);
    setPendingFlag(false);
    if (isGuided) {
      const step = guidedSteps[stepRef.current];
      if (step?.requiresFlagPlacement) setShowNext(true);
    }
  }

  // ── Guided steps ──────────────────────────────────────────────────────────
  function beginStep(idx: number) {
    if (idx >= guidedSteps.length) { finishMission(); return; }
    stepHoldRef.current = null;
    setShowNext(false);
    setPendingFlag(false);
    setPlateauCallout(false);
    setAdaobiLine(guidedSteps[idx].narration);
  }
  function advanceStep() {
    setShowNext(false);
    const next = stepRef.current + 1;
    stepRef.current = next;
    setPlateauCallout(false);
    if (next >= guidedSteps.length) {
      setAdaobiLine("Two flat sections, two changes of state. Every time you see that plateau on a heating curve — someone's bonds are breaking. Now you know what to say when an exam asks why the temperature stopped rising.");
    } else {
      beginStep(next);
    }
  }
  function beginMission() {
    startTimeRef.current = Date.now();
    setEP("playing");
    if (isGuided) beginStep(0);
    else setAdaobiLine("Drag the heat slider upward to heat the sample. Watch the particles and the curve.");
  }
  function finishMission() {
    setEP("done");
    setAdaobiLine("You read a heating curve, identified both change-of-state events by their plateaus, and explained the energy transfer at each one. That's the full answer to every heating-curve question this exam can throw at you.");
    const outcome: PhaseChamberOutcome = {
      success:true, mode:"heat-control",
      timeSpentSec:Math.round((Date.now()-startTimeRef.current)/1000),
      totalWrongAttempts:totalWrongRef.current, anyRevealed:false, firstTryCount:0,
    };
    setTimeout(()=>onComplete(outcome as never), 2200);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const currentStep = isGuided ? guidedSteps[stepRef.current] ?? null : null;
  const onPlat = isOnPlateau(temperature, meltC, boilC);
  const stats = [
    { label: "Temp",  value: `${temperature}°C`,              tone: "gold" as const },
    { label: "State", value: HEAT_PHASE_LABEL[heatPhaseLabel], tone: onPlat ? "success" as const : "default" as const },
  ];

  return (
    <GameplayShell
      fallbackGradient="linear-gradient(160deg,#030a14 0%,#0a1a2e 100%)"
      accentColor="#9b7ae0"
      stats={stats}
      menu={menu!}
      isPaused={isPaused}
      gameTitle={gameTitle ?? "Matter Lab"}
      // missionPrompt removed — substance is shown in canvas phase badge, cleaner header
    >
      <div className={styles.outer}>
        <div className={styles.heatLayout}>

          {/* Vertical heat slider */}
          <div className={styles.heatSliderWrap}>
            <span className={styles.heatSliderLabel}>HOT</span>
            <div
              ref={sliderRef}
              className={[styles.heatSliderTrack, enginePhase==="playing"?"":styles.sliderLocked].join(" ")}
              onPointerDown={onSliderDown} onPointerMove={onSliderMove}
              onPointerUp={onSliderUp}     onPointerLeave={onSliderUp}
            >
              <div className={styles.heatSliderFill} style={{ height: `${heatInput}%` }} />
              <div className={styles.heatSliderThumb} style={{ bottom: `calc(${heatInput}% - 20px)` }}>
                <span className={styles.thumbIcon}>↕</span>
              </div>
            </div>
            <span className={styles.heatSliderLabel}>COOL</span>
          </div>

          {/* Centre: particle canvas + curve canvas */}
          <div className={styles.heatCentreCol}>
            <div className={styles.heatParticleWrap}>
              <div className={styles.heatStateLabel} style={{ opacity: enginePhase==="intro"?0:1 }}>
                {HEAT_PHASE_LABEL[heatPhaseLabel]}
              </div>
              <canvas ref={canvasRef} className={styles.canvas} />
            </div>

            {/* Heating curve */}
            <div className={styles.heatCurveWrap}>
              {isGuided && plateauCallout && (
                <div className={styles.plateauCallout}>
                  Temperature has stopped rising — watch the energy meter
                </div>
              )}
              <canvas
                ref={curveCanvasRef}
                className={styles.canvas}
                onClick={handleCurveTap}
                style={{ cursor: payload.flagPlacementEnabled ? "crosshair" : "default" }}
              />
              {pendingFlag && (
                <div className={styles.flagPicker}>
                  <p className={styles.flagPickerPrompt}>Mark this point as:</p>
                  <div className={styles.flagPickerChips}>
                    {FLAG_OPTIONS.map(opt => (
                      <button key={opt} className={styles.flagChip} onClick={() => placeFlag(opt)}>{opt}</button>
                    ))}
                    <button className={styles.flagChipCancel} onClick={() => setPendingFlag(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Energy-view meter */}
          <div className={styles.energyMeter}>
            <div className={styles.energyBar}>
              <div className={styles.energyBarFill} style={{ height:`${energySplit.tempFraction*100}%`, background:"#ffb23c" }} />
            </div>
            <span className={styles.energyLabel}>TEMP</span>
            <div className={styles.energyBar}>
              <div className={styles.energyBarFill} style={{ height:`${energySplit.bondsFraction*100}%`, background:"var(--eg-subject-chemistry,#9b7ae0)" }} />
            </div>
            <span className={styles.energyLabel}>BONDS</span>
            <span className={styles.energyQuestion}>Where is the energy going?</span>
          </div>
        </div>

        {/* Dr. Adaobi — in-game guided narration strip */}
        <div className={[styles.adaobiStrip, hcAdaobiMinimised ? styles.adaobiStripMinimised : ""].filter(Boolean).join(" ")}>

          {isGuided && guidedSteps.length > 0 && (
            <div className={styles.adaobiStepBadge}>
              Step {Math.min(stepRef.current + 1, guidedSteps.length)} / {guidedSteps.length}
            </div>
          )}

          <div className={styles.adaobiMinimise} onClick={() => setHcAdaobiMinimised(v => !v)} />

          <div className={styles.adaobiMinimisedPeek} onClick={() => setHcAdaobiMinimised(false)}>
            <span className={styles.adaobiMinimisedIcon}>🔬</span>
            <span className={styles.adaobiMinimisedText}>Dr. Adaobi has a tip — tap to see</span>
            <span className={styles.adaobiMinimisedExpand}>↑ expand</span>
          </div>

          <div className={styles.adaobiInner}>
            <div className={styles.adaobiAvatar}><DrAdaobiSvg /></div>
            <div className={styles.adaobiBubble}>
              <div className={styles.adaobiName}>Dr. Adaobi</div>
              <p className={styles.adaobiText}>{adaobiLine}</p>
              {enginePhase==="intro" && (
                <button className={styles.beginBtn} onClick={beginMission}>
                  {isGuided?"Let\'s begin →":"Start →"}
                </button>
              )}
              {enginePhase==="done"&&<div className={styles.doneChip}>✓ Mission complete</div>}
            </div>
          </div>

          {(isGuided && guidedSteps.length > 0) && (
            <div className={styles.adaobiFooter}>
              <div className={styles.adaobiDots}>
                {guidedSteps.map((_, i) => (
                  <div
                    key={i}
                    className={[
                      styles.adaobiDot,
                      i < stepRef.current ? styles.adaobiDotDone : "",
                      i === stepRef.current ? styles.adaobiDotNow : "",
                    ].filter(Boolean).join(" ")}
                  />
                ))}
              </div>
              {showNext && !pendingFlag && enginePhase === "playing" ? (
                <button className={styles.nextBtn} onClick={advanceStep}>Next →</button>
              ) : enginePhase === "playing" && currentStep?.instruction ? (
                <div className={styles.adaobiActionPill}>
                  <span className={styles.adaobiActionIcon}>→</span>
                  <span>{currentStep.instruction}</span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {enginePhase==="playing"&&isGuided&&stepRef.current>=guidedSteps.length&&(
          <button className={styles.completeBtn} onClick={finishMission}>Complete Mission</button>
        )}
        {!isGuided&&enginePhase==="playing"&&(
          <button className={styles.completeBtn} onClick={finishMission}>Complete Mission</button>
        )}
      </div>
    </GameplayShell>
  );
}

// ─── Dr. Adaobi SVG ───────────────────────────────────────────────────────────

function DrAdaobiSvg() {
  return (
    <svg viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%"}} aria-hidden="true">
      <ellipse cx="40" cy="97" rx="22" ry="4" fill="rgba(0,0,0,0.3)"/>
      <rect x="27" y="74" width="10" height="18" fill="#1a2a4a" rx="3"/><rect x="43" y="74" width="10" height="18" fill="#1a2a4a" rx="3"/>
      <ellipse cx="32" cy="92" rx="7" ry="4" fill="#0e1828"/><ellipse cx="48" cy="92" rx="7" ry="4" fill="#0e1828"/>
      <rect x="19" y="48" width="42" height="30" fill="#dde8f8" rx="6"/>
      <path d="M34 48 L40 64 L46 48Z" fill="#b8cce8"/><rect x="35" y="48" width="10" height="14" fill="#2a4a8a"/>
      <rect x="10" y="50" width="10" height="28" fill="#dde8f8" rx="5"/><rect x="60" y="50" width="10" height="28" fill="#dde8f8" rx="5"/>
      <ellipse cx="15" cy="79" rx="6" ry="5" fill="#c8956a"/><ellipse cx="65" cy="78" rx="6" ry="5" fill="#c8956a"/>
      <rect x="36" y="44" width="8" height="6" fill="#c8956a" rx="3"/>
      <ellipse cx="40" cy="32" rx="18" ry="21" fill="#c8956a"/>
      <ellipse cx="40" cy="14" rx="19" ry="10" fill="#1a0800"/>
      {[25,30,35,40,45,50,55].map((x,i)=><ellipse key={i} cx={x} cy={16} rx={2.5} ry={6} fill={i%2===0?"#1a0800":"#2a0e00"}/>)}
      <ellipse cx="22" cy="34" rx="4" ry="6" fill="#c8956a"/><ellipse cx="58" cy="34" rx="4" ry="6" fill="#c8956a"/>
      <ellipse cx="33" cy="31" rx="5" ry="5" fill="#fff"/><ellipse cx="47" cy="31" rx="5" ry="5" fill="#fff"/>
      <ellipse cx="34" cy="32" rx="3" ry="3" fill="#2a1808"/><ellipse cx="48" cy="32" rx="3" ry="3" fill="#2a1808"/>
      <ellipse cx="33" cy="31" rx="1" ry="1" fill="#fff"/><ellipse cx="47" cy="31" rx="1" ry="1" fill="#fff"/>
      <path d="M28 25 Q33 22 38 25" fill="none" stroke="#1a0800" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M42 25 Q47 22 52 25" fill="none" stroke="#1a0800" strokeWidth="1.4" strokeLinecap="round"/>
      <ellipse cx="40" cy="40" rx="2" ry="1.5" fill="#b07050"/>
      <path d="M35 46 Q40 50 45 46" fill="none" stroke="#9a6040" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}