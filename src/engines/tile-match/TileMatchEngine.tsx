"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { TileMatchConfig, TileMatchOutcome, Tier } from "@/engines/tile-match/tileMatch.config";
import { generateClueForTier, buildTileGrid, poolFromSymbols, type Clue } from "@/engines/tile-match/tileMatch.logic";
import { resolveTeachingHint } from "@/engines/tile-match/teachingHints";
import type { HunterElement } from "@/engines/tile-match/elementData";
import { Mascot } from "@/motion/Mascot";
import { playSound } from "@/motion/sound/playSound";
import type { EngineRuntimeProps } from "@/engines/engine-types";
import { GameplayShell, type GameplayStat } from "@/components/gameplay/GameplayShell";
import { HintModal, type HintContent } from "@/components/gameplay/HintModal";
import { GAME_ENVIRONMENT_IMAGES } from "@/lib/content/gameEnvironments";
import styles from "@/engines/tile-match/TileMatchEngine.module.css";

/**
 * tile-match engine runtime — Element Hunter.
 *
 * Architectural note: unlike particle-assembly (one mission = one
 * tap-to-submit attempt), this engine treats an entire timed SESSION as
 * the single "mission" GameRuntime expects. It loops many rounds
 * internally — generating a clue, building a tile grid, resolving taps,
 * advancing tiers — entirely inside this component's own state, and calls
 * onComplete exactly once, when the session timer hits zero. This fits the
 * existing one-call-per-mission GameRuntime contract without requiring any
 * change to GameRuntime itself; GameRuntime has no idea Element Hunter's
 * "mission" took 60 seconds and contained 30 rounds internally.
 *
 * MIGRATED onto GameplayShell (gameplay-redesign brief, section 8: "Build
 * One Universal Gameplay Template"). Everything that used to be rendered
 * directly by this component — environment backdrop, HUD cards, the
 * fixed-position menu button, the pause overlay, the mission banner —
 * moved into GameplayShell, which now owns all of that as shared chrome.
 * This component renders ONLY: its own `stats` array (declarative, not
 * fixed markup), its `missionPrompt` (the clue), and `children` (the
 * actual tile grid) — the part of the screen that's genuinely specific to
 * this game. The hint, previously an inline dismissible card competing
 * for screen space with the tile grid, is now a real HintModal overlay
 * (section 7: "a well-designed modal... encourage students to actually
 * read the hint").
 */
