/**
 * engines/molecule-builder/moleculeBuilder.logic.ts
 *
 * Pure logic, no React — same convention as
 * particleAssembly.logic.ts/tileMatch.logic.ts. Three jobs:
 *   1. Track how many bond "slots" a placed atom has used so far
 *      (bondCountForSlot) — the live 0/4, 1/4, 2/4... counter.
 *   2. Decide whether a NEW bond would overfill either atom involved
 *      BEFORE it's added (wouldOverfill) — the engine calls this and
 *      rejects/flashes red instead of ever allowing an invalid state to
 *      exist, rather than allowing it and catching it later on Submit.
 *      Carbon's tetravalency is taught by the rejection itself, not by a
 *      validation message after the fact.
 *   3. Check a finished structure against the mission's target
 *      (checkStructure) and build specific, teaching feedback when it's
 *      wrong (buildFeedback) — same "specific over generic" shape as
 *      particleAssembly's buildFeedback, which is the explicit design
 *      decision for this engine (see docs/carbon-builder.md's Open
 *      Questions: "wrong-submit feedback should be specific, not
 *      generic — this is a teaching game").
 */

import { BOND_ORDER_WEIGHT, type AtomDef, type BondOrder, type Slot, type TargetBond } from "@/engines/molecule-builder/moleculeBuilder.config";

export interface PlacedBond {
  slotA: string;
  slotB: string;
  order: BondOrder;
}

/** How many bond "units" a slot has used so far, given the bonds placed
 *  on the board right now — a double bond counts as 2 toward EACH side,
 *  per BOND_ORDER_WEIGHT, not 1 per connection. */
export function bondCountForSlot(slotId: string, bonds: PlacedBond[]): number {
  return bonds
    .filter((b) => b.slotA === slotId || b.slotB === slotId)
    .reduce((sum, b) => sum + BOND_ORDER_WEIGHT[b.order], 0);
}

/** Looks up an atom's max bond capacity by symbol from the game's
 *  roster. Returns undefined for an unknown symbol rather than throwing
 *  — callers decide how to handle a missing atom def (treated as "can't
 *  bond" by wouldOverfill below, which is the safe default). */
export function atomDefBySymbol(roster: AtomDef[], symbol: string): AtomDef | undefined {
  return roster.find((a) => a.symbol === symbol);
}

/**
 * Would adding this candidate bond push EITHER slot over its placed
 * atom's max capacity? Checked BEFORE the bond is added — the engine
 * calls this on every bond attempt and rejects (red flash, no state
 * change) rather than ever allowing an over-capacity atom to exist, even
 * transiently. This is the literal implementation of "carbon cannot have
 * more than four bonds" from the original game brief.
 *
 * Returns true (blocks the bond) if either slot has no atom placed yet,
 * since there's nothing valid to bond from/to.
 */
export function wouldOverfill(
  candidate: { slotA: string; slotB: string; order: BondOrder },
  placedAtoms: Record<string, string>,
  existingBonds: PlacedBond[],
  roster: AtomDef[]
): boolean {
  const symbolA = placedAtoms[candidate.slotA];
  const symbolB = placedAtoms[candidate.slotB];
  if (!symbolA || !symbolB) return true;

  const defA = atomDefBySymbol(roster, symbolA);
  const defB = atomDefBySymbol(roster, symbolB);
  if (!defA || !defB) return true;

  const weight = BOND_ORDER_WEIGHT[candidate.order];
  const currentA = bondCountForSlot(candidate.slotA, existingBonds);
  const currentB = bondCountForSlot(candidate.slotB, existingBonds);

  return currentA + weight > defA.maxBonds || currentB + weight > defB.maxBonds;
}

/** Whether two slots are already directly bonded (in either direction)
 *  — used to block a duplicate bond attempt on the same pair, since bond
 *  order is fixed at creation time (see config.ts's header comment) and
 *  isn't meant to be upgraded by dragging a second connection onto an
 *  already-bonded pair. To change a bond's order, the player removes it
 *  and re-creates it with the selector set to the order they want. */
