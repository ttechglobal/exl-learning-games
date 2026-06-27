/**
 * The platform-wide data contract every engine's output gets normalized into,
 * regardless of how different the gameplay is. This is what makes the
 * "non-negotiable data contract" (Project Brief) enforceable in code.
 *
 * GameRuntime builds this from an engine's raw onComplete(rawOutcome) callback
 * plus context it already knows (studentId, gameId, missionId, topicId).
 * ExportAdapter.reportAttempt() is the only thing allowed to consume it.
 */
export interface AttemptResult {
  studentId: string;
  gameId: string;
  missionId?: string;       // omitted for engines with no discrete missions
  topicId: string;
  subtopicId?: string;

  /** Exactly one of success/score should be meaningful, depending on the engine's mechanic shape. */
  success?: boolean;        // pass/fail mechanics (e.g. particle-assembly)
  score?: number;           // 0-1 continuous-outcome mechanics

  timeSpentSec?: number;
  /** Retry count before success, where the mechanic supports retrying. A free difficulty signal. */
  attemptsBeforeSuccess?: number;

  /** Engine's untouched output, stored as-is for debugging/richer Reflection screens. */
  rawOutcome: Record<string, unknown>;

  completedAt: string; // ISO 8601
}
