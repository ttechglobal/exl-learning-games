"use client";

/**
 * DiffusionEngine.tsx — Matter Lab, Interaction 4
 * Cluster 3 (secondary): Temperature & Diffusion Rate
 * Guided Learning + Practice only.
 *
 * Import into PhaseChamberEngine.tsx dispatcher:
 *   import { DiffusionEngine } from "./DiffusionEngine";
 *   if (mode === "diffusion") return <DiffusionEngine {...props} />;
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { GameplayShell } from "@/components/gameplay/GameplayShell";
import type { EngineRuntimeProps } from "@/engines/engine-types";
import type { PhaseChamberConfig, PhaseChamberOutcome, DiffusionPayload } from "./phaseChamber.config";
import styles from "./PhaseChamberEngine.module.css";

// ─── Physics ──────────────────────────────────────────────────────────────────

const PARTICLE_COUNT = 30; // per side
const FULL_MIX_THRESHOLD = 0.15; // concentration variance below this = fully mixed

/** Speed in normalised canvas-units per second at a given temperature */
function speedFromTemp(tempC: number): number {
  // 0°C → 0.04/sec, 20°C → 0.08/sec, 60°C → 0.18/sec, 100°C → 0.30/sec
  return 0.04 + (tempC / 100) * 0.26;
}

interface DyeParticle {
  x: number;   // 0–1 normalised
  y: number;
  vx: number;
  vy: number;
  isDye: boolean;
}

function makeDyeParticles(speed: number): DyeParticle[] {
  const particles: DyeParticle[] = [];
  // Left half: plain white particles (x 0–0.5)
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const s = speed * (0.7 + Math.random() * 0.6);
    particles.push({ x: 0.05 + Math.random() * 0.4, y: 0.05 + Math.random() * 0.9, vx: Math.cos(angle)*s, vy: Math.sin(angle)*s, isDye: false });
  }
  // Right half: amber dye particles (x 0.5–1)
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const s = speed * (0.7 + Math.random() * 0.6);
    particles.push({ x: 0.55 + Math.random() * 0.4, y: 0.05 + Math.random() * 0.9, vx: Math.cos(angle)*s, vy: Math.sin(angle)*s, isDye: true });
  }
  return particles;
}

function updateDyeParticle(p: DyeParticle, dt: number): void {
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (p.x < 0.01) { p.x = 0.01; p.vx = Math.abs(p.vx); }
  if (p.x > 0.99) { p.x = 0.99; p.vx = -Math.abs(p.vx); }
  if (p.y < 0.01) { p.y = 0.01; p.vy = Math.abs(p.vy); }
  if (p.y > 0.99) { p.y = 0.99; p.vy = -Math.abs(p.vy); }
}

/** Returns concentration variance (0–1) across a 4×4 grid. 0 = fully mixed. */
function calcConcentrationVariance(particles: DyeParticle[]): number {
  const COLS = 4; const ROWS = 4;
  const grid = Array(COLS * ROWS).fill(0);
  for (const p of particles) {
    if (!p.isDye) continue;
    const col = Math.min(COLS - 1, Math.floor(p.x * COLS));
    const row = Math.min(ROWS - 1, Math.floor(p.y * ROWS));
    grid[row * COLS + col]++;
  }
  const expected = PARTICLE_COUNT / (COLS * ROWS);
  const variance = grid.reduce((acc, v) => acc + Math.abs(v - expected), 0) / (COLS * ROWS * expected);
  return Math.min(1, variance);
}

type DiffPhase = "intro" | "set-temp" | "running" | "mixed" | "set-temp-2" | "running-2" | "done";

// ─── Component ────────────────────────────────────────────────────────────────

