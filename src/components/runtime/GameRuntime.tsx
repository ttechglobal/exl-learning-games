"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ConceptSnapshot } from "@/components/runtime/ConceptSnapshot";
import { ReflectionScreen } from "@/components/runtime/ReflectionScreen";
import { PeriodicTableReveal } from "@/motion/PeriodicTableReveal";
import { PersonalBest } from "@/components/runtime/PersonalBest";
import { getEngineDefinition } from "@/engines/registry";
import { applyDifficultyModifiers, type PlayerDifficulty } from "@/lib/content/difficultyModifiers";
import { resolveQuickConceptsForSlug } from "@/lib/content/quickConcepts";
import type { AttemptResult } from "@/types/result";
import { enqueueAttempt } from "@/lib/offline/attemptQueue";
import { track } from "@/lib/analytics/track";

export interface GameRuntimeMission {
  id: string;
  missionKey: string;
  title: string;
  xpReward: number;
  topicId: string;
  subtopicId?: string;
  payload: Record<string, unknown>;
}

export interface GameRuntimeProps {
  gameId: string;
  /** Needed for lib/content/personalBest.ts's per-game storage key —
   *  gameId (a DB uuid) would work as a key too, but slug is what every
   *  other localStorage-backed feature in this app already keys on
   *  (contentPrefs.ts uses engineType, not an id), and slugs are stable
   *  across environments in a way a row's literal id isn't guaranteed
   *  to be if the DB is ever reseeded. */
  gameSlug: string;
  /** Added alongside Quick Concepts' new header bar (see ConceptSnapshot
   *  usage below) — previously GameRuntime had no need for either of
   *  these, since the gameplay/Reflection screens it owns don't show a
   *  title bar at all. PlayClient.tsx already has both (it's how
   *  PrePlayShell gets them for every OTHER pre-play screen), so this is
   *  plain plumbing, not new data. */
  gameTitle: string;
  subject: string;
  studentId: string;
  engineType: string;
  sharedConfig: Record<string, unknown>;
  snapshot: { cards: { title: string; body: string }[] };
  mission: GameRuntimeMission;
  hasNextMission: boolean;
  reviewSuccessLines: string[];
  onAdvanceToNextMission: () => void;
  /**
   * Fires the INSTANT a mission is reported successful — independent of
   * whatever the player does next on the Reflection screen (Next
   * Mission, View Concept Summary, or Back to Home). Added to fix a
   * real, confirmed bug: the previous code only recorded a mission's
   * completion (the actual mechanism TrackMapScreen's lock check reads
   * from) inside onAdvanceToNextMission — meaning a player who finished
   * a mission and then tapped BACK instead of Next Mission never had
   * that completion recorded at all, so the next mission stayed locked
   * even though it should have unlocked. Completion and "the player
   * chose to advance" are two separate events; this callback exists
   * specifically so PlayClient can record the former without needing
   * the latter to also happen. See handleEngineComplete below, which
   * calls this immediately on a successful outcome, same moment phase
   * flips to "reflection" — not gated behind any later button press.
   */
  onMissionSucceeded: () => void;
  /** Navigates away from the play flow entirely (PlayClient owns the
   *  actual router call, same as BackButton's onBack callbacks) — wired
   *  to ReflectionScreen's new "Back to Home" button. */
  onBackToHome: () => void;
  /** Optional — see ReflectionScreen.tsx's onChangeDifficulty comment.
   *  Only passed by PlayClient when engineSupportsDifficultyChoice is
   *  true for this game; GameRuntime itself has no opinion on which
   *  engines support this, it just forwards whatever it's given. */
  onChangeDifficulty?: () => void;
  /**
   * Returns to the Mission Objectives screen — the literal previous step
   * before GameRuntime mounts (see PlayClient.tsx: `screen ===
   * "objectives"` is what calls setScreen("runtime") to get here). Used
   * by Quick Concepts' new header back button during the initial
   * pre-mission "snapshot" phase ONLY — NOT the post-mission
   * "reviewingConcepts" revisit, which has nowhere equivalent to go back
   * to (see ConceptSnapshotProps.onBack's comment). Matches every OTHER
   * pre-play screen's "back goes one step back in this exact flow"
   * convention (PrePlayShell's handleBack in PlayClient.tsx) — this is
   * NOT the same as onBackToHome, which exits the whole play flow to
   * /worlds; conflating the two would mean Quick Concepts' back button
   * skips past Objectives/Difficulty/Briefing entirely, unlike every
   * other screen's back button.
   */
  onBackFromConcepts: () => void;
  /**
   * Player-chosen difficulty (see DifficultySelectScreen / PlayClient) —
   * null when the engine has no real modifiers defined
   * (engineSupportsDifficultyChoice returned false, so PlayClient skipped
   * the picker entirely) or when no choice was made yet. Applied via
   * applyDifficultyModifiers as a shallow overlay onto sharedConfig right
   * before the engine mounts — mission.payload (the actual target/content)
   * is never touched by this, only the engine's mechanical config
   * (timers, item counts, hint verbosity).
   */
  playerDifficulty: PlayerDifficulty | null;
  /**
   * True while the player has paused via GameMenu (see PlayClient.tsx,
   * the actual owner of this state). Passed straight through to the
   * mounted engine — GameRuntime itself has no clock of its own to
   * pause, only whichever engine is currently mounted does (or doesn't;
   * see EngineRuntimeProps.isPaused's comment for which engines this
   * actually matters to).
   */
  isPaused?: boolean;
  /**
   * The in-game menu instance (Restart Mission / Exit to Worlds — see
   * components/runtime/GameMenu.tsx), built once by PlayClient and handed
   * down here. Threaded straight into whichever engine mounts below (see
   * the `playing` phase branch) so the engine can render it inside its
   * own GameplayShell — this is now the ONLY place the menu appears;
   * every screen before actual gameplay shows a plain BackButton instead
   * (see PlayClient.tsx).
   */
  menu?: React.ReactNode;
}

