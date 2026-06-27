"use client";

import { useState, useCallback } from "react";
import { ConceptSnapshot } from "@/components/runtime/ConceptSnapshot";
import { ReflectionScreen } from "@/components/runtime/ReflectionScreen";
import { PeriodicTableReveal } from "@/motion/PeriodicTableReveal";
import { getEngineDefinition } from "@/engines/registry";
import { applyDifficultyModifiers, type PlayerDifficulty } from "@/lib/content/difficultyModifiers";
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
}

type Phase = "snapshot" | "playing" | "reflection" | "reviewingConcepts";

/** Used only when a live row's `snapshot` doesn't actually have the new
 *  `{cards}` shape yet (see the guard in the snapshot/reviewingConcepts
 *  branch below) — generic enough to not be actively wrong for any
 *  subject, but every real game should have its own migrated content
 *  rather than relying on this long-term. */
const FALLBACK_SNAPSHOT_CARDS = [{ title: "Quick Concept", body: "Get ready — your mission is about to begin." }];

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
  studentId,
  engineType,
  sharedConfig,
  snapshot,
  mission,
  hasNextMission,
  reviewSuccessLines,
  onAdvanceToNextMission,
  playerDifficulty
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
    // Defensive guard against unmigrated rows: until the DB migration that
    // rewrites every game's `snapshot` column from the old
    // `{lines, readTimeSec}` shape to `{cards}` actually runs, a live
    // Supabase row can still arrive here with the OLD shape — `snapshot`
    // is typed as `{cards: [...]}` (see GameRow.snapshot's migration
    // caveat in types/db.ts) but TypeScript types don't change what
    // Postgres actually returns. Without this guard, `cards` would be
    // `undefined` and ConceptSnapshot would crash on `cards.length`
    // immediately on every single play session against an unmigrated DB.
    const cards = Array.isArray(snapshot?.cards) && snapshot.cards.length > 0 ? snapshot.cards : FALLBACK_SNAPSHOT_CARDS;
    return (
      <ConceptSnapshot
        cards={cards}
        onContinue={() => setPhase(phase === "reviewingConcepts" ? "reflection" : "playing")}
        engineType={phase === "snapshot" ? engineType : undefined}
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

  return (
    <ReflectionScreen
      successLines={reviewSuccessLines}
      hasNextMission={hasNextMission}
      onPlayAgain={() => setPhase("playing")}
      onNextMission={onAdvanceToNextMission}
      onViewConceptSummary={() => setPhase("reviewingConcepts")}
      xpEarned={mission.xpReward}
      extraContent={typeof protonCount === "number" ? <PeriodicTableReveal highlightAtomicNumber={protonCount} /> : undefined}
    />
  );
}