/**
 * types/event.ts
 *
 * The platform-wide analytics event contract — same role as
 * types/result.ts's AttemptResult, just for the lighter-weight,
 * higher-volume signals that AttemptResult was never meant to carry
 * (screen views, hint usage, abandonment), not just one row per
 * completed mission.
 *
 * WHY A SEPARATE CONTRACT, NOT MORE FIELDS ON AttemptResult:
 * AttemptResult is one row per COMPLETED mission attempt, written once
 * the player finishes (success or fail) and already drives mastery
 * scoring / XP / the attempt table directly. EventResult is its own
 * lightweight stream, written fire-and-forget from wherever something
 * worth knowing happens, with no requirement that a mission ever
 * completes at all (e.g. tracking that someone opened a game and left
 * before finishing).
 *
 * DESIGNED FOR THE OFFLINE-QUEUE PATTERN ALREADY PROVEN BY
 * lib/offline/attemptQueue.ts: see lib/offline/eventQueue.ts and
 * lib/analytics/track.ts. Reusing that exact resilience model (queue
 * locally in IndexedDB when offline, flush on reconnect) rather than a
 * third-party SDK — see lib/analytics/track.ts's header for the full
 * reasoning (low-end Android / limited connectivity / no extra vendor
 * dependency).
 */

/**
 * Closed set, not a free-form string — keeps every event name
 * queryable/groupable without typos silently fragmenting the data (e.g.
 * "mission_completed" vs "missionCompleted" vs "mission-completed" all
 * meaning the same thing but counted separately). Add new names here as
 * new questions come up; don't let call sites invent ad hoc strings.
 */
export type AnalyticsEventName =
  /** A mission's pre-play screen (EntryScreen) was reached. The funnel's
   *  true top — pairs with mission_started/mission_completed to compute
   *  "how many people who SAW a mission actually started it." */
  | "mission_viewed"
  /** The player tapped Start Mission and the engine actually mounted —
   *  see GameRuntime.tsx's phase flip to "playing". */
  | "mission_started"
  /** A full mission attempt finished — success or fail. Carries
   *  `detail.attemptsBeforeSuccess` (already produced by every engine's
   *  raw outcome — see TileMatchEngine/BondMatchEngine/
   *  MoleculeBuilderEngine/ParticleAssemblyEngine, all of which already
   *  count internal wrong attempts before calling onComplete) as the
   *  fine-grained "how many times did they get this wrong" signal,
   *  rather than a separate per-tap event. A per-tap wrong-attempt event
   *  would need studentId/gameId/topicId threaded into every engine's
   *  EngineRuntimeProps (none of the four currently receive any
   *  identity context — see engine-types.ts) purely to support
   *  analytics, which is a much larger, riskier change for a refinement
   *  that this aggregate count already answers reasonably well: "which
   *  topics/missions have the highest average attemptsBeforeSuccess"
   *  is the same underlying question ("what do students get wrong
   *  most") as a raw per-tap count would answer, just computed from
   *  data that already exists end to end today.
   *
   *  Deliberately ALSO tracked here (not just inferred from the attempt
   *  table) so a single analytics query can answer funnel questions
   *  without joining across two different storage systems with
   *  different write timing (attempt writes can be queued offline and
   *  arrive late; this event fires at the same logical moment for
   *  consistency, see GameRuntime.tsx's handleEngineComplete). */
  | "mission_completed"
  /** The player left the play flow (Back to Home / browser navigation
   *  via BackButton) WITHOUT a mission_completed having fired first for
   *  the mission they were on — the other half of the funnel
   *  mission_started enables: "of everyone who started, who never
   *  finished." */
  | "mission_abandoned"
  /** A hint was used (TileMatchEngine's Hint button, or equivalent).
   *  Signals a concept that's hard enough to need scaffolding even
   *  before getting it wrong outright. */
  | "hint_used";

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  studentId: string;
  gameId: string;
  /** Omitted for engines/screens with no discrete mission in play yet
   *  (e.g. mission_viewed before a specific mission is chosen on a
   *  levelSelect game). */
  missionId?: string;
  topicId?: string;
  subtopicId?: string;
  /**
   * Event-specific detail, kept loose (unlike AttemptResult's
   * deliberately narrow, named fields) because each event NAME implies
   * its own shape and the set of names is itself the closed contract —
   * see AnalyticsEventName. Examples actually produced today:
   *   mission_completed: { success: boolean | null, attemptsBeforeSuccess: number | null }
   *   hint_used: { costSec: number }
   */
  detail?: Record<string, unknown>;
  occurredAt: string; // ISO 8601
}
