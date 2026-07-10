/**
 * lib/content/ranks.ts
 *
 * Single source of truth for the XP rank system.
 * Used by WorldsClient (mission control header) and ProfileClient (profile page)
 * so the thresholds, labels, icons, and colours are always in sync.
 *
 * Design intent: six tiers from Recruit → Legend.
 * Each rank has a distinct colour so the badge reads at a glance.
 */

export interface Rank {
  min: number;          // XP threshold to reach this rank
  label: string;
  icon: string;         // emoji shown in rank badge
  color: string;        // accent colour for the badge / glow
  bgGradient: string;   // gradient for the rank card / badge background
}

export const RANKS: Rank[] = [
  {
    min: 0,
    label: "Recruit",
    icon: "🎖️",
    color: "#9ca3af",
    bgGradient: "linear-gradient(135deg, #374151, #1f2937)",
  },
  {
    min: 100,
    label: "Cadet",
    icon: "⭐",
    color: "#60a5fa",
    bgGradient: "linear-gradient(135deg, #1e40af, #1d4ed8)",
  },
  {
    min: 300,
    label: "Scholar",
    icon: "🌟",
    color: "#34d399",
    bgGradient: "linear-gradient(135deg, #065f46, #047857)",
  },
  {
    min: 600,
    label: "Expert",
    icon: "🔥",
    color: "#fb923c",
    bgGradient: "linear-gradient(135deg, #9a3412, #c2410c)",
  },
  {
    min: 1000,
    label: "Champion",
    icon: "💎",
    color: "#a78bfa",
    bgGradient: "linear-gradient(135deg, #5b21b6, #7c3aed)",
  },
  {
    min: 2000,
    label: "Legend",
    icon: "👑",
    color: "#fbbf24",
    bgGradient: "linear-gradient(135deg, #92400e, #d97706)",
  },
];

/** Current rank for a given XP total */
export function getRank(xp: number): Rank {
  return [...RANKS].reverse().find((r) => xp >= r.min) ?? RANKS[0];
}

/** Next rank to unlock, or null if already at max */
export function getNextRank(xp: number): Rank | null {
  return RANKS.find((r) => xp < r.min) ?? null;
}

/** 0–100 progress percentage toward the next rank */
export function getRankProgress(xp: number): number {
  const current = getRank(xp);
  const next    = getNextRank(xp);
  if (!next) return 100;
  return Math.min(100, ((xp - current.min) / (next.min - current.min)) * 100);
}

/** XP remaining until the next rank, or 0 if at Legend */
export function getXpToNextRank(xp: number): number {
  const next = getNextRank(xp);
  return next ? next.min - xp : 0;
}