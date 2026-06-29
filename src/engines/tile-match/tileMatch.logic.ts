import { HUNTER_ELEMENTS, type HunterElement, type ElementGroup } from "@/engines/tile-match/elementData";
import type { ClueType, Tier } from "@/engines/tile-match/tileMatch.config";

export interface Clue {
  type: ClueType;
  label: string;
  text: string;
  isMatch: (el: HunterElement) => boolean;
  seedSymbol: string;
}

const CLUE_LABELS: Record<ClueType, string> = {
  atomic_number: "Find an element with...",
  electron_number: "Find an element with...",
  period: "Find an element in...",
  group: "Find a...",
  valence: "Find an element with...",
  mass_number: "Find an element with..."
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateClue(type: ClueType, pool: HunterElement[]): Clue {
  if (type === "atomic_number") {
    const target = pick(pool);
    return {
      type,
      label: CLUE_LABELS.atomic_number,
      text: `Atomic Number ${target.number}`,
      isMatch: (el) => el.number === target.number,
      seedSymbol: target.symbol
    };
  }

  if (type === "electron_number") {
    // For a neutral atom, electron count equals atomic number — same
    // underlying value as atomic_number, asked a different way on
    // purpose (Easy tier wants two simple "read a number" clue framings,
    // not two genuinely different concepts).
    const target = pick(pool);
    return {
      type,
      label: CLUE_LABELS.electron_number,
      text: `${target.number} electron${target.number === 1 ? "" : "s"}`,
      isMatch: (el) => el.number === target.number,
      seedSymbol: target.symbol
    };
  }

  if (type === "period") {
    const periods = [...new Set(pool.map((e) => e.period))];
    const period = pick(periods);
    const candidates = pool.filter((e) => e.period === period);
    const target = pick(candidates);
    return {
      type,
      label: CLUE_LABELS.period,
      text: `Period ${period}`,
      isMatch: (el) => el.period === period,
      seedSymbol: target.symbol
    };
  }

  if (type === "mass_number") {
    const target = pick(pool);
    return {
      type,
      label: CLUE_LABELS.mass_number,
      text: `Mass Number ${target.mass}`,
      isMatch: (el) => el.mass === target.mass,
      seedSymbol: target.symbol
    };
  }

  if (type === "group") {
    const groups = [...new Set(pool.map((e) => e.group))] as ElementGroup[];
    const group = pick(groups);
    const candidates = pool.filter((e) => e.group === group);
    const target = pick(candidates);
    return {
      type,
      label: CLUE_LABELS.group,
      text: group,
      isMatch: (el) => el.group === group,
      seedSymbol: target.symbol
    };
  }

  const target = pick(pool);
  return {
    type,
    label: CLUE_LABELS.valence,
    text: `${target.valence} valence electron${target.valence === 1 ? "" : "s"}`,
    isMatch: (el) => el.valence === target.valence,
    seedSymbol: target.symbol
  };
}

export function generateClueForTier(tier: Tier, pool: HunterElement[]): Clue {
  const type = pick(tier.clueTypes);
  return generateClue(type, pool);
}

export function buildTileGrid(clue: Clue, pool: HunterElement[], tileCount: number): HunterElement[] {
  const seed = pool.find((e) => e.symbol === clue.seedSymbol);
  if (!seed) throw new Error(`Clue seed symbol ${clue.seedSymbol} not found in pool`);

  const rest = shuffle(pool.filter((e) => e.symbol !== seed.symbol));
  const distractors = rest.slice(0, Math.max(0, tileCount - 1));
  return shuffle([seed, ...distractors]);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function poolFromSymbols(symbols: string[]): HunterElement[] {
  return HUNTER_ELEMENTS.filter((e) => symbols.includes(e.symbol));
}
