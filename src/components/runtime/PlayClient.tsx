"use client";

/**
 * components/runtime/PlayClient.tsx
 *
 * This is the version of PlayClient used in the components/runtime path.
 * The canonical version is src/app/(player)/play/[gameSlug]/PlayClient.tsx
 * which is the one actually imported by page.tsx.
 *
 * This file is kept in sync to avoid TypeScript build errors from orphaned
 * files being type-checked even when not imported.
 *
 * SCREEN FLOW (corrected):
 *   title → entry (narration) → difficulty (stage picker) → missionSelect → runtime
 *
 * For levelSelect games:   title → entry → difficulty → levelSelect → runtime
 * For linear games:        title → entry → difficulty → runtime
 * For trackMap games:      title → entry → difficulty → missionSelect → runtime
 */

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GameRuntime } from "@/components/runtime/GameRuntime";
import { GameMenu } from "@/components/runtime/GameMenu";
import { GameTitleScreen } from "@/components/runtime/GameTitleScreen";
import { PrePlayShell } from "@/components/runtime/PrePlayShell";
import { LevelSelectScreen } from "@/app/(player)/play/[gameSlug]/LevelSelectScreen";
import { MissionSelectScreen } from "@/app/(player)/play/[gameSlug]/MissionSelectScreen";
import { DifficultySelectScreen } from "@/app/(player)/play/[gameSlug]/DifficultySelectScreen";
import { NarrationScreen } from "@/components/exl/NarrationScreen";
import { resetConceptsSeen } from "@/lib/content/contentPrefs";
import { getLocalPlayerName } from "@/lib/content/localPlayerName";
import { engineSupportsDifficultyChoice, type PlayerDifficulty } from "@/lib/content/difficultyModifiers";
import { getElementByAtomicNumber, CATEGORY_COLORS } from "@/motion/periodicTableData";
import { track } from "@/lib/analytics/track";
import { getGameTheme } from "@/lib/content/gameThemes";
import type { GameRow, MissionRow } from "@/types/db";

export interface PlayClientProps {
  studentId: string;
  game: GameRow;
  missions: MissionRow[];
  initialMissionId: string;
  completedMissionIds: Set<string>;
}

type Screen = "title" | "levelSelect" | "missionSelect" | "difficultyTrack" | "entry" | "difficulty" | "runtime";

const SUBJECT_FALLBACK_ACCENT: Record<string, string> = {
  chemistry:   "var(--eg-subject-chemistry)",
  biology:     "var(--eg-subject-biology)",
  physics:     "var(--eg-subject-physics)",
  mathematics: "var(--eg-subject-mathematics)"
};

