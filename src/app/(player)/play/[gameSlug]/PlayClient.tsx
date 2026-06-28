"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { GameRuntime } from "@/components/runtime/GameRuntime";
import { GameMenu } from "@/components/runtime/GameMenu";
import { PrePlayShell } from "@/components/runtime/PrePlayShell";
import { EntryScreen } from "@/app/(player)/play/[gameSlug]/EntryScreen";
import { LevelSelectScreen } from "@/app/(player)/play/[gameSlug]/LevelSelectScreen";
import { DifficultySelectScreen } from "@/app/(player)/play/[gameSlug]/DifficultySelectScreen";
import { MissionObjectivesScreen } from "@/app/(player)/play/[gameSlug]/MissionObjectivesScreen";
import { resolveMissionObjectives } from "@/lib/content/missionObjectives";
import { engineSupportsDifficultyChoice, type PlayerDifficulty } from "@/lib/content/difficultyModifiers";
import { getElementByAtomicNumber, CATEGORY_COLORS } from "@/motion/periodicTableData";
import type { GameRow, MissionRow } from "@/types/db";

export interface PlayClientProps {
  studentId: string;
  game: GameRow;
  missions: MissionRow[];
  initialMissionId: string;
}

type Screen = "levelSelect" | "entry" | "difficulty" | "objectives" | "runtime";

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
 * Level select only shows for games whose missions represent genuinely
 * different LEVELS rather than a content sequence within one continuous
 * difficulty — Atom Forge's 4 missions are real levels (different
 * mechanics/difficulty: ionic, covalent, mixed, timed factory), so the
 * player picks one; Build The Atom's missions are all EASY/MEDIUM content
 * variety at the same difficulty tier, so it stays a straight linear
 * sequence with no picker. Detected by whether mission difficulty actually
 * varies across the list.
 */
export function PlayClient({ studentId, game, missions, initialMissionId }: PlayClientProps) {
  const router = useRouter();
  const sortedMissions = useMemo(() => [...missions].sort((a, b) => a.sequence_index - b.sequence_index), [missions]);
  const isLevelBased = useMemo(() => new Set(sortedMissions.map((m) => m.difficulty)).size > 1, [sortedMissions]);
  const supportsDifficultyChoice = engineSupportsDifficultyChoice(game.engine_type);

  const [screen, setScreen] = useState<Screen>(isLevelBased ? "levelSelect" : "entry");
  const [activeMissionId, setActiveMissionId] = useState(initialMissionId);
  const [playerDifficulty, setPlayerDifficulty] = useState<PlayerDifficulty | null>(null);
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
   *   - levelSelect (the first screen when shown) -> /worlds
   *   - entry -> levelSelect if this game has one, else /worlds
   *   - difficulty -> entry
   *   - objectives -> difficulty if the engine showed one, else entry
   */
  function handleBack() {
    if (screen === "entry") {
      if (isLevelBased) setScreen("levelSelect");
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
    // levelSelect, or any unexpected state
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

  if (screen === "entry") {
    return (
      <PrePlayShell
        gameSlug={game.slug}
        gameTitle={game.title}
        subject={game.subject}
        accentColor={resolveAccentColor()}
        onBack={handleBack}
        backLabel={isLevelBased ? "Back to Levels" : "Back to Worlds"}
      >
        <EntryScreen
          gameSlug={game.slug}
          gameId={game.id}
          gameTitle={game.title}
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
      key={runtimeResetKey}
      gameId={game.id}
      gameSlug={game.slug}
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
        "Review the Concept Snapshot any time from this screen."
      ]}
      playerDifficulty={playerDifficulty}
      isPaused={isPaused}
      menu={menu}
      onAdvanceToNextMission={() => {
        if (isLevelBased) {
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
    />
  );
}