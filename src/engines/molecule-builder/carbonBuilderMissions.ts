/**
 * engines/molecule-builder/carbonBuilderMissions.ts
 *
 * The actual mission content for Carbon Builder — one entry per mission
 * in docs/carbon-builder.md's Section 4 table, hand-verified against real
 * molecular formulas before being encoded here (every atom's bond count
 * sums to exactly its maxBonds; every molecule's H count matches its real
 * formula). See the comment above each mission for that check.
 *
 * Grid layout convention: carbons sit in a single horizontal row at
 * row 0, one column apart, in the order they're chain-bonded. Each
 * carbon's hydrogens/branches sit at row -1 (above) and row 1 (below) in
 * that carbon's column, so the rendered shape always reads left-to-right
 * as the real carbon backbone with substituents branching off it —
 * matching how a structural formula is normally drawn, not an arbitrary
 * arrangement. This is content, not engine logic — a future
 * molecule-builder game with a different shape (e.g. a ring) would
 * define its own slot layout, not change how this file lays out chains.
 */

import type { MoleculeBuilderMissionPayload } from "@/engines/molecule-builder/moleculeBuilder.config";

/**
 * MISSION 0a — Hydrogen gas (H2) — Easy (warm-up)
 * Added as a pre-Methane warm-up per a later round of feedback: the
 * smallest possible molecule — two atoms, one bond, both reaching their
 * cap (1) at the same moment. No asymmetry, no carbon, no counting past
 * 1. Isolates the core rule ("an atom's own number is a hard cap, and
 * one bond uses up exactly 1 of it") before Methane scales that same
 * rule up to a much bigger number (4) with four bonds at once.
 * Check: h1=h2=1/1 each. Formula H2. ✓
 */
export const HYDROGEN_GAS_MISSION: MoleculeBuilderMissionPayload = {
  slots: [
    { id: "h1", acceptsSymbols: ["H"], bondableTo: ["h2"], row: 0, col: 0 },
    { id: "h2", acceptsSymbols: ["H"], bondableTo: ["h1"], row: 0, col: 1 }
  ],
  targetAtoms: { h1: "H", h2: "H" },
  targetBonds: [{ slotA: "h1", slotB: "h2", order: "single" }],
  dockSymbols: ["H"],
  resultLabel: "Hydrogen gas (H\u2082)"
};

/**
 * MISSION 0b — Water (H2O) — Easy (warm-up)
 * First mission where two DIFFERENT atoms with two DIFFERENT caps
 * appear together, and the first "central atom with branches" shape —
 * both ideas Methane will need, rehearsed here with a smaller, more
 * familiar molecule first.
 * Check: o1=h1+h2=2/2. h1=o1=1/1. h2=o1=1/1. Formula H2O. ✓
 */
export const WATER_MISSION: MoleculeBuilderMissionPayload = {
  slots: [
    { id: "o1", acceptsSymbols: ["O"], bondableTo: ["h1", "h2"], row: 0, col: 0 },
    { id: "h1", acceptsSymbols: ["H"], bondableTo: ["o1"], row: -1, col: 0 },
    { id: "h2", acceptsSymbols: ["H"], bondableTo: ["o1"], row: 1, col: 0 }
  ],
  targetAtoms: { o1: "O", h1: "H", h2: "H" },
  targetBonds: [
    { slotA: "o1", slotB: "h1", order: "single" },
    { slotA: "o1", slotB: "h2", order: "single" }
  ],
  dockSymbols: ["O", "H"],
  resultLabel: "Water (H\u2082O)"
};

/**
 * MISSION 0c — Chlorine gas (Cl2) — Easy (warm-up)
 * Reinforces Mission 0a's "single bond, matching caps" pattern with a
 * new atom on screen, right before Methane introduces carbon — the last
 * rehearsal of "this atom's own number is the rule" before the number
 * involved jumps from 1/2 up to 4.
 * Check: cl1=cl2=1/1 each. Formula Cl2. ✓
 */
