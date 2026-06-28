"use client";

import { useState, useCallback } from "react";
import { ConceptSnapshot } from "@/components/runtime/ConceptSnapshot";
import { ReflectionScreen } from "@/components/runtime/ReflectionScreen";
import { PeriodicTableReveal } from "@/motion/PeriodicTableReveal";
import { HighScoreEntry } from "@/components/runtime/HighScoreEntry";
import { getEngineDefinition } from "@/engines/registry";
import { applyDifficultyModifiers, type PlayerDifficulty } from "@/lib/content/difficultyModifiers";
import { resolveQuickConceptsForSlug } from "@/lib/content/quickConcepts";
import type { AttemptResult } from "@/types/result";
import { enqueueAttempt } from "@/lib/offline/attemptQueue";

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
  /** Needed for lib/content/localHighScores.ts's per-game storage key —
   *  gameId (a DB uuid) would work as a key too, but slug is what every
   *  other localStorage-backed feature in this app already keys on
   *  (conceptPrefs.ts uses engineType, not an id), and slugs are stable
   *  across environments in a way a row's literal id isn't guaranteed
   *  to be if the DB is ever reseeded. */
  gameSlug: string;
  studentId: string;
  engineType: string;
  sharedConfig: Record<string, unknown>;
  snapshot: { cards: { title: string; body: string }[] };
  mission: GameRuntimeMission;
  hasNextMission: boolean;
  reviewSuccessLines: string[];
  onAdvanceToNextMission: () => void;
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
  studentId,
  engineType,
  sharedConfig,
  snapshot,
  mission,
  hasNextMission,
  reviewSuccessLines,
  onAdvanceToNextMission,
  playerDifficulty,
  isPaused,
  menu
}: GameRuntimeProps) {
  const [phase, setPhase] = useState<Phase>("snapshot");
  const [lastResult, setLastResult] = useState<AttemptResult | null>(null);

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
    [studentId, gameId, mission]
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

  // Same soft-contract pattern for high scores: ANY engine reporting a
  // numeric `finalScore` gets the local high-score prompt automatically —
  // not hardcoded to tile-match by name. Currently true for tile-match
  // (every session) AND bond-match's factory mode specifically (Atom
  // Forge Level 4 — BondMatchFactoryOutcome also has finalScore), which
  // is correct: factory mode genuinely is a scored, repeatable session
  // just like tile-match. bond-match's LEVEL mode (most missions) and
  // particle-assembly's one-shot completion have no comparable score and
  // correctly never trigger this.
  const finalScore = lastResult?.rawOutcome?.finalScore as number | undefined;

  const extraContent = (
    <>
      {typeof protonCount === "number" && <PeriodicTableReveal highlightAtomicNumber={protonCount} />}
      {typeof finalScore === "number" && <HighScoreEntry gameSlug={gameSlug} score={finalScore} />}
    </>
  );

  return (
    <ReflectionScreen
      successLines={reviewSuccessLines}
      hasNextMission={hasNextMission}
      onPlayAgain={() => setPhase("playing")}
      onNextMission={onAdvanceToNextMission}
      onViewConceptSummary={() => setPhase("reviewingConcepts")}
      gameSlug={gameSlug}
      extraContent={extraContent}
    />
  );
}