export function alreadyBonded(slotA: string, slotB: string, bonds: PlacedBond[]): boolean {
  return bonds.some((b) => (b.slotA === slotA && b.slotB === slotB) || (b.slotA === slotB && b.slotB === slotA));
}

export interface StructureCheckResult {
  correct: boolean;
  /** Present only when correct is false — the FIRST specific mismatch
   *  found, in a fixed check order (missing atoms, then extra atoms,
   *  then each slot's bond count, then bond order mismatches) so
   *  feedback is deterministic and always names one concrete, fixable
   *  thing rather than a vague "something's wrong." */
  mismatch?: {
    kind: "missing_atom" | "extra_atom" | "bond_count" | "bond_order_or_missing";
    slotId?: string;
  };
}

/**
 * Checks the player's built structure against the mission's target.
 * Order/identity of slots matters (slot ids are fixed per mission, not
 * relabeled), so this is a direct lookup comparison, not a graph
 * isomorphism problem — deliberately simple because the slot-based
 * layout (see config.ts's header comment) already pins every atom to a
 * specific named position.
 */
export function checkStructure(
  targetAtoms: Record<string, string>,
  targetBonds: TargetBond[],
  placedAtoms: Record<string, string>,
  placedBonds: PlacedBond[]
): StructureCheckResult {
  for (const slotId of Object.keys(targetAtoms)) {
    if (!placedAtoms[slotId]) {
      return { correct: false, mismatch: { kind: "missing_atom", slotId } };
    }
    if (placedAtoms[slotId] !== targetAtoms[slotId]) {
      return { correct: false, mismatch: { kind: "missing_atom", slotId } };
    }
  }

  for (const slotId of Object.keys(placedAtoms)) {
    if (!targetAtoms[slotId]) {
      return { correct: false, mismatch: { kind: "extra_atom", slotId } };
    }
  }

  for (const target of targetBonds) {
    const placed = placedBonds.find(
      (b) => (b.slotA === target.slotA && b.slotB === target.slotB) || (b.slotA === target.slotB && b.slotB === target.slotA)
    );
    if (!placed || placed.order !== target.order) {
      return { correct: false, mismatch: { kind: "bond_order_or_missing", slotId: target.slotA } };
    }
  }

  if (placedBonds.length !== targetBonds.length) {
    return { correct: false, mismatch: { kind: "bond_count" } };
  }

  return { correct: true };
}

/**
 * Builds specific, teaching feedback text for a wrong Submit — mirrors
 * particleAssembly.logic.ts's buildFeedback shape (a small lookup by
 * mismatch kind, falling back to a generic line only if something truly
 * unexpected happens). Takes the slot definitions so it can name an
 * atom's CURRENT bond count out of its real max, the same "Carbon #2
 * only has 3/4 bonds" specificity decided on in the game spec.
 */
export function buildFeedback(
  result: StructureCheckResult,
  slots: Slot[],
  placedAtoms: Record<string, string>,
  placedBonds: PlacedBond[],
  roster: AtomDef[]
): string {
  if (result.correct || !result.mismatch) {
    return "Not quite — check your structure against the mission card. Try again.";
  }

  const { kind, slotId } = result.mismatch;
  const slot = slotId ? slots.find((s) => s.id === slotId) : undefined;
  const slotLabel = slot ? slot.acceptsSymbols.join("/") : "a slot";

  if (kind === "missing_atom") {
    return `${slotLabel} still needs the right atom placed there. Check the mission card for what belongs in that spot.`;
  }

  if (kind === "extra_atom") {
    return "There's an extra atom on the board that the target molecule doesn't need — remove it and try again.";
  }

  if (kind === "bond_count" || kind === "bond_order_or_missing") {
    if (slotId) {
      const symbol = placedAtoms[slotId];
      const def = symbol ? atomDefBySymbol(roster, symbol) : undefined;
      if (def) {
        const used = bondCountForSlot(slotId, placedBonds);
        return `${def.name} only has ${used} of ${def.maxBonds} bonds filled — check what's still missing or wrong there.`;
      }
    }
    return "A bond is missing or the wrong type — double-check each connection against the mission card.";
  }

  return "Not quite — check your structure against the mission card. Try again.";
}
