/**
 * phaseChamber.logic.ts
 *
 * Pure functions for the phase-chamber engine.
 * No React. No side effects. Fully testable.
 *
 * Contains logic for all four configs:
 *   boundary-drag    — Interaction 1: State & Arrangement
 *   heat-control     — Interaction 2: Change of State & Energy Flow
 *   pressure-chamber — Interaction 3: Temperature & Pressure
 *   diffusion        — Interaction 4: Diffusion
 */

import type { PhaseChamberSharedConfig } from "./phaseChamber.config";

// ─── Particle ─────────────────────────────────────────────────────────────────

export interface Particle {
  /** Normalised position 0–1 within the canvas. */
  x: number;
  y: number;
  /** Velocity in normalised units per second. */
  vx: number;
  vy: number;
  /** Grid home position — used in solid state to anchor vibration. */
  gridX: number;
  gridY: number;
  /** Phase offset for jitter animation. */
  jitterPhase: number;
  /** Grid home when solid (null in liquid/gas). */
  homeX: number | null;
  homeY: number | null;
}

// ─── State identification ─────────────────────────────────────────────────────

export type PhaseState = "solid" | "liquid" | "gas";

/**
 * Returns the current phase given a normalised wall position (0–1).
 * wallPos = 0 → fully closed (solid), wallPos = 1 → fully open (gas).
 */
export function getPhaseFromWall(
  wallPos: number,
  solidMax: number,
  gasMin: number
): PhaseState {
  const wall = wallPos * 100;
  if (wall < solidMax) return "solid";
  if (wall >= gasMin)  return "gas";
  return "liquid";
}

// ─── Particle speed ───────────────────────────────────────────────────────────

// Base speed in normalised units/sec. Multiplied by getSpeedMultFromWall().
// At speedMult=1.0 (full gas) this gives 0.038 units/sec, which crosses
// a 332px-wide canvas in ~26 frames at 60fps — clearly fast and chaotic.
const SPEED_SCALE = 0.038;

/**
 * Returns a speed multiplier (0–1) from wall position.
 * Used by boundary-drag mode.
 *
 * Three distinct regimes with a pronounced jump at the gas threshold:
 *   solid  (0–0.35)  → near-zero vibration only:    0 → 0.05
 *   liquid (0.35–0.65)→ gentle, clear flow:          0.05 → 0.18
 *   gas    (0.65–1.0) → sharp quadratic ramp:        0.18 → 1.0
 *
 * The jump at the solid→liquid and liquid→gas boundaries is intentional
 * and pronounced — students should see a clear mode change, not a linear
 * ramp. At full gas, particles move ~5.5× faster than at full liquid.
 */
export function getSpeedMultFromWall(wallPos: number): number {
  if (wallPos < 0.35) {
    return (wallPos / 0.35) * 0.05;
  }
  if (wallPos < 0.65) {
    return 0.05 + ((wallPos - 0.35) / 0.30) * 0.13;
  }
  // Quadratic — fast start, even faster finish
  const t = (wallPos - 0.65) / 0.35;
  return 0.18 + t * t * 0.82;
}

/**
 * Returns a speed multiplier (0–1) from temperature.
 * Used by heat-control and pressure-chamber modes.
 * @param tempC      — current temperature in °C
 * @param startTempC — minimum temperature in this config (e.g. -20)
 * @param maxTempC   — maximum temperature in this config (e.g. 120)
 */
export function getSpeedMultFromTemp(
  tempC: number,
  startTempC: number,
  maxTempC: number
): number {
  return Math.max(0, Math.min(1, (tempC - startTempC) / (maxTempC - startTempC)));
}

// ─── Particle colour ──────────────────────────────────────────────────────────

/**
 * Returns an {r, g, b} object interpolated between the three state colours.
 * @param value          — normalised 0–1 (wall position or speed multiplier)
 * @param solidColour    — hex colour for solid state
 * @param liquidColour   — hex colour for liquid state
 * @param gasColour      — hex colour for gas state
 * @param solidThreshold — normalised value below which solid colour applies (e.g. 0.35)
 * @param gasThreshold   — normalised value above which gas colour applies (e.g. 0.65)
 */
