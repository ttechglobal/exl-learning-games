/**
 * engines/molecule-builder/moleculeBuilder.config.ts
 *
 * molecule-builder engine — config schema. Carbon Builder is the first
 * (and so far only) game on this engine — see docs/carbon-builder.md for
 * the full design spec this was built from.
 *
 * Engine family: player drags atoms from a dock onto fixed SLOTS on a
 * build surface, then drags BETWEEN two placed atoms (after picking a
 * bond type from a selector) to connect them. Every atom enforces its
 * own real max bond capacity — the core teaching mechanic — and a
 * connection's bond order (single/double/triple) is fixed at creation
 * time, never inferred or upgraded by stacking drags. The player must
 * place every atom by hand (no auto-fill of implied hydrogens) and
 * presses an explicit Submit button to check the built structure against
 * the mission's target molecule; there is no auto-complete.
 *
 * SLOT-BASED LAYOUT, not freeform physics (the bond-match pattern):
 * deliberately chosen over letting the player nudge atoms to arbitrary
 * pixel positions. A 5-carbon pentane chain built with full freeform
 * placement is a real UX tax with nothing to do with chemistry — slots
 * keep 100% of the player's effort on the actual bonding rules. See
 * `SlotSchema` below: each mission defines a small fixed set of named
 * slots (where atoms can be placed) and the engine renders them as a
 * simple horizontal backbone with stub positions branching off, not a
 * literal canvas the player composes freely.
 *
 * Split to match the Game/Mission DB tables, same convention as every
 * other engine here: SharedConfig holds the atom roster + bond-type
 * rules (true for every mission in this game); Mission.payload holds one
 * mission's slot layout + target bond graph + result label.
 */

import { z } from "zod";

export const BondOrderSchema = z.enum(["single", "double", "triple"]);

/** How much of EACH bonded atom's capacity one connection of this order
 *  consumes. A double bond consumes 2 of carbon's 4 slots by itself, not
 *  2 separate single bonds — this is the actual rule, not a UI label. */
export const BOND_ORDER_WEIGHT: Record<z.infer<typeof BondOrderSchema>, number> = {
  single: 1,
  double: 2,
  triple: 3
};

export const AtomDefSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  /** The real chemistry rule this whole engine exists to teach — see
   *  file header. Carbon = 4, Hydrogen = 1, Oxygen = 2, etc. */
  maxBonds: z.number().int().positive(),
  /** CSS color/token, same per-atom hex convention as elementData.ts /
   *  bondData.ts use for their own engines. */
  hex: z.string()
});

export const MoleculeBuilderSharedConfigSchema = z.object({
  /** The full roster of atoms this GAME can ever offer in any mission's
   *  dock — individual missions select a subset via their own
   *  `dockSymbols` (see MissionPayloadSchema below), the same
   *  game-roster-vs-mission-subset split bond-match's elementPool /
   *  mission.pair already uses. */
  atomRoster: z.array(AtomDefSchema).min(1),
  /** Which bond orders this game's selector tool offers at all — Easy/
   *  Medium missions only need "single" available; Hard missions need
   *  the full set. Keeping this game-level (not per-mission) means the
   *  selector UI can simply hide tools the current game never uses,
   *  while still being explicit content (not a hardcoded engine
   *  assumption) per game. */
  availableBondOrders: z.array(BondOrderSchema).min(1).default(["single"]),
  scoring: z.object({
    /** No per-attempt time pressure exists in this engine (untimed,
     *  checked on submit — same family as particle-assembly, not
     *  tile-match) — attempts are tracked for the outcome/analytics, but
     *  never penalize XP. Matches the platform's existing "no
     *  punishment, only guidance" mascot philosophy. */
    trackAttempts: z.boolean().default(true)
  }),
  /** Per direct feedback ("the Game Menu... Change Difficulty" should
   *  be available for all the games, not just one): this is Carbon
   *  Builder's actual difficulty lever, same family as
   *  particle-assembly's feedbackRules verbosity toggle — Hard turns
   *  off the specific "Carbon #2 only has 3/4 bonds" mismatch detail in
   *  favor of a generic "check your structure" nudge, so the player has
   *  to reason about the bond count themselves instead of being told
   *  exactly what's wrong. See moleculeBuilder.logic.ts's buildFeedback. */
  feedbackVerbose: z.boolean().default(true)
});

/**
 * One named placement point on the build surface. `bondStubs` lists the
 * OTHER slot ids this slot can directly bond to — the engine only offers
 * a bond action between two slots that are listed as connected to each
 * other, which is what keeps the layout a fixed backbone (methane's one
 * central slot with 4 stubs; ethane's two carbon slots bonded to each
 * other, each with 3 remaining stubs) rather than a free-for-all where
 * any atom could attempt to bond any other atom anywhere on screen.
 */
