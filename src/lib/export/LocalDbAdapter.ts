import type { ExportAdapter } from "@/lib/export/ExportAdapter";
import type { AttemptResult } from "@/types/result";
import { insertAttempt } from "@/lib/db/queries/attempts";
import { getTopicProgress, upsertTopicProgress, addXpToStudent } from "@/lib/db/queries/progress";
import { updateMastery, outcomeScoreFromAttempt } from "@/lib/scoring/masteryFormula";
import { getMissionById } from "@/lib/db/queries/games";

/**
 * Default adapter: writes everything to this repo's own Supabase project.
 * Active until cross-app integration (subdomain/shared-auth/API) is decided —
 * swapping to ApiAdapter later means changing the export below this class,
 * not touching GameRuntime or any engine.
 */
export class LocalDbAdapter implements ExportAdapter {
  async reportAttempt(result: AttemptResult): Promise<void> {
    const outcomeScore = outcomeScoreFromAttempt(result.success, result.score);

    const existingProgress = await getTopicProgress(result.studentId, result.topicId, result.subtopicId ?? null);

    const { newScore, newAttemptsCount, isMastered } = updateMastery({
      previousScore: existingProgress?.mastery_score ?? 0,
      previousAttemptsCount: existingProgress?.attempts_count ?? 0,
      outcomeScore
    });

    await upsertTopicProgress(
      result.studentId,
      result.topicId,
      result.subtopicId ?? null,
      newScore,
      newAttemptsCount,
      isMastered
    );

    const xpAwarded = await resolveXpReward(result);
    await insertAttempt(result, xpAwarded);
    if (xpAwarded > 0) {
      await addXpToStudent(result.studentId, xpAwarded);
    }
  }
}

/** XP comes from the Mission's xp_reward when available; falls back to a small flat amount otherwise. */
async function resolveXpReward(result: AttemptResult): Promise<number> {
  if (result.missionId) {
    const mission = await getMissionById(result.missionId);
    if (mission) return mission.xp_reward;
  }
  return result.success ? 20 : 0;
}
