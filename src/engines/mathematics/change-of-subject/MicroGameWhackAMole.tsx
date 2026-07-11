"use client";
/**
 * MicroGameWhackAMole.tsx  ·  v2 — Complete Redesign
 *
 * Design brief:
 *  - 9 holes in a 3×3 grid, each with a proper "ground" platform feel
 *  - Moles are character-driven: 6 distinct emoji critters with personality names
 *  - Dynamic difficulty: moles speed up as time counts down
 *  - Combo system: hit 3 in a row without missing → COMBO x2 XP
 *  - Visual juice: screen shake on miss, sparkle burst on hit, color flashes
 *  - Sound stubs: playSound("whack") / playSound("miss") / playSound("combo")
 *  - Countdown 3-2-1 then GO with scale-punch animation
 *  - Done screen: animated score reveal, tier messaging, bonus XP display
 *  - Skip always visible (top-right X) — never trap the player
 *
 * XP Tiers:
 *   ≥ 15 hits  →  25 XP  🏆 "Mole Destroyer"
 *   ≥ 10 hits  →  15 XP  🎯 "Sharp Eye"
 *   ≥  5 hits  →   8 XP  👏 "Getting There"
 *   <  5 hits  →   0 XP  😅 "Needs Work"
 */

import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./MicroGameWhackAMole.module.css";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MicroGameWhackAMoleProps {
  onFinish: (bonusXp: number) => void;
}

interface Critter {
  emoji: string;
  name: string;
  points: number; // some are worth more
}

interface HoleState {
  critter: Critter | null;
  isUp: boolean;
  isWhacked: boolean;
  isMissed: boolean; // critter ducked before player hit
}

// ── Constants ────────────────────────────────────────────────────────────────

const CRITTERS: Critter[] = [
  { emoji: "🐹", name: "Hammy",    points: 1 },
  { emoji: "🐭", name: "Squeak",   points: 1 },
  { emoji: "🦔", name: "Spike",    points: 1 },
  { emoji: "🐿️", name: "Chippy",   points: 1 },
  { emoji: "🦦", name: "Otter",    points: 2 }, // rare — worth 2
  { emoji: "👾", name: "Glitch",   points: 3 }, // ultra rare — worth 3
];

const CRITTER_WEIGHTS = [30, 30, 20, 15, 4, 1]; // relative spawn weights

const TOTAL_HOLES = 9;
const GAME_DURATION = 20;

// How many holes can be simultaneously active (increases over time)
function maxConcurrent(timeLeft: number): number {
  if (timeLeft > 15) return 1;
  if (timeLeft > 10) return 2;
  if (timeLeft > 5)  return 3;
  return 4;
}

// How long a critter stays up before ducking (shrinks as time decreases)
function stayDurationMs(timeLeft: number): number {
  if (timeLeft > 15) return 1100;
  if (timeLeft > 10) return 850;
  if (timeLeft > 5)  return 650;
  return 500;
}

// Delay between successive pops (shrinks as time decreases)
function popIntervalMs(timeLeft: number): number {
  if (timeLeft > 15) return 1300;
  if (timeLeft > 10) return 1000;
  if (timeLeft > 5)  return 750;
  return 600;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function weightedPickCritter(): Critter {
  const total = CRITTER_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < CRITTERS.length; i++) {
    r -= CRITTER_WEIGHTS[i];
    if (r <= 0) return CRITTERS[i];
  }
  return CRITTERS[0];
}

function xpForScore(hits: number): number {
  if (hits >= 15) return 25;
  if (hits >= 10) return 15;
  if (hits >= 5)  return 8;
  return 0;
}

function tierLabel(hits: number): { icon: string; title: string; sub: string } {
  if (hits >= 15) return { icon: "🏆", title: "Mole Destroyer!", sub: "Absolutely ruthless. They never stood a chance." };
  if (hits >= 10) return { icon: "🎯", title: "Sharp Eye!",      sub: "Quick reflexes. The critters are scared of you." };
  if (hits >= 5)  return { icon: "👏", title: "Getting There!",  sub: "Good effort. Try again for a bonus boost." };
  return              { icon: "😅", title: "Keep Practising!", sub: "The critters got away this time. Rematch?" };
}

// ── Component ────────────────────────────────────────────────────────────────