export const CHLORINE_GAS_MISSION: MoleculeBuilderMissionPayload = {
  slots: [
    { id: "cl1", acceptsSymbols: ["Cl"], bondableTo: ["cl2"], row: 0, col: 0 },
    { id: "cl2", acceptsSymbols: ["Cl"], bondableTo: ["cl1"], row: 0, col: 1 }
  ],
  targetAtoms: { cl1: "Cl", cl2: "Cl" },
  targetBonds: [{ slotA: "cl1", slotB: "cl2", order: "single" }],
  dockSymbols: ["Cl"],
  resultLabel: "Chlorine gas (Cl\u2082)"
};

/**
 * MISSION 1 — Methane (CH4) — Easy
 * One carbon, four single bonds to hydrogen, all four slots filled
 * exactly to capacity. Introduces the 4-bond limit with nothing else to
 * think about yet.
 * Check: C bonds = h1+h2+h3+h4 = 4/4. Each H = 1/1. Formula CH4. ✓
 */
export const METHANE_MISSION: MoleculeBuilderMissionPayload = {
  slots: [
    { id: "c1", acceptsSymbols: ["C"], bondableTo: ["h1", "h2", "h3", "h4"], row: 0, col: 0 },
    { id: "h1", acceptsSymbols: ["H"], bondableTo: ["c1"], row: -1, col: 0 },
    { id: "h2", acceptsSymbols: ["H"], bondableTo: ["c1"], row: 1, col: 0 },
    { id: "h3", acceptsSymbols: ["H"], bondableTo: ["c1"], row: 0, col: -1 },
    { id: "h4", acceptsSymbols: ["H"], bondableTo: ["c1"], row: 0, col: 1 }
  ],
  targetAtoms: { c1: "C", h1: "H", h2: "H", h3: "H", h4: "H" },
  targetBonds: [
    { slotA: "c1", slotB: "h1", order: "single" },
    { slotA: "c1", slotB: "h2", order: "single" },
    { slotA: "c1", slotB: "h3", order: "single" },
    { slotA: "c1", slotB: "h4", order: "single" }
  ],
  dockSymbols: ["C", "H"],
  resultLabel: "Methane (CH\u2084)"
};

/**
 * MISSION 2 — Ethane (C2H6) — Medium
 * Two carbons. The C-C bond uses up 1 of EACH carbon's 4 slots — the
 * actual teaching point of this mission, per the spec ("C-C bond counts
 * as one bond; remaining bonds filled with hydrogen").
 * Check: c1 = c2+h1+h2+h3 = 4/4. c2 = c1+h4+h5+h6 = 4/4. Formula C2H6. ✓
 */
export const ETHANE_MISSION: MoleculeBuilderMissionPayload = {
  slots: [
    { id: "c1", acceptsSymbols: ["C"], bondableTo: ["c2", "h1", "h2", "h3"], row: 0, col: 0 },
    { id: "c2", acceptsSymbols: ["C"], bondableTo: ["c1", "h4", "h5", "h6"], row: 0, col: 1 },
    { id: "h1", acceptsSymbols: ["H"], bondableTo: ["c1"], row: -1, col: 0 },
    { id: "h2", acceptsSymbols: ["H"], bondableTo: ["c1"], row: 1, col: 0 },
    { id: "h3", acceptsSymbols: ["H"], bondableTo: ["c1"], row: 0, col: -1 },
    { id: "h4", acceptsSymbols: ["H"], bondableTo: ["c2"], row: -1, col: 1 },
    { id: "h5", acceptsSymbols: ["H"], bondableTo: ["c2"], row: 1, col: 1 },
    { id: "h6", acceptsSymbols: ["H"], bondableTo: ["c2"], row: 0, col: 2 }
  ],
  targetAtoms: { c1: "C", c2: "C", h1: "H", h2: "H", h3: "H", h4: "H", h5: "H", h6: "H" },
  targetBonds: [
    { slotA: "c1", slotB: "c2", order: "single" },
    { slotA: "c1", slotB: "h1", order: "single" },
    { slotA: "c1", slotB: "h2", order: "single" },
    { slotA: "c1", slotB: "h3", order: "single" },
    { slotA: "c2", slotB: "h4", order: "single" },
    { slotA: "c2", slotB: "h5", order: "single" },
    { slotA: "c2", slotB: "h6", order: "single" }
  ],
  dockSymbols: ["C", "H"],
  resultLabel: "Ethane (C\u2082H\u2086)"
};

