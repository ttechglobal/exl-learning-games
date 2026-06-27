import type { AttemptResult } from "@/types/result";

/**
 * The integration seam (architecture doc Section 3.3). Whatever the
 * cross-app integration story ends up being — shared DB, API call, or
 * message-passing — it's implemented as a new ExportAdapter, not a change
 * to GameRuntime or any engine.
 */
export interface ExportAdapter {
  reportAttempt(result: AttemptResult): Promise<void>;
}