export function getParticleRgb(
  value: number,
  solidColour: string,
  liquidColour: string,
  gasColour: string,
  solidThreshold: number,
  gasThreshold: number
): { r: number; g: number; b: number } {
  function hexToRgb(hex: string) {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  function lerp(a: number, b: number, t: number) {
    return Math.round(a + (b - a) * Math.max(0, Math.min(1, t)));
  }

  const sc = hexToRgb(solidColour);
  const lc = hexToRgb(liquidColour);
  const gc = hexToRgb(gasColour);

  // value is already 0–1; thresholds are also 0–1
  if (value <= solidThreshold) return sc;
  if (value <= gasThreshold) {
    const t = (value - solidThreshold) / (gasThreshold - solidThreshold);
    return { r: lerp(sc.r, lc.r, t), g: lerp(sc.g, lc.g, t), b: lerp(sc.b, lc.b, t) };
  }
  const t = Math.min(1, (value - gasThreshold) / 0.2);
  return { r: lerp(lc.r, gc.r, t), g: lerp(lc.g, gc.g, t), b: lerp(lc.b, gc.b, t) };
}

// ─── Particle initialisation ──────────────────────────────────────────────────

/**
 * Builds the initial particle array for a given count.
 * Particles start in a tight solid-state grid.
 * @param count        — number of particles
 * @param startWallPos — initial wall position (0–1), determines starting state
 * @param shared       — shared config (used for phase thresholds)
 */
export function buildParticles(
  count: number,
  startWallPos: number,
  shared: PhaseChamberSharedConfig
): Particle[] {
  const particles: Particle[] = [];
  const cols = Math.ceil(Math.sqrt(count * 1.5));
  const rows = Math.ceil(count / cols);

  const marginX = 0.08;
  const marginY = 0.10;
  const cellW = (1 - marginX * 2) / cols;
  const cellH = (1 - marginY * 2) / rows;

  const phase    = getPhaseFromWall(startWallPos, shared.phases.solid.tempRange[1], shared.phases.gas.tempRange[0]);
  const speedMult = getSpeedMultFromWall(startWallPos);

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const gx  = marginX + col * cellW + cellW / 2;
    const gy  = marginY + row * cellH + cellH / 2;
    const jitter = (i * 137.508 * Math.PI) % (Math.PI * 2);

    let vx = 0;
    let vy = 0;
    if (phase !== "solid") {
      const speed = speedMult * SPEED_SCALE * (0.75 + (i % 7) * 0.05);
      vx = Math.cos(jitter) * speed;
      vy = Math.sin(jitter) * speed;
    }

    particles.push({
      x: gx + (Math.random() - 0.5) * 0.01,
      y: gy + (Math.random() - 0.5) * 0.01,
      vx, vy, gridX: gx, gridY: gy, jitterPhase: jitter,
      homeX: phase === "solid" ? gx : null,
      homeY: phase === "solid" ? gy : null,
    });
  }

  return particles;
}

// ─── Per-frame particle update ────────────────────────────────────────────────

/**
 * Updates a single particle's position and velocity for one frame.
 * Mutates the particle in-place.
 */