export function PlayClient({ studentId, game, missions, initialMissionId, completedMissionIds }: PlayClientProps) {
  const router = useRouter();
  const sortedMissions = useMemo(() => [...missions].sort((a, b) => a.sequence_index - b.sequence_index), [missions]);

  const progressionMode = useMemo<"linear" | "levelSelect" | "trackMap">(() => {
    if (game.progression_mode) return game.progression_mode;
    const hasMixedDifficulty = new Set(sortedMissions.map((m) => m.difficulty)).size > 1;
    return hasMixedDifficulty ? "levelSelect" : "linear";
  }, [game.progression_mode, sortedMissions]);

  const isLevelBased = progressionMode === "levelSelect";
  const isTrackMap   = progressionMode === "trackMap";
  const supportsDifficultyChoice = engineSupportsDifficultyChoice(game.engine_type);
  const skipPreGameScreens = game.engine_type === "change-of-subject";

  const [screen,             setScreen]             = useState<Screen>(skipPreGameScreens ? "runtime" : "title");
  const [activeMissionId,    setActiveMissionId]    = useState(initialMissionId);
  const [playerDifficulty,   setPlayerDifficulty]   = useState<PlayerDifficulty | null>(null);
  const [locallyCompletedIds, setLocallyCompletedIds] = useState(completedMissionIds);
  const [runtimeResetKey,    setRuntimeResetKey]    = useState(0);

  const activeMissionIndex = sortedMissions.findIndex((m) => m.id === activeMissionId);
  const activeMission      = sortedMissions[activeMissionIndex];
  const nextMission        = sortedMissions[activeMissionIndex + 1];

  useEffect(() => {
    if (screen === "entry" && activeMission) {
      track("mission_viewed", {
        studentId,
        gameId:     game.id,
        missionId:  activeMission.id,
        topicId:    activeMission.topic_id,
        subtopicId: activeMission.subtopic_id ?? undefined
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, activeMission?.id, studentId, game.id]);

  if (!activeMission) {
    return <div style={{ textAlign: "center", padding: 60 }}>Mission not found.</div>;
  }

  function resolveAccentColor(): string {
    const target     = (activeMission.payload as { target?: Record<string, number> }).target;
    const protonCount = target?.proton;
    const element    = typeof protonCount === "number" ? getElementByAtomicNumber(protonCount) : undefined;
    if (element) return CATEGORY_COLORS[element.category];
    const gameAccent = getGameTheme(game.slug).accent;
    if (gameAccent && gameAccent !== "var(--eg-brand)") return gameAccent;
    return SUBJECT_FALLBACK_ACCENT[game.subject] ?? "var(--eg-subject-chemistry)";
  }

  function handleRestart() {
    setPlayerDifficulty(null);
    setRuntimeResetKey((k) => k + 1);
    setScreen("entry");
  }

  function handleChangeDifficulty() {
    setRuntimeResetKey((k) => k + 1);
    setScreen("difficulty");
  }

  function handleBack() {
    if (screen === "entry")         { setScreen("title");   return; }
    if (screen === "difficulty")    { setScreen("entry");   return; }
    if (screen === "levelSelect")   { setScreen(supportsDifficultyChoice ? "difficulty" : "entry"); return; }
    if (screen === "missionSelect") { setScreen(supportsDifficultyChoice ? "difficulty" : "entry"); return; }
    if (screen === "title")         { router.push("/worlds"); return; }
    router.push("/worlds");
  }

  const menu = <GameMenu onRestart={handleRestart} onChangeDifficulty={supportsDifficultyChoice ? handleChangeDifficulty : undefined} />;

  // ── TITLE SCREEN ──────────────────────────────────────────────────────────
  if (screen === "title") {
    const totalXp = sortedMissions.reduce((s, m) => s + (m.xp_reward ?? 0), 0);
    return (
      <GameTitleScreen
        gameTitle={game.title}
        subject={game.subject}
        missionTitle={activeMission.title}
        missionCount={sortedMissions.length}
        xpReward={totalXp}
        onPlay={() => setScreen("entry")}
        onBack={() => router.push("/worlds")}
      />
    );
  }

  // ── NARRATION (entry) ─────────────────────────────────────────────────────
  if (screen === "entry") {
    return (
      <NarrationScreen
        key={activeMission.id}
        gameSlug={game.slug}
        subject={game.subject}
        mission={activeMission}
        onStart={() => setScreen("difficulty")}
        onBack={handleBack}
        backLabel="Back"
      />
    );
  }

  // ── STAGE PICKER (difficulty) ─────────────────────────────────────────────
  if (screen === "difficulty") {
    return (
      <DifficultySelectScreen
        subject={game.subject}
        accentColor={resolveAccentColor()}
        onSelect={(difficulty) => {
          setPlayerDifficulty(difficulty);
          if (isLevelBased) {
            resetConceptsSeen(game.engine_type);
            setScreen("levelSelect");
          } else if (isTrackMap) {
            setScreen("missionSelect");
          } else {
            setScreen("runtime");
          }
        }}
        onBack={handleBack}
        playerName={getLocalPlayerName() ?? undefined}
      />
    );
  }

  // ── LEVEL SELECT (levelSelect games — Atom Forge etc.) ───────────────────
  if (screen === "levelSelect") {
    return (
      <PrePlayShell
        gameSlug={game.slug}
        gameTitle={game.title}
        subject={game.subject}
        onBack={handleBack}
        backLabel="Back"
      >
        <LevelSelectScreen
          gameTitle={game.title}
          missions={sortedMissions}
          onSelect={(missionId: string) => {
            resetConceptsSeen(game.engine_type);
            setActiveMissionId(missionId);
            setScreen("runtime");
          }}
        />
      </PrePlayShell>
    );
  }

  // ── MISSION SELECT (trackMap games — vertical list, no swiping) ──────────
  if (screen === "missionSelect") {
    return (
      <PrePlayShell
        gameSlug={game.slug}
        gameTitle={game.title}
        subject={game.subject}
        onBack={handleBack}
        backLabel="Back"
      >
        <MissionSelectScreen
          missions={sortedMissions}
          completedMissionIds={locallyCompletedIds}
          onSelect={(missionId: string) => {
            resetConceptsSeen(game.engine_type);
            setActiveMissionId(missionId);
            setScreen("runtime");
          }}
        />
      </PrePlayShell>
    );
  }

  // ── RUNTIME ───────────────────────────────────────────────────────────────
  return (
    <GameRuntime
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
        id:         activeMission.id,
        missionKey: activeMission.mission_key,
        title:      activeMission.title,
        xpReward:   activeMission.xp_reward,
        topicId:    activeMission.topic_id,
        subtopicId: activeMission.subtopic_id ?? undefined,
        payload:    activeMission.payload,
      }}
      hasNextMission={Boolean(nextMission) && !isLevelBased}
      reviewSuccessLines={[
        `You successfully completed ${activeMission.title}.`,
        ...(isTrackMap && nextMission ? [`🔓 "${nextMission.title}" is now unlocked!`] : [])
      ]}
      playerDifficulty={playerDifficulty}
      isPaused={false}
      menu={menu}
      onMissionSucceeded={() => {
        if (isTrackMap) {
          setLocallyCompletedIds((prev) => new Set(prev).add(activeMission.id));
        }
      }}
      onAdvanceToNextMission={() => {
        if (isTrackMap) {
          if (nextMission) {
            setActiveMissionId(nextMission.id);
            setScreen("runtime");
          } else {
            setScreen("missionSelect");
          }
        } else if (isLevelBased) {
          setScreen("levelSelect");
        } else if (nextMission) {
          setActiveMissionId(nextMission.id);
          if (supportsDifficultyChoice) setScreen("difficulty");
          else setScreen("runtime");
        }
      }}
      onBackToHome={() => router.push("/worlds")}
      onChangeDifficulty={supportsDifficultyChoice ? handleChangeDifficulty : undefined}
      onBackFromConcepts={() => setScreen("runtime")}
      accentColor={resolveAccentColor()}
    />
  );
}
