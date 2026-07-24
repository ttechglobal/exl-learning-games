"use client";

/**
 * ScenarioScannerEngine.tsx — Matter Lab, Interaction 5
 * Cluster 4: Physical vs Chemical Change
 * All four stages.
 *
 * The engine renders an animated scenario illustration, a scrub bar,
 * a SCAN button, a fingerprint-diff panel, and classification buttons.
 * No external art assets — scenarios are drawn inline with canvas/SVG.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { GameplayShell } from "@/components/gameplay/GameplayShell";
import type { EngineRuntimeProps } from "@/engines/engine-types";
import type {
  ScenarioScannerOutcome,
  ScenarioDefinition,
  ScenarioScannerPayload,
} from "./scenarioScanner.config";
import styles from "./ScenarioScannerEngine.module.css";

// ─── Scenario illustrations (inline canvas) ───────────────────────────────────

type FrameKey = ScenarioDefinition["frameKey"];

/**
 * Draws a scenario illustration onto a canvas context.
 * progress: 0 = before, 0.5 = during, 1 = after.
 */
function drawScenario(
  ctx: CanvasRenderingContext2D,
  frameKey: FrameKey,
  progress: number,
  CW: number,
  CH: number
): void {
  ctx.clearRect(0, 0, CW, CH);

  // Base background
  ctx.fillStyle = "#0d1a2e";
  ctx.fillRect(0, 0, CW, CH);

  // Lab bench at bottom
  ctx.fillStyle = "#1a2a3a";
  ctx.fillRect(0, CH * 0.75, CW, CH * 0.25);
  ctx.fillStyle = "#243444";
  ctx.fillRect(0, CH * 0.75, CW, 4);

  switch (frameKey) {
    case "ice-melting":       drawIceMelting(ctx, progress, CW, CH); break;
    case "paper-burning":     drawPaperBurning(ctx, progress, CW, CH); break;
    case "iron-rusting":      drawIronRusting(ctx, progress, CW, CH); break;
    case "sugar-dissolving":  drawSugarDissolving(ctx, progress, CW, CH); break;
    case "glass-shattering":  drawGlassShattering(ctx, progress, CW, CH); break;
    case "milk-souring":      drawMilkSouring(ctx, progress, CW, CH); break;
    case "wax-melting":       drawWaxMelting(ctx, progress, CW, CH); break;
    case "metal-sparks":      drawMetalSparks(ctx, progress, CW, CH); break;
    case "neutralisation":    drawNeutralisation(ctx, progress, CW, CH); break;
    case "effervescent-tablet": drawEffervescent(ctx, progress, CW, CH); break;
    default:                  drawPlaceholder(ctx, frameKey, CW, CH); break;
  }
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * Math.max(0, Math.min(1, t)); }

function drawBeaker(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fillColour: string, fillLevel: number) {
  // Beaker body
  ctx.strokeStyle = "rgba(200,230,255,0.6)";
  ctx.lineWidth   = 2;
  ctx.fillStyle   = "rgba(180,220,255,0.08)";
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x - 6, y + h); ctx.lineTo(x + w + 6, y + h); ctx.lineTo(x + w, y); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Liquid
  if (fillLevel > 0) {
    const top = y + h * (1 - fillLevel);
    ctx.fillStyle = fillColour;
    ctx.beginPath();
    ctx.moveTo(x - 2 + (6 * (1-fillLevel)), top);
    ctx.lineTo(x - 6, y + h); ctx.lineTo(x + w + 6, y + h);
    ctx.lineTo(x + w + 2 - (6 * (1-fillLevel)), top);
    ctx.closePath();
    ctx.fill();
  }
}