export function TileMatchEngine({ config, onComplete, isPaused, menu }: EngineRuntimeProps<TileMatchConfig, TileMatchOutcome>) {
  const { shared } = config;
  const pool = useRef<HunterElement[]>(poolFromSymbols(shared.elementPool)).current;

  const [timeLeft, setTimeLeft] = useState(shared.sessionDurationSec);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [roundsAnswered, setRoundsAnswered] = useState(0);
  const [roundsCorrect, setRoundsCorrect] = useState(0);
  const [tierIndex, setTierIndex] = useState(0);
  const [wrongAttemptsOnClue, setWrongAttemptsOnClue] = useState(0);
  const [mascotPose, setMascotPose] = useState<"idle" | "celebrate" | "encourage" | null>(null);
  /** Now holds structured HintContent for the modal, not a flat string —
   *  see HintModal.tsx / teachingHints.ts for the shape and why it
   *  changed. */
  const [activeHint, setActiveHint] = useState<HintContent | null>(null);

  const [clue, setClue] = useState<Clue | null>(null);
  const [tiles, setTiles] = useState<HunterElement[]>([]);
  const [tileState, setTileState] = useState<Record<string, "correct" | "wrong" | null>>({});

  const tierStartedAtRef = useRef(shared.sessionDurationSec);
  const tierCorrectCountRef = useRef(0);
  const endedRef = useRef(false);

  const currentTier: Tier = shared.tiers[Math.min(tierIndex, shared.tiers.length - 1)];

  const startNewRound = useCallback(() => {
    const newClue = generateClueForTier(currentTier, pool);
    const grid = buildTileGrid(newClue, pool, shared.tileCount);
    setClue(newClue);
    setTiles(grid);
    setTileState({});
    setWrongAttemptsOnClue(0);
    setActiveHint(null);
  }, [currentTier, pool, shared.tileCount]);

  useEffect(() => {
    startNewRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (endedRef.current) return;
    if (isPaused) return;
    if (timeLeft <= 0) {
      endedRef.current = true;
      const timeSpentSec = shared.sessionDurationSec;
      const roughCeiling = shared.sessionDurationSec * 4;
      onComplete({
        success: true,
        score: Math.min(1, score / roughCeiling),
        finalScore: score,
        bestStreak,
        roundsAnswered,
        roundsCorrect,
        highestTierReached: currentTier.tier,
        timeSpentSec
      });
      return;
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, isPaused, score, bestStreak, roundsAnswered, roundsCorrect, currentTier.tier, shared.sessionDurationSec, onComplete]);

  useEffect(() => {
    const secondsAtTier = tierStartedAtRef.current - timeLeft;
    const shouldAdvanceByCorrect = tierCorrectCountRef.current >= currentTier.advanceAfterCorrect;
    const shouldAdvanceByTime = secondsAtTier >= currentTier.advanceAfterSec;
    if ((shouldAdvanceByCorrect || shouldAdvanceByTime) && tierIndex < shared.tiers.length - 1) {
      setTierIndex((i) => i + 1);
      tierStartedAtRef.current = timeLeft;
      tierCorrectCountRef.current = 0;
    }
  }, [timeLeft, tierIndex, currentTier.advanceAfterCorrect, currentTier.advanceAfterSec, shared.tiers.length]);

  const applyTimePenalty = useCallback((sec: number) => {
    setTimeLeft((t) => Math.max(0, t - sec));
  }, []);

  const handleTileTap = useCallback(
    (el: HunterElement) => {
      if (isPaused || !clue || tileState[el.symbol]) return;

      if (clue.isMatch(el)) {
        setTileState((s) => ({ ...s, [el.symbol]: "correct" }));
        const newStreak = streak + 1;
        setStreak(newStreak);
        setBestStreak((b) => Math.max(b, newStreak));
        const bonus = Math.min(newStreak, shared.scoring.streakBonusCap) * shared.scoring.streakBonusPerLevel;
        const points = shared.scoring.baseCorrectPoints + bonus;
        setScore((s) => s + points);
        setRoundsAnswered((r) => r + 1);
        setRoundsCorrect((r) => r + 1);
        tierCorrectCountRef.current += 1;
        playSound("success");
        if (newStreak > 0 && newStreak % 5 === 0) {
          setMascotPose("celebrate");
          setTimeout(() => setMascotPose(null), 900);
        }
        setTimeout(startNewRound, 280);
      } else {
        setTileState((s) => ({ ...s, [el.symbol]: "wrong" }));
        setStreak(0);
        setRoundsAnswered((r) => r + 1);
        setWrongAttemptsOnClue((n) => n + 1);
        applyTimePenalty(shared.scoring.wrongAnswerTimePenaltySec);
        playSound("fail");
        setMascotPose("encourage");
        setTimeout(() => setMascotPose(null), 900);
      }
    },
    [clue, tileState, streak, shared.scoring, startNewRound, applyTimePenalty, isPaused]
  );

  const handleHintTap = useCallback(() => {
    if (!clue) return;
    setActiveHint(resolveTeachingHint(clue));
    applyTimePenalty(shared.scoring.hintTimePenaltySec);
    playSound("particleRemove");
  }, [clue, shared.scoring.hintTimePenaltySec, applyTimePenalty]);

  /**
   * Per the gameplay-redesign brief, section 6: "Instead of appearing only
   * after an incorrect answer, provide a dedicated Hint button... Players
   * may choose whether or not to use it." Previously gated behind
   * wrongAttemptsOnClue >= shared.hints.showAfterWrongAttempts, which was
   * exactly the old "appears after you get it wrong" pattern the brief
   * asks to move away from. The button is now visible for the whole round
   * whenever hints are enabled at all, full stop.
   *
   * wrongAttemptsOnClue itself is left in place (still incremented on a
   * wrong tap, still reset on a new round) even though nothing reads it
   * anymore — it's a one-line hook point for per-clue miss telemetry if
   * that's wanted later, not dead code being smuggled in.
   */
  const showHintButton = shared.hints.enabled;

  const stats: GameplayStat[] = [
    { label: "Time", value: timeLeft, tone: "danger", urgent: timeLeft <= 10 },
    { label: "Score", value: score, tone: "success", caption: streak > 1 ? `\u{1F525} x${streak} streak` : `Tier ${currentTier.tier}` }
  ];

  return (
    <GameplayShell
      environmentImages={GAME_ENVIRONMENT_IMAGES["element-hunter"]}
      fallbackGradient="radial-gradient(ellipse 90% 70% at 50% 0%, #2A3A5C 0%, #1B2438 55%, #11162A 100%)"
      accentColor="var(--eg-subject-chemistry)"
      stats={stats}
      missionPrompt={clue ? { label: clue.label, text: clue.text } : undefined}
      menu={menu}
      isPaused={isPaused}
    >
      {/* Wrapped in one column container — GameplayShell's .gameplayFrame
          is a row flex container by default (it centers a SINGLE child;
          most engines only ever render one). Now that the hint lives
          outside .tileGridPanel as a sibling, both need to be grouped
          together so they stack vertically instead of GameplayShell
          placing them side by side as two separate flex items. */}
      <div className={styles.engineColumn}>
        {/* Backing panel enforces "stay quiet behind the tiles" in code,
            not just by trusting the background image to leave this area
            empty — a solid-ish panel always sits between the environment
            art and the tile grid regardless of what the art actually
            contains. */}
        <div className={styles.tileGridPanel}>
          <div className={styles.tileGrid}>
            {tiles.map((el, i) => (
              <div
                key={el.symbol}
                className={[
                  styles.elementTile,
                  tileState[el.symbol] === "correct" ? styles.correct : "",
                  tileState[el.symbol] === "wrong" ? styles.wrong : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ "--el-color": el.hex, animationDelay: `${i * 0.03}s` } as React.CSSProperties}
                onPointerDown={() => handleTileTap(el)}
              >
                <div className={styles.tileNumber}>{el.number}</div>
                <div className={styles.tileSymbol}>{el.symbol}</div>
                <div className={styles.tileName}>{el.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Hint deliberately lives OUTSIDE .tileGridPanel now, in its own
            zone below it — per direct feedback on both its styling and
            its position. Previously it was squeezed inside the same
            panel as the tile grid, directly beneath the tiles, sharing
            that card's visual space; now it's a clearly separate element
            so it never competes with the grid for room or attention,
            with styling that reads as an inviting "get help" affordance
            (warm, rounded, mascot-led) rather than the flatter, slightly
            warning-toned treatment it had before. */}
        <div className={styles.hintButtonWrap}>
          {showHintButton && (
            <button className={styles.hintButton} onClick={handleHintTap}>
              <Mascot pose="encourage" widthPx={26} />
              <span className={styles.hintButtonText}>
                <span>Use a Hint</span>
                <span className={styles.hintButtonCost}>Costs {shared.scoring.hintTimePenaltySec}s off the clock</span>
              </span>
            </button>
          )}
        </div>
      </div>

      {activeHint && <HintModal content={activeHint} accentColor="var(--eg-subject-chemistry)" onClose={() => setActiveHint(null)} />}

      {mascotPose && (
        <div className={styles.mascotPopup}>
          <Mascot pose={mascotPose} widthPx={76} />
        </div>
      )}
    </GameplayShell>
  );
}