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

/**
 * XP comes from the engine's own reported `xpEarned` (on rawOutcome)
 * when present — a real, performance-based amount (e.g. Element
 * Hunter's 5 XP per correct round, Atom Forge's 5 XP per compound
 * forged; see TileMatchEngine.tsx / BondMatchEngine.tsx for where
 * that's computed). Falls back to the Mission's flat xp_reward only
 * when the engine doesn't report one at all — true for the
 * single-attempt engines (particle-assembly, molecule-builder), where
 * "one flat reward for the one thing you built" is the correct model
 * to begin with, not a gap to fix.
 *
 * BUG THIS REPLACES: every engine, including session-based ones that
 * already tracked their own internal score (tile-match's streak-bonus
 * score, bond-match's per-compound score), was previously awarded the
 * exact same flat mission.xp_reward regardless of how the session
 * actually went — finishing Element Hunter having gotten one tile right
 * paid the identical XP as finishing it with a 20-round streak. xpEarned
 * closes that gap by being the one place a session's real performance
 * becomes the real XP number, instead of two disconnected scoring
 * systems (an in-game "Score" stat nobody's profile ever saw, and a
 * flat reward that ignored it).
 */
async function resolveXpReward(result: AttemptResult): Promise<number> {
  const reported = result.rawOutcome?.xpEarned;
  if (typeof reported === "number" && Number.isFinite(reported)) {
    return Math.max(0, Math.round(reported));
  }
  if (result.missionId) {
    const mission = await getMissionById(result.missionId);
    if (mission) return mission.xp_reward;
  }
  return result.success ? 20 : 0;
}