function drawIceMelting(ctx: CanvasRenderingContext2D, p: number, CW: number, CH: number) {
  const bx = CW*0.3; const by = CH*0.2; const bw = CW*0.4; const bh = CH*0.5;
  const waterLevel = lerp(0, 0.6, p);
  drawBeaker(ctx, bx, by, bw, bh, "rgba(100,180,255,0.5)", waterLevel);

  // Ice cubes — shrink with progress
  const iceAlpha = Math.max(0, 1 - p * 2);
  if (iceAlpha > 0) {
    ctx.fillStyle = `rgba(200,230,255,${iceAlpha * 0.7})`;
    ctx.strokeStyle = `rgba(255,255,255,${iceAlpha * 0.5})`;
    ctx.lineWidth = 1.5;
    const iceSize = CW * 0.08 * (1 - p * 0.7);
    [[bx + bw*0.2, by + bh*0.5],[bx + bw*0.5, by + bh*0.4],[bx + bw*0.65, by + bh*0.55]].forEach(([ix,iy]) => {
      ctx.fillRect(ix, iy, iceSize, iceSize);
      ctx.strokeRect(ix, iy, iceSize, iceSize);
    });
  }

  // Formula label
  ctx.font = `bold 14px "Fredoka",sans-serif`;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(180,220,255,0.8)";
  ctx.fillText("H₂O", CW*0.5, CH*0.15);
  ctx.textAlign = "left";
}

function drawPaperBurning(ctx: CanvasRenderingContext2D, p: number, CW: number, CH: number) {
  // Paper sheet on bench
  const px = CW*0.25; const py = CH*0.45; const pw = CW*0.5; const phe = CH*0.2;
  const charProgress = Math.min(1, p * 1.5);
  ctx.fillStyle = `rgb(${lerp(240,60,charProgress)},${lerp(230,50,charProgress)},${lerp(210,30,charProgress)})`;
  ctx.fillRect(px, py, pw, phe);

  // Flame (visible during burning phase)
  if (p > 0.1 && p < 0.9) {
    const flameH = CH * 0.2 * Math.min(1, (p - 0.1) / 0.3);
    const grad = ctx.createLinearGradient(0, py - flameH, 0, py);
    grad.addColorStop(0, "rgba(255,200,0,0)");
    grad.addColorStop(0.3, "rgba(255,120,0,0.8)");
    grad.addColorStop(1, "rgba(255,40,0,0.9)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(CW*0.5, py - flameH*0.3, pw*0.25, flameH*0.6, 0, 0, Math.PI*2);
    ctx.fill();
  }

  // Smoke (after burning)
  if (p > 0.5) {
    const smokeAlpha = (p - 0.5) * 0.4;
    ctx.fillStyle = `rgba(100,100,100,${smokeAlpha})`;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(CW*(0.3+i*0.12), CH*(0.2-i*0.05), CW*0.04, 0, Math.PI*2);
      ctx.fill();
    }
  }

  ctx.font = `bold 13px "Fredoka",sans-serif`;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,200,150,0.8)";
  ctx.fillText(p > 0.5 ? "CO₂ + H₂O" : "cellulose", CW*0.5, CH*0.15);
  ctx.textAlign = "left";
}

function drawIronRusting(ctx: CanvasRenderingContext2D, p: number, CW: number, CH: number) {
  const nx = CW*0.35; const ny = CH*0.25; const nw = CW*0.3; const nh = CH*0.5;
  const rustR = Math.round(lerp(180, 160, p));
  const rustG = Math.round(lerp(180, 80, p));
  const rustB = Math.round(lerp(180, 30, p));
  ctx.fillStyle = `rgb(${rustR},${rustG},${rustB})`;
  ctx.fillRect(nx, ny, nw, nh);
  // Rust texture
  if (p > 0.2) {
    ctx.fillStyle = `rgba(200,60,10,${(p-0.2)*0.7})`;
    for (let i=0; i<8; i++) {
      const rx = nx + (i%4)*(nw/4) + nw*0.05;
      const ry = ny + Math.floor(i/4)*(nh/2) + nh*0.1;
      ctx.beginPath(); ctx.arc(rx, ry, nw*0.06, 0, Math.PI*2); ctx.fill();
    }
  }
  ctx.font = `bold 13px "Fredoka",sans-serif`;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,200,150,0.8)";
  ctx.fillText(p > 0.5 ? "Fe₂O₃" : "Fe", CW*0.5, CH*0.15);
  ctx.textAlign = "left";
}

