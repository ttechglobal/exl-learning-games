/**
 * engines/tile-match/elementData.ts
 *
 * Element dataset for tile-match-based games (Element Hunter being the
 * first). Expanded from an earlier 18-element prototype to the first 36
 * elements (periods 1-4, through Krypton) per the Element Hunter spec —
 * "more elements" was an explicit content-scope fix, not cosmetic.
 *
 * Stops at period 4 / Krypton deliberately: periods 5+ introduce d-block
 * transition metals with more complex electron configurations than this
 * game's valence-electron clue type is designed to represent simply.
 * Extend here, not by special-casing the engine, if that's needed later.
 */

export type ElementGroup =
  | "alkali metal"
  | "alkaline earth metal"
  | "transition metal"
  | "metalloid"
  | "nonmetal"
  | "halogen"
  | "noble gas"
  | "metal";

export interface HunterElement {
  symbol: string;
  name: string;
  number: number;
  group: ElementGroup;
  valence: number;
  hex: string;
}

// A small fixed palette, cycled by group so same-group elements share a
// family resemblance without needing a unique color per element.
const GROUP_COLORS: Record<ElementGroup, string> = {
  "alkali metal": "#ffb23c",
  "alkaline earth metal": "#4caf6e",
  "transition metal": "#c97b4e",
  metalloid: "#8b7fa3",
  nonmetal: "#2f9bd6",
  halogen: "#7ee0c3",
  "noble gas": "#ff6f91",
  metal: "#7b4fcb"
};

export const HUNTER_ELEMENTS: HunterElement[] = [
  { symbol: "H", name: "Hydrogen", number: 1, group: "nonmetal", valence: 1, hex: GROUP_COLORS.nonmetal },
  { symbol: "He", name: "Helium", number: 2, group: "noble gas", valence: 2, hex: GROUP_COLORS["noble gas"] },
  { symbol: "Li", name: "Lithium", number: 3, group: "alkali metal", valence: 1, hex: GROUP_COLORS["alkali metal"] },
  { symbol: "Be", name: "Beryllium", number: 4, group: "alkaline earth metal", valence: 2, hex: GROUP_COLORS["alkaline earth metal"] },
  { symbol: "B", name: "Boron", number: 5, group: "metalloid", valence: 3, hex: GROUP_COLORS.metalloid },
  { symbol: "C", name: "Carbon", number: 6, group: "nonmetal", valence: 4, hex: GROUP_COLORS.nonmetal },
  { symbol: "N", name: "Nitrogen", number: 7, group: "nonmetal", valence: 5, hex: GROUP_COLORS.nonmetal },
  { symbol: "O", name: "Oxygen", number: 8, group: "nonmetal", valence: 6, hex: GROUP_COLORS.nonmetal },
  { symbol: "F", name: "Fluorine", number: 9, group: "halogen", valence: 7, hex: GROUP_COLORS.halogen },
  { symbol: "Ne", name: "Neon", number: 10, group: "noble gas", valence: 8, hex: GROUP_COLORS["noble gas"] },
  { symbol: "Na", name: "Sodium", number: 11, group: "alkali metal", valence: 1, hex: GROUP_COLORS["alkali metal"] },
  { symbol: "Mg", name: "Magnesium", number: 12, group: "alkaline earth metal", valence: 2, hex: GROUP_COLORS["alkaline earth metal"] },
  { symbol: "Al", name: "Aluminium", number: 13, group: "metal", valence: 3, hex: GROUP_COLORS.metal },
  { symbol: "Si", name: "Silicon", number: 14, group: "metalloid", valence: 4, hex: GROUP_COLORS.metalloid },
  { symbol: "P", name: "Phosphorus", number: 15, group: "nonmetal", valence: 5, hex: GROUP_COLORS.nonmetal },
  { symbol: "S", name: "Sulfur", number: 16, group: "nonmetal", valence: 6, hex: GROUP_COLORS.nonmetal },
  { symbol: "Cl", name: "Chlorine", number: 17, group: "halogen", valence: 7, hex: GROUP_COLORS.halogen },
  { symbol: "Ar", name: "Argon", number: 18, group: "noble gas", valence: 8, hex: GROUP_COLORS["noble gas"] },
  { symbol: "K", name: "Potassium", number: 19, group: "alkali metal", valence: 1, hex: GROUP_COLORS["alkali metal"] },
  { symbol: "Ca", name: "Calcium", number: 20, group: "alkaline earth metal", valence: 2, hex: GROUP_COLORS["alkaline earth metal"] },
  { symbol: "Sc", name: "Scandium", number: 21, group: "transition metal", valence: 2, hex: GROUP_COLORS["transition metal"] },
  { symbol: "Ti", name: "Titanium", number: 22, group: "transition metal", valence: 2, hex: GROUP_COLORS["transition metal"] },
  { symbol: "V", name: "Vanadium", number: 23, group: "transition metal", valence: 2, hex: GROUP_COLORS["transition metal"] },
  { symbol: "Cr", name: "Chromium", number: 24, group: "transition metal", valence: 1, hex: GROUP_COLORS["transition metal"] },
  { symbol: "Mn", name: "Manganese", number: 25, group: "transition metal", valence: 2, hex: GROUP_COLORS["transition metal"] },
  { symbol: "Fe", name: "Iron", number: 26, group: "transition metal", valence: 2, hex: GROUP_COLORS["transition metal"] },
  { symbol: "Co", name: "Cobalt", number: 27, group: "transition metal", valence: 2, hex: GROUP_COLORS["transition metal"] },
  { symbol: "Ni", name: "Nickel", number: 28, group: "transition metal", valence: 2, hex: GROUP_COLORS["transition metal"] },
  { symbol: "Cu", name: "Copper", number: 29, group: "transition metal", valence: 1, hex: GROUP_COLORS["transition metal"] },
  { symbol: "Zn", name: "Zinc", number: 30, group: "transition metal", valence: 2, hex: GROUP_COLORS["transition metal"] },
  { symbol: "Ga", name: "Gallium", number: 31, group: "metal", valence: 3, hex: GROUP_COLORS.metal },
  { symbol: "Ge", name: "Germanium", number: 32, group: "metalloid", valence: 4, hex: GROUP_COLORS.metalloid },
  { symbol: "As", name: "Arsenic", number: 33, group: "metalloid", valence: 5, hex: GROUP_COLORS.metalloid },
  { symbol: "Se", name: "Selenium", number: 34, group: "nonmetal", valence: 6, hex: GROUP_COLORS.nonmetal },
  { symbol: "Br", name: "Bromine", number: 35, group: "halogen", valence: 7, hex: GROUP_COLORS.halogen },
  { symbol: "Kr", name: "Krypton", number: 36, group: "noble gas", valence: 8, hex: GROUP_COLORS["noble gas"] }
];

export function elementBySymbol(symbol: string): HunterElement | undefined {
  return HUNTER_ELEMENTS.find((e) => e.symbol === symbol);
}
