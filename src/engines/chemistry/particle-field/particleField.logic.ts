/**
 * particleField.logic.ts — pure functions, no React
 */

import type { ParticleFieldSharedConfig, Transition, NarrationStop } from "./particleField.config";

// ─── Particle ─────────────────────────────────────────────────────────────────

export interface Particle {
  id: number;
  x: number;          // normalised 0–1
  y: number;
  vx: number;
  vy: number;
  homeX: number | null;
  homeY: number | null;
  gridX: number;      // original grid position — used to snap back on cooling
  gridY: number;
  jitterPhase: number;
  /** true = this particle is in the surface layer (top 18%) for evaporation */
  isSurface: boolean;
  /** if >0, particle is escaping upward (surface evaporation visual) */
  escapeVy: number;
}

// ─── Phase ────────────────────────────────────────────────────────────────────

export type PhaseName = "solid" | "liquid" | "gas";

export function getPhase(temp: number, cfg: ParticleFieldSharedConfig): PhaseName {
  if (temp <= cfg.phases.solid.tempRange[1])  return "solid";
  if (temp <= cfg.phases.liquid.tempRange[1]) return "liquid";
  return "gas";
}

// ─── Speed multiplier ─────────────────────────────────────────────────────────

export function getSpeedMult(temp: number, cfg: ParticleFieldSharedConfig): number {
  const { solid, liquid, gas } = cfg.phases;

  if (temp <= solid.tempRange[1]) {
    // 0 at temp=0, ramps to solid.speedMult at solid max
    const t = temp / solid.tempRange[1];
    return solid.speedMult * t;
  }
  if (temp <= liquid.tempRange[1]) {
    const t = (temp - solid.tempRange[1]) / (liquid.tempRange[1] - solid.tempRange[1]);
    return solid.speedMult + (liquid.speedMult - solid.speedMult) * t;
  }
  const t = (temp - liquid.tempRange[1]) / (gas.tempRange[1] - liquid.tempRange[1]);
  return liquid.speedMult + (gas.speedMult - liquid.speedMult) * Math.min(t, 1);
}

// ─── Colour (returns {r,g,b} to avoid hex+alpha concat bug) ──────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function lerpC(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * Math.max(0, Math.min(1, t)));
}

export interface RGB { r: number; g: number; b: number }

export function getParticleRgb(
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
    return { r:lerpC(sr,lr,t), g:lerpC(sg,lg,t), b:lerpC(sb,lb,t) };
  }
  const t = Math.min(1, (temp - liquidMax) / (100 - liquidMax));
  return { r:lerpC(lr,gr,t), g:lerpC(lg,gg,t), b:lerpC(lb,gb,t) };
}

// ─── Build particles ──────────────────────────────────────────────────────────

export function buildParticles(
  count: number,
  startTemp: number,
  cfg: ParticleFieldSharedConfig,
  surfaceFraction = 0.18,
): Particle[] {
  const phase = getPhase(startTemp, cfg);
  const particles: Particle[] = [];

  if (phase === "solid") {
    const cols = Math.ceil(Math.sqrt(count * 1.4));
    const rows = Math.ceil(count / cols);
    const sx = 1 / (cols + 1);
    const sy = 1 / (rows + 1);

    for (let i = 0; i < count; i++) {
      const col = (i % cols) + 1;
      const row = Math.floor(i / cols) + 1;
      const hx = col * sx;
      const hy = row * sy;
      particles.push({
        id: i, x: hx, y: hy, vx: 0, vy: 0,
        homeX: hx, homeY: hy, gridX: hx, gridY: hy,
        jitterPhase: Math.random() * Math.PI * 2,
        isSurface: hy <= surfaceFraction,
        escapeVy: 0,
      });
    }
  } else {
    const speedBase = getSpeedMult(startTemp, cfg) * 0.022;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = speedBase * (0.6 + Math.random() * 0.8);
      const y     = 0.05 + Math.random() * 0.9;
      particles.push({
        id: i,
        x: 0.05 + Math.random() * 0.9, y,
        vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
        homeX: null, homeY: null,
        gridX: 0.5, gridY: 0.5,
        jitterPhase: Math.random() * Math.PI * 2,
        isSurface: y <= surfaceFraction,
        escapeVy: 0,
      });
    }
  }
  return particles;
}

// ─── Transition detection ─────────────────────────────────────────────────────

export function detectTransition(
  prevTemp: number, nextTemp: number,
  transitions: Transition[], firedKeys: Set<string>,
): Transition | null {
  for (const tr of transitions) {
    if (firedKeys.has(tr.key)) continue;
    const crossed = tr.direction === "up"
      ? prevTemp < tr.threshold && nextTemp >= tr.threshold
      : prevTemp > tr.threshold && nextTemp <= tr.threshold;
    if (crossed) return tr;
  }
  return null;
}

// ─── Narration stop detection ─────────────────────────────────────────────────

/**
 * Returns the first narration stop that the temperature has just crossed
 * and has not yet been shown (not in shownKeys).
 * Always fires in heating direction (stops are ascending temperature targets).
 */
export function detectNarrationStop(
  prevTemp: number, nextTemp: number,
  stops: NarrationStop[], shownKeys: Set<number>,
): NarrationStop | null {
  for (let i = 0; i < stops.length; i++) {
    if (shownKeys.has(i)) continue;
    const s = stops[i];
    if (prevTemp < s.temp && nextTemp >= s.temp) return s;
  }
  return null;
}

export function getNarrationStopIndex(stop: NarrationStop, stops: NarrationStop[]): number {
  return stops.findIndex(s => s.temp === stop.temp && s.line === stop.line);
}

// ─── Label options by difficulty ──────────────────────────────────────────────

export function getOptionsForDifficulty(
  transition: Transition,
  difficulty: "EASY" | "MEDIUM" | "HARD",
): string[] {
  const all     = transition.options;
  const correct = transition.correctLabel;
  if (difficulty === "HARD") return shuffle(all);
  const distractors = all.filter(o => o !== correct);
  const count = difficulty === "EASY" ? 2 : 3;
  return shuffle([correct, ...shuffle(distractors).slice(0, count)]);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