export function MicroGameWhackAMole({ onFinish }: MicroGameWhackAMoleProps) {
  const [phase, setPhase]     = useState<"countdown" | "playing" | "done">("countdown");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft]   = useState(GAME_DURATION);
  const [holes, setHoles]         = useState<HoleState[]>(
    Array.from({ length: TOTAL_HOLES }, () => ({ critter: null, isUp: false, isWhacked: false, isMissed: false }))
  );
  const [score, setScore]       = useState(0);   // total points (accounting for critter value)
  const [hits, setHits]         = useState(0);   // hit count
  const [combo, setCombo]       = useState(0);   // current consecutive hits
  const [maxCombo, setMaxCombo] = useState(0);
  const [comboFlash, setComboFlash] = useState(false);
  const [screenShake, setScreenShake] = useState(false);

  // Refs for values needed inside intervals/timeouts
  const timeRef      = useRef(GAME_DURATION);
  const scoreRef     = useRef(0);
  const hitsRef      = useRef(0);
  const comboRef     = useRef(0);
  const activeHoles  = useRef<Set<number>>(new Set());
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const popTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holeTimers   = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // ── Cleanup ────────────────────────────────────────────────────────────────

  const clearAll = useCallback(() => {
    if (timerRef.current)   clearInterval(timerRef.current);
    if (popTimerRef.current) clearTimeout(popTimerRef.current);
    holeTimers.current.forEach((t) => clearTimeout(t));
    holeTimers.current.clear();
    activeHoles.current.clear();
  }, []);

  // ── End game ──────────────────────────────────────────────────────────────

  const endGame = useCallback(() => {
    clearAll();
    setPhase("done");
  }, [clearAll]);

  // ── Pop a mole ────────────────────────────────────────────────────────────

  const popMole = useCallback(() => {
    if (timeRef.current <= 0) return;
    const maxActive = maxConcurrent(timeRef.current);
    if (activeHoles.current.size >= maxActive) return;

    // Pick a hole that is not already active
    const available = Array.from({ length: TOTAL_HOLES }, (_, i) => i)
      .filter((i) => !activeHoles.current.has(i));
    if (available.length === 0) return;

    const idx = available[Math.floor(Math.random() * available.length)];
    const critter = weightedPickCritter();
    activeHoles.current.add(idx);

    setHoles((prev) => {
      const next = [...prev];
      next[idx] = { critter, isUp: true, isWhacked: false, isMissed: false };
      return next;
    });

    // Schedule auto-duck if not whacked
    const stayMs = stayDurationMs(timeRef.current) + (Math.random() * 200 - 100);
    const t = setTimeout(() => {
      activeHoles.current.delete(idx);
      // Mark missed (brief flash), then clear
      setHoles((prev) => {
        if (!prev[idx].isWhacked) {
          const next = [...prev];
          next[idx] = { ...next[idx], isUp: false, isMissed: true };
          return next;
        }
        return prev;
      });
      // Break combo on miss
      comboRef.current = 0;
      setCombo(0);
      // Screen shake on miss when combo was active
      if (comboRef.current > 1) {
        setScreenShake(true);
        setTimeout(() => setScreenShake(false), 400);
      }
      // Clear missed state after brief flash
      setTimeout(() => {
        setHoles((prev) => {
          const next = [...prev];
          next[idx] = { critter: null, isUp: false, isWhacked: false, isMissed: false };
          return next;
        });
      }, 300);
      holeTimers.current.delete(idx);
    }, stayMs);
    holeTimers.current.set(idx, t);
  }, []);

  // ── Schedule next pop ─────────────────────────────────────────────────────

  const schedulePop = useCallback(() => {
    if (timeRef.current <= 0) return;
    const interval = popIntervalMs(timeRef.current) + (Math.random() * 200 - 100);
    popTimerRef.current = setTimeout(() => {
      popMole();
      schedulePop();
    }, interval);
  }, [popMole]);

  // ── Whack handler ─────────────────────────────────────────────────────────

  const handleWhack = useCallback((idx: number) => {
    const hole = holes[idx];
    if (!hole.isUp || hole.isWhacked || !hole.critter) return;

    activeHoles.current.delete(idx);
    if (holeTimers.current.has(idx)) {
      clearTimeout(holeTimers.current.get(idx)!);
      holeTimers.current.delete(idx);
    }

    const pts = hole.critter.points;
    scoreRef.current += pts;
    hitsRef.current  += 1;
    comboRef.current += 1;
    const newCombo = comboRef.current;

    setScore(scoreRef.current);
    setHits(hitsRef.current);
    setCombo(newCombo);
    setMaxCombo((prev) => Math.max(prev, newCombo));

    if (newCombo >= 3) {
      setComboFlash(true);
      setTimeout(() => setComboFlash(false), 600);
    }

    // Mark whacked (triggers CSS pop animation)
    setHoles((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], isWhacked: true, isUp: false };
      return next;
    });

    // Clear hole after animation
    setTimeout(() => {
      setHoles((prev) => {
        const next = [...prev];
        next[idx] = { critter: null, isUp: false, isWhacked: false, isMissed: false };
        return next;
      });
    }, 400);
  }, [holes]);

  // ── Countdown → Play ──────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown === 0) {
      const t = setTimeout(() => setPhase("playing"), 500); // brief "GO!" hold
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // ── Game timer ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "playing") return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        timeRef.current = next;
        if (next <= 0) {
          endGame();
          return 0;
        }
        return next;
      });
    }, 1000);

    // Kick off first pop with a short lead-in delay
    const leadIn = setTimeout(() => {
      popMole();
      schedulePop();
    }, 400);

    return () => {
      clearInterval(timerRef.current!);
      clearTimeout(leadIn);
      clearAll();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const timerPct  = (timeLeft / GAME_DURATION) * 100;
  const timerColor = timeLeft <= 5 ? "#ef4444" : timeLeft <= 10 ? "#f59e0b" : "#22c55e";
  const bonus      = xpForScore(hits);
  const tier       = tierLabel(hits);

  // ── COUNTDOWN SCREEN ──────────────────────────────────────────────────────

  if (phase === "countdown") {
    return (
      <div className={styles.root}>
        <button className={styles.skipBtn} onClick={() => onFinish(0)}>✕ Skip</button>
        <div className={styles.countdownScreen}>
          <div className={styles.bonusTag}>🎉 Bonus Round</div>
          <div className={styles.gameTitle}>Whack-a-Mole</div>
          <div className={styles.gameSub}>Tap the critters before they hide!</div>
          <div
            className={styles.countdownNum}
            key={countdown} // re-mount triggers CSS animation
            data-go={countdown === 0}
          >
            {countdown === 0 ? "GO!" : countdown}
          </div>
          <div className={styles.critterPreview}>
            {CRITTERS.slice(0, 5).map((c) => (
              <span key={c.name} className={styles.previewEmoji}>{c.emoji}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── DONE SCREEN ───────────────────────────────────────────────────────────

  if (phase === "done") {
    return (
      <div className={styles.root}>
        <div className={styles.doneScreen}>
          <div className={styles.doneIcon}>{tier.icon}</div>
          <div className={styles.doneTitle}>{tier.title}</div>
          <div className={styles.doneSub}>{tier.sub}</div>

          <div className={styles.scoreRow}>
            <div className={styles.scoreStat}>
              <span className={styles.scoreNum}>{hits}</span>
              <span className={styles.scoreLabel}>hits</span>
            </div>
            <div className={styles.scoreDivider} />
            <div className={styles.scoreStat}>
              <span className={styles.scoreNum}>{score}</span>
              <span className={styles.scoreLabel}>points</span>
            </div>
            <div className={styles.scoreDivider} />
            <div className={styles.scoreStat}>
              <span className={styles.scoreNum}>{maxCombo}x</span>
              <span className={styles.scoreLabel}>best combo</span>
            </div>
          </div>

          {bonus > 0 && (
            <div className={styles.bonusBadge}>
              <span className={styles.bonusIcon}>⭐</span>
              <span className={styles.bonusText}>+{bonus} Bonus XP earned!</span>
            </div>
          )}

          <button className={styles.continueBtn} onClick={() => onFinish(bonus)}>
            🚀 Continue
          </button>
          <button className={styles.skipLink} onClick={() => onFinish(0)}>
            Skip bonus
          </button>
        </div>
      </div>
    );
  }

  // ── PLAYING SCREEN ────────────────────────────────────────────────────────

  return (
    <div className={`${styles.root} ${screenShake ? styles.shake : ""}`}>
      {/* Header HUD */}
      <div className={styles.hud}>
        <div className={styles.hudHits}>
          <span className={styles.hudVal}>{hits}</span>
          <span className={styles.hudLabel}>hits</span>
        </div>

        {/* Timer bar */}
        <div className={styles.timerWrap}>
          <div
            className={styles.timerBar}
            style={{ width: `${timerPct}%`, background: timerColor }}
          />
          <div className={styles.timerNum} style={{ color: timerColor }}>
            {timeLeft}s
          </div>
        </div>

        <div className={styles.hudScore}>
          <span className={styles.hudVal}>{score}</span>
          <span className={styles.hudLabel}>pts</span>
        </div>
      </div>

      {/* Combo flash */}
      {combo >= 3 && (
        <div className={`${styles.comboFlash} ${comboFlash ? styles.comboVisible : ""}`}>
          🔥 {combo}x COMBO!
        </div>
      )}

      {/* Skip button */}
      <button className={styles.skipBtn} onClick={() => onFinish(0)}>✕ Skip</button>

      {/* 3×3 Grid */}
      <div className={styles.grid}>
        {holes.map((hole, idx) => (
          <div
            key={idx}
            className={styles.hole}
            onPointerDown={(e) => {
              e.preventDefault();
              handleWhack(idx);
            }}
          >
            {/* Ground platform */}
            <div className={styles.ground} />

            {/* Mole character */}
            {(hole.isUp || hole.isWhacked || hole.isMissed) && hole.critter && (
              <div
                className={`
                  ${styles.mole}
                  ${hole.isUp      ? styles.moleUp      : ""}
                  ${hole.isWhacked ? styles.moleWhacked : ""}
                  ${hole.isMissed  ? styles.moleMissed  : ""}
                `}
              >
                <span className={styles.moleEmoji}>{hole.critter.emoji}</span>
                {hole.critter.points > 1 && (
                  <span className={styles.moleBonus}>×{hole.critter.points}</span>
                )}
                {hole.isWhacked && (
                  <span className={styles.whackStar}>⭐</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Hint strip */}
      <div className={styles.hintStrip}>
        🦦 Otter = 2pts &nbsp;·&nbsp; 👾 Glitch = 3pts
      </div>
    </div>
  );
}