"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GameRuntime } from "@/components/runtime/GameRuntime";
import { GameMenu } from "@/components/runtime/GameMenu";
import { PrePlayShell } from "@/components/runtime/PrePlayShell";
import { EntryScreen } from "@/app/(player)/play/[gameSlug]/EntryScreen";
import { LevelSelectScreen } from "@/app/(player)/play/[gameSlug]/LevelSelectScreen";
import { TrackMapScreen } from "@/app/(player)/play/[gameSlug]/TrackMapScreen";
import { DifficultySelectScreen } from "@/app/(player)/play/[gameSlug]/DifficultySelectScreen";
import { MissionObjectivesScreen } from "@/app/(player)/play/[gameSlug]/MissionObjectivesScreen";
import { resolveMissionObjectives } from "@/lib/content/missionObjectives";
import { engineSupportsDifficultyChoice, type PlayerDifficulty } from "@/lib/content/difficultyModifiers";
import { getElementByAtomicNumber, CATEGORY_COLORS } from "@/motion/periodicTableData";
import { track } from "@/lib/analytics/track";
import type { GameRow, MissionRow } from "@/types/db";

export interface PlayClientProps {
  studentId: string;
  game: GameRow;
  missions: MissionRow[];
  initialMissionId: string;
  /** mission_id -> has at least one successful attempt. Empty set is
   *  fine/expected for any game not using "trackMap" progression — see
   *  page.tsx, which only bothers fetching this for trackMap games. */
  completedMissionIds: Set<string>;
}

type Screen = "levelSelect" | "trackMap" | "entry" | "difficulty" | "objectives" | "runtime";

const SUBJECT_FALLBACK_ACCENT: Record<string, string> = {
  chemistry: "var(--eg-subject-chemistry)",
  biology: "var(--eg-subject-biology)",
  physics: "var(--eg-subject-physics)",
  mathematics: "var(--eg-subject-mathematics)"
};