/**
 * MISSION 3 — Propane (C3H8) — Medium
 * Three carbons in a chain; the middle carbon now bonds to TWO other
 * carbons (1 slot each), leaving only 2 slots for hydrogen — the first
 * time a carbon's hydrogen count is reduced by chain position, not just
 * by the presence of a neighbor.
 * Check: c1=c2+3H=4. c2=c1+c3+2H=4. c3=c2+3H=4. Formula C3H8. ✓
 */
export const PROPANE_MISSION: MoleculeBuilderMissionPayload = {
  slots: [
    { id: "c1", acceptsSymbols: ["C"], bondableTo: ["c2", "h1", "h2", "h3"], row: 0, col: 0 },
    { id: "c2", acceptsSymbols: ["C"], bondableTo: ["c1", "c3", "h4", "h5"], row: 0, col: 1 },
    { id: "c3", acceptsSymbols: ["C"], bondableTo: ["c2", "h6", "h7", "h8"], row: 0, col: 2 },
    { id: "h1", acceptsSymbols: ["H"], bondableTo: ["c1"], row: -1, col: 0 },
    { id: "h2", acceptsSymbols: ["H"], bondableTo: ["c1"], row: 1, col: 0 },
    { id: "h3", acceptsSymbols: ["H"], bondableTo: ["c1"], row: 0, col: -1 },
    { id: "h4", acceptsSymbols: ["H"], bondableTo: ["c2"], row: -1, col: 1 },
    { id: "h5", acceptsSymbols: ["H"], bondableTo: ["c2"], row: 1, col: 1 },
    { id: "h6", acceptsSymbols: ["H"], bondableTo: ["c3"], row: -1, col: 2 },
    { id: "h7", acceptsSymbols: ["H"], bondableTo: ["c3"], row: 1, col: 2 },
    { id: "h8", acceptsSymbols: ["H"], bondableTo: ["c3"], row: 0, col: 3 }
  ],
  targetAtoms: {
    c1: "C", c2: "C", c3: "C",
    h1: "H", h2: "H", h3: "H", h4: "H", h5: "H", h6: "H", h7: "H", h8: "H"
  },
  targetBonds: [
    { slotA: "c1", slotB: "c2", order: "single" },
    { slotA: "c2", slotB: "c3", order: "single" },
    { slotA: "c1", slotB: "h1", order: "single" },
    { slotA: "c1", slotB: "h2", order: "single" },
    { slotA: "c1", slotB: "h3", order: "single" },
    { slotA: "c2", slotB: "h4", order: "single" },
    { slotA: "c2", slotB: "h5", order: "single" },
    { slotA: "c3", slotB: "h6", order: "single" },
    { slotA: "c3", slotB: "h7", order: "single" },
    { slotA: "c3", slotB: "h8", order: "single" }
  ],
  dockSymbols: ["C", "H"],
  resultLabel: "Propane (C\u2083H\u2088)"
};

/**
 * MISSION 4 — Butane (C4H10) — Medium
 * Four-carbon chain; two middle carbons now each have 2 neighbors + 2 H.
 * Check: c1=c2+3H=4. c2=c1+c3+2H=4. c3=c2+c4+2H=4. c4=c3+3H=4.
 * Formula C4H10. ✓
 */
