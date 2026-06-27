import { z } from "zod";

export const BondTypeSchema = z.enum(["ionic", "covalent"]);
export const BondPairSchema = z.tuple([z.string(), z.string()]);

export const BondMissionSchema = z.object({
  key: z.string(),
  formula: z.string(),
  name: z.string(),
  bondType: BondTypeSchema,
  pair: BondPairSchema,
  xpReward: z.number().int().positive()
});

export const FactoryOrderSchema = z.object({
  key: z.string(),
  formula: z.string(),
  name: z.string(),
  bondType: BondTypeSchema,
  pair: BondPairSchema,
  quantity: z.number().int().positive(),
  xpReward: z.number().int().positive()
});

export const BondMatchSharedConfigSchema = z
  .object({
    elementPool: z.array(z.string()).min(2),
    showBondTypeHint: z.boolean().default(true),
    missions: z.array(BondMissionSchema).optional(),
    factory: z
      .object({
        sessionDurationSec: z.number().int().positive().default(60),
        orders: z.array(FactoryOrderSchema).min(1)
      })
      .optional()
  })
  .refine((data) => Boolean(data.missions) !== Boolean(data.factory), {
    message: "Exactly one of `missions` or `factory` must be set"
  });

export type BondMatchSharedConfig = z.infer<typeof BondMatchSharedConfigSchema>;
export type BondMission = z.infer<typeof BondMissionSchema>;
export type FactoryOrder = z.infer<typeof FactoryOrderSchema>;

/**
 * `mission.payload` carries the level's FULL BondMatchSharedConfig when
 * this game models "one game, several self-contained levels the player
 * picks from" (Atom Forge) — each level needs its own element pool and
 * mission-list-or-factory config, which a single Game.shared_config can't
 * represent for more than one level at once. BondMatchEngine resolves its
 * real config by preferring mission.payload over the top-level `shared`
 * when payload itself looks like a valid shared config (see
 * resolveSharedConfig in BondMatchEngine.tsx) — Game.shared_config can stay
 * empty for this kind of game, or hold genuinely game-wide values for
 * engines/games that don't need per-level variation.
 */
export interface BondMatchConfig {
  shared: BondMatchSharedConfig;
  mission: {
    id: string;
    xpReward: number;
    payload?: Record<string, unknown>;
  };
}

export interface BondMatchMissionOutcome {
  success: true;
  attemptsBeforeSuccess: number;
  timeSpentSec: number;
  bondType: "ionic" | "covalent";
  pair: [string, string];
}

export interface BondMatchFactoryOutcome {
  success: true;
  score: number;
  finalScore: number;
  compoundsProduced: number;
  wrongAttempts: number;
  timeSpentSec: number;
}