/**
 * Owns the full pre-gameplay sequence per the latest product brief:
 * (Level Select if applicable) -> Mission Briefing (EntryScreen) ->
 * Difficulty Select (if the engine supports it) -> Mission Objectives ->
 * Runtime (which itself owns Quick Concepts -> gameplay -> Mission
 * Complete/Rewards, see GameRuntime.tsx).
 *
 * BACK BUTTON vs IN-GAME MENU: per direct feedback, these are not the same
 * control and should not share a screen. The in-game menu (Restart
 * Mission / Exit to Worlds — see GameMenu.tsx) now appears ONLY once
 * actual gameplay is running, passed down into GameRuntime -> the mounted
 * engine. Every screen BEFORE that (Level Select, Mission Briefing,
 * Difficulty Select, Mission Objectives) is wrapped in PrePlayShell,
 * which renders a plain Back action (not a menu sheet with restart/exit
 * options that don't really apply before a mission has even started).
 *
 * PREPLAYSHELL: as of this revision, BackButton and MissionTopBar are no
 * longer rendered here as independent siblings of each screen — they're
 * rendered BY PrePlayShell, alongside the environment backdrop, as ONE
 * wrapper around whichever screen is active (see PrePlayShell.tsx). This
 * fixed a real, confirmed bug: rendering them as separate siblings meant
 * the header sat on the page's plain base background while the screen
 * content below had its own independently-applied backdrop image — a
 * visible seam between "header area" and "the rest of the screen."
 * PrePlayShell now owns the backdrop once, for the whole flow, with the
 * header rendered inside that same backdrop-having container.
 *
 * Each screen's back destination is intentionally a literal step backward
 * through THIS sequence, not browser history — see handleBack() below for
 * the exact per-screen mapping.
 *
 * GameMenu is built once here and handed to GameRuntime as `menu`, which
 * threads it down into whichever engine is mounted (see
 * GameRuntime.tsx / EngineRuntimeProps.menu) so the engine can render it
 * inside its own GameplayShell.
 *
 * "Restart Mission" resets back to Entry for the SAME mission, not just
 * GameRuntime's internal phase — a player choosing Restart from deep in
 * gameplay should land back at the Mission Briefing, not silently
 * re-mount the engine mid-flow.
 *
 * DIFFICULTY SELECT: per the brief's section 4 — "Difficulty should become
 * a player choice rather than a fixed label" — this is the SAME mission
 * played with different engine-level parameters (timer length, item
 * count, hint verbosity; see lib/content/difficultyModifiers.ts), not a
 * different mission. Only shown when engineSupportsDifficultyChoice(...)
 * is true; an engine with no real modifiers defined is skipped straight
 * to Objectives rather than showing a choice that would silently do
 * nothing. Distinct from Level Select: that screen picks WHICH mission
 * (e.g. Atom Forge's Level 1 vs Level 4, genuinely different content);
 * this screen picks HOW one chosen mission plays.
 *
 * Mission Objectives REPLACES the old HowToPlayScreen entirely (deleted,
 * not kept alongside this) — the brief explicitly asks to remove dense
 * "How to Play" pages in favor of a short ✓ checklist players can absorb
 * in ~5 seconds. There's no skip-if-seen tracking on Objectives (unlike
 * the old HowToPlayScreen) because the brief doesn't ask for that here —
 * it only asks for skip/revisit on Quick Concepts, which now lives inside
 * GameRuntime/ConceptSnapshot instead.
 *
 * PROGRESSION MODE: previously, whether this game showed a flat level
 * picker was INFERRED purely from whether mission difficulty values
 * varied (`new Set(missions.map(m => m.difficulty)).size > 1`). That
 * broke for Carbon Builder, whose 11 missions deliberately span
 * EASY/MEDIUM/HARD as one staged sequence, not free-choice levels — the
 * same "mixed difficulty" signal Atom Forge's real levels also produce,
 * with a completely different intended experience. Replaced with an
 * explicit `game.progression_mode` column (see types/db.ts's GameRow
 * for the full reasoning) with three values:
 *   - "linear": straight chain, auto-advance via Next Mission. No
 *     picker screen at all. (Element Hunter, Build the Atom.)
 *   - "levelSelect": flat, unordered, always-fully-unlocked grid —
 *     unchanged behavior, still LevelSelectScreen. (Atom Forge.)
 *   - "trackMap": ordered, LOCKED path — a NEW screen (TrackMapScreen),
 *     where mission N+1 stays locked until N has a successful attempt.
 *     (Carbon Builder.)
 * `progression_mode` is nullable for already-seeded games; null falls
 * back to the OLD inferred behavior so nothing existing breaks without
 * a migration (see the `progressionMode` useMemo below).
 *
 * Level select only shows for games whose missions represent genuinely
 * different LEVELS rather than a content sequence within one continuous
 * difficulty — Atom Forge's 4 missions are real levels (different
 * mechanics/difficulty: ionic, covalent, mixed, timed factory), so the
 * player picks one; Build The Atom's missions are all EASY/MEDIUM content
 * variety at the same difficulty tier, so it stays a straight linear
 * sequence with no picker.
 */