export function updateParticle(
  p: Particle,
  phase: PhaseState,
  speedMult: number,
  dtEff: number,
  now: number,
  index: number,
  CW: number,
  CH: number,
  particleRadius: number
): void {
  if (dtEff <= 0) return;

  const r2 = particleRadius / Math.min(CW, CH);

  if (phase === "solid") {
    const amp = speedMult * 0.028;
    if (amp < 0.0001) {
      p.x = p.gridX; p.y = p.gridY;
    } else {
      const t = now * 0.003 + p.jitterPhase;
      p.x = p.gridX + Math.sin(t * 2.1 + index * 0.3) * amp;
      p.y = p.gridY + Math.cos(t * 1.7 + index * 0.2) * amp;
    }
    p.homeX = p.gridX; p.homeY = p.gridY;
  } else {
    p.x += p.vx * dtEff;
    p.y += p.vy * dtEff;

    const mx = r2; const my = r2;
    if (p.x < mx)   { p.x = mx;   p.vx =  Math.abs(p.vx); }
    if (p.x > 1-mx) { p.x = 1-mx; p.vx = -Math.abs(p.vx); }
    if (p.y < my)   { p.y = my;   p.vy =  Math.abs(p.vy); }
    if (p.y > 1-my) { p.y = 1-my; p.vy = -Math.abs(p.vy); }

    const variety = 0.75 + ((index * 137 + 1) % 50) / 100;
    const target  = speedMult * SPEED_SCALE * variety;
    const current = Math.hypot(p.vx, p.vy);
    if (current > 0.00001) {
      const factor = 1 + (target - current) / current * 0.25;
      p.vx *= factor; p.vy *= factor;
    } else {
      const angle = p.jitterPhase + index * 0.4;
      p.vx = Math.cos(angle) * target;
      p.vy = Math.sin(angle) * target;
    }

    if (p.homeX !== null) {
      p.homeX = null; p.homeY = null;
      p.vx = Math.cos(p.jitterPhase) * speedMult * SPEED_SCALE;
      p.vy = Math.sin(p.jitterPhase) * speedMult * SPEED_SCALE;
    }
  }

  if (phase === "solid" && p.homeX === null) {
    p.homeX = p.gridX; p.homeY = p.gridY;
  }
}

// ─── Bond tap ─────────────────────────────────────────────────────────────────

export interface BondTapResult {
  strength: "strong" | "moderate" | "none";
  label: string;
}

export function getBondTapResult(phase: PhaseState): BondTapResult {
  switch (phase) {
    case "solid":  return { strength: "strong",   label: "Strong attraction — particles held in place" };
    case "liquid": return { strength: "moderate", label: "Moderate attraction — particles stay close but can move" };
    case "gas":    return { strength: "none",     label: "No attraction — particles are free" };
  }
}

// ─── Guided step logic ────────────────────────────────────────────────────────

export function isGuidedStepComplete(
  step: { targetZone?: "solid" | "liquid" | "gas"; holdMs: number; requiresBondTap: boolean },
  currentPhase: PhaseState,
  holdDurationMs: number,
  bondTapDone: boolean
): boolean {
  const zoneOk = step.targetZone == null || currentPhase === step.targetZone;
  const holdOk = step.targetZone == null || holdDurationMs >= step.holdMs;
  const tapOk  = !step.requiresBondTap || bondTapDone;
  return zoneOk && holdOk && tapOk;
}

// ─── Canvas drawing helpers ───────────────────────────────────────────────────

export function drawBackground(ctx: CanvasRenderingContext2D, CW: number, CH: number): void {
  // Flat dark base — almost black, slight blue tint
  const bg = ctx.createLinearGradient(0, 0, 0, CH);
  bg.addColorStop(0, "#03080e");
  bg.addColorStop(1, "#010406");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CW, CH);
}

export function drawContainerBorder(
  ctx: CanvasRenderingContext2D,
  CW: number, CH: number,
  r: number, g: number, b: number,
  slowMo: boolean, now: number
): void {
  const pulse = slowMo ? 0.4 + 0.35 * Math.sin(now * 0.007) : 0;
  ctx.strokeStyle = slowMo
    ? `rgba(255,200,60,${pulse})`
    : `rgba(${r},${g},${b},0.30)`;
  ctx.lineWidth = slowMo ? 2.5 : 1.5;
  ctx.strokeRect(1, 1, CW - 2, CH - 2);
}

/**
 * Draws a per-frame ambient colour wash behind the particles
 * based on current energy (speedMult). Call this after drawBackground,
 * before drawing particles.
 */
export function drawAmbientGlow(
  ctx: CanvasRenderingContext2D,
  CW: number, CH: number,
  r: number, g: number, b: number,
  speedMult: number
): void {
  if (speedMult < 0.08) return;
  const intensity = Math.min(1, speedMult) * 0.18;
  const radG = ctx.createRadialGradient(CW / 2, CH / 2, 0, CW / 2, CH / 2, CW * 0.62);
  radG.addColorStop(0, `rgba(${r},${g},${b},${intensity})`);
  radG.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = radG;
  ctx.fillRect(0, 0, CW, CH);
}

