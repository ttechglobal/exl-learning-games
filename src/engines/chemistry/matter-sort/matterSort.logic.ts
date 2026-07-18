/**
 * engines/chemistry/matter-sort/matterSort.logic.ts
 *
 * Pure logic — no React, no side effects.
 */

import type { SortCard, Column, MatterSortSharedConfig } from "./matterSort.config";

// ─── Card selection ───────────────────────────────────────────────────────────

export function drawCards(
  pool: SortCard[],
  alreadyActive: Set<string>,
  recentlyUsed: Set<string>,
  count: number
): SortCard[] {
  const available = pool.filter(c => !alreadyActive.has(c.id));
  const fresh = available.filter(c => !recentlyUsed.has(c.id));
  const source = fresh.length >= count ? fresh : available;
  return shuffle(source).slice(0, count);
}

export function isCorrectPlacement(card: SortCard, column: Column): boolean {
  return card.correctColumn === column;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

export function calculatePoints(config: MatterSortSharedConfig, streak: number): number {
  const base = config.pointsPerCorrect;
  const streakActive = streak >= config.streakBonusAfter;
  const multiplier = streakActive
    ? Math.min(1 + (streak - config.streakBonusAfter + 1) * 0.25, 2.5)
    : 1;
  return Math.round(base * multiplier);
}

// ─── Card positions ───────────────────────────────────────────────────────────

export function generateCardX(index: number, total: number): number {
  const band = 1 / (total + 1);
  const baseX = band * (index + 1);
  const jitter = (Math.random() - 0.5) * band * 0.5;
  return Math.max(0.1, Math.min(0.9, baseX + jitter));
}

// ─── Difficulty ───────────────────────────────────────────────────────────────

export interface DifficultyParams {
  sessionDurationSec: number;
  cardsOnScreen: number;
  driftDurationSec: number;
  hintsEnabled: boolean;
}

export function applyDifficulty(
  base: MatterSortSharedConfig,
  difficulty: "EASY" | "MEDIUM" | "HARD"
): DifficultyParams {
  switch (difficulty) {
    case "EASY":
      return { sessionDurationSec: 120, cardsOnScreen: 1, driftDurationSec: 18, hintsEnabled: true };
    case "HARD":
      return { sessionDurationSec: 60, cardsOnScreen: 3, driftDurationSec: 8, hintsEnabled: false };
    case "MEDIUM":
    default:
      return {
        sessionDurationSec: base.sessionDurationSec,
        cardsOnScreen: base.cardsOnScreen,
        driftDurationSec: base.driftDurationSec,
        hintsEnabled: base.hints.enabled,
      };
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────────

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}