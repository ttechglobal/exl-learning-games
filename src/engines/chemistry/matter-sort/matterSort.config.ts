/**
 * engines/chemistry/matter-sort/matterSort.config.ts
 *
 * Config schema for the matter-sort engine.
 *
 * GameRuntime passes config as { shared: effectiveSharedConfig, mission: effectiveMission }
 * where effectiveSharedConfig = game.shared_config (with difficulty modifiers applied).
 *
 * Mechanic: property/description cards drift upward on screen; the student
 * drags each card into the correct state column (Solid / Liquid / Gas,
 * or for Mission 3 the three change-of-state arrows). A placement is
 * checked the moment the card is released over a column.
 */

import { z } from "zod";

// ─── Column types ─────────────────────────────────────────────────────────────

export const StateColumnSchema = z.enum(["solid", "liquid", "gas"]);
export type StateColumn = z.infer<typeof StateColumnSchema>;

export const ChangeColumnSchema = z.enum(["solid-liquid", "liquid-gas", "solid-gas"]);
export type ChangeColumn = z.infer<typeof ChangeColumnSchema>;

export const ColumnSchema = z.union([StateColumnSchema, ChangeColumnSchema]);
export type Column = z.infer<typeof ColumnSchema>;

// ─── Card definition ──────────────────────────────────────────────────────────

export const SortCardSchema = z.object({
  id: z.string(),
  text: z.string(),
  correctColumn: ColumnSchema,
  hint: z.string().optional(),
});
export type SortCard = z.infer<typeof SortCardSchema>;

// ─── Column definition ────────────────────────────────────────────────────────

export const ColumnDefSchema = z.object({
  id: ColumnSchema,
  label: z.string(),
  emoji: z.string(),
  color: z.string(),
});
export type ColumnDef = z.infer<typeof ColumnDefSchema>;

// ─── Shared config (stored in game.shared_config) ────────────────────────────

export const MatterSortSharedConfigSchema = z.object({
  sessionDurationSec: z.number().int().positive().default(90),
  cardsOnScreen: z.number().int().min(1).max(4).default(2),
  pointsPerCorrect: z.number().int().positive().default(10),
  streakBonusAfter: z.number().int().positive().default(3),
  wrongPenaltySec: z.number().int().nonnegative().default(3),
  driftDurationSec: z.number().positive().default(14),
  hints: z.object({
    enabled: z.boolean().default(true),
    showAfterWrongPlacements: z.number().int().positive().default(1),
  }).default({ enabled: true, showAfterWrongPlacements: 1 }),
  columns: z.array(ColumnDefSchema).min(2).max(3),
  cardPool: z.array(SortCardSchema).min(4),
});

export type MatterSortSharedConfig = z.infer<typeof MatterSortSharedConfigSchema>;

// ─── Full engine config (what the engine component receives) ──────────────────

export interface MatterSortConfig {
  shared: MatterSortSharedConfig;
  mission: {
    id: string;
    title: string;
    xp_reward: number;
    payload: {
      difficulty?: string;
      /** Override columns for this specific mission (e.g. transition arrows for M3) */
      columnsOverride?: ColumnDef[];
      /** Override card pool for this specific mission (e.g. changes-of-state cards) */
      cardPoolOverride?: SortCard[];
    };
  };
}

// ─── Outcome ─────────────────────────────────────────────────────────────────

export interface MatterSortOutcome {
  success: true;
  score: number;
  cardsCorrect: number;
  cardsAttempted: number;
  bestStreak: number;
  timeSpentSec: number;
}