export function drawParticle(
  ctx: CanvasRenderingContext2D,
  px: number, py: number, r2: number,
  r: number, g: number, b: number,
  slowMo: boolean
): void {
  // Ambient glow halo — only drawn when particles have some energy
  // (skip for solid-state near-zero speeds to avoid muddy look)
  const glowR = r2 * (slowMo ? 4 : 2.6);
  const grd = ctx.createRadialGradient(px, py, 0, px, py, glowR);
  grd.addColorStop(0,   `rgba(${r},${g},${b},${slowMo ? 0.45 : 0.30})`);
  grd.addColorStop(0.45,`rgba(${r},${g},${b},0.10)`);
  grd.addColorStop(1,   `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(px, py, glowR, 0, Math.PI * 2);
  ctx.fill();

  // Core body — radial gradient for depth (lighter top-left)
  const bodyGrd = ctx.createRadialGradient(
    px - r2 * 0.3, py - r2 * 0.3, r2 * 0.05,
    px, py, r2
  );
  // lighten top-left corner by ~30%
  const rl = Math.min(255, r + 70); const gl2 = Math.min(255, g + 70); const bl = Math.min(255, b + 70);
  bodyGrd.addColorStop(0, `rgb(${rl},${gl2},${bl})`);
  bodyGrd.addColorStop(1, `rgb(${r},${g},${b})`);

  ctx.shadowColor = `rgb(${r},${g},${b})`;
  ctx.shadowBlur  = slowMo ? 24 : 9;
  ctx.fillStyle   = bodyGrd;
  ctx.beginPath();
  ctx.arc(px, py, r2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Specular highlight
  ctx.fillStyle = "rgba(255,255,255,0.52)";
  ctx.beginPath();
  ctx.arc(px - r2 * 0.28, py - r2 * 0.28, r2 * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

// ─── Bond animation ───────────────────────────────────────────────────────────

export interface BondAnimation {
  x1: number; y1: number;
  x2: number; y2: number;
  progress: number;
  strength: "strong" | "moderate" | "none";
  startTime: number;
}

export const BOND_DURATION_MS = 350;

export function drawBondAnimation(
  ctx: CanvasRenderingContext2D,
  bond: BondAnimation,
  CW: number, CH: number
): void {
  const { x1, y1, x2, y2, progress, strength } = bond;
  const px1 = x1 * CW; const py1 = y1 * CH;
  const px2 = x2 * CW; const py2 = y2 * CH;

  if (strength === "none") {
    const alpha = Math.max(0, 1 - progress * 2);
    ctx.strokeStyle = `rgba(255,178,60,${alpha})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(px1, py1); ctx.lineTo(px2, py2); ctx.stroke();
    ctx.setLineDash([]);
    return;
  }

  const maxStretch = strength === "strong" ? 1.4 : 1.2;
  const stretchPhase = progress < 0.5
    ? progress / 0.5 * (maxStretch - 1) + 1
    : maxStretch - (progress - 0.5) / 0.5 * (maxStretch - 1);

  const midX = (px1 + px2) / 2; const midY = (py1 + py2) / 2;
  const dx = (px2 - px1) * (stretchPhase - 1) / 2;
  const dy = (py2 - py1) * (stretchPhase - 1) / 2;

  ctx.strokeStyle = `rgba(255,178,60,${strength === "strong" ? 0.9 : 0.65})`;
  ctx.lineWidth = strength === "strong" ? 2.5 : 1.5;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(px1 - dx, py1 - dy);
  ctx.lineTo(midX, midY);
  ctx.lineTo(px2 + dx, py2 + dy);
  ctx.stroke();
  ctx.setLineDash([]);

  if (progress > 0.7 && strength === "strong") {
    const flashAlpha = (1 - progress) * 2;
    ctx.beginPath();
    ctx.arc(midX, midY, 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,178,60,${flashAlpha})`;
    ctx.fill();
  }
}

// ─── State label constants ────────────────────────────────────────────────────

export const PHASE_LABELS: Record<PhaseState, string> = {
  solid:  "SOLID",
  liquid: "LIQUID",
  gas:    "GAS",
};

export const PROPERTY_BADGES: Record<PhaseState, string> = {
  solid:  "Fixed shape  •  Fixed volume  •  Cannot be compressed",
  liquid: "No fixed shape  •  Fixed volume  •  Barely compressible",
  gas:    "No fixed shape  •  No fixed volume  •  Easily compressed",
};

export const BOND_RESULT_LABELS: Record<PhaseState, string> = {
  solid:  "Strong attraction — particles held in place",
  liquid: "Moderate attraction — particles stay close but can move",
  gas:    "No attraction — particles are free",
};

export const DENSITY_LABELS: Record<PhaseState, string> = {
  solid:  "Density: HIGH",
  liquid: "Density: MEDIUM",
  gas:    "Density: LOW",
};

// ─── Heat-control mode ────────────────────────────────────────────────────────

const PLATEAU_BAND = 1.5; // °C either side of a transition point

export type HeatPhaseLabel = "solid" | "melting" | "liquid" | "boiling" | "gas";

export function getHeatPhaseLabel(
  tempC: number,
  meltingPointC: number,
  boilingPointC: number
): HeatPhaseLabel {
  if (tempC < meltingPointC - PLATEAU_BAND) return "solid";
  if (tempC <= meltingPointC + PLATEAU_BAND) return "melting";
  if (tempC < boilingPointC - PLATEAU_BAND)  return "liquid";
  if (tempC <= boilingPointC + PLATEAU_BAND) return "boiling";
  return "gas";
}

export function isOnPlateau(
  tempC: number,
  meltingPointC: number,
  boilingPointC: number
): boolean {
  const label = getHeatPhaseLabel(tempC, meltingPointC, boilingPointC);
  return label === "melting" || label === "boiling";
}

/**
 * Energy-view meter split.
 * Returns { tempFraction, bondsFraction } each 0–1.
 */
export function getEnergyViewSplit(
  heatInput: number,
  onPlateau: boolean
): { tempFraction: number; bondsFraction: number } {
  if (onPlateau) {
    return { tempFraction: 0.05, bondsFraction: Math.min(1, heatInput / 60) };
  }
  return { tempFraction: Math.min(1, heatInput / 100), bondsFraction: 0.03 };
}

// ─── Heating curve ────────────────────────────────────────────────────────────

export interface CurvePoint {
  x: number; // seconds elapsed
  y: number; // temperature °C
}

export const MAX_CURVE_POINTS = 3600;

export function drawHeatingCurve(
  ctx: CanvasRenderingContext2D,
  points: CurvePoint[],
  CW: number, CH: number,
  minTemp: number, maxTemp: number,
  meltingC: number, boilingC: number,
  onPlateau: boolean,
  shownMelt: boolean, shownBoil: boolean
): void {
  if (points.length < 2) return;

  const PAD_L = 28; const PAD_R = 6;
  const PAD_T = 8;  const PAD_B = 18;
  const plotW = CW - PAD_L - PAD_R;
  const plotH = CH - PAD_T - PAD_B;

  const lastX = points[points.length - 1].x;
  const windowSec = Math.max(60, lastX + 5);
  const xStart = Math.max(0, lastX - windowSec + 5);

  function toSX(x: number) { return PAD_L + ((x - xStart) / windowSec) * plotW; }
  function toSY(y: number) { return PAD_T + plotH - ((y - minTemp) / (maxTemp - minTemp)) * plotH; }

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, CW, CH);

  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD_L, PAD_T);
  ctx.lineTo(PAD_L, PAD_T + plotH);
  ctx.lineTo(CW - PAD_R, PAD_T + plotH);
  ctx.stroke();

  ctx.save();
  ctx.translate(10, PAD_T + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = `10px "Fredoka", sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("Temp (°C)", 0, 0);
  ctx.restore();

  if (shownMelt) {
    const my = toSY(meltingC);
    ctx.strokeStyle = "rgba(176,200,240,0.35)";
    ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD_L, my); ctx.lineTo(CW - PAD_R, my); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(176,200,240,0.7)";
    ctx.font = `10px "Fredoka", sans-serif`; ctx.textAlign = "right";
    ctx.fillText(`${meltingC}°`, PAD_L - 2, my + 3);
  }

  if (shownBoil) {
    const by = toSY(boilingC);
    ctx.strokeStyle = "rgba(255,178,60,0.35)";
    ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD_L, by); ctx.lineTo(CW - PAD_R, by); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,178,60,0.7)";
    ctx.font = `10px "Fredoka", sans-serif`; ctx.textAlign = "right";
    ctx.fillText(`${boilingC}°`, PAD_L - 2, by + 3);
  }

  ctx.strokeStyle = onPlateau ? "rgba(255,255,255,0.9)" : "rgba(255,178,60,0.9)";
  ctx.lineWidth = 2; ctx.lineJoin = "round";
  ctx.beginPath();
  let started = false;
  for (const pt of points) {
    const sx = toSX(pt.x);
    const sy = toSY(Math.max(minTemp, Math.min(maxTemp, pt.y)));
    if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  const last = points[points.length - 1];
  const dx = toSX(last.x);
  const dy = toSY(Math.max(minTemp, Math.min(maxTemp, last.y)));
  ctx.beginPath();
  ctx.arc(dx, dy, 4, 0, Math.PI * 2);
  ctx.fillStyle = onPlateau ? "#fff" : "#ffb23c";
  ctx.fill();
}

