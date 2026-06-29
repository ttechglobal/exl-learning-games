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
 *
 * `period` and `mass` were added alongside the Easy/Medium/Hard clue-type
 * segregation (see difficultyModifiers.ts's tile-match entry): `period`
 * backs the Medium-tier "find an element in Period N" clue, and `mass`
 * backs the Hard-tier "find an element with Mass Number N" clue. Mass is
 * the standard atomic weight rounded to the nearest whole number — kept
 * simple on purpose, since the game is teaching element identification,
 * not isotope-level precision.
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
  /** Period (row) on the periodic table, 1-4 for this dataset's range. */
  period: number;
  group: ElementGroup;
  valence: number;
  /** Standard atomic weight, rounded to the nearest whole number — kept
   *  simple deliberately (no decimals) since this is the Hard-tier clue
   *  type and the audience is identifying elements, not doing precision
   *  chemistry. */
  mass: number;
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
  { symbol: "H", name: "Hydrogen", number: 1, period: 1, group: "nonmetal", valence: 1, mass: 1, hex: GROUP_COLORS.nonmetal },
  { symbol: "He", name: "Helium", number: 2, period: 1, group: "noble gas", valence: 2, mass: 4, hex: GROUP_COLORS["noble gas"] },
  { symbol: "Li", name: "Lithium", number: 3, period: 2, group: "alkali metal", valence: 1, mass: 7, hex: GROUP_COLORS["alkali metal"] },
  { symbol: "Be", name: "Beryllium", number: 4, period: 2, group: "alkaline earth metal", valence: 2, mass: 9, hex: GROUP_COLORS["alkaline earth metal"] },
  { symbol: "B", name: "Boron", number: 5, period: 2, group: "metalloid", valence: 3, mass: 11, hex: GROUP_COLORS.metalloid },
  { symbol: "C", name: "Carbon", number: 6, period: 2, group: "nonmetal", valence: 4, mass: 12, hex: GROUP_COLORS.nonmetal },
  { symbol: "N", name: "Nitrogen", number: 7, period: 2, group: "nonmetal", valence: 5, mass: 14, hex: GROUP_COLORS.nonmetal },
  { symbol: "O", name: "Oxygen", number: 8, period: 2, group: "nonmetal", valence: 6, mass: 16, hex: GROUP_COLORS.nonmetal },
  { symbol: "F", name: "Fluorine", number: 9, period: 2, group: "halogen", valence: 7, mass: 19, hex: GROUP_COLORS.halogen },
  { symbol: "Ne", name: "Neon", number: 10, period: 2, group: "noble gas", valence: 8, mass: 20, hex: GROUP_COLORS["noble gas"] },
  { symbol: "Na", name: "Sodium", number: 11, period: 3, group: "alkali metal", valence: 1, mass: 23, hex: GROUP_COLORS["alkali metal"] },
  { symbol: "Mg", name: "Magnesium", number: 12, period: 3, group: "alkaline earth metal", valence: 2, mass: 24, hex: GROUP_COLORS["alkaline earth metal"] },
  { symbol: "Al", name: "Aluminium", number: 13, period: 3, group: "metal", valence: 3, mass: 27, hex: GROUP_COLORS.metal },
  { symbol: "Si", name: "Silicon", number: 14, period: 3, group: "metalloid", valence: 4, mass: 28, hex: GROUP_COLORS.metalloid },
  { symbol: "P", name: "Phosphorus", number: 15, period: 3, group: "nonmetal", valence: 5, mass: 31, hex: GROUP_COLORS.nonmetal },
  { symbol: "S", name: "Sulfur", number: 16, period: 3, group: "nonmetal", valence: 6, mass: 32, hex: GROUP_COLORS.nonmetal },
  { symbol: "Cl", name: "Chlorine", number: 17, period: 3, group: "halogen", valence: 7, mass: 35, hex: GROUP_COLORS.halogen },
  { symbol: "Ar", name: "Argon", number: 18, period: 3, group: "noble gas", valence: 8, mass: 40, hex: GROUP_COLORS["noble gas"] },
  { symbol: "K", name: "Potassium", number: 19, period: 4, group: "alkali metal", valence: 1, mass: 39, hex: GROUP_COLORS["alkali metal"] },
  { symbol: "Ca", name: "Calcium", number: 20, period: 4, group: "alkaline earth metal", valence: 2, mass: 40, hex: GROUP_COLORS["alkaline earth metal"] },
  { symbol: "Sc", name: "Scandium", number: 21, period: 4, group: "transition metal", valence: 2, mass: 45, hex: GROUP_COLORS["transition metal"] },
  { symbol: "Ti", name: "Titanium", number: 22, period: 4, group: "transition metal", valence: 2, mass: 48, hex: GROUP_COLORS["transition metal"] },
  { symbol: "V", name: "Vanadium", number: 23, period: 4, group: "transition metal", valence: 2, mass: 51, hex: GROUP_COLORS["transition metal"] },
  { symbol: "Cr", name: "Chromium", number: 24, period: 4, group: "transition metal", valence: 1, mass: 52, hex: GROUP_COLORS["transition metal"] },
  { symbol: "Mn", name: "Manganese", number: 25, period: 4, group: "transition metal", valence: 2, mass: 55, hex: GROUP_COLORS["transition metal"] },
  { symbol: "Fe", name: "Iron", number: 26, period: 4, group: "transition metal", valence: 2, mass: 56, hex: GROUP_COLORS["transition metal"] },
  { symbol: "Co", name: "Cobalt", number: 27, period: 4, group: "transition metal", valence: 2, mass: 59, hex: GROUP_COLORS["transition metal"] },
  { symbol: "Ni", name: "Nickel", number: 28, period: 4, group: "transition metal", valence: 2, mass: 59, hex: GROUP_COLORS["transition metal"] },
  { symbol: "Cu", name: "Copper", number: 29, period: 4, group: "transition metal", valence: 1, mass: 64, hex: GROUP_COLORS["transition metal"] },
  { symbol: "Zn", name: "Zinc", number: 30, period: 4, group: "transition metal", valence: 2, mass: 65, hex: GROUP_COLORS["transition metal"] },
  { symbol: "Ga", name: "Gallium", number: 31, period: 4, group: "metal", valence: 3, mass: 70, hex: GROUP_COLORS.metal },
  { symbol: "Ge", name: "Germanium", number: 32, period: 4, group: "metalloid", valence: 4, mass: 73, hex: GROUP_COLORS.metalloid },
  { symbol: "As", name: "Arsenic", number: 33, period: 4, group: "metalloid", valence: 5, mass: 75, hex: GROUP_COLORS.metalloid },
  { symbol: "Se", name: "Selenium", number: 34, period: 4, group: "nonmetal", valence: 6, mass: 79, hex: GROUP_COLORS.nonmetal },
  { symbol: "Br", name: "Bromine", number: 35, period: 4, group: "halogen", valence: 7, mass: 80, hex: GROUP_COLORS.halogen },
  { symbol: "Kr", name: "Krypton", number: 36, period: 4, group: "noble gas", valence: 8, mass: 84, hex: GROUP_COLORS["noble gas"] }
];

export function elementBySymbol(symbol: string): HunterElement | undefined {
  return HUNTER_ELEMENTS.find((e) => e.symbol === symbol);
}