export const BUTANE_MISSION: MoleculeBuilderMissionPayload = {
  slots: [
    { id: "c1", acceptsSymbols: ["C"], bondableTo: ["c2", "h1", "h2", "h3"], row: 0, col: 0 },
    { id: "c2", acceptsSymbols: ["C"], bondableTo: ["c1", "c3", "h4", "h5"], row: 0, col: 1 },
    { id: "c3", acceptsSymbols: ["C"], bondableTo: ["c2", "c4", "h6", "h7"], row: 0, col: 2 },
    { id: "c4", acceptsSymbols: ["C"], bondableTo: ["c3", "h8", "h9", "h10"], row: 0, col: 3 },
    { id: "h1", acceptsSymbols: ["H"], bondableTo: ["c1"], row: -1, col: 0 },
    { id: "h2", acceptsSymbols: ["H"], bondableTo: ["c1"], row: 1, col: 0 },
    { id: "h3", acceptsSymbols: ["H"], bondableTo: ["c1"], row: 0, col: -1 },
    { id: "h4", acceptsSymbols: ["H"], bondableTo: ["c2"], row: -1, col: 1 },
    { id: "h5", acceptsSymbols: ["H"], bondableTo: ["c2"], row: 1, col: 1 },
    { id: "h6", acceptsSymbols: ["H"], bondableTo: ["c3"], row: -1, col: 2 },
    { id: "h7", acceptsSymbols: ["H"], bondableTo: ["c3"], row: 1, col: 2 },
    { id: "h8", acceptsSymbols: ["H"], bondableTo: ["c4"], row: -1, col: 3 },
    { id: "h9", acceptsSymbols: ["H"], bondableTo: ["c4"], row: 1, col: 3 },
    { id: "h10", acceptsSymbols: ["H"], bondableTo: ["c4"], row: 0, col: 4 }
  ],
  targetAtoms: {
    c1: "C", c2: "C", c3: "C", c4: "C",
    h1: "H", h2: "H", h3: "H", h4: "H", h5: "H", h6: "H", h7: "H", h8: "H", h9: "H", h10: "H"
  },
  targetBonds: [
    { slotA: "c1", slotB: "c2", order: "single" },
    { slotA: "c2", slotB: "c3", order: "single" },
    { slotA: "c3", slotB: "c4", order: "single" },
    { slotA: "c1", slotB: "h1", order: "single" },
    { slotA: "c1", slotB: "h2", order: "single" },
    { slotA: "c1", slotB: "h3", order: "single" },
    { slotA: "c2", slotB: "h4", order: "single" },
    { slotA: "c2", slotB: "h5", order: "single" },
    { slotA: "c3", slotB: "h6", order: "single" },
    { slotA: "c3", slotB: "h7", order: "single" },
    { slotA: "c4", slotB: "h8", order: "single" },
    { slotA: "c4", slotB: "h9", order: "single" },
    { slotA: "c4", slotB: "h10", order: "single" }
  ],
  dockSymbols: ["C", "H"],
  resultLabel: "Butane (C\u2084H\u2081\u2080)"
};

/**
 * MISSION 5 — Pentane (C5H12) — Medium
 * Five-carbon chain; the last mission in the "longer single-bond chains"
 * progression before Hard tier introduces multiple bonds and branching.
 * Check: ends (c1,c5)=3H each. middles (c2,c3,c4)=2H each. H=12.
 * Formula C5H12. ✓
 */