// ─── Surface escape particles ─────────────────────────────────────────────────

export interface EscapeParticle {
  id: number;
  x: number;
  y: number;
  opacity: number;
}

export const SURFACE_FRACTION = 0.18;

export function updateEscapeParticles(
  particles: EscapeParticle[],
  dtEff: number
): EscapeParticle[] {
  for (const ep of particles) {
    ep.y       -= 0.010 * dtEff * 60;
    ep.opacity -= 0.020 * dtEff * 60;
  }
  return particles.filter(ep => ep.opacity > 0.02);
}

export function maybeEmitEscape(
  accumRef: { current: number },
  tempC: number,
  boilingPointC: number,
  dtEff: number,
  nextIdRef: { current: number }
): EscapeParticle | null {
  const BAND = 2;
  if (tempC < boilingPointC - BAND) return null;
  const rate = 1.5 * Math.min(1, (tempC - (boilingPointC - BAND)) / 4);
  accumRef.current += rate * dtEff;
  if (accumRef.current < 1) return null;
  accumRef.current -= 1;
  return {
    id: nextIdRef.current++,
    x: 0.05 + Math.random() * 0.9,
    y: SURFACE_FRACTION * (0.4 + Math.random() * 0.6),
    opacity: 1,
  };
}

export function drawEscapeParticles(
  ctx: CanvasRenderingContext2D,
  particles: EscapeParticle[],
  CW: number, CH: number, r2: number
): void {
  for (const ep of particles) {
    ctx.globalAlpha = Math.max(0, ep.opacity);
    ctx.shadowColor = "#FFB23C";
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = "#FFB23C";
    ctx.beginPath();
    ctx.arc(ep.x * CW, ep.y * CH, r2 * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}

export function drawSurfaceZone(
  ctx: CanvasRenderingContext2D,
  CW: number, CH: number
): void {
  const surfH = SURFACE_FRACTION * CH;
  const grad  = ctx.createLinearGradient(0, 0, 0, surfH);
  grad.addColorStop(0, "rgba(255,178,60,0.06)");
  grad.addColorStop(1, "rgba(255,178,60,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CW, surfH);

  ctx.strokeStyle = "rgba(255,178,60,0.2)";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(0, surfH); ctx.lineTo(CW, surfH); ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(255,178,60,0.5)";
  ctx.font = `bold 9px "Fredoka", sans-serif`;
  ctx.fillText("surface", 5, surfH - 3);
}