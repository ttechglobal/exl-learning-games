/**
 * engines/chemistry/particle-field/particleField.logic.ts
 *
 * Pure functions for the particle-field engine.
 * No React imports — fully unit-testable.
 */

import type { ParticleFieldSharedConfig, Transition } from "./particleField.config";

// ─── Particle type ────────────────────────────────────────────────────────────

export interface Particle {
  id: number;
  /** Position in canvas-local coords (0–1 normalised). */
  x: number;
  y: number;
  /** Current velocity in normalised-coords-per-second. */
  vx: number;
  vy: number;
  /**
   * For solid state: the home position the particle jitters around.
   * Null in liquid/gas (particle moves freely).
   */
  homeX: number | null;
  homeY: number | null;
  /** Jitter phase offset — prevents all solid particles moving in sync. */
  jitterPhase: number;
}

// ─── Current phase name ───────────────────────────────────────────────────────

export type PhaseName = "solid" | "liquid" | "gas";

export function getPhase(temp: number, cfg: ParticleFieldSharedConfig): PhaseName {
  if (temp <= cfg.phases.solid.tempRange[1])  return "solid";
  if (temp <= cfg.phases.liquid.tempRange[1]) return "liquid";
  return "gas";
}

// ─── Speed multiplier interpolated from temperature ───────────────────────────

export function getSpeedMult(temp: number, cfg: ParticleFieldSharedConfig): number {
  const { solid, liquid, gas } = cfg.phases;

  if (temp <= solid.tempRange[1]) {
    // Within solid range: interpolate 0→solid.speedMult
    const t = temp / solid.tempRange[1];
    return solid.speedMult * t;
  }
  if (temp <= liquid.tempRange[1]) {
    // Solid→liquid interpolation
    const t = (temp - solid.tempRange[1]) / (liquid.tempRange[1] - solid.tempRange[1]);
    return solid.speedMult + (liquid.speedMult - solid.speedMult) * t;
  }
  // Liquid→gas interpolation
  const t = (temp - liquid.tempRange[1]) / (gas.tempRange[1] - liquid.tempRange[1]);
  return liquid.speedMult + (gas.speedMult - liquid.speedMult) * Math.min(t, 1);
}

// ─── Particle colour interpolated from temperature ───────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * Math.max(0, Math.min(1, t)));
}

export function getParticleColor(temp: number, cfg: ParticleFieldSharedConfig): string {
  const { solid, liquid, gas } = cfg.phases;
  const sc = cfg.particleColors.solid;
  const lc = cfg.particleColors.liquid;
  const gc = cfg.particleColors.gas;

  const [sr, sg, sb] = hexToRgb(sc);
  const [lr, lg, lb] = hexToRgb(lc);
  const [gr, gg, gb] = hexToRgb(gc);

  if (temp <= solid.tempRange[1]) {
    return `rgb(${sr},${sg},${sb})`;
  }
  if (temp <= liquid.tempRange[1]) {
    const t = (temp - solid.tempRange[1]) / (liquid.tempRange[1] - solid.tempRange[1]);
    return `rgb(${lerp(sr, lr, t)},${lerp(sg, lg, t)},${lerp(sb, lb, t)})`;
  }
  const t = (temp - liquid.tempRange[1]) / (gas.tempRange[1] - liquid.tempRange[1]);
  return `rgb(${lerp(lr, gr, t)},${lerp(lg, gg, t)},${lerp(lb, gb, t)})`;
}

// ─── Initial particle placement ───────────────────────────────────────────────

/**
 * Builds the initial particle array for a given temperature.
 * Solid: grid arrangement with jitter phase offsets.
 * Liquid/Gas: random positions with random velocities.
 */
export function buildParticles(
  count: number,
  startTemp: number,
  cfg: ParticleFieldSharedConfig
): Particle[] {
  const phase = getPhase(startTemp, cfg);
  const particles: Particle[] = [];

  if (phase === "solid") {
    // Grid arrangement
    const cols = Math.ceil(Math.sqrt(count * 1.4));
    const rows = Math.ceil(count / cols);
    const spacingX = 1 / (cols + 1);
    const spacingY = 1 / (rows + 1);

    for (let i = 0; i < count; i++) {
      const col = (i % cols) + 1;
      const row = Math.floor(i / cols) + 1;
      const hx = col * spacingX;
      const hy = row * spacingY;
      particles.push({
        id: i,
        x: hx,
        y: hy,
        vx: 0,
        vy: 0,
        homeX: hx,
        homeY: hy,
        jitterPhase: Math.random() * Math.PI * 2,
      });
    }
  } else {
    // Random positions
    const speedBase = getSpeedMult(startTemp, cfg) * 0.004;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = speedBase * (0.6 + Math.random() * 0.8);
      particles.push({
        id: i,
        x: 0.05 + Math.random() * 0.9,
        y: 0.05 + Math.random() * 0.9,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        homeX: null,
        homeY: null,
        jitterPhase: Math.random() * Math.PI * 2,
      });
    }
  }

  return particles;
}

// ─── Transition detection ─────────────────────────────────────────────────────

/**
 * Returns the first unfired transition that the temperature has just crossed,
 * or null if none. Caller tracks which transitions have already fired.
 */
export function detectTransition(
  prevTemp: number,
  nextTemp: number,
  transitions: Transition[],
  firedKeys: Set<string>
): Transition | null {
  for (const tr of transitions) {
    if (firedKeys.has(tr.key)) continue;
    const crossed =
      tr.direction === "up"
        ? prevTemp < tr.threshold && nextTemp >= tr.threshold
        : prevTemp > tr.threshold && nextTemp <= tr.threshold;
    if (crossed) return tr;
  }
  return null;
}

// ─── Difficulty label trimming ────────────────────────────────────────────────

/**
 * Returns the label options for a transition, trimmed to the right
 * count for the current difficulty.
 * EASY: 3 options (correct + 2 distractors)
 * MEDIUM: 4 options
 * HARD: all options (up to 6)
 */
export function getOptionsForDifficulty(
  transition: Transition,
  difficulty: "EASY" | "MEDIUM" | "HARD"
): string[] {
  const all = transition.options;
  const correct = transition.correctLabel;

  if (difficulty === "HARD") return shuffle(all);

  const distractors = all.filter(o => o !== correct);
  const count = difficulty === "EASY" ? 2 : 3;
  const picked = shuffle(distractors).slice(0, count);
  return shuffle([correct, ...picked]);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