export const PENTANE_MISSION: MoleculeBuilderMissionPayload = {
  slots: [
    { id: "c1", acceptsSymbols: ["C"], bondableTo: ["c2", "h1", "h2", "h3"], row: 0, col: 0 },
    { id: "c2", acceptsSymbols: ["C"], bondableTo: ["c1", "c3", "h4", "h5"], row: 0, col: 1 },
    { id: "c3", acceptsSymbols: ["C"], bondableTo: ["c2", "c4", "h6", "h7"], row: 0, col: 2 },
    { id: "c4", acceptsSymbols: ["C"], bondableTo: ["c3", "c5", "h8", "h9"], row: 0, col: 3 },
    { id: "c5", acceptsSymbols: ["C"], bondableTo: ["c4", "h10", "h11", "h12"], row: 0, col: 4 },
    { id: "h1", acceptsSymbols: ["H"], bondableTo: ["c1"], row: -1, col: 0 },
    { id: "h2", acceptsSymbols: ["H"], bondableTo: ["c1"], row: 1, col: 0 },
    { id: "h3", acceptsSymbols: ["H"], bondableTo: ["c1"], row: 0, col: -1 },
    { id: "h4", acceptsSymbols: ["H"], bondableTo: ["c2"], row: -1, col: 1 },
    { id: "h5", acceptsSymbols: ["H"], bondableTo: ["c2"], row: 1, col: 1 },
    { id: "h6", acceptsSymbols: ["H"], bondableTo: ["c3"], row: -1, col: 2 },
    { id: "h7", acceptsSymbols: ["H"], bondableTo: ["c3"], row: 1, col: 2 },
    { id: "h8", acceptsSymbols: ["H"], bondableTo: ["c4"], row: -1, col: 3 },
    { id: "h9", acceptsSymbols: ["H"], bondableTo: ["c4"], row: 1, col: 3 },
    { id: "h10", acceptsSymbols: ["H"], bondableTo: ["c5"], row: -1, col: 4 },
    { id: "h11", acceptsSymbols: ["H"], bondableTo: ["c5"], row: 1, col: 4 },
    { id: "h12", acceptsSymbols: ["H"], bondableTo: ["c5"], row: 0, col: 5 }
  ],
  targetAtoms: {
    c1: "C", c2: "C", c3: "C", c4: "C", c5: "C",
    h1: "H", h2: "H", h3: "H", h4: "H", h5: "H", h6: "H",
    h7: "H", h8: "H", h9: "H", h10: "H", h11: "H", h12: "H"
  },
  targetBonds: [
    { slotA: "c1", slotB: "c2", order: "single" },
    { slotA: "c2", slotB: "c3", order: "single" },
    { slotA: "c3", slotB: "c4", order: "single" },
    { slotA: "c4", slotB: "c5", order: "single" },
    { slotA: "c1", slotB: "h1", order: "single" },
    { slotA: "c1", slotB: "h2", order: "single" },
    { slotA: "c1", slotB: "h3", order: "single" },
    { slotA: "c2", slotB: "h4", order: "single" },
    { slotA: "c2", slotB: "h5", order: "single" },
    { slotA: "c3", slotB: "h6", order: "single" },
    { slotA: "c3", slotB: "h7", order: "single" },
    { slotA: "c4", slotB: "h8", order: "single" },
    { slotA: "c4", slotB: "h9", order: "single" },
    { slotA: "c5", slotB: "h10", order: "single" },
    { slotA: "c5", slotB: "h11", order: "single" },
    { slotA: "c5", slotB: "h12", order: "single" }
  ],
  dockSymbols: ["C", "H"],
  resultLabel: "Pentane (C\u2085H\u2081\u2082)"
};

/**
 * MISSION 6 — Ethene (C2H4) — Hard
 * Double bond between the two carbons consumes 2 of EACH carbon's 4
 * slots by itself — the actual teaching point named in the original
 * brief. Only 2 slots remain per carbon, so only 2 H each instead of
 * ethane's 3 each, even though it's still "two carbons."
 * Check: c1=c2(double,weight2)+2H=4. c2=c1(weight2)+2H=4. Formula C2H4. ✓
 */