export function PlayClient({ studentId, game, missions, initialMissionId, completedMissionIds }: PlayClientProps) {
  const router = useRouter();
  const sortedMissions = useMemo(() => [...missions].sort((a, b) => a.sequence_index - b.sequence_index), [missions]);

  /**
   * Falls back to the pre-progression_mode inferred heuristic ONLY when
   * the column is null (an existing seeded game predating this field) —
   * every newly-authored game should set this explicitly rather than
   * relying on inference, per this file's header comment.
   */
  const progressionMode = useMemo<"linear" | "levelSelect" | "trackMap">(() => {
    if (game.progression_mode) return game.progression_mode;
    const hasMixedDifficulty = new Set(sortedMissions.map((m) => m.difficulty)).size > 1;
    return hasMixedDifficulty ? "levelSelect" : "linear";
  }, [game.progression_mode, sortedMissions]);

  const isLevelBased = progressionMode === "levelSelect";
  const isTrackMap = progressionMode === "trackMap";
  const supportsDifficultyChoice = engineSupportsDifficultyChoice(game.engine_type);

  const [screen, setScreen] = useState<Screen>(isLevelBased ? "levelSelect" : isTrackMap ? "trackMap" : "entry");
  const [activeMissionId, setActiveMissionId] = useState(initialMissionId);
  const [playerDifficulty, setPlayerDifficulty] = useState<PlayerDifficulty | null>(null);
  /**
   * Mirrors the server-fetched completedMissionIds prop, but kept as
   * local state so a freshly-completed mission can flip TrackMapScreen's
   * lock state immediately (unlocking the next step) without a full page
   * reload/re-fetch — onAdvanceToNextMission below adds the
   * just-finished mission's id into this set client-side, which is safe
   * here ONLY because reaching onAdvanceToNextMission at all already
   * means GameRuntime reported a successful completion.
   */
  const [locallyCompletedIds, setLocallyCompletedIds] = useState(completedMissionIds);
  /**
   * No UI control sets this true anymore — GameMenu's Pause/Resume button
   * was removed per the gameplay-redesign brief (section 6: "Restart
   * Mission, Exit to Worlds... remove unnecessary actions"). Kept as a
   * literal `false` constant rather than deleted entirely, since
   * GameRuntime/EngineRuntimeProps/TileMatchEngine's isPaused plumbing is
   * real, working infrastructure (genuinely halts the timer, blocks taps,
   * doesn't leak the answer through feedback text either) that a future
   * pause trigger (e.g. a dedicated icon, not inside the menu sheet)
   * could reconnect to without redoing any of that engine-level work —
   * see GameMenu.tsx's comment for the same reasoning.
   */
  const isPaused = false;
  /** Bumped on every Restart so GameRuntime/the engine remounts fresh
   *  (cleared internal state) rather than just receiving the same props
   *  again, which React could otherwise bail out of re-running setup
   *  effects for. */
  const [runtimeResetKey, setRuntimeResetKey] = useState(0);

  const activeMissionIndex = sortedMissions.findIndex((m) => m.id === activeMissionId);
  const activeMission = sortedMissions[activeMissionIndex];
  const nextMission = sortedMissions[activeMissionIndex + 1];

  /**
   * mission_viewed — the funnel's true top (see types/event.ts's header):
   * fires whenever the Mission Briefing (EntryScreen) is actually shown
   * for a given mission, distinct from mission_started (GameRuntime.tsx),
   * which only fires once the player taps through to real gameplay.
   * Comparing the two answers "of everyone who SAW a mission, how many
   * actually started it." Placed BEFORE the `if (!activeMission) return`
   * below, not after — React requires every hook to run on every render
   * in the same order, so a hook can never sit after a conditional
   * return; the `activeMission &&` guard inside the effect body handles
   * the same "nothing to track yet" case safely instead.
   */
  useEffect(() => {
    if (screen === "entry" && activeMission) {
      track("mission_viewed", {
        studentId,
        gameId: game.id,
        missionId: activeMission.id,
        topicId: activeMission.topic_id,
        subtopicId: activeMission.subtopic_id ?? undefined
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, activeMission?.id, studentId, game.id]);

  if (!activeMission) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "var(--eg-text-dim)" }}>Mission not found.</div>
    );
  }

  /** Shared by EntryScreen, DifficultySelectScreen, and MissionObjectivesScreen
   *  so every pre-gameplay screen's accent matches the same logic
   *  GameRuntime/ReflectionScreen already use (proton-target -> periodic
   *  category color, else subject fallback). */
  function resolveAccentColor(): string {
    const target = (activeMission.payload as { target?: Record<string, number> }).target;
    const protonCount = target?.proton;
    const element = typeof protonCount === "number" ? getElementByAtomicNumber(protonCount) : undefined;
    return element ? CATEGORY_COLORS[element.category] : SUBJECT_FALLBACK_ACCENT[game.subject] ?? "var(--eg-subject-chemistry)";
  }

  function handleRestart() {
    setPlayerDifficulty(null);
    setRuntimeResetKey((k) => k + 1);
    setScreen("entry");
  }

  /**
   * Per-screen back destination. A literal step backward through THIS
   * sequence (not browser history) — mirrors how GameMenu's Exit always
   * goes to a fixed /worlds rather than trusting wherever history points.
   *   - levelSelect / trackMap (the first screen when shown) -> /worlds
   *   - entry -> levelSelect/trackMap if this game has one, else /worlds
   *   - difficulty -> entry
   *   - objectives -> difficulty if the engine showed one, else entry
   */
  function handleBack() {
    if (screen === "entry") {
      if (isLevelBased) setScreen("levelSelect");
      else if (isTrackMap) setScreen("trackMap");
      else router.push("/worlds");
      return;
    }
    if (screen === "difficulty") {
      setScreen("entry");
      return;
    }
    if (screen === "objectives") {
      setScreen(supportsDifficultyChoice ? "difficulty" : "entry");
      return;
    }
    // levelSelect, trackMap, or any unexpected state
    router.push("/worlds");
  }

  const menu = <GameMenu onRestart={handleRestart} />;

  if (screen === "levelSelect") {
    return (
      <PrePlayShell
        gameSlug={game.slug}
        gameTitle={game.title}
        subject={game.subject}
        onBack={() => router.push("/worlds")}
        backLabel="Back to Worlds"
      >
        <LevelSelectScreen
          gameTitle={game.title}
          missions={sortedMissions}
          onSelect={(missionId: string) => {
            setActiveMissionId(missionId);
            setScreen("entry");
          }}
        />
      </PrePlayShell>
    );
  }

  if (screen === "trackMap") {
    return (
      <PrePlayShell
        gameSlug={game.slug}
        gameTitle={game.title}
        subject={game.subject}
        onBack={() => router.push("/worlds")}
        backLabel="Back to Worlds"
      >
        <TrackMapScreen
          gameTitle={game.title}
          missions={sortedMissions}
          completedMissionIds={locallyCompletedIds}
          onSelect={(missionId: string) => {
            setActiveMissionId(missionId);
            setScreen("entry");
          }}
        />
      </PrePlayShell>
    );
  }

  if (screen === "entry") {
    return (
      <PrePlayShell
        gameSlug={game.slug}
        gameTitle={game.title}
        subject={game.subject}
        accentColor={resolveAccentColor()}
        onBack={handleBack}
        backLabel={isLevelBased ? "Back to Levels" : isTrackMap ? "Back to Map" : "Back to Worlds"}
      >
        <EntryScreen
          gameSlug={game.slug}
          subject={game.subject}
          mission={activeMission}
          onStart={() => setScreen(supportsDifficultyChoice ? "difficulty" : "objectives")}
        />
      </PrePlayShell>
    );
  }

  if (screen === "difficulty") {
    return (
      <PrePlayShell
        gameSlug={game.slug}
        gameTitle={game.title}
        subject={game.subject}
        accentColor={resolveAccentColor()}
        onBack={handleBack}
        backLabel="Back to Mission Briefing"
      >
        <DifficultySelectScreen
          accentColor={resolveAccentColor()}
          onSelect={(difficulty) => {
            setPlayerDifficulty(difficulty);
            setScreen("objectives");
          }}
        />
      </PrePlayShell>
    );
  }

  if (screen === "objectives") {
    return (
      <PrePlayShell
        gameSlug={game.slug}
        gameTitle={game.title}
        subject={game.subject}
        accentColor={resolveAccentColor()}
        onBack={handleBack}
        backLabel={supportsDifficultyChoice ? "Back to Difficulty" : "Back to Mission Briefing"}
      >
        <MissionObjectivesScreen
          objectives={resolveMissionObjectives(game.engine_type, activeMission.payload)}
          accentColor={resolveAccentColor()}
          onStart={() => setScreen("runtime")}
        />
      </PrePlayShell>
    );
  }

  // screen === 'runtime'
  return (
    <GameRuntime
      // Keyed on BOTH runtimeResetKey (bumped on explicit Restart) AND
      // activeMission.id — the mission-id part is the actual fix for a
      // real bug this round's "skip pregame screens" change would
      // otherwise introduce: GameRuntime's internal phase state
      // (useState<Phase>("snapshot")) only initializes on a genuine
      // mount, never resets on a prop change alone. The OLD flow (mission
      // N+1 routed through "entry"/"objectives" before reaching
      // "runtime" again) happened to get a correct reset for free,
      // because switching screen away from "runtime" unmounted
      // GameRuntime entirely, then mounting it again for screen ===
      // "runtime" was a genuinely fresh instance. The NEW trackMap path
      // (see onAdvanceToNextMission below) goes straight from one
      // mission's "runtime" to the next mission's "runtime" with NO
      // screen change in between — same component instance the whole
      // time, so without this key change, GameRuntime would still be
      // sitting in phase "reflection" (left over from the mission that
      // just finished) when the new mission's props arrive, instead of
      // starting the new mission at phase "snapshot" as it should.
      key={`${runtimeResetKey}-${activeMission.id}`}
      gameId={game.id}
      gameSlug={game.slug}
      gameTitle={game.title}
      subject={game.subject}
      studentId={studentId}
      engineType={game.engine_type}
      sharedConfig={game.shared_config}
      snapshot={game.snapshot}
      mission={{
        id: activeMission.id,
        missionKey: activeMission.mission_key,
        title: activeMission.title,
        xpReward: activeMission.xp_reward,
        topicId: activeMission.topic_id,
        subtopicId: activeMission.subtopic_id ?? undefined,
        payload: activeMission.payload
      }}
      hasNextMission={Boolean(nextMission) && !isLevelBased}
      reviewSuccessLines={[
        `You successfully created ${(activeMission.payload as { resultLabel?: string }).resultLabel ?? activeMission.title}.`,
        "Review the Concept Snapshot any time from this screen.",
        // Explicit unlock confirmation per direct feedback ("when a
        // user completes a level it should unlock the next one") — see
        // onMissionSucceeded below for where the unlock is now actually
        // recorded (fixed a real bug: it used to only happen inside
        // onAdvanceToNextMission, so tapping Back instead of Next
        // Mission meant the unlock never got recorded at all).
        ...(isTrackMap && nextMission ? [`🔓 "${nextMission.title}" is now unlocked!`] : [])
      ]}
      playerDifficulty={playerDifficulty}
      isPaused={isPaused}
      menu={menu}
      onMissionSucceeded={() => {
        // Fires the INSTANT a mission succeeds — independent of
        // whatever the player does next (Next Mission, View Concept
        // Summary, or Back to Home). This is the actual fix for a real
        // bug: an earlier revision only recorded a mission's completion
        // here inside onAdvanceToNextMission, which meant a player who
        // finished a mission and then tapped BACK (to look at the map,
        // say) instead of Next Mission never had that completion
        // recorded — TrackMapScreen's lock check
        // (completedMissionIds.has(...)) would still show the next
        // mission as locked even though it had genuinely just been
        // earned. Completion and "the player chose to advance" are two
        // separate events; this callback exists specifically so the
        // former is recorded without needing the latter.
        if (isTrackMap) {
          setLocallyCompletedIds((prev) => new Set(prev).add(activeMission.id));
        }
      }}
      onAdvanceToNextMission={() => {
        if (isTrackMap) {
          // The unlock itself is now recorded in onMissionSucceeded
          // above, not here — this callback ONLY handles navigation.
          // Per direct feedback ("after completing a mission, the user
          // should be able to start the next mission without
          // necessarily going through all the pregame screens"): goes
          // straight to "runtime" (gameplay), skipping Mission
          // Briefing/Objectives entirely. ReflectionScreen (Mission
          // Complete, with its Next Mission button) is still the one
          // screen shown between missions — that satisfies "one quick
          // transition screen" without forcing a second click-through
          // for content the player has already seen on every earlier
          // mission of this same game. The map stays available via Back
          // for a player who WANTS to stop and look at the whole path.
          if (nextMission) {
            setActiveMissionId(nextMission.id);
            setScreen("runtime");
          } else {
            // Finished the whole track — nothing left to unlock, so
            // there's nowhere more useful to land than the map itself,
            // now showing every step completed.
            setScreen("trackMap");
          }
        } else if (isLevelBased) {
          // Level-based games return to the level picker rather than
          // auto-advancing to a "next" level — completing Level 1 doesn't
          // imply Level 2 is what the player wants next.
          setScreen("levelSelect");
        } else if (nextMission) {
          setActiveMissionId(nextMission.id);
          setScreen(supportsDifficultyChoice ? "difficulty" : "entry");
        }
      }}
      onBackToHome={() => router.push("/worlds")}
      onBackFromConcepts={() => setScreen("objectives")}
    />
  );
}