/**
 * lib/content/ranks.ts
 *
 * Single source of truth for the XP rank system.
 * 12 tiers — designed for long-term engagement:
 *   Recruit → Cadet → Scholar → Expert → Champion → Legend
 *   → Elite → Master → Grandmaster → Prodigy → Sage → Mythic
 *
 * Progression curve: starts easy (quick early wins), then stretches
 * so advanced students always have something to chase.
 */

export interface Rank {
  min: number;
  label: string;
  icon: string;
  color: string;
  bgGradient: string;
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
    min: 150,
    label: "Cadet",
    icon: "⭐",
    color: "#60a5fa",
    bgGradient: "linear-gradient(135deg, #1e40af, #1d4ed8)",
  },
  {
    min: 400,
    label: "Scholar",
    icon: "🌟",
    color: "#34d399",
    bgGradient: "linear-gradient(135deg, #065f46, #047857)",
  },
  {
    min: 800,
    label: "Expert",
    icon: "🔥",
    color: "#fb923c",
    bgGradient: "linear-gradient(135deg, #9a3412, #c2410c)",
  },
  {
    min: 1500,
    label: "Champion",
    icon: "💎",
    color: "#a78bfa",
    bgGradient: "linear-gradient(135deg, #5b21b6, #7c3aed)",
  },
  {
    min: 2500,
    label: "Legend",
    icon: "👑",
    color: "#fbbf24",
    bgGradient: "linear-gradient(135deg, #92400e, #d97706)",
  },
  {
    min: 4000,
    label: "Elite",
    icon: "🏆",
    color: "#f472b6",
    bgGradient: "linear-gradient(135deg, #9d174d, #db2777)",
  },
  {
    min: 6500,
    label: "Master",
    icon: "⚡",
    color: "#38bdf8",
    bgGradient: "linear-gradient(135deg, #0c4a6e, #0284c7)",
  },
  {
    min: 10000,
    label: "Grandmaster",
    icon: "🌙",
    color: "#c084fc",
    bgGradient: "linear-gradient(135deg, #4c1d95, #6d28d9)",
  },
  {
    min: 15000,
    label: "Prodigy",
    icon: "🚀",
    color: "#86efac",
    bgGradient: "linear-gradient(135deg, #14532d, #15803d)",
  },
  {
    min: 25000,
    label: "Sage",
    icon: "🔮",
    color: "#fdba74",
    bgGradient: "linear-gradient(135deg, #7c2d12, #ea580c)",
  },
  {
    min: 50000,
    label: "Mythic",
    icon: "🌌",
    color: "#e879f9",
    bgGradient: "linear-gradient(135deg, #701a75, #a21caf)",
  },
];

export function getRank(xp: number): Rank {
  return [...RANKS].reverse().find((r) => xp >= r.min) ?? RANKS[0];
}
export function getNextRank(xp: number): Rank | null {
  return RANKS.find((r) => xp < r.min) ?? null;
}
export function getRankProgress(xp: number): number {
  const current = getRank(xp);
  const next = getNextRank(xp);
  if (!next) return 100;
  return Math.min(100, ((xp - current.min) / (next.min - current.min)) * 100);
}
export function getXpToNextRank(xp: number): number {
  const next = getNextRank(xp);
  return next ? next.min - xp : 0;
}