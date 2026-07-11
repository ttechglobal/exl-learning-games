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
    /**
     * Both optional, both only meaningful in "missions" mode (ignored
     * entirely when `factory` is set, which already has its own timed
     * session loop). Per direct feedback ("the user should be able to
     * create different and more compounds in each level, not just
     * one... introduce timer in medium and hard"):
     *   - sessionLength: how many successful compounds end an UNTIMED
     *     session (Easy) — the player forges this many, in random
     *     order with no immediate repeat, then the mission completes.
     *   - sessionDurationSec: when set, the session is timed instead
     *     (Medium/Hard) — the player forges as many compounds as they
     *     can, drawn the same randomized no-repeat way, until the
     *     clock runs out; sessionLength is ignored if this is set.
     * Neither set at all -> falls back to forging through `missions`
     * once each, in shuffled order (still no immediate repeat), the
     * pre-existing untimed behavior for any mission authored before
     * this field existed.
     */
    sessionLength: z.number().int().positive().optional(),
    sessionDurationSec: z.number().int().positive().optional(),
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
  score: number;
  finalScore: number;
  compoundsProduced: number;
  wrongAttempts: number;
  timeSpentSec: number;
  /** Real XP for this session, read by LocalDbAdapter.resolveXpReward()
   *  in preference to the Mission's flat xp_reward — see
   *  tileMatch.config.ts's TileMatchOutcome.xpEarned for the full
   *  rationale (same fix, same reason, applied here too). Atom Forge
   *  sets this to 5 per compound forged (sessionXpRef in
   *  BondMatchEngine.tsx), matching finalScore exactly in the current
   *  content but kept as its own field rather than reusing finalScore
   *  directly — a future mission could tune finalScore (the in-game
   *  number shown on the HUD) and xpEarned (the real reward)
   *  differently without this field meaning two things at once. */
  xpEarned: number;
}

export interface BondMatchFactoryOutcome {
  success: true;
  score: number;
  finalScore: number;
  compoundsProduced: number;
  wrongAttempts: number;
  timeSpentSec: number;
  xpEarned: number;
}