export const ETHENE_MISSION: MoleculeBuilderMissionPayload = {
  slots: [
    { id: "c1", acceptsSymbols: ["C"], bondableTo: ["c2", "h1", "h2"], row: 0, col: 0 },
    { id: "c2", acceptsSymbols: ["C"], bondableTo: ["c1", "h3", "h4"], row: 0, col: 1 },
    { id: "h1", acceptsSymbols: ["H"], bondableTo: ["c1"], row: -1, col: 0 },
    { id: "h2", acceptsSymbols: ["H"], bondableTo: ["c1"], row: 1, col: 0 },
    { id: "h3", acceptsSymbols: ["H"], bondableTo: ["c2"], row: -1, col: 1 },
    { id: "h4", acceptsSymbols: ["H"], bondableTo: ["c2"], row: 1, col: 1 }
  ],
  targetAtoms: { c1: "C", c2: "C", h1: "H", h2: "H", h3: "H", h4: "H" },
  targetBonds: [
    { slotA: "c1", slotB: "c2", order: "double" },
    { slotA: "c1", slotB: "h1", order: "single" },
    { slotA: "c1", slotB: "h2", order: "single" },
    { slotA: "c2", slotB: "h3", order: "single" },
    { slotA: "c2", slotB: "h4", order: "single" }
  ],
  dockSymbols: ["C", "H"],
  resultLabel: "Ethene (C\u2082H\u2084)"
};

/**
 * MISSION 7 — Ethyne / Acetylene (C2H2) — Hard
 * Triple bond consumes 3 of EACH carbon's 4 slots, leaving exactly 1
 * slot per carbon for a single hydrogen — the most constrained molecule
 * in this mission set, and the natural next step after Mission 6's
 * double bond.
 * Check: c1=c2(triple,weight3)+1H=4. c2=c1(weight3)+1H=4. Formula C2H2. ✓
 */
export const ETHYNE_MISSION: MoleculeBuilderMissionPayload = {
  slots: [
    { id: "c1", acceptsSymbols: ["C"], bondableTo: ["c2", "h1"], row: 0, col: 0 },
    { id: "c2", acceptsSymbols: ["C"], bondableTo: ["c1", "h2"], row: 0, col: 1 },
    { id: "h1", acceptsSymbols: ["H"], bondableTo: ["c1"], row: 0, col: -1 },
    { id: "h2", acceptsSymbols: ["H"], bondableTo: ["c2"], row: 0, col: 2 }
  ],
  targetAtoms: { c1: "C", c2: "C", h1: "H", h2: "H" },
  targetBonds: [
    { slotA: "c1", slotB: "c2", order: "triple" },
    { slotA: "c1", slotB: "h1", order: "single" },
    { slotA: "c2", slotB: "h2", order: "single" }
  ],
  dockSymbols: ["C", "H"],
  resultLabel: "Ethyne / Acetylene (C\u2082H\u2082)"
};

/**
 * MISSION 8 — Isobutane / 2-Methylpropane (C4H10, branched) — Hard
 * Same molecular FORMULA as Mission 4's butane (C4H10) but a different
 * STRUCTURE — c2 is a branch point bonded to three other carbons at
 * once instead of a straight chain. This is the actual teaching point:
 * tetravalency allows branching, not just linear chains, and two
 * molecules can share a formula while being genuinely different
 * compounds.
 * Check: c2(branch)=c1+c3+c4+1H=4. c1,c3,c4(terminal)=c2+3H each=4.
 * H = 1+3+3+3 = 10. Formula C4H10. ✓
 */
