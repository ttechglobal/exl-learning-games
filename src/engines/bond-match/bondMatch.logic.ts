import { BOND_ELEMENTS } from "@/engines/bond-match/bondData";

export function isValidBondPair(elA: string, elB: string, targetPair: readonly [string, string]): boolean {
  const [a, b] = targetPair;
  return (elA === a && elB === b) || (elA === b && elB === a);
}

export function ionicTransferDirection(elA: string, elB: string): { fromSymbol: string; toSymbol: string } {
  const a = BOND_ELEMENTS[elA];
  if (a?.kind === "metal") return { fromSymbol: elA, toSymbol: elB };
  return { fromSymbol: elB, toSymbol: elA };
}
