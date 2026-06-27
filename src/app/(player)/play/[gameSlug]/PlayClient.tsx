"use client";

import { useState, useMemo } from "react";
import { GameRuntime } from "@/components/runtime/GameRuntime";
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
  const sortedMissions = useMemo(() => [...missions].sort((a, b) => a.sequence_index - b.sequence_index), [missions]);
  const isLevelBased = useMemo(() => new Set(sortedMissions.map((m) => m.difficulty)).size > 1, [sortedMissions]);
  const supportsDifficultyChoice = engineSupportsDifficultyChoice(game.engine_type);

  const [screen, setScreen] = useState<Screen>(isLevelBased ? "levelSelect" : "entry");
  const [activeMissionId, setActiveMissionId] = useState(initialMissionId);
  const [playerDifficulty, setPlayerDifficulty] = useState<PlayerDifficulty | null>(null);

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

  if (screen === "levelSelect") {
    return (
      <LevelSelectScreen
        gameTitle={game.title}
        missions={sortedMissions}
        onSelect={(missionId: string) => {
          setActiveMissionId(missionId);
          setScreen("entry");
        }}
      />
    );
  }

  if (screen === "entry") {
    return (
      <EntryScreen
        gameTitle={game.title}
        gameSlug={game.slug}
        subject={game.subject}
        mission={activeMission}
        onStart={() => setScreen(supportsDifficultyChoice ? "difficulty" : "objectives")}
      />
    );
  }

  if (screen === "difficulty") {
    return (
      <DifficultySelectScreen
        accentColor={resolveAccentColor()}
        onSelect={(difficulty) => {
          setPlayerDifficulty(difficulty);
          setScreen("objectives");
        }}
      />
    );
  }

  if (screen === "objectives") {
    return (
      <MissionObjectivesScreen
        objectives={resolveMissionObjectives(game.engine_type, activeMission.payload)}
        accentColor={resolveAccentColor()}
        onStart={() => setScreen("runtime")}
      />
    );
  }

  // screen === 'runtime'
  return (
    <GameRuntime
      gameId={game.id}
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
    />
  );
}