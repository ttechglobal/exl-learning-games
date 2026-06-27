/**
 * motion/periodicTableData.ts
 *
 * A deliberately small slice of the periodic table — just the first 18
 * elements (periods 1-3), which covers every element Build The Atom's
 * mission list currently uses (H, He, C, O, Na, Mg) plus enough surrounding
 * context (Li, Be, B, N, F, Ne, Al, Si, P, S, Cl, Ar) for the table to look
 * and feel like a real periodic table rather than a sparse list.
 *
 * Position uses standard IUPAC group (1-18) / period (1-3) coordinates so
 * the layout grid math matches a real periodic table's shape, including
 * the gap for groups 3-12 in periods 1-2 (no transition metals yet at
 * these atomic numbers).
 */

export interface PeriodicElement {
  atomicNumber: number;
  symbol: string;
  name: string;
  group: number; // 1-18, standard IUPAC numbering
  period: number; // 1-3 for this slice
  category: "nonmetal" | "noble-gas" | "alkali-metal" | "alkaline-earth" | "metalloid" | "other-metal" | "halogen";
}

export const PERIODIC_TABLE_SLICE: PeriodicElement[] = [
  { atomicNumber: 1, symbol: "H", name: "Hydrogen", group: 1, period: 1, category: "nonmetal" },
  { atomicNumber: 2, symbol: "He", name: "Helium", group: 18, period: 1, category: "noble-gas" },

  { atomicNumber: 3, symbol: "Li", name: "Lithium", group: 1, period: 2, category: "alkali-metal" },
  { atomicNumber: 4, symbol: "Be", name: "Beryllium", group: 2, period: 2, category: "alkaline-earth" },
  { atomicNumber: 5, symbol: "B", name: "Boron", group: 13, period: 2, category: "metalloid" },
  { atomicNumber: 6, symbol: "C", name: "Carbon", group: 14, period: 2, category: "nonmetal" },
  { atomicNumber: 7, symbol: "N", name: "Nitrogen", group: 15, period: 2, category: "nonmetal" },
  { atomicNumber: 8, symbol: "O", name: "Oxygen", group: 16, period: 2, category: "nonmetal" },
  { atomicNumber: 9, symbol: "F", name: "Fluorine", group: 17, period: 2, category: "halogen" },
  { atomicNumber: 10, symbol: "Ne", name: "Neon", group: 18, period: 2, category: "noble-gas" },

  { atomicNumber: 11, symbol: "Na", name: "Sodium", group: 1, period: 3, category: "alkali-metal" },
  { atomicNumber: 12, symbol: "Mg", name: "Magnesium", group: 2, period: 3, category: "alkaline-earth" },
  { atomicNumber: 13, symbol: "Al", name: "Aluminium", group: 13, period: 3, category: "other-metal" },
  { atomicNumber: 14, symbol: "Si", name: "Silicon", group: 14, period: 3, category: "metalloid" },
  { atomicNumber: 15, symbol: "P", name: "Phosphorus", group: 15, period: 3, category: "nonmetal" },
  { atomicNumber: 16, symbol: "S", name: "Sulfur", group: 16, period: 3, category: "nonmetal" },
  { atomicNumber: 17, symbol: "Cl", name: "Chlorine", group: 17, period: 3, category: "halogen" },
  { atomicNumber: 18, symbol: "Ar", name: "Argon", group: 18, period: 3, category: "noble-gas" }
];

export const CATEGORY_COLORS: Record<PeriodicElement["category"], string> = {
  nonmetal: "#7b4fcb",
  "noble-gas": "#ff6f91",
  "alkali-metal": "#ffb23c",
  "alkaline-earth": "#4caf6e",
  metalloid: "#8b7fa3",
  "other-metal": "#8b7fa3",
  halogen: "#2f9bd6"
};

export function getElementByAtomicNumber(atomicNumber: number): PeriodicElement | undefined {
  return PERIODIC_TABLE_SLICE.find((e) => e.atomicNumber === atomicNumber);
}
