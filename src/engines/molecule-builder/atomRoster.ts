/**
 * engines/molecule-builder/atomRoster.ts
 *
 * Atom dataset for molecule-builder games (Carbon Builder being the
 * first) — same per-engine-dataset convention as
 * engines/tile-match/elementData.ts and engines/bond-match/bondData.ts.
 * Neither of those files stores bond capacity, since neither engine
 * needs it; this is new content specific to this engine, per
 * docs/carbon-builder.md Section 2.
 *
 * Deliberately minimal roster for Carbon Builder's first mission set
 * (only C and H are needed through Mission 5; O and Cl are included
 * ahead of any mission that uses them, per the spec's note to keep the
 * roster from being built "too narrow" — extend this table, not the
 * engine, when a future mission needs another atom).
 */

import type { AtomDef } from "@/engines/molecule-builder/moleculeBuilder.config";

export const CARBON_BUILDER_ATOMS: AtomDef[] = [
  { symbol: "C", name: "Carbon", maxBonds: 4, hex: "#2f9bd6" },
  { symbol: "H", name: "Hydrogen", maxBonds: 1, hex: "#dcd6ff" },
  { symbol: "O", name: "Oxygen", maxBonds: 2, hex: "#ff6f91" },
  { symbol: "Cl", name: "Chlorine", maxBonds: 1, hex: "#7ee0c3" }
];

export function atomDefBySymbol(symbol: string): AtomDef | undefined {
  return CARBON_BUILDER_ATOMS.find((a) => a.symbol === symbol);
}