export function DiffusionEngine({
  config: rawConfig, onComplete, menu, isPaused, gameTitle,
}: EngineRuntimeProps) {
  const cfg    = rawConfig as PhaseChamberConfig;
  const p      = cfg.mission.payload as DiffusionPayload;

  const isGuided    = Boolean(p.guidedSteps?.length);
  const splitAB     = p.splitABEnabled ?? false;
  const defaultTemp = p.startTempC ?? 20;

  // ── Refs ──────────────────────────────────────────────────────────────────
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const rafRef        = useRef<number>(0);
  const lastTimeRef   = useRef<number>(0);
  const ptclRef       = useRef<DyeParticle[]>([]);
  const ptclBRef      = useRef<DyeParticle[]>([]); // split B
  const dividerRef    = useRef<number>(1);          // 1 = full height, 0 = gone
  const divDropRef    = useRef<boolean>(false);
  const elapsedRef    = useRef<number>(0);
  const elapsedBRef   = useRef<number>(0);
  const mixedRef      = useRef<boolean>(false);
  const mixedBRef     = useRef<boolean>(false);
  const mixTimeRef    = useRef<number>(0);
  const mixTimeBRef   = useRef<number>(0);
  const epRef         = useRef<DiffPhase>("intro");
  const startTimeRef  = useRef<number>(Date.now());
  const tempARef      = useRef<number>(defaultTemp);
  const tempBRef      = useRef<number>(60);
  const heatMapTimerR = useRef<number>(0);
  const heatMapRef    = useRef<number[]>(Array(16).fill(0)); // 4×4 grid dye counts

  // ── State ─────────────────────────────────────────────────────────────────
  const [ep,          setEp]         = useState<DiffPhase>("intro");
  const [tempA,       setTempA]      = useState(defaultTemp);
  const [tempB,       setTempB]      = useState(60);
  const [elapsed,     setElapsed]    = useState(0);
  const [elapsedB,    setElapsedB]   = useState(0);
  const [mixed,       setMixed]      = useState(false);
  const [mixedB,      setMixedB]     = useState(false);
  const [mixTime,     setMixTime]    = useState(0);
  const [mixTimeB,    setMixTimeB]   = useState(0);
  const [adaobi,      setAdaobi]     = useState(
    p.missionContext ?? "The container is split in two. Amber dye on the right, plain particles on the left. When I drop the divider, the dye will start spreading. Your job: tell me how fast."
  );
  const [showRelease, setShowRelease] = useState(false);
  const [tempLocked,  setTempLocked]  = useState(true);
  const [prediction,  setPrediction]  = useState<"A" | "B" | null>(null);
  const [showResult,  setShowResult]  = useState(false);

  function setEpState(s: DiffPhase) { epRef.current = s; setEp(s); }

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    ptclRef.current = makeDyeParticles(speedFromTemp(defaultTemp));
  }, []); // eslint-disable-line

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
      const dt = Math.min((now-(lastTimeRef.current||now))/1000, 0.05);
      lastTimeRef.current = now;

      const running = epRef.current === "running" || epRef.current === "running-2";
      const dtEff   = isPaused || !running ? 0 : dt;

      // ── Divider drop animation ────────────────────────────────────────
      if (divDropRef.current && dividerRef.current > 0) {
        dividerRef.current = Math.max(0, dividerRef.current - dt / 0.6);
        if (dividerRef.current === 0) divDropRef.current = false;
      }

      // ── Update particles ──────────────────────────────────────────────
      if (dtEff > 0) {
        for (const pt of ptclRef.current) updateDyeParticle(pt, dtEff);
        if (splitAB) for (const pt of ptclBRef.current) updateDyeParticle(pt, dtEff);

        elapsedRef.current += dtEff;
        setElapsed(elapsedRef.current);
        if (splitAB) { elapsedBRef.current += dtEff; setElapsedB(elapsedBRef.current); }

        // Heat-map update every 500ms
        heatMapTimerR.current += dtEff;
        if (heatMapTimerR.current >= 0.5) {
          heatMapTimerR.current = 0;
          const COLS=4; const ROWS=4;
          const grid = Array(COLS*ROWS).fill(0);
          for (const pt of ptclRef.current) {
            if (!pt.isDye) continue;
            const col = Math.min(COLS-1, Math.floor(pt.x*COLS));
            const row = Math.min(ROWS-1, Math.floor(pt.y*ROWS));
            grid[row*COLS+col]++;
          }
          heatMapRef.current = grid;

          // Check full mix
          const variance = calcConcentrationVariance(ptclRef.current);
          if (!mixedRef.current && variance < FULL_MIX_THRESHOLD) {
            mixedRef.current = true;
            mixTimeRef.current = elapsedRef.current;
            setMixed(true);
            setMixTime(elapsedRef.current);
            if (epRef.current === "running") {
              if (isGuided) {
                setAdaobi("Even spread. Neither side is still amber, neither is still plain. That's diffusion — random movement filling available space until there's no concentration difference left.");
                setEpState("mixed");
              }
            }
          }
        }
      }

      // ── Draw ─────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, CW, CH);

      // Background
      ctx.fillStyle = "#030a14";
      ctx.fillRect(0, 0, CW, CH);

      // Container border
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(1, 1, CW-2, CH-2);

      const r2 = Math.max(4, Math.min(8, CW * 0.016));

      // Heat map overlay
      if (running || mixedRef.current) {
        const COLS=4; const ROWS=4;
        const cellW = CW/COLS; const cellH = CH/ROWS;
        const maxCount = PARTICLE_COUNT / (COLS*ROWS) * 2;
        for (let row=0; row<ROWS; row++) {
          for (let col=0; col<COLS; col++) {
            const count = heatMapRef.current[row*COLS+col] ?? 0;
            const alpha = Math.min(0.5, (count/maxCount)*0.6);
            if (alpha > 0.02) {
              ctx.fillStyle = `rgba(255,178,60,${alpha})`;
              ctx.fillRect(col*cellW, row*cellH, cellW, cellH);
            }
          }
        }
      }

      // Particles
      for (const pt of ptclRef.current) {
        const px = pt.x * CW; const py = pt.y * CH;
        if (pt.isDye) {
          ctx.shadowColor = "#FFB23C"; ctx.shadowBlur = 8;
          ctx.fillStyle = "#FFB23C";
        } else {
          ctx.shadowColor = "rgba(255,255,255,0.5)"; ctx.shadowBlur = 4;
          ctx.fillStyle = "rgba(255,255,255,0.9)";
        }
        ctx.beginPath();
        ctx.arc(px, py, r2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Divider line
      if (dividerRef.current > 0) {
        const divH = CH * dividerRef.current;
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(CW/2, 0);
        ctx.lineTo(CW/2, divH);
        ctx.stroke();
      }

      // Timer
      const ep = epRef.current;
      if (ep === "running" || ep === "running-2") {
        const fz = Math.max(11, Math.round(CW*0.035));
        ctx.font = `bold ${fz}px "Fredoka",sans-serif`;
        ctx.textAlign = "right";
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillText(`${elapsedRef.current.toFixed(1)}s`, CW-8, fz+4);
        ctx.textAlign = "left";
      }

      // Full mix label
      if (mixedRef.current) {
        ctx.font = `bold 16px "Fredoka",sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = "#24c96e";
        ctx.fillText("✓ Fully mixed", CW/2, CH*0.45);
        ctx.font = `12px "Fredoka",sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fillText(`${mixTimeRef.current.toFixed(1)}s`, CW/2, CH*0.45+20);
        ctx.textAlign = "left";
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPaused, isGuided, splitAB]); // eslint-disable-line

  // ── Temperature slider ────────────────────────────────────────────────────
  const sliderRef  = useRef<HTMLDivElement>(null);
  const draggingA  = useRef(false);

  function tempFromX(clientX: number, el: HTMLDivElement): number {
    const rect = el.getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  }

  function onTempDown(e: React.PointerEvent) {
    if (tempLocked) return;
    draggingA.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const v = tempFromX(e.clientX, sliderRef.current!);
    tempARef.current = v; setTempA(v);
  }
  function onTempMove(e: React.PointerEvent) {
    if (!draggingA.current) return;
    const v = tempFromX(e.clientX, sliderRef.current!);
    tempARef.current = v; setTempA(v);
  }
  function onTempUp() { draggingA.current = false; }

  // ── Release ───────────────────────────────────────────────────────────────
  function handleRelease() {
    if (epRef.current !== "set-temp" && epRef.current !== "set-temp-2") return;

    const isRun2 = epRef.current === "set-temp-2";

    // Re-init particles at current temp
    const spd = speedFromTemp(tempARef.current);
    ptclRef.current    = makeDyeParticles(spd);
    mixedRef.current   = false;
    elapsedRef.current = 0;
    dividerRef.current = 1;
    divDropRef.current = true;
    heatMapRef.current = Array(16).fill(0);
    heatMapTimerR.current = 0;
    setMixed(false); setMixTime(0); setElapsed(0);

    setEpState(isRun2 ? "running-2" : "running");
    setShowRelease(false);

    if (!isRun2) {
      setAdaobi("Watch the amber spreading. Those particles aren't trying to mix — they just have energy and space. There's nothing in their way.");
    } else {
      setAdaobi("Now hotter. Same particles, same space — but more energy. Watch how fast this time.");
    }
  }

  // ── Guided step machine ───────────────────────────────────────────────────
  const stepRef = useRef<number>(0);
  const guidedSteps = p.guidedSteps ?? [];

  function beginMission() {
    startTimeRef.current = Date.now();
    if (isGuided) {
      setTempLocked(true);
      setAdaobi(guidedSteps[0]?.narration ?? adaobi);
      setEpState("set-temp");
      setShowRelease(true);
    } else {
      setTempLocked(false);
      setEpState("set-temp");
      setShowRelease(true);
      setAdaobi("Set the temperature using the slider, then tap Release to drop the divider.");
    }
  }

  function handleNext() {
    const ep = epRef.current;

    if (ep === "mixed" && isGuided) {
      // Advance to step 2 — unlock slider, set to higher temp
      stepRef.current = 1;
      setTempLocked(false);
      setTempA(60); tempARef.current = 60;
      setEpState("set-temp-2");
      setShowRelease(true);
      setAdaobi(guidedSteps[1]?.narration ?? "Now hotter. Same particles, same space — but more energy. What changes?");
      return;
    }

    if (ep === "running-2" && mixedRef.current) {
      finishMission();
      return;
    }

    if (!isGuided) finishMission();
  }

  function finishMission() {
    setEpState("done");
    setAdaobi("Temperature drives diffusion rate. Hotter particles have more energy — they cover the distance faster. That's all there is to it.");
    const outcome: PhaseChamberOutcome = {
      success: true, mode: "diffusion",
      timeSpentSec: Math.round((Date.now() - startTimeRef.current) / 1000),
      totalWrongAttempts: 0, anyRevealed: false, firstTryCount: 0,
    };
    setTimeout(() => onComplete(outcome as never), 2000);
  }

  // ── After run-2 completes ─────────────────────────────────────────────────
  useEffect(() => {
    if (ep === "running-2" && mixed) {
      setAdaobi("Faster. More energy means faster random motion. Faster motion means they spread to fill the space more quickly. Temperature drives diffusion rate.");
    }
  }, [ep, mixed]);

  // ── Show Next when mixed in run-2 ────────────────────────────────────────
  const showNext = (ep === "mixed" && isGuided) || (ep === "running-2" && mixed) || (!isGuided && mixed);
  const showComplete = ep === "done";

  return (
    <GameplayShell
      fallbackGradient="linear-gradient(160deg,#030a14 0%,#0a1a2e 100%)"
      accentColor="#9b7ae0"
      stats={[{ label: "Temp", value: `${tempA}°C`, tone: "gold" as const }]}
      menu={menu!}
      isPaused={isPaused}
      gameTitle={gameTitle ?? "Matter Lab"}
      missionPrompt={{ label: "Experiment", text: "Diffusion" }}
    >
      <div className={styles.outer}>

        {/* Canvas */}
        <div className={styles.canvasWrap} style={{ flex: "1 1 0" }}>
          <canvas ref={canvasRef} className={styles.canvas} />

          {/* Dr. Adaobi */}
          <div className={styles.adaobiStrip}>
            <div className={styles.adaobiAvatar}><DiffAdaobiSvg /></div>
            <div className={styles.adaobiBubble}>
              <p className={styles.adaobiText}>{adaobi}</p>
              {ep === "intro" && (
                <button className={styles.beginBtn} onClick={beginMission}>
                  Let's begin →
                </button>
              )}
              {showNext && ep !== "done" && (
                <button className={styles.nextBtn} onClick={handleNext}>
                  {ep === "running-2" && mixed ? "Complete Mission →" : "Next →"}
                </button>
              )}
              {ep === "done" && <div className={styles.doneChip}>✓ Mission complete</div>}
            </div>
          </div>
        </div>

        {/* Temperature slider + Release */}
        <div className={styles.diffControlRow}>
          <div className={styles.diffTempWrap}>
            <span className={styles.diffTempLabel}>{tempA}°C</span>
            <div
              ref={sliderRef}
              className={[styles.sliderTrack, tempLocked ? styles.sliderLocked : ""].join(" ")}
              onPointerDown={onTempDown}
              onPointerMove={onTempMove}
              onPointerUp={onTempUp}
              onPointerLeave={onTempUp}
            >
              <div className={styles.sliderFill} style={{ width: `${tempA}%` }} />
              <div className={styles.sliderThumb} style={{ left: `calc(${tempA}% - 20px)` }}>
                <span className={styles.thumbIcon}>⟺</span>
              </div>
            </div>
            <span className={styles.diffTempHint}>0°C — 100°C</span>
          </div>

          {showRelease && (
            <button className={styles.releaseBtn} onClick={handleRelease}>
              Release →
            </button>
          )}
        </div>

        {showComplete && !showNext && (
          <button className={styles.completeBtn} onClick={finishMission}>
            Complete Mission
          </button>
        )}
      </div>
    </GameplayShell>
  );
}

function DiffAdaobiSvg() {
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