export const SlotSchema = z.object({
  id: z.string(),
  /** Which atom symbol(s) are valid for this slot — usually a single
   *  required symbol (a carbon backbone slot), but left as an array so a
   *  slot can accept "any of these" when a mission wants that
   *  flexibility (e.g. a generic terminal slot that takes H or Cl). */
  acceptsSymbols: z.array(z.string()).min(1),
  /** Other slot ids this slot is allowed to bond to. Symmetric — if "c1"
   *  lists "h1", "h1" should list "c1" back; validated at mission-author
   *  time, not inferred at runtime, so a malformed mission fails loudly
   *  via gameConfig.schema.ts rather than silently allowing or rejecting
   *  bonds in a way that's hard to debug. */
  bondableTo: z.array(z.string()).min(1),
  /** Layout hint for the slot-rendering grid — see
   *  MoleculeBuilderEngine.tsx's renderSlotLayout for how this maps to
   *  actual pixel positions. Kept as a simple row/col grid (not pixel
   *  coordinates) so missions stay easy to author by hand and don't
   *  need per-breakpoint position math. */
  row: z.number().int(),
  col: z.number().int()
});

/** One bond the TARGET molecule requires — which two slots, and at what
 *  order. This is what Submit validates the player's actual bonds
 *  against; see moleculeBuilder.logic.ts's checkStructure(). */
export const TargetBondSchema = z.object({
  slotA: z.string(),
  slotB: z.string(),
  order: BondOrderSchema
});

export const MoleculeBuilderMissionPayloadSchema = z.object({
  /** This mission's fixed slot layout — see SlotSchema. */
  slots: z.array(SlotSchema).min(1),
  /** Which atom symbol belongs in each slot, by slot id — the actual
   *  target composition, checked against what the player placed. */
  targetAtoms: z.record(z.string(), z.string()),
  /** The target bond graph — every bond the finished molecule needs,
   *  checked against what the player actually connected. */
  targetBonds: z.array(TargetBondSchema).min(1),
  /** Which atom symbols appear in this mission's dock — a subset of
   *  shared.atomRoster, same convention as bond-match's elementPool. */
  dockSymbols: z.array(z.string()).min(1),
  /** e.g. "Methane (CH₄)" — shown on the mission prompt banner. */
  resultLabel: z.string()
});

export type MoleculeBuilderSharedConfig = z.infer<typeof MoleculeBuilderSharedConfigSchema>;
export type MoleculeBuilderMissionPayload = z.infer<typeof MoleculeBuilderMissionPayloadSchema>;
export type AtomDef = z.infer<typeof AtomDefSchema>;
export type Slot = z.infer<typeof SlotSchema>;
export type TargetBond = z.infer<typeof TargetBondSchema>;
export type BondOrder = z.infer<typeof BondOrderSchema>;

/**
 * Combined shape the engine component actually receives at runtime.
 *
 * IMPORTANT — mission.payload stays NESTED, matching
 * GameRuntime.tsx's real GameRuntimeMission shape (`{ id, title,
 * xpReward, ..., payload: {...} }`) exactly. An earlier version of this
 * type flattened MoleculeBuilderMissionPayload directly onto `mission`
 * (`mission: MoleculeBuilderMissionPayload & {id, title, xpReward}`),
 * which crashed at runtime with "Cannot read properties of undefined
 * (reading 'map')" on `mission.dockSymbols` — GameRuntime never
 * actually flattens payload fields onto the mission object, so they
 * only ever existed at `mission.payload.dockSymbols`. Confirmed this
 * is the established, WORKING convention elsewhere in this codebase by
 * checking bond-match's resolveSharedConfig(), which correctly reads
 * `config.mission.payload` — not flattened access. (particle-assembly
 * has this exact same latent bug, accessing `mission.target` directly;
 * not fixed here since it's out of this engine's scope, but flagged in
 * the Build Log as a real pre-existing issue this round surfaced.)
 */
export interface MoleculeBuilderConfig {
  shared: MoleculeBuilderSharedConfig;
  mission: {
    id: string;
    title: string;
    xpReward: number;
    payload: MoleculeBuilderMissionPayload;
  };
}

/** Raw outcome shape this engine hands back to GameRuntime on mission
 *  completion — same "success is binary, attempts tracked, no partial
 *  credit" shape as ParticleAssemblyOutcome, since this is the same
 *  build-toward-a-target-then-submit family of engine. */
export interface MoleculeBuilderOutcome {
  success: true;
  attemptsBeforeSuccess: number;
  timeSpentSec: number;
  /** Final placed atoms (slotId -> symbol) and bonds, for any future
   *  reveal/summary screen wanting to show what was actually built —
   *  same soft-contract pattern as ParticleAssemblyOutcome.finalComposition. */
  finalAtoms: Record<string, string>;
  finalBonds: { slotA: string; slotB: string; order: BondOrder }[];
}