function drawSugarDissolving(ctx: CanvasRenderingContext2D, p: number, CW: number, CH: number) {
  const bx=CW*0.3; const by=CH*0.2; const bw=CW*0.4; const bh=CH*0.5;
  drawBeaker(ctx, bx, by, bw, bh, "rgba(255,255,200,0.4)", 0.65);
  // Sugar cube — shrinks
  const sugarAlpha = Math.max(0, 1 - p * 2.5);
  const sugarSize  = CW*0.1 * Math.max(0, 1 - p*2);
  if (sugarAlpha > 0 && sugarSize > 0) {
    ctx.fillStyle   = `rgba(255,255,255,${sugarAlpha})`;
    ctx.strokeStyle = `rgba(200,200,200,${sugarAlpha*0.5})`;
    ctx.lineWidth = 1;
    ctx.fillRect(bx+bw*0.5-sugarSize/2, by+bh*0.55-sugarSize/2, sugarSize, sugarSize);
    ctx.strokeRect(bx+bw*0.5-sugarSize/2, by+bh*0.55-sugarSize/2, sugarSize, sugarSize);
  }
  ctx.font=`bold 13px "Fredoka",sans-serif`; ctx.textAlign="center";
  ctx.fillStyle="rgba(255,255,200,0.8)";
  ctx.fillText("C₁₂H₂₂O₁₁", CW*0.5, CH*0.15);
  ctx.textAlign="left";
}

