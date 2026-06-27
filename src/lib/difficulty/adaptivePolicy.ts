import type { MissionRow } from "@/types/db";
import type { DifficultyPolicy } from "@/lib/difficulty/fixedOrderPolicy";
import { listTopicProgressForStudent } from "@/lib/db/queries/progress";

/**
 * PLACEHOLDER — not wired up anywhere yet. Documents the intended shape so
 * building this later doesn't require touching fixedOrderPolicy, GameRuntime,
 * or any engine.
 *
 * Intended behavior: read the student's TopicProgress.masteryScore for the
 * mission's topic, and pick a harder mission if mastery is high, an easier
 * one if mastery is low/the student has been failing. Uses exactly the
 * mastery data the platform already tracks for the main app's learning path
 * — no new student-modeling work needed.
 */
export const adaptivePolicy: DifficultyPolicy = {
  async pickNextMission(studentId, missions) {
    const progress = await listTopicProgressForStudent(studentId);
    // NOT IMPLEMENTED: cross-reference `progress` against `missions[].topic_id`
    // and `missions[].difficulty` to pick something other than the first
    // unmastered mission. Falling back to fixed-order behavior for now so
    // this is safe to reference without being wired up.
    void progress;
    const sorted = [...missions].sort((a, b) => a.sequence_index - b.sequence_index);
    return sorted[0] ?? null;
  }
};
