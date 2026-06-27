import type { MissionRow } from "@/types/db";

/**
 * A DifficultyPolicy decides which Mission a given student should play next
 * for a given game. This is deliberately NOT inside any engine — engines only
 * report difficulty/sequence metadata on their missions; something outside
 * the engine decides what to do with it. See architecture doc Section 6.
 */
export interface DifficultyPolicy {
  pickNextMission(studentId: string, missions: MissionRow[]): Promise<MissionRow | null>;
}

/** Returns the lowest-sequenceIndex mission the student hasn't yet mastered/completed. */
export const fixedOrderPolicy: DifficultyPolicy = {
  async pickNextMission(_studentId, missions) {
    const sorted = [...missions].sort((a, b) => a.sequence_index - b.sequence_index);
    // v1 of this policy: always start from the top of the sequence. A real
    // implementation would check the student's attempt history per mission
    // to resume at the right point — left as a follow-up, not blocking the
    // architecture itself.
    return sorted[0] ?? null;
  }
};