export const ISOBUTANE_MISSION: MoleculeBuilderMissionPayload = {
  slots: [
    { id: "c2", acceptsSymbols: ["C"], bondableTo: ["c1", "c3", "c4", "h10"], row: 0, col: 1 },
    { id: "c1", acceptsSymbols: ["C"], bondableTo: ["c2", "h1", "h2", "h3"], row: 0, col: 0 },
    { id: "c3", acceptsSymbols: ["C"], bondableTo: ["c2", "h4", "h5", "h6"], row: 0, col: 2 },
    { id: "c4", acceptsSymbols: ["C"], bondableTo: ["c2", "h7", "h8", "h9"], row: 1, col: 1 },
    { id: "h1", acceptsSymbols: ["H"], bondableTo: ["c1"], row: -1, col: 0 },
    { id: "h2", acceptsSymbols: ["H"], bondableTo: ["c1"], row: 0, col: -1 },
    { id: "h3", acceptsSymbols: ["H"], bondableTo: ["c1"], row: 1, col: 0 },
    { id: "h4", acceptsSymbols: ["H"], bondableTo: ["c3"], row: -1, col: 2 },
    { id: "h5", acceptsSymbols: ["H"], bondableTo: ["c3"], row: 0, col: 3 },
    { id: "h6", acceptsSymbols: ["H"], bondableTo: ["c3"], row: 1, col: 2 },
    { id: "h7", acceptsSymbols: ["H"], bondableTo: ["c4"], row: 2, col: 0 },
    { id: "h8", acceptsSymbols: ["H"], bondableTo: ["c4"], row: 2, col: 1 },
    { id: "h9", acceptsSymbols: ["H"], bondableTo: ["c4"], row: 2, col: 2 },
    { id: "h10", acceptsSymbols: ["H"], bondableTo: ["c2"], row: -1, col: 1 }
  ],
  targetAtoms: {
    c1: "C", c2: "C", c3: "C", c4: "C",
    h1: "H", h2: "H", h3: "H", h4: "H", h5: "H", h6: "H", h7: "H", h8: "H", h9: "H", h10: "H"
  },
  targetBonds: [
    { slotA: "c2", slotB: "c1", order: "single" },
    { slotA: "c2", slotB: "c3", order: "single" },
    { slotA: "c2", slotB: "c4", order: "single" },
    { slotA: "c2", slotB: "h10", order: "single" },
    { slotA: "c1", slotB: "h1", order: "single" },
    { slotA: "c1", slotB: "h2", order: "single" },
    { slotA: "c1", slotB: "h3", order: "single" },
    { slotA: "c3", slotB: "h4", order: "single" },
    { slotA: "c3", slotB: "h5", order: "single" },
    { slotA: "c3", slotB: "h6", order: "single" },
    { slotA: "c4", slotB: "h7", order: "single" },
    { slotA: "c4", slotB: "h8", order: "single" },
    { slotA: "c4", slotB: "h9", order: "single" }
  ],
  dockSymbols: ["C", "H"],
  resultLabel: "Isobutane (C\u2084H\u2081\u2080, branched)"
};

export const CARBON_BUILDER_MISSIONS_BY_KEY: Record<string, MoleculeBuilderMissionPayload> = {
  "carbon-builder-hydrogen-gas": HYDROGEN_GAS_MISSION,
  "carbon-builder-water": WATER_MISSION,
  "carbon-builder-chlorine-gas": CHLORINE_GAS_MISSION,
  "carbon-builder-methane": METHANE_MISSION,
  "carbon-builder-ethane": ETHANE_MISSION,
  "carbon-builder-propane": PROPANE_MISSION,
  "carbon-builder-butane": BUTANE_MISSION,
  "carbon-builder-pentane": PENTANE_MISSION,
  "carbon-builder-ethene": ETHENE_MISSION,
  "carbon-builder-ethyne": ETHYNE_MISSION,
  "carbon-builder-isobutane": ISOBUTANE_MISSION
};

/**
 * Explicit ordering for the locked-path Track Map (see
 * TrackMapScreen.tsx) — this is the literal sequence the player
 * progresses through, independent of whatever order Object.entries()
 * would otherwise yield or whatever sequence_index ends up stored in
 * the DB. Authoring this list once here means content order and the
 * keys-map above can't silently drift apart.
 */
export const CARBON_BUILDER_MISSION_ORDER: string[] = [
  "carbon-builder-hydrogen-gas",
  "carbon-builder-water",
  "carbon-builder-chlorine-gas",
  "carbon-builder-methane",
  "carbon-builder-ethane",
  "carbon-builder-propane",
  "carbon-builder-butane",
  "carbon-builder-pentane",
  "carbon-builder-ethene",
  "carbon-builder-ethyne",
  "carbon-builder-isobutane"
];
