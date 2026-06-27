/**
 * motion/orbitalMotion.ts
 *
 * Two reusable DOM/CSS-based placement patterns, extracted from Build The
 * Atom v2's nucleus/electron motion. Both are transform-only (cheap on
 * low-end Android, no physics engine):
 *
 * - `clusterJitter`: objects gather near a center point with small random
 *   offsets and continuous gentle motion — a "magnetic" feel. Good for any
 *   engine where multiple same-class objects accumulate toward a target
 *   (nucleons in Build The Atom; could fit e.g. ions clustering, particles
 *   collecting in a container).
 * - `orbitShell`: objects circle a center at increasing radii ("shells"),
 *   each new object in a shell joining the rotation already in progress.
 *   Good for anything with a literal or metaphorical "orbiting" element.
 *
 * These are NOT React components — they return plain style/animation
 * descriptors so they work the same whether the calling engine renders
 * with React state + refs or imperative DOM manipulation.
 */

export interface ClusterJitterPlacement {
  /** Translate offset from center, in px. Apply as `translate(-50%, -50%) translate(x, y)`. */
  x: number;
  y: number;
  /** Negative animation-delay (seconds) so jitter phases are desynced across particles. */
  jitterDelay: number;
}

export function computeClusterJitterPlacement(
  minRadius = 6,
  maxRadius = 16,
  maxJitterPeriodSec = 2.4
): ClusterJitterPlacement {
  const angle = Math.random() * Math.PI * 2;
  const radius = minRadius + Math.random() * (maxRadius - minRadius);
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    jitterDelay: -Math.random() * maxJitterPeriodSec
  };
}

export interface OrbitShellPlacement {
  shellIndex: number;
  radiusPx: number;
  durationSec: number;
  startAngleDeg: number;
}

/**
 * Call once per object added to an orbiting group; `existingCountInGroup` is
 * how many orbit objects already exist in this group (used to round-robin
 * across shells and to vary rotation speed per shell so the motion doesn't
 * look uniform).
 */
export function computeOrbitShellPlacement(
  existingCountInGroup: number,
  shellCount = 3,
  baseRadiusPx = 60,
  radiusStepPx = 25,
  baseDurationSec = 4,
  durationStepSec = 1.4
): OrbitShellPlacement {
  const shellIndex = existingCountInGroup % shellCount;
  return {
    shellIndex,
    radiusPx: baseRadiusPx + shellIndex * radiusStepPx,
    durationSec: baseDurationSec + shellIndex * durationStepSec,
    startAngleDeg: Math.random() * 360
  };
}

/**
 * Particle trail descriptor — a short fading tail rendered behind an
 * arriving particle. Returns a small fixed set of dot offsets (interpolated
 * back along the arrival path) rather than a persistent particle system, so
 * the cost per arrival is bounded and predictable on low-end Android.
 */
export interface TrailDot {
  key: string;
  offsetX: number;
  offsetY: number;
  sizePx: number;
  peakOpacity: number;
  delayMs: number;
}

export function computeArrivalTrail(targetX: number, targetY: number, dotCount = 3): TrailDot[] {
  const dots: TrailDot[] = [];
  for (let i = 0; i < dotCount; i++) {
    const t = (i + 1) / (dotCount + 1); // fraction back along the path from start (0,0) to target
    dots.push({
      key: `trail-${i}-${Math.random().toString(36).slice(2, 7)}`,
      offsetX: targetX * t,
      offsetY: targetY * t,
      sizePx: 6 - i * 1.4,
      peakOpacity: 0.5 - i * 0.12,
      delayMs: i * 35
    });
  }
  return dots;
}
