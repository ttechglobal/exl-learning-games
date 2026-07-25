"use client";

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
import { engineSupportsDifficultyChoice, type PlayerDifficulty } from "@/lib/content/difficultyModifiers";
import { getElementByAtomicNumber, CATEGORY_COLORS } from "@/motion/periodicTableData";
import { track } from "@/lib/analytics/track";
import { resetLearnSeen } from "@/lib/content/contentPrefs";
import type { GameRow, MissionRow } from "@/types/db";

export interface PlayClientProps {
  studentId: string;
  game: GameRow;
  missions: MissionRow[];
  initialMissionId: string;
  completedMissionIds: Set<string>;
}

/**
 * SCREEN FLOW (all game types):
 *
 *   title → entry (narration) → difficulty (stage picker) → [levelSelect | missionSelect] → runtime
 *
 * Linear games:    title → entry → difficulty → runtime
 * LevelSelect:     title → entry → difficulty → levelSelect → runtime
 * TrackMap:        title → entry → difficulty → missionSelect → runtime
 *
 * stepwise-solver: title → entry (narration) → runtime
 *   The engine's own hub handles mode selection — no separate difficulty screen.
 *   The hub has its own back button that returns to this title screen.
 */
type Screen = "title" | "entry" | "difficulty" | "levelSelect" | "missionSelect" | "runtime";

const SUBJECT_FALLBACK_ACCENT: Record<string, string> = {
  chemistry:   "var(--eg-subject-chemistry)",
  biology:     "var(--eg-subject-biology)",
  physics:     "var(--eg-subject-physics)",
  mathematics: "var(--eg-subject-mathematics)"
};

/** Engine types that handle their own mode/difficulty selection internally */
const SELF_SELECTING_ENGINES = ["stepwise-solver", "change-of-subject"];

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

  // stepwise-solver handles its own mode selection — skip difficulty screen,
  // show title + narration, then go straight to runtime (engine hub).
  const isSelfSelecting = SELF_SELECTING_ENGINES.includes(game.engine_type);

  const [screen,               setScreen]             = useState<Screen>("title");
  const [activeMissionId,      setActiveMissionId]    = useState(initialMissionId);
  const [playerDifficulty,     setPlayerDifficulty]   = useState<PlayerDifficulty | null>(null);
  const [locallyCompletedIds,  setLocallyCompletedIds] = useState(completedMissionIds);
  const [runtimeResetKey,      setRuntimeResetKey]    = useState(0);
  const [openInReview,         setOpenInReview]        = useState(false);
  const isPaused = false;

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
    return <div style={{ textAlign: "center", padding: 60, color: "var(--eg-text-dim)" }}>Mission not found.</div>;
  }

  function resolveAccentColor(): string {
    const target     = (activeMission.payload as { target?: Record<string, number> }).target;
    const protonCount = target?.proton;
    const element    = typeof protonCount === "number" ? getElementByAtomicNumber(protonCount) : undefined;
    if (element) return CATEGORY_COLORS[element.category];
    return SUBJECT_FALLBACK_ACCENT[game.subject] ?? "var(--eg-subject-chemistry)";
  }

  function handleRestart() {
    setPlayerDifficulty(null);
    setRuntimeResetKey((k) => k + 1);
    // Self-selecting engines: back button in hub triggers RESTART action,
    // which resets to hub — not to title screen. So restart goes to runtime.
    setScreen(isSelfSelecting ? "runtime" : "entry");
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
    router.push("/worlds");
  }

  /** What screen comes after the narration briefing */
  function afterNarration() {
    if (isSelfSelecting) {
      // Skip difficulty picker — engine handles mode selection in its own hub
      setScreen("runtime");
    } else {
      setScreen("difficulty");
    }
  }

  /** What screen comes after the stage (difficulty) picker */
  function afterStagePicker(difficulty: PlayerDifficulty) {
    setPlayerDifficulty(difficulty);
    if (isLevelBased) {
      resetConceptsSeen(game.engine_type);
      setScreen("levelSelect");
    } else if (isTrackMap) {
      setScreen("missionSelect");
    } else {
      setScreen("runtime");
    }
  }

  const menu = (
    <GameMenu
      onRestart={handleRestart}
      onChangeDifficulty={supportsDifficultyChoice ? handleChangeDifficulty : undefined}
    />
  );

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
        onPlay={() => {
          // stepwise-solver: skip narration — hub is the welcome + mode selector
          if (isSelfSelecting) {
            setScreen("runtime");
          } else {
            setScreen("entry");
          }
        }}
        onBack={() => router.push("/worlds")}
      />
    );
  }

  // ── NARRATION ─────────────────────────────────────────────────────────────
  if (screen === "entry") {
    return (
      <NarrationScreen
        key={activeMission.id}
        gameSlug={game.slug}
        subject={game.subject}
        mission={activeMission}
        onStart={afterNarration}
        onBack={handleBack}
        backLabel="Back"
      />
    );
  }

  // ── STAGE PICKER ──────────────────────────────────────────────────────────
  if (screen === "difficulty") {
    return (
      <DifficultySelectScreen
        subject={game.subject}
        accentColor={resolveAccentColor()}
        onSelect={afterStagePicker}
        onBack={handleBack}
      />
    );
  }

  // ── LEVEL SELECT ──────────────────────────────────────────────────────────
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

  // ── MISSION SELECT ────────────────────────────────────────────────────────
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
      sharedConfig={{
        ...game.shared_config,
        // Inject _allMissions for ALL games — engines that don't need it ignore it.
        // This removes the need for per-engine-type conditionals here.
        _allMissions: sortedMissions.map(m => ({
          id:            m.id,
          missionKey:    m.mission_key,
          title:         m.title,
          difficulty:    m.difficulty,
          sequenceIndex: m.sequence_index,
          xpReward:      m.xp_reward,
          payload:       m.payload,
        })),
        _studentId:   studentId,
        _gameId:      game.id,
        _topicId:     activeMission.topic_id,
        _onBack:      () => setScreen("title"),
      }}
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
        `You successfully completed ${(activeMission.payload as { resultLabel?: string }).resultLabel ?? activeMission.title}.`,
        ...(isTrackMap && nextMission ? [`🔓 "${nextMission.title}" is now unlocked!`] : [])
      ]}
      playerDifficulty={playerDifficulty}
      isPaused={isPaused}
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
      openInReviewMode={openInReview}
      onReviewModeConsumed={() => setOpenInReview(false)}
    />
  );
}