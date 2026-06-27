"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { TileMatchConfig, TileMatchOutcome, Tier } from "@/engines/tile-match/tileMatch.config";
import { generateClueForTier, buildTileGrid, poolFromSymbols, type Clue } from "@/engines/tile-match/tileMatch.logic";
import { resolveTeachingHint } from "@/engines/tile-match/teachingHints";
import type { HunterElement } from "@/engines/tile-match/elementData";
import { Mascot } from "@/motion/Mascot";
import { playSound } from "@/motion/sound/playSound";
import type { EngineRuntimeProps } from "@/engines/engine-types";
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
 */
export function TileMatchEngine({ config, onComplete }: EngineRuntimeProps<TileMatchConfig, TileMatchOutcome>) {
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
  const [bannerShift, setBannerShift] = useState(false);
  const [mascotPose, setMascotPose] = useState<"idle" | "celebrate" | "encourage" | null>(null);
  /**
   * Replaces the old eliminatedSymbols mechanic (hint = remove one wrong
   * tile from the board) — that was an answer-revealing hint, exactly
   * the pattern flagged as wrong since the platform's original design
   * philosophy doc. Now a hint shows TEACHING TEXT (see
   * teachingHints.ts) explaining the rule behind the current clue, and
   * never touches which tiles are visible or tappable.
   */
  const [activeHintText, setActiveHintText] = useState<string | null>(null);

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
    setActiveHintText(null);
    setBannerShift(false);
    requestAnimationFrame(() => setBannerShift(true));
  }, [currentTier, pool, shared.tileCount]);

  useEffect(() => {
    startNewRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (endedRef.current) return;
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
  }, [timeLeft, score, bestStreak, roundsAnswered, roundsCorrect, currentTier.tier, shared.sessionDurationSec, onComplete]);

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
      if (!clue || tileState[el.symbol]) return;

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
    [clue, tileState, streak, shared.scoring, startNewRound, applyTimePenalty]
  );

  const handleHintTap = useCallback(() => {
    if (!clue) return;
    setActiveHintText(resolveTeachingHint(clue));
    applyTimePenalty(shared.scoring.hintTimePenaltySec);
    playSound("particleRemove");
  }, [clue, shared.scoring.hintTimePenaltySec, applyTimePenalty]);

  const showHintButton = shared.hints.enabled && wrongAttemptsOnClue >= shared.hints.showAfterWrongAttempts;

  return (
    <div className={styles.screen}>
      {/* Environment background layer — see docs/ELEMENT_HUNTER_ENVIRONMENT_BRIEF.md
          for the full art spec. Falls back to a plain CSS gradient (no
          real art file required) until /public/mascot/scene-element-hunter.png
          exists — this <img> simply renders nothing visible if the file
          is missing, so there's no broken-image icon while waiting on
          the asset; the CSS gradient on .screen behind it covers that gap. */}
      <img
        src="/mascot/scene-element-hunter.png"
        alt=""
        role="presentation"
        className={styles.environmentBackdrop}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />

      <div className={styles.hud}>
        <div className={styles.hudCard}>
          <div className={styles.statLabel}>Time</div>
          <div className={`${styles.statValue} ${styles.timer} ${timeLeft <= 10 ? styles.urgent : ""}`}>{timeLeft}</div>
        </div>
        <div className={styles.hudCard}>
          <div className={styles.statLabel}>Score</div>
          <div className={`${styles.statValue} ${styles.score}`}>{score}</div>
          <div className={styles.streakRow}>{streak > 1 ? `\u{1F525} x${streak} streak` : ""}</div>
          <div className={styles.tierBadge}>Tier {currentTier.tier}</div>
        </div>
      </div>

      <div className={`${styles.missionBanner} ${bannerShift ? styles.shifting : ""}`}>
        <div className={styles.missionLabel}>{clue?.label}</div>
        <div className={styles.missionText}>{clue?.text}</div>
      </div>

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
              <div className={styles.tileSymbol}>{el.symbol}</div>
              <div className={styles.tileNumber}>#{el.number}</div>
              <div className={styles.tileName}>{el.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Teaching hint card — replaces the old tile-elimination mechanic.
          Shows the RULE behind the current clue, never which tile is
          correct. Dismissible by tapping it again or starting the next
          round (cleared automatically by startNewRound). */}
      {activeHintText && (
        <div className={styles.hintCard} onClick={() => setActiveHintText(null)}>
          <span className={styles.hintCardIcon}>💡</span>
          <span className={styles.hintCardText}>{activeHintText}</span>
        </div>
      )}

      <div className={styles.hintButtonWrap}>
        {showHintButton && (
          <button className={styles.hintButton} onClick={handleHintTap}>
            <Mascot pose="encourage" widthPx={22} />
            Hint (-{shared.scoring.hintTimePenaltySec}s)
          </button>
        )}
      </div>

      {mascotPose && (
        <div style={{ position: "fixed", bottom: 18, right: 14, zIndex: 7, width: 76 }}>
          <Mascot pose={mascotPose} widthPx={76} />
        </div>
      )}
    </div>
  );
}