type Phase = "snapshot" | "playing" | "reflection" | "reviewingConcepts";

/** Last-resort fallback when a game has NEITHER a real snapshot.cards
 *  row in the DB NOR an entry in lib/content/quickConcepts.ts — see the
 *  resolveSnapshotCards() helper below for the actual 3-tier resolution
 *  order. Generic enough to not be actively wrong for any subject, but
 *  every real game should have one of the two better sources rather
 *  than relying on this long-term. */
const GENERIC_FALLBACK_SNAPSHOT_CARDS = [{ title: "Quick Concept", body: "Get ready — your mission is about to begin." }];

/**
 * Resolves which Quick Concept cards to show, in order of preference:
 *   1. The real snapshot.cards column on this game's DB row, if it's
 *      actually been migrated/populated (Postgres can still return the
 *      OLD {lines, readTimeSec} shape for any row that hasn't been
 *      migrated yet — see GameRow.snapshot's type comment — so this is
 *      checked defensively, not just type-asserted).
 *   2. lib/content/quickConcepts.ts's per-slug content, for any game
 *      that has real authored content written in code even though its
 *      DB row doesn't (this is how Element Hunter's actual 5-card
 *      content reaches players right now — no DB migration needed for
 *      this specific game).
 *   3. The single generic one-liner above, as an absolute last resort
 *      so this screen never renders with zero content for any game.
 */
function resolveSnapshotCards(gameSlug: string, snapshot: { cards: { title: string; body: string }[] } | undefined) {
  if (Array.isArray(snapshot?.cards) && snapshot.cards.length > 0) {
    return snapshot.cards;
  }
  const perSlugCards = resolveQuickConceptsForSlug(gameSlug);
  if (perSlugCards && perSlugCards.length > 0) {
    return perSlugCards;
  }
  return GENERIC_FALLBACK_SNAPSHOT_CARDS;
}

/**
 * Orchestrates the full per-mission loop (architecture doc Section 3.1):
 * Concept Snapshot -> mount the right engine via registry.ts -> receive raw
 * outcome -> build AttemptResult -> POST /api/attempts (or queue offline) ->
 * Reflection screen.
 *
 * This component is the SAME for every game — it contains no subject- or
 * engine-specific logic. Each engine just needs to call onComplete with its
 * own outcome shape; this component normalizes whatever comes back into the
 * platform-wide AttemptResult before sending it anywhere.
 */