function drawGlassShattering(ctx: CanvasRenderingContext2D, p: number, CW: number, CH: number) {
  if (p < 0.5) {
    // Intact bottle
    ctx.fillStyle = "rgba(100,200,180,0.5)";
    ctx.strokeStyle = "rgba(150,230,210,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(CW*0.38, CH*0.2, CW*0.24, CH*0.55, 8);
    ctx.fill(); ctx.stroke();
  } else {
    // Shattered fragments
    const fragCount = 8;
    ctx.fillStyle = "rgba(100,200,180,0.5)";
    ctx.strokeStyle = "rgba(150,230,210,0.8)";
    ctx.lineWidth = 1.5;
    for (let i=0; i<fragCount; i++) {
      const angle = (i/fragCount)*Math.PI*2;
      const dist  = CW*0.15*(p-0.5)*2;
      const fx    = CW*0.5 + Math.cos(angle)*dist;
      const fy    = CH*0.5 + Math.sin(angle)*dist;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(angle + p*2);
      ctx.beginPath();
      ctx.moveTo(-10,-8); ctx.lineTo(10,-5); ctx.lineTo(8,8); ctx.lineTo(-8,5);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
  ctx.font=`bold 13px "Fredoka",sans-serif`; ctx.textAlign="center";
  ctx.fillStyle="rgba(150,230,210,0.8)";
  ctx.fillText("SiO₂", CW*0.5, CH*0.15);
  ctx.textAlign="left";
}

function drawMilkSouring(ctx: CanvasRenderingContext2D, p: number, CW: number, CH: number) {
  const bx=CW*0.3; const by=CH*0.2; const bw=CW*0.4; const bh=CH*0.5;
  const r=Math.round(lerp(245,220,p)); const g=Math.round(lerp(245,215,p)); const b=Math.round(lerp(245,200,p));
  drawBeaker(ctx, bx, by, bw, bh, `rgba(${r},${g},${b},0.6)`, 0.65);
  ctx.font=`bold 13px "Fredoka",sans-serif`; ctx.textAlign="center";
  ctx.fillStyle="rgba(255,255,220,0.8)";
  ctx.fillText(p>0.5?"lactic acid":"lactose", CW*0.5, CH*0.15);
  ctx.textAlign="left";
}

function drawWaxMelting(ctx: CanvasRenderingContext2D, p: number, CW: number, CH: number) {
  const cx=CW*0.5; const cy=CH*0.55;
  // Candle body
  ctx.fillStyle="#f0e8d0"; ctx.fillRect(cx-CW*0.06, cy-CH*0.35, CW*0.12, CH*0.35);
  // Wick
  ctx.strokeStyle="#333"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(cx, cy-CH*0.35); ctx.lineTo(cx, cy-CH*0.42); ctx.stroke();
  // Flame
  ctx.fillStyle="rgba(255,150,0,0.9)";
  ctx.beginPath(); ctx.ellipse(cx, cy-CH*0.47, CW*0.025, CH*0.055, 0, 0, Math.PI*2); ctx.fill();
  // Molten wax pool (grows with progress)
  const poolR = CW*0.08*p;
  if (poolR > 2) {
    ctx.fillStyle="rgba(240,230,200,0.7)";
    ctx.beginPath(); ctx.ellipse(cx, cy-CH*0.35, poolR, poolR*0.3, 0, 0, Math.PI*2); ctx.fill();
  }
  ctx.font=`bold 13px "Fredoka",sans-serif`; ctx.textAlign="center";
  ctx.fillStyle="rgba(240,220,180,0.8)";
  ctx.fillText("C₂₅H₅₂", CW*0.5, CH*0.12);
  ctx.textAlign="left";
}

function drawMetalSparks(ctx: CanvasRenderingContext2D, p: number, CW: number, CH: number) {
  // Hammer
  ctx.fillStyle="#888"; ctx.fillRect(CW*0.6, CH*0.2, CW*0.08, CH*0.15);
  ctx.fillStyle="#666"; ctx.fillRect(CW*0.55, CH*0.2, CW*0.18, CH*0.08);
  // Metal block
  ctx.fillStyle="#aaa"; ctx.strokeStyle="#ccc"; ctx.lineWidth=2;
  ctx.fillRect(CW*0.3, CH*0.55, CW*0.4, CH*0.15); ctx.strokeRect(CW*0.3, CH*0.55, CW*0.4, CH*0.15);
  // Sparks (mid-event)
  if (p > 0.3 && p < 0.8) {
    const sparkCount = Math.round(6*(p-0.3)/0.5);
    for (let i=0; i<sparkCount; i++) {
      const angle = Math.random()*Math.PI*2;
      const dist  = CW*0.1*(p-0.3);
      ctx.fillStyle=`rgba(255,${Math.round(180+Math.random()*75)},0,0.9)`;
      ctx.beginPath();
      ctx.arc(CW*0.5+Math.cos(angle)*dist, CH*0.52+Math.sin(angle)*dist*0.5, 3, 0, Math.PI*2);
      ctx.fill();
    }
  }
  ctx.font=`bold 13px "Fredoka",sans-serif`; ctx.textAlign="center";
  ctx.fillStyle="rgba(200,200,200,0.8)";
  ctx.fillText("Fe", CW*0.5, CH*0.15);
  ctx.textAlign="left";
}

function drawNeutralisation(ctx: CanvasRenderingContext2D, p: number, CW: number, CH: number) {
  // Two beakers merging into one
  if (p < 0.4) {
    drawBeaker(ctx, CW*0.15, CH*0.25, CW*0.28, CH*0.45, "rgba(255,120,120,0.5)", 0.6);
    drawBeaker(ctx, CW*0.57, CH*0.25, CW*0.28, CH*0.45, "rgba(120,180,255,0.5)", 0.6);
    ctx.font=`bold 11px "Fredoka",sans-serif`; ctx.textAlign="center";
    ctx.fillStyle="rgba(255,180,180,0.9)"; ctx.fillText("HCl", CW*0.29, CH*0.2);
    ctx.fillStyle="rgba(180,210,255,0.9)"; ctx.fillText("NaOH", CW*0.71, CH*0.2);
    ctx.textAlign="left";
  } else {
    drawBeaker(ctx, CW*0.3, CH*0.25, CW*0.4, CH*0.45, "rgba(200,230,200,0.5)", 0.6);
    ctx.font=`bold 13px "Fredoka",sans-serif`; ctx.textAlign="center";
    ctx.fillStyle="rgba(200,255,200,0.8)"; ctx.fillText("NaCl + H₂O", CW*0.5, CH*0.2);
    ctx.textAlign="left";
  }
}

function drawEffervescent(ctx: CanvasRenderingContext2D, p: number, CW: number, CH: number) {
  const bx=CW*0.3; const by=CH*0.2; const bw=CW*0.4; const bh=CH*0.5;
  drawBeaker(ctx, bx, by, bw, bh, "rgba(150,220,255,0.4)", 0.7);
  // Tablet dropping
  if (p < 0.3) {
    ctx.fillStyle="rgba(255,255,255,0.9)";
    ctx.fillRect(CW*0.45, by + (p/0.3)*(bh*0.4), CW*0.1, CH*0.04);
  }
  // Bubbles rising (during reaction)
  if (p > 0.2) {
    const bubbleCount = Math.round((p-0.2)*15);
    ctx.fillStyle="rgba(255,255,255,0.4)";
    for (let i=0; i<bubbleCount; i++) {
      const bxPos = bx + bw*(0.1 + (i%5)*0.18);
      const byPos = by + bh*(0.9 - (p-0.2)*0.8*((i%3)/3));
      ctx.beginPath(); ctx.arc(bxPos, byPos, 3+i%3, 0, Math.PI*2); ctx.fill();
    }
  }
  ctx.font=`bold 13px "Fredoka",sans-serif`; ctx.textAlign="center";
  ctx.fillStyle="rgba(200,240,255,0.8)";
  ctx.fillText(p>0.4?"CO₂ + H₂O":"NaHCO₃ + citric acid", CW*0.5, CH*0.15);
  ctx.textAlign="left";
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, frameKey: string, CW: number, CH: number) {
  ctx.font = `16px "Fredoka",sans-serif`; ctx.textAlign="center";
  ctx.fillStyle="rgba(255,255,255,0.4)";
  ctx.fillText(frameKey, CW*0.5, CH*0.5);
  ctx.textAlign="left";
}

// ─── Molecule badge ───────────────────────────────────────────────────────────

function MoleculeTag({ formula, match }: { formula: string; match: boolean }) {
  return (
    <div style={{
      display:"inline-flex", alignItems:"center", gap:4,
      padding:"4px 10px", borderRadius:20,
      background: match ? "rgba(36,201,110,0.15)" : "rgba(245,101,101,0.15)",
      border: `1px solid ${match ? "rgba(36,201,110,0.5)" : "rgba(245,101,101,0.5)"}`,
      fontFamily:"var(--eg-font-display)", fontSize:13, fontWeight:700,
      color: match ? "#24c96e" : "#f56565",
    }}>
      {formula}
    </div>
  );
}

// ─── Engine types ─────────────────────────────────────────────────────────────

type ScanPhase = "intro" | "exploring" | "scanner-open" | "classifying" | "result" | "done";

interface ScannerEngineConfig {
  shared: { maxWrongBeforeReveal: number; xpPerScenario: number };
  mission: { id: string; stage: string; learningGoal: string; payload: ScenarioScannerPayload };
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ScenarioScannerEngine({
  config: rawConfig, onComplete, menu, isPaused, gameTitle,
}: EngineRuntimeProps) {
  const cfg     = rawConfig as ScannerEngineConfig;
  const payload = cfg.mission.payload as ScenarioScannerPayload;
  const stage   = payload.stage ?? "guided";
  const isGuided = stage === "guided";

  const scenarios = payload.scenarios ?? [];

  // ── Refs ──────────────────────────────────────────────────────────────────
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const rafRef         = useRef<number>(0);
  const scrubRef       = useRef<number>(0);      // 0–1 scrub position
  const sceneIdxRef    = useRef<number>(0);
  const startTimeRef   = useRef<number>(Date.now());
  const scansUsedRef   = useRef<number>(0);
  const correctRef     = useRef<number>(0);
  const scansDoneRef   = useRef<boolean>(false);

  // ── State ─────────────────────────────────────────────────────────────────
  const [ep,            setEp]            = useState<ScanPhase>("intro");
  const [scrub,         setScrub]         = useState(0);
  const [sceneIdx,      setSceneIdx]      = useState(0);
  const [scannerOpen,   setScannerOpen]   = useState(false);
  const [scanResult,    setScanResult]    = useState<"match"|"mismatch"|null>(null);
  const [classResult,   setClassResult]   = useState<"correct"|"incorrect"|null>(null);
  const [postAnswer,    setPostAnswer]    = useState("");
  const [adaobi,        setAdaobi]        = useState(
    payload.missionContext ?? "Two events are happening in the lab tonight. One made something new. The other just rearranged what was already there. Your job is to figure out which is which — and I'm giving you a tool that goes straight to the answer."
  );
  const [scanBudget,    setScanBudget]    = useState<number | null>(null);
  const [showClass,     setShowClass]     = useState(false);
  const [wrongShake,    setWrongShake]    = useState<"physical"|"chemical"|null>(null);
  const [guidedScanned, setGuidedScanned] = useState(false);

  const currentScenario = scenarios[sceneIdx] ?? null;

  // ── Scan budget init ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentScenario) return;
    const budget = currentScenario.scanBudget;
    setScanBudget(budget);
    scansUsedRef.current = 0;
  }, [sceneIdx]); // eslint-disable-line

  // ── RAF loop (scenario illustration) ─────────────────────────────────────
  useEffect(() => {
    function tick() {
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
      if (!currentScenario) return;
      drawScenario(ctx, currentScenario.frameKey, scrubRef.current, cssW, cssH);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [currentScenario]); // eslint-disable-line

  // ── Scrub bar ─────────────────────────────────────────────────────────────
  const scrubBarRef = useRef<HTMLDivElement>(null);
  const scrubbing   = useRef(false);

  function scrubFromX(clientX: number): number {
    const el = scrubBarRef.current; if (!el) return scrubRef.current;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }
  function onScrubDown(e: React.PointerEvent) {
    scrubbing.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const v = scrubFromX(e.clientX); scrubRef.current = v; setScrub(v);
    if (ep === "intro") setEp("exploring");
  }
  function onScrubMove(e: React.PointerEvent) {
    if (!scrubbing.current) return;
    const v = scrubFromX(e.clientX); scrubRef.current = v; setScrub(v);
  }
  function onScrubUp() { scrubbing.current = false; }

  // ── SCAN ──────────────────────────────────────────────────────────────────
  function handleScan() {
    if (!currentScenario) return;
    if (scanBudget !== null && scansUsedRef.current >= scanBudget) return;

    scansUsedRef.current++;
    if (scanBudget !== null) setScanBudget(b => b !== null ? b - 1 : null);
    scansUsedRef.current++;

    // Diff: compare entity tags at current scrub vs reference
    const refTags = currentScenario.entityTags.reference;
    const nowTags = scrubRef.current < 0.5
      ? currentScenario.entityTags.at_50
      : currentScenario.entityTags.at_100;

    const isMatch = JSON.stringify([...refTags].sort()) === JSON.stringify([...nowTags].sort());
    setScanResult(isMatch ? "match" : "mismatch");
    setScannerOpen(true);
    setEp("scanner-open");
    setGuidedScanned(true);

    // Guided narration on scan
    if (isGuided) {
      setAdaobi(currentScenario.narration.onScan);
    }
  }

  function closeScannerAndClassify() {
    setScannerOpen(false);
    setShowClass(true);
    setEp("classifying");
  }

  // ── Classification ────────────────────────────────────────────────────────
  function handleClassify(choice: "physical" | "chemical") {
    if (!currentScenario) return;
    const correct = choice === currentScenario.correctClassification;

    if (correct) {
      setClassResult("correct");
      setAdaobi(currentScenario.narration.onCorrect);
      setPostAnswer(currentScenario.narration.postAnswer);
      correctRef.current++;
      setTimeout(() => {
        setShowClass(false);
        setScannerOpen(false);
        setScanResult(null);
        setClassResult(null);
        setPostAnswer("");
        setEp("result");
        // Short delay then advance
        setTimeout(() => advanceScene(), 2000);
      }, 2000);
    } else {
      // Wrong
      setWrongShake(choice);
      setClassResult("incorrect");
      setTimeout(() => setWrongShake(null), 400);

      if (isGuided || stage === "practice") {
        setAdaobi(currentScenario.narration.onIncorrect);
        // Allow retry
        setTimeout(() => {
          setClassResult(null);
        }, 1500);
      } else {
        // Challenge/Mastery: no retry
        setPostAnswer(currentScenario.narration.postAnswer);
        setTimeout(() => {
          setShowClass(false);
          setScannerOpen(false);
          setScanResult(null);
          setClassResult(null);
          setPostAnswer("");
          advanceScene();
        }, 3000);
      }
    }
  }

  function advanceScene() {
    const next = sceneIdxRef.current + 1;
    sceneIdxRef.current = next;
    if (next >= scenarios.length) {
      finishMission();
    } else {
      setSceneIdx(next);
      scrubRef.current = 0;
      setScrub(0);
      setEp("exploring");
      setGuidedScanned(false);
      setScanResult(null);
      setShowClass(false);
      setClassResult(null);
      if (isGuided && next < scenarios.length) {
        setAdaobi(next === 1
          ? "Now watch this one carefully before you scan. What evidence do you see?"
          : "Next scenario. Scrub through and scan when you're ready."
        );
      }
    }
  }

  function beginMission() {
    startTimeRef.current = Date.now();
    setEp("exploring");
    setAdaobi("Scrub through the scenario to see what's happening. When you're ready, tap SCAN to check the molecular fingerprint.");
  }

  function finishMission() {
    setEp("done");
    setAdaobi("Physical or chemical — it's one question: did the fingerprint change? Every scenario in this lab comes down to that. Don't let the drama fool you.");
    const outcome: ScenarioScannerOutcome = {
      success: true,
      scenariosAttempted: scenarios.length,
      correctOnFirstTry: correctRef.current,
      scansUsed: scansUsedRef.current,
      timeSpentSec: Math.round((Date.now() - startTimeRef.current) / 1000),
    };
    setTimeout(() => onComplete(outcome as never), 2000);
  }

  // ── Evidence icons ────────────────────────────────────────────────────────
  const icons = currentScenario?.evidenceIcons;
  const evidenceAtProgress = scrub > 0.1 ? icons : null;

  // ── Scan button label ─────────────────────────────────────────────────────
  const scanLabel = scanBudget === null
    ? "SCAN"
    : scanBudget === 0
      ? "No scans left"
      : `SCAN (${scanBudget} left)`;

  const scanDisabled = ep === "intro" || ep === "done" || (scanBudget !== null && scanBudget <= 0);

  // ── Guided: must scan before classify ────────────────────────────────────
  const canClassify = !isGuided || guidedScanned;

  return (
    <GameplayShell
      fallbackGradient="linear-gradient(160deg,#030a14 0%,#0a1a2e 100%)"
      accentColor="#9b7ae0"
      stats={[{ label: "Scenario", value: `${sceneIdx+1} of ${scenarios.length}`, tone: "default" as const }]}
      menu={menu!}
      isPaused={isPaused}
      gameTitle={gameTitle ?? "Matter Lab"}
      missionPrompt={{ label: "Lab event", text: currentScenario?.title ?? "" }}
    >
      <div className={styles.outer}>

        {/* Scenario title */}
        {currentScenario && (
          <div className={styles.scenarioTitle}>{currentScenario.title}</div>
        )}

        {/* Scenario frame */}
        <div className={styles.sceneWrap}>
          {/* Scan counter */}
          {scanBudget !== null && (
            <div className={[styles.scanCounter, scanBudget===0?styles.scanCounterRed:""].join(" ")}>
              Scans remaining: {scanBudget}
            </div>
          )}

          {/* Evidence icons */}
          {evidenceAtProgress && (
            <div className={styles.evidenceRow}>
              {evidenceAtProgress.temperature  && <span title="Temperature change">🌡️</span>}
              {evidenceAtProgress.stateChange   && <span title="State change">💧</span>}
              {evidenceAtProgress.lightRelease  && <span title="Light / energy released">✨</span>}
              {evidenceAtProgress.gasProduced   && <span title="Gas produced">🫧</span>}
              {evidenceAtProgress.colourChange  && <span title="Colour change">🎨</span>}
            </div>
          )}

          <canvas ref={canvasRef} className={styles.canvas} />

          {/* Post-answer overlay */}
          {postAnswer && (
            <div className={styles.postAnswerOverlay}>
              <p>{postAnswer}</p>
            </div>
          )}
        </div>

        {/* Scrub bar */}
        <div className={styles.scrubWrap}>
          <span className={styles.scrubLabel}>BEFORE</span>
          <div
            ref={scrubBarRef}
            className={styles.scrubTrack}
            onPointerDown={onScrubDown}
            onPointerMove={onScrubMove}
            onPointerUp={onScrubUp}
            onPointerLeave={onScrubUp}
          >
            <div className={styles.scrubFill} style={{ width: `${scrub*100}%` }} />
            <div className={styles.scrubThumb} style={{ left:`calc(${scrub*100}% - 22px)` }}>
              <span style={{ fontSize:14 }}>◆</span>
            </div>
          </div>
          <span className={styles.scrubLabel}>AFTER</span>
        </div>

        {/* SCAN button */}
        {ep !== "done" && (
          <button
            className={[styles.scanBtn, scanDisabled?styles.scanBtnDisabled:""].join(" ")}
            onClick={handleScan}
            disabled={scanDisabled}
          >
            {scanLabel}
          </button>
        )}

        {/* Fingerprint scanner panel */}
        {scannerOpen && currentScenario && (
          <div className={styles.scannerPanel}>
            <div className={styles.scannerCols}>
              <div className={styles.scannerCol}>
                <div className={styles.scannerColHeader}>BEFORE</div>
                <div className={styles.tagList}>
                  {currentScenario.entityTags.reference.map((t,i) => (
                    <MoleculeTag key={i} formula={t} match={true} />
                  ))}
                </div>
              </div>
              <div className={styles.scannerDivider} />
              <div className={styles.scannerCol}>
                <div className={styles.scannerColHeader}>NOW</div>
                <div className={styles.tagList}>
                  {(scrub < 0.5 ? currentScenario.entityTags.at_50 : currentScenario.entityTags.at_100).map((t,i) => {
                    const inRef = currentScenario.entityTags.reference.includes(t);
                    return <MoleculeTag key={i} formula={t} match={inRef} />;
                  })}
                </div>
              </div>
            </div>

            <div className={styles.scannerResult}>
              {scanResult === "match"
                ? <><span className={styles.scanMatch}>✓ SAME SUBSTANCE(S)</span><span className={styles.scanResultText}>No new substance detected — molecules unchanged.</span></>
                : <><span className={styles.scanMismatch}>✗ NEW SUBSTANCE DETECTED</span><span className={styles.scanResultText}>New molecule identities found — old ones absent.</span></>
              }
            </div>

            {canClassify && (
              <button className={styles.closeScanner} onClick={closeScannerAndClassify}>
                Classify →
              </button>
            )}
            {!canClassify && isGuided && (
              <button className={styles.closeScanner} onClick={() => { setScannerOpen(false); setEp("exploring"); }}>
                Close
              </button>
            )}
          </div>
        )}

        {/* Classification buttons */}
        {showClass && !scannerOpen && (
          <div className={styles.classRow}>
            <button
              className={[
                styles.classBtn,
                classResult==="correct" && currentScenario?.correctClassification==="physical" ? styles.classBtnCorrect : "",
                wrongShake==="physical" ? styles.classBtnWrong : "",
              ].filter(Boolean).join(" ")}
              onClick={() => handleClassify("physical")}
              disabled={classResult==="correct"}
            >
              PHYSICAL CHANGE
            </button>
            <button
              className={[
                styles.classBtn,
                classResult==="correct" && currentScenario?.correctClassification==="chemical" ? styles.classBtnCorrect : "",
                wrongShake==="chemical" ? styles.classBtnWrong : "",
              ].filter(Boolean).join(" ")}
              onClick={() => handleClassify("chemical")}
              disabled={classResult==="correct"}
            >
              CHEMICAL CHANGE
            </button>
          </div>
        )}

        {/* Dr. Adaobi */}
        <div className={styles.adaobiStrip}>
          <div className={styles.adaobiAvatar}><ScanAdaobiSvg /></div>
          <div className={styles.adaobiBubble}>
            <p className={styles.adaobiText}>{adaobi}</p>
            {ep === "intro" && (
              <button className={styles.beginBtn} onClick={beginMission}>Let's begin →</button>
            )}
            {ep === "done" && (
              <div className={styles.doneChip}>✓ Mission complete</div>
            )}
          </div>
        </div>
      </div>
    </GameplayShell>
  );
}

function ScanAdaobiSvg() {
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