export type BondType = "ionic" | "covalent";
export type ElementKind = "metal" | "nonmetal";

export interface BondElement {
  symbol: string;
  name: string;
  shells: number[];
  kind: ElementKind;
  hex: string;
}

export const BOND_ELEMENTS: Record<string, BondElement> = {
  H: { symbol: "H", name: "Hydrogen", shells: [1], kind: "nonmetal", hex: "#dcd6ff" },
  O: { symbol: "O", name: "Oxygen", shells: [2, 6], kind: "nonmetal", hex: "#2f9bd6" },
  N: { symbol: "N", name: "Nitrogen", shells: [2, 5], kind: "nonmetal", hex: "#6f9bd8" },
  Na: { symbol: "Na", name: "Sodium", shells: [2, 8, 1], kind: "metal", hex: "#ffb23c" },
  Cl: { symbol: "Cl", name: "Chlorine", shells: [2, 8, 7], kind: "nonmetal", hex: "#4caf6e" },
  Mg: { symbol: "Mg", name: "Magnesium", shells: [2, 8, 2], kind: "metal", hex: "#b86bff" },
  K: { symbol: "K", name: "Potassium", shells: [2, 8, 8, 1], kind: "metal", hex: "#ff6f91" },
  F: { symbol: "F", name: "Fluorine", shells: [2, 7], kind: "nonmetal", hex: "#7ee0c3" }
};

export interface BondMission {
  key: string;
  formula: string;
  name: string;
  bondType: BondType;
  pair: [string, string];
  xpReward: number;
}

export const LEVEL_1_MISSIONS: BondMission[] = [
  { key: "nacl", formula: "NaCl", name: "Sodium Chloride", bondType: "ionic", pair: ["Na", "Cl"], xpReward: 80 },
  { key: "mgo", formula: "MgO", name: "Magnesium Oxide", bondType: "ionic", pair: ["Mg", "O"], xpReward: 90 },
  { key: "kf", formula: "KF", name: "Potassium Fluoride", bondType: "ionic", pair: ["K", "F"], xpReward: 85 }
];

export const LEVEL_2_MISSIONS: BondMission[] = [
  { key: "h2", formula: "H\u2082", name: "Hydrogen Gas", bondType: "covalent", pair: ["H", "H"], xpReward: 90 },
  { key: "o2", formula: "O\u2082", name: "Oxygen Gas", bondType: "covalent", pair: ["O", "O"], xpReward: 95 },
  { key: "n2", formula: "N\u2082", name: "Nitrogen Gas", bondType: "covalent", pair: ["N", "N"], xpReward: 100 }
];

export const LEVEL_3_MISSIONS: BondMission[] = [...LEVEL_1_MISSIONS, ...LEVEL_2_MISSIONS];

export interface FactoryOrder {
  key: string;
  formula: string;
  name: string;
  bondType: BondType;
  pair: [string, string];
  quantity: number;
  xpReward: number;
}

export const LEVEL_4_ORDERS: FactoryOrder[] = [
  { key: "mgcl2-order", formula: "MgCl\u2082", name: "Magnesium Chloride", bondType: "ionic", pair: ["Mg", "Cl"], quantity: 3, xpReward: 60 },
  { key: "nacl-order", formula: "NaCl", name: "Sodium Chloride", bondType: "ionic", pair: ["Na", "Cl"], quantity: 4, xpReward: 50 }
];
