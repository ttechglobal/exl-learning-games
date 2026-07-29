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
import { getLocalPlayerName } from "@/lib/content/localPlayerName";
import { engineSupportsDifficultyChoice, type PlayerDifficulty } from "@/lib/content/difficultyModifiers";
import { getElementByAtomicNumber, CATEGORY_COLORS } from "@/motion/periodicTableData";
import { track } from "@/lib/analytics/track";
import { resetLearnSeen } from "@/lib/content/contentPrefs";
import type { GameRow, MissionRow } from "@/types/db";

export interface PlayClientProps {
  studentId: string;
  studentName?: string | null;
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

export function PlayClient({ studentId, studentName, game, missions, initialMissionId, completedMissionIds }: PlayClientProps) {
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

  // Skip title/narration for games with level selection — go straight to level picker
  const initialScreen: Screen = (!isSelfSelecting && (isLevelBased || sortedMissions.length > 1))
    ? "levelSelect"
    : "title";
  const [screen,               setScreen]             = useState<Screen>(initialScreen);
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
    const restartScreen: Screen = isSelfSelecting ? "runtime"
      : (!isLevelBased && sortedMissions.length <= 1) ? "entry"
      : "levelSelect";
    setScreen(restartScreen);
  }

  function handleChangeDifficulty() {
    setRuntimeResetKey((k) => k + 1);
    setScreen("difficulty");
  }

  function handleBack() {
    if (screen === "entry")         { setScreen("title");   return; }
    if (screen === "difficulty")    { setScreen("entry");   return; }
    if (screen === "levelSelect")   { router.push("/worlds"); return; }
    if (screen === "missionSelect") { router.push("/worlds"); return; }
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
      onExitToLevelSelect={isLevelBased ? () => setScreen("levelSelect") : undefined}
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
        playerName={getLocalPlayerName() ?? undefined}
      />
    );
  }

  // ── LEVEL SELECT ──────────────────────────────────────────────────────────
  if (screen === "levelSelect") {
    return (
      <LevelSelectScreen
        gameTitle={game.title}
        subject={game.subject}
        studentName={studentName ?? undefined}
        coach={((game.shared_config ?? {}) as Record<string, unknown>)?.coach as string | undefined}
        missions={sortedMissions}
        completedMissionIds={locallyCompletedIds}
        onSelect={(missionId: string) => {
          resetConceptsSeen(game.engine_type);
          setActiveMissionId(missionId);
          setScreen("runtime");
        }}
        onBack={handleBack}
      />
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
        studentName: studentName ?? undefined,
        // Session context — all missions of the same difficulty for MCQEngine view-all
        currentMissionIndex: activeMissionIndex,
        allSessionMissions: sortedMissions
          .filter(m => m.difficulty === activeMission.difficulty)
          .map(m => ({
            id: m.id,
            title: m.title,
            missionKey: m.mission_key,
            sequenceIndex: m.sequence_index,
            payload: m.payload,
          })),
        // Inject _allMissions for ALL games — engines that don't need it ignore it.
        _allMissions: sortedMissions.map(m => ({
          id:            m.id,
          missionKey:    m.mission_key,
          title:         m.title,
          difficulty:    m.difficulty,
          sequenceIndex: m.sequence_index,
          xpReward:      m.xp_reward,
          topicId:       m.topic_id,
          subtopicId:    m.subtopic_id ?? undefined,
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
      hasNextMission={Boolean(nextMission)}
      studentName={studentName ?? undefined}
      nextMissionLabel={(() => {
        if (!nextMission) return undefined;
        if (activeMission?.difficulty === nextMission.difficulty) {
          const remaining = sortedMissions.filter(m => m.difficulty === activeMission?.difficulty).length - activeMissionIndex - 1;
          return `Next question (${remaining} left) →`;
        }
        if (nextMission.difficulty === "MEDIUM") return "Go to Practice →";
        if (nextMission.difficulty === "HARD")   return "Go to Challenge →";
        return "Next →";
      })()}
      reviewSuccessLines={[
        nextMission && activeMission?.difficulty === nextMission.difficulty
          ? `Question ${activeMissionIndex + 1} done.`
          : activeMission?.difficulty === "EASY"
            ? "Concept complete! Ready to practice?"
            : activeMission?.difficulty === "MEDIUM"
              ? "Practice done! Ready for a challenge?"
              : "Challenge complete! Well done.",
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
        } else if (nextMission) {
          // Same difficulty group continues — go straight to next mission
          const sameGroup = activeMission?.difficulty === nextMission.difficulty;
          setActiveMissionId(nextMission.id);
          setLocallyCompletedIds(prev => new Set(prev).add(activeMission!.id));
          if (sameGroup) {
            setScreen("runtime");
          } else {
            // Difficulty changed — go back to level select to choose next stage
            setScreen("levelSelect");
          }
        } else {
          // No more missions — back to level select
          setScreen("levelSelect");
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