export function GameRuntime({
  gameId,
  gameSlug,
  gameTitle,
  subject,
  studentId,
  engineType,
  sharedConfig,
  snapshot,
  mission,
  hasNextMission,
  reviewSuccessLines,
  onAdvanceToNextMission,
  onMissionSucceeded,
  onBackToHome,
  onChangeDifficulty,
  onBackFromConcepts,
  playerDifficulty,
  isPaused,
  menu
}: GameRuntimeProps) {
  /**
   * Always starts at "snapshot" now. An EARLIER revision initialized
   * this via `hasSeenConcepts(engineType) ? "playing" : "snapshot"` —
   * per feedback at the time ("we should not need to show the quick
   * concepts again"). In practice that permanently hid Quick Concepts
   * for an entire engine type (not just one game) the moment a player
   * had seen it ONCE, ever, on ANY game sharing that engine — including
   * across browser sessions, since hasSeenConcepts reads localStorage.
   * Reported back as "Atom Forge has no Quick Concepts at all," which
   * is exactly what that looks like from the player's side once it's
   * been marked seen. Reverted: the screen always mounts again now, and
   * the "don't make a returning player sit through it" need is instead
   * served by ConceptSnapshot's Skip button being unconditionally
   * visible (see its own canSkip change) — one tap, not a silent,
   * permanent, cross-game disappearance.
   */
  const [phase, setPhase] = useState<Phase>("snapshot");
  const [lastResult, setLastResult] = useState<AttemptResult | null>(null);

  /**
   * mission_started fires exactly once per real GameRuntime mount (this
   * component remounts per mission/restart — see PlayClient.tsx's `key=
   * {\`${runtimeResetKey}-${activeMission.id}\`}` comment for why that's
   * guaranteed), the moment gameplay actually begins. Tracked here
   * rather than inside each engine so every engine gets this signal for
   * free, same "one place, not four engines" reasoning as
   * handleEngineComplete below. hasStartedRef guards against firing a
   * second time if phase cycles back through "playing" later in the
   * SAME mount (e.g. Play Again on the Reflection screen sets phase back
   * to "playing" — that's a genuinely new attempt at the same mission,
   * but mission_started already covers "did the player ever start this
   * mission instance," not "how many times did they retry," which
   * attemptsBeforeSuccess on mission_completed already answers).
   */
  const hasTrackedStartRef = useRef(false);
  useEffect(() => {
    if (phase !== "playing" || hasTrackedStartRef.current) return;
    hasTrackedStartRef.current = true;
    track("mission_started", { studentId, gameId, missionId: mission.id, topicId: mission.topicId, subtopicId: mission.subtopicId });
  }, [phase, studentId, gameId, mission.id, mission.topicId, mission.subtopicId]);

  /**
   * mission_abandoned fires on unmount if gameplay had started
   * (mission_started already fired) but mission_completed never did —
   * the player navigated away (Back to Home, browser back/close,
   * switching games) mid-mission rather than finishing it. Read via a
   * ref inside the cleanup, not component state, since an unmounting
   * component's next render never happens — the cleanup closure must
   * read whatever the LATEST committed value was, which refs guarantee
   * and stale closures over plain variables don't.
   */
  const hasCompletedRef = useRef(false);
  useEffect(() => {
    return () => {
      if (hasTrackedStartRef.current && !hasCompletedRef.current) {
        track("mission_abandoned", { studentId, gameId, missionId: mission.id, topicId: mission.topicId, subtopicId: mission.subtopicId });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const engineDef = getEngineDefinition(engineType);

  /**
   * bond-match (and potentially future engines with the same pattern)
   * sometimes treats mission.payload itself AS the real shared config for
   * that level, ignoring the top-level sharedConfig entirely — see
   * resolveSharedConfig() in BondMatchEngine.tsx: when a mission's payload
   * already looks like a valid BondMatchSharedConfig (has elementPool +
   * missions-or-factory), THAT wins, not config.shared. Atom Forge's real
   * levels work exactly this way. If applyDifficultyModifiers only patched
   * `sharedConfig`, the difficulty choice would be silently ignored for
   * any mission using this pattern — so the same overlay is applied to
   * BOTH sharedConfig and mission.payload here; whichever one the engine
   * actually resolves as authoritative ends up with the modifier either
   * way. This duplicates a little work for engines that don't need it
   * (the merge is cheap and a no-op when payload has no matching keys),
   * which is a smaller risk than re-deriving BondMatchEngine's own
   * resolution rule a second time in this file and having the two drift.
   */
  const effectiveSharedConfig = playerDifficulty ? applyDifficultyModifiers(engineType, sharedConfig, playerDifficulty) : sharedConfig;
  const effectiveMissionPayload = playerDifficulty
    ? applyDifficultyModifiers(engineType, mission.payload, playerDifficulty)
    : mission.payload;
  const effectiveMission = { ...mission, payload: effectiveMissionPayload };

  const handleEngineComplete = useCallback(
    async (rawOutcome: Record<string, unknown>) => {
      const result: AttemptResult = {
        studentId,
        gameId,
        missionId: mission.id,
        topicId: mission.topicId,
        subtopicId: mission.subtopicId,
        success: typeof rawOutcome.success === "boolean" ? rawOutcome.success : undefined,
        score: typeof rawOutcome.score === "number" ? rawOutcome.score : undefined,
        timeSpentSec: typeof rawOutcome.timeSpentSec === "number" ? rawOutcome.timeSpentSec : undefined,
        attemptsBeforeSuccess:
          typeof rawOutcome.attemptsBeforeSuccess === "number" ? rawOutcome.attemptsBeforeSuccess : undefined,
        rawOutcome,
        completedAt: new Date().toISOString()
      };

      setLastResult(result);
      setPhase("reflection");
      // Fires immediately on success — see onMissionSucceeded's doc
      // comment on GameRuntimeProps for exactly why this can't wait for
      // onAdvanceToNextMission (the player might tap Back instead, and
      // the mission still completed).
      if (result.success) onMissionSucceeded();

      // Flip BEFORE the mission_abandoned-on-unmount effect could ever
      // run — a mission that just completed should never also report as
      // abandoned, even if the player immediately navigates away from
      // the Reflection screen a moment later.
      hasCompletedRef.current = true;
      track("mission_completed", {
        studentId,
        gameId,
        missionId: mission.id,
        topicId: mission.topicId,
        subtopicId: mission.subtopicId,
        detail: {
          success: result.success ?? null,
          attemptsBeforeSuccess: result.attemptsBeforeSuccess ?? null
        }
      });

      // hintsUsed is a soft-contract field on rawOutcome (currently only
      // TileMatchEngine's outcome carries it — see tileMatch.config.ts's
      // comment on why this engine-internal counter is surfaced through
      // rawOutcome rather than threading studentId/gameId into the
      // engine itself). Tracked as its own event (not just folded into
      // mission_completed's detail) since "did this mission need a
      // hint" is a per-occurrence question worth counting on its own,
      // the same way TileMatchEngine's Hint button already exists as a
      // standalone, always-visible affordance rather than something
      // bundled into the wrong-answer flow.
      const hintsUsed = typeof rawOutcome.hintsUsed === "number" ? rawOutcome.hintsUsed : 0;
      if (hintsUsed > 0) {
        track("hint_used", {
          studentId,
          gameId,
          missionId: mission.id,
          topicId: mission.topicId,
          subtopicId: mission.subtopicId,
          detail: { count: hintsUsed }
        });
      }

      try {
        const response = await fetch("/api/attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result)
        });
        if (!response.ok) throw new Error(`POST /api/attempts failed: ${response.status}`);
      } catch {
        // Offline or the request otherwise failed — queue it; attemptQueue
        // flushes to the active ExportAdapter once connectivity returns.
        // The student still sees their Reflection screen immediately either way.
        await enqueueAttempt(result);
      }
    },
    [studentId, gameId, mission, onMissionSucceeded]
  );

  if (phase === "snapshot" || phase === "reviewingConcepts") {
    // See resolveSnapshotCards() above for the 3-tier resolution order
    // (real DB content -> per-slug code fallback -> generic last
    // resort). The defensive Array.isArray check inside it still
    // matters: until a DB migration rewrites every game's `snapshot`
    // column from the old `{lines, readTimeSec}` shape to `{cards}`, a
    // live Supabase row can arrive here with the OLD shape — `snapshot`
    // is typed as `{cards: [...]}` (see GameRow.snapshot's migration
    // caveat in types/db.ts) but TypeScript types don't change what
    // Postgres actually returns.
    const cards = resolveSnapshotCards(gameSlug, snapshot);
    return (
      <ConceptSnapshot
        cards={cards}
        onContinue={() => setPhase(phase === "reviewingConcepts" ? "reflection" : "playing")}
        engineType={phase === "snapshot" ? engineType : undefined}
        gameSlug={gameSlug}
        gameTitle={gameTitle}
        subject={subject}
        // Only the initial pre-mission "snapshot" phase gets a working
        // Back — there's nowhere sensible to navigate "back" to from
        // the post-mission "reviewingConcepts" revisit (the mission is
        // already done; Reflection already has its own way back). See
        // ConceptSnapshotProps.onBack's doc comment.
        onBack={phase === "snapshot" ? onBackFromConcepts : undefined}
        backLabel="Back to Objectives"
      />
    );
  }

  if (phase === "playing") {
    if (!engineDef) {
      return (
        <div style={{ color: "var(--eg-danger)", textAlign: "center", padding: 40 }}>
          No engine registered for type &quot;{engineType}&quot;. Check src/engines/registry.ts.
        </div>
      );
    }
    const EngineComponent = engineDef.Component;
    return (
      <EngineComponent
        config={{ shared: effectiveSharedConfig, mission: effectiveMission }}
        onComplete={(outcome: unknown) => handleEngineComplete(outcome as Record<string, unknown>)}
        isPaused={isPaused}
        menu={menu}
        gameTitle={gameTitle}
      />
    );
  }

  // phase === 'reflection'
  // Soft, optional contract: ANY engine reporting `finalComposition.proton` in
  // its raw outcome gets the periodic table reveal automatically — this isn't
  // hardcoded to particle-assembly by name, it's keyed on the shape of the
  // data. An engine with no notion of "proton count" simply won't trigger it.
  const finalComposition = lastResult?.rawOutcome?.finalComposition as Record<string, number> | undefined;
  const protonCount = finalComposition?.proton;

  // Same soft-contract pattern for scores: ANY engine reporting a
  // numeric `finalScore` gets the quiet personal-best stat automatically
  // — not hardcoded to tile-match by name. Currently true for tile-match
  // (every session) AND bond-match's factory mode specifically (Atom
  // Forge Level 4 — BondMatchFactoryOutcome also has finalScore), which
  // is correct: factory mode genuinely is a scored, repeatable session
  // just like tile-match. bond-match's LEVEL mode (most missions) and
  // particle-assembly's one-shot completion have no comparable score and
  // correctly never trigger this. PersonalBest (not the old
  // HighScoreEntry/per-game leaderboard — see lib/db/queries/
  // leaderboard.ts's header) is intentionally a quiet, non-competitive
  // stat now; the weekly/monthly/all-time leaderboard is the one
  // competitive ranking surface in the app.
  const finalScore = lastResult?.rawOutcome?.finalScore as number | undefined;

  const extraContent = (
    <>
      {typeof protonCount === "number" && <PeriodicTableReveal highlightAtomicNumber={protonCount} />}
      {typeof finalScore === "number" && <PersonalBest gameSlug={gameSlug} score={finalScore} />}
    </>
  );

  return (
    <ReflectionScreen
      successLines={reviewSuccessLines}
      hasNextMission={hasNextMission}
      onPlayAgain={() => {
        // Re-arm both tracking refs — Play Again is a genuinely NEW
        // attempt at the same mission within the same GameRuntime
        // mount, so it needs its own mission_started and needs to be
        // eligible for mission_abandoned again if the player leaves
        // without finishing THIS attempt. Without this reset,
        // hasCompletedRef would stay permanently true from the first
        // attempt and a second, abandoned attempt would never report as
        // abandoned.
        hasTrackedStartRef.current = false;
        hasCompletedRef.current = false;
        setPhase("playing");
      }}
      onNextMission={onAdvanceToNextMission}
      onViewConceptSummary={() => setPhase("reviewingConcepts")}
      onBackToHome={onBackToHome}
      onChangeDifficulty={onChangeDifficulty}
      gameSlug={gameSlug}
      extraContent={extraContent}
    />
  );
}