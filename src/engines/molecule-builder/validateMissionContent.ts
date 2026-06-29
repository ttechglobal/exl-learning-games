/**
 * engines/molecule-builder/validateMissionContent.ts
 *
 * Dev-time content validator for molecule-builder missions — catches
 * authoring mistakes that the Zod schema alone can't (schema checks
 * SHAPE; this checks CHEMISTRY/GRAPH correctness):
 *   - every targetBond's slots actually exist and list each other in
 *     bondableTo (symmetric, so the engine's "what can I bond this slot
 *     to" lookup is never one-directional)
 *   - every atom's total bond weight in targetBonds matches its real
 *     maxBonds exactly (catches a typo'd extra/missing bond before it
 *     ships as an unsolvable or already-wrong mission)
 *   - targetAtoms and slots agree on which slot ids exist
 *
 * Not wired into the runtime engine (which trusts its content, same as
 * every other engine here) — this is a content-authoring safety net,
 * meant to be run against new mission content before it ships, the same
 * role gameConfig.schema.ts's validateGameInput plays for DB writes.
 */

import type { AtomDef, MoleculeBuilderMissionPayload } from "@/engines/molecule-builder/moleculeBuilder.config";
import { BOND_ORDER_WEIGHT } from "@/engines/molecule-builder/moleculeBuilder.config";

export interface ContentValidationIssue {
  missionKey: string;
  message: string;
}

export function validateMissionContent(
  missionKey: string,
  mission: MoleculeBuilderMissionPayload,
  roster: AtomDef[]
): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];
  const slotIds = new Set(mission.slots.map((s) => s.id));

  // Every targetAtoms key must be a real slot.
  for (const slotId of Object.keys(mission.targetAtoms)) {
    if (!slotIds.has(slotId)) {
      issues.push({ missionKey, message: `targetAtoms references unknown slot "${slotId}"` });
    }
  }

  // Every slot must have a targetAtoms entry (every defined slot is meant to be filled).
  for (const slotId of slotIds) {
    if (!(slotId in mission.targetAtoms)) {
      issues.push({ missionKey, message: `slot "${slotId}" has no targetAtoms entry` });
    }
  }

  // bondableTo symmetry: if A lists B, B must list A.
  for (const slot of mission.slots) {
    for (const other of slot.bondableTo) {
      if (!slotIds.has(other)) {
        issues.push({ missionKey, message: `slot "${slot.id}" lists unknown bondableTo target "${other}"` });
        continue;
      }
      const otherSlot = mission.slots.find((s) => s.id === other);
      if (otherSlot && !otherSlot.bondableTo.includes(slot.id)) {
        issues.push({ missionKey, message: `bondableTo not symmetric: "${slot.id}" -> "${other}" but not back` });
      }
    }
  }

  // Every targetBond's slots must exist and must list each other in bondableTo.
  for (const bond of mission.targetBonds) {
    if (!slotIds.has(bond.slotA) || !slotIds.has(bond.slotB)) {
      issues.push({ missionKey, message: `targetBond references unknown slot(s): ${bond.slotA}/${bond.slotB}` });
      continue;
    }
    const slotA = mission.slots.find((s) => s.id === bond.slotA)!;
    if (!slotA.bondableTo.includes(bond.slotB)) {
      issues.push({ missionKey, message: `targetBond ${bond.slotA}-${bond.slotB} not listed in bondableTo` });
    }
  }

  // The real chemistry check: every atom's total bond weight across
  // targetBonds must exactly equal its maxBonds — not <=, exactly ==,
  // since an under-filled or over-filled target is itself a content bug
  // (a real molecule has no "spare" bond capacity sitting unused).
  const weightBySlot: Record<string, number> = {};
  for (const bond of mission.targetBonds) {
    const w = BOND_ORDER_WEIGHT[bond.order];
    weightBySlot[bond.slotA] = (weightBySlot[bond.slotA] ?? 0) + w;
    weightBySlot[bond.slotB] = (weightBySlot[bond.slotB] ?? 0) + w;
  }
  for (const slotId of slotIds) {
    const symbol = mission.targetAtoms[slotId];
    if (!symbol) continue;
    const def = roster.find((a) => a.symbol === symbol);
    if (!def) {
      issues.push({ missionKey, message: `slot "${slotId}" uses unknown atom symbol "${symbol}"` });
      continue;
    }
    const weight = weightBySlot[slotId] ?? 0;
    if (weight !== def.maxBonds) {
      issues.push({
        missionKey,
        message: `slot "${slotId}" (${symbol}) has bond weight ${weight}, expected exactly ${def.maxBonds}`
      });
    }
  }

  return issues;
}

export function validateAllMissions(
  missions: Record<string, MoleculeBuilderMissionPayload>,
  roster: AtomDef[]
): ContentValidationIssue[] {
  return Object.entries(missions).flatMap(([key, mission]) => validateMissionContent(key, mission, roster));
}
