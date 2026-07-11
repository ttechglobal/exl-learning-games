"use client";
/**
 * WhackAMoleEngine.tsx
 *
 * Standalone Whack-a-Mole game — extracted from change-of-subject's
 * MicroGameWhackAMole and rebuilt as a full first-class engine.
 *
 * Folder: src/engines/cross-subject/whack-a-mole/
 *
 * Changes from the embedded version:
 *  - Full instruction modal before play (not just a countdown)
 *  - 5 progressive difficulty waves (not just speed ramping)
 *  - Subject-aware: subject passed in as prop, future content can be
 *    themed per-subject (e.g. show formula fragments on moles)
 *  - Persistent high score via localStorage
 *  - Clean standalone layout — not fixed-position overlay
 *  - Works as a proper game engine (onComplete callback shape matches
 *    the platform's AttemptResult contract)
 *
 * Difficulty Waves (each 8 seconds of a 40s game):
 *   Wave 1 — 1 mole at a time, slow pops (1100ms stay, 1300ms gap)
 *   Wave 2 — up to 2 moles, medium speed
 *   Wave 3 — up to 3 moles, faster
 *   Wave 4 — up to 4 moles, fast; rare "bomb" moles appear (don't tap!)
 *   Wave 5 — up to 5 moles, frantic; golden moles worth 5pts
 */

import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./WhackAMoleEngine.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WhackAMoleEngineProps {
  subject?: string;
  onComplete?: (result: { score: number; hits: number; maxCombo: number; xp: number }) => void;
  onExit?: () => void;
}

type Phase = "instructions" | "countdown" | "playing" | "waveTransition" | "done";

interface Critter {
  emoji: string;
  name: string;
  points: number;
  isBomb?: boolean;    // tap = lose points + combo break
  isGolden?: boolean;  // only in wave 5, worth 5pts
  weight: number;
}

interface HoleState {
  critter: Critter | null;
  isUp: boolean;
  isWhacked: boolean;
  isMissed: boolean;
  isBombHit: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TOTAL_HOLES = 9;
const GAME_DURATION = 40; // 5 waves × 8s
const WAVE_DURATION = 8;
const TOTAL_WAVES = 5;

const BASE_CRITTERS: Critter[] = [
  { emoji: "🐹", name: "Hammy",  points: 1, weight: 30 },
  { emoji: "🐭", name: "Squeak", points: 1, weight: 28 },
  { emoji: "🦔", name: "Spike",  points: 1, weight: 20 },
  { emoji: "🐿️", name: "Chippy", points: 1, weight: 15 },
  { emoji: "🦦", name: "Otter",  points: 2, weight: 5  }, // rare, worth 2
];

const BOMB_CRITTER: Critter = { emoji: "💣", name: "Bomb", points: -2, isBomb: true, weight: 0 };
const GOLDEN_CRITTER: Critter = { emoji: "⭐", name: "Golden", points: 5, isGolden: true, weight: 0 };

interface WaveConfig {
  label: string;
  maxConcurrent: number;
  stayMs: number;       // how long critter stays up
  popIntervalMs: number; // delay between new pops
  bombChance: number;   // 0–1 chance per pop of spawning a bomb (wave 4+)
  goldenChance: number; // 0–1 chance per pop of spawning a golden (wave 5)
}

const WAVES: WaveConfig[] = [
  { label: "Wave 1", maxConcurrent: 1, stayMs: 1100, popIntervalMs: 1300, bombChance: 0,    goldenChance: 0    },
  { label: "Wave 2", maxConcurrent: 2, stayMs: 900,  popIntervalMs: 1050, bombChance: 0,    goldenChance: 0    },
  { label: "Wave 3", maxConcurrent: 3, stayMs: 700,  popIntervalMs: 800,  bombChance: 0,    goldenChance: 0    },
  { label: "Wave 4", maxConcurrent: 4, stayMs: 560,  popIntervalMs: 650,  bombChance: 0.15, goldenChance: 0    },
  { label: "Wave 5", maxConcurrent: 5, stayMs: 440,  popIntervalMs: 520,  bombChance: 0.12, goldenChance: 0.10 },
];

const LS_HIGH_SCORE = "exl-wam-highscore";

function safeLS(key: string, fb: number): number {
  try { return parseInt(localStorage.getItem(key) ?? String(fb), 10) || fb; } catch { return fb; }
}
function safeLSSet(key: string, v: number) {
  try { localStorage.setItem(key, String(v)); } catch { /* noop */ }
}

function weightedPickCritter(wave: number): Critter {
  const w = WAVES[wave];

  // Check for special critters first
  if (w.goldenChance > 0 && Math.random() < w.goldenChance) return GOLDEN_CRITTER;
  if (w.bombChance  > 0 && Math.random() < w.bombChance)  return BOMB_CRITTER;

  const pool = BASE_CRITTERS;
  const total = pool.reduce((a, c) => a + c.weight, 0);
  let r = Math.random() * total;
  for (const c of pool) {
    r -= c.weight;
    if (r <= 0) return c;
  }
  return pool[0];
}

function xpForScore(score: number): number {
  if (score >= 40) return 50;
  if (score >= 28) return 35;
  if (score >= 18) return 20;
  if (score >= 10) return 10;
  return 0;
}

function tierLabel(score: number) {
  if (score >= 40) return { icon: "🏆", title: "Mole Legend!",     sub: "Perfect reflexes. You're unstoppable." };
  if (score >= 28) return { icon: "🎯", title: "Mole Destroyer!",  sub: "Sharp eyes and faster hands. Impressive." };
  if (score >= 18) return { icon: "⚡", title: "Quick Fingers!",   sub: "You've got the hang of it. Try for more!" };
  if (score >= 10) return { icon: "👏", title: "Getting There!",   sub: "Good effort — the critters are nervous." };
  return               { icon: "😅", title: "Keep Practising!",  sub: "They got away this time. Rematch?" };
}

// ── Component ──────────────────────────────────────────────────────────────────

export function WhackAMoleEngine({ onComplete, onExit }: WhackAMoleEngineProps) {
  const [phase, setPhase]       = useState<Phase>("instructions");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft]  = useState(GAME_DURATION);
  const [currentWave, setCurrentWave] = useState(0);
  const [waveAnnounce, setWaveAnnounce] = useState(false);

  const [holes, setHoles] = useState<HoleState[]>(
    Array.from({ length: TOTAL_HOLES }, () => ({
      critter: null, isUp: false, isWhacked: false, isMissed: false, isBombHit: false,
    }))
  );

  const [score, setScore]     = useState(0);
  const [hits, setHits]       = useState(0);
  const [combo, setCombo]     = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [comboFlash, setComboFlash] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const [bombFlash, setBombFlash]   = useState(false);
  const [highScore, setHighScore]   = useState(0);
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  const timeRef     = useRef(GAME_DURATION);
  const scoreRef    = useRef(0);
  const hitsRef     = useRef(0);
  const comboRef    = useRef(0);
  const waveRef     = useRef(0);
  const activeHoles = useRef<Set<number>>(new Set());
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const popTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holeTimers  = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    setHighScore(safeLS(LS_HIGH_SCORE, 0));
  }, []);

  const clearAll = useCallback(() => {
    if (timerRef.current)    clearInterval(timerRef.current);
    if (popTimerRef.current) clearTimeout(popTimerRef.current);
    holeTimers.current.forEach(t => clearTimeout(t));
    holeTimers.current.clear();
    activeHoles.current.clear();
  }, []);

  const endGame = useCallback(() => {
    clearAll();
    const finalScore = scoreRef.current;
    const prev = safeLS(LS_HIGH_SCORE, 0);
    if (finalScore > prev) {
      safeLSSet(LS_HIGH_SCORE, finalScore);
      setHighScore(finalScore);
      setIsNewHighScore(true);
    }
    setPhase("done");
  }, [clearAll]);

  const popMole = useCallback(() => {
    if (timeRef.current <= 0) return;
    const wave = waveRef.current;
    const waveCfg = WAVES[wave];
    if (activeHoles.current.size >= waveCfg.maxConcurrent) return;

    const available = Array.from({ length: TOTAL_HOLES }, (_, i) => i)
      .filter(i => !activeHoles.current.has(i));
    if (available.length === 0) return;

    const idx = available[Math.floor(Math.random() * available.length)];
    const critter = weightedPickCritter(wave);
    activeHoles.current.add(idx);

    setHoles(prev => {
      const next = [...prev];
      next[idx] = { critter, isUp: true, isWhacked: false, isMissed: false, isBombHit: false };
      return next;
    });

    const jitter = Math.random() * 180 - 90;
    const stayMs = waveCfg.stayMs + jitter;

    const t = setTimeout(() => {
      activeHoles.current.delete(idx);
      setHoles(prev => {
        if (!prev[idx].isWhacked && !prev[idx].isBombHit) {
          const next = [...prev];
          next[idx] = { ...next[idx], isUp: false, isMissed: true };
          // break combo on miss (non-bomb duck)
          if (!prev[idx].critter?.isBomb) {
            comboRef.current = 0;
            setCombo(0);
          }
          return next;
        }
        return prev;
      });
      setTimeout(() => {
        setHoles(prev => {
          const next = [...prev];
          next[idx] = { critter: null, isUp: false, isWhacked: false, isMissed: false, isBombHit: false };
          return next;
        });
      }, 320);
      holeTimers.current.delete(idx);
    }, stayMs);
    holeTimers.current.set(idx, t);
  }, []);

  const schedulePop = useCallback(() => {
    if (timeRef.current <= 0) return;
    const wave = waveRef.current;
    const waveCfg = WAVES[Math.min(wave, WAVES.length - 1)];
    const jitter = Math.random() * 150 - 75;
    popTimerRef.current = setTimeout(() => {
      popMole();
      schedulePop();
    }, waveCfg.popIntervalMs + jitter);
  }, [popMole]);

  const handleWhack = useCallback((idx: number) => {
    setHoles(prev => {
      const hole = prev[idx];
      if (!hole.isUp || hole.isWhacked || hole.isBombHit || !hole.critter) return prev;

      activeHoles.current.delete(idx);
      if (holeTimers.current.has(idx)) {
        clearTimeout(holeTimers.current.get(idx)!);
        holeTimers.current.delete(idx);
      }

      const pts = hole.critter.points;
      const isBomb = !!hole.critter.isBomb;

      if (isBomb) {
        // Bomb hit: lose points, break combo, flash
        const newScore = Math.max(0, scoreRef.current + pts); // pts is negative
        scoreRef.current = newScore;
        comboRef.current = 0;
        setScore(newScore);
        setCombo(0);
        setBombFlash(true);
        setScreenShake(true);
        setTimeout(() => { setBombFlash(false); setScreenShake(false); }, 500);

        const next = [...prev];
        next[idx] = { ...next[idx], isUp: false, isBombHit: true, isWhacked: false };
        setTimeout(() => {
          setHoles(p => {
            const n = [...p];
            n[idx] = { critter: null, isUp: false, isWhacked: false, isMissed: false, isBombHit: false };
            return n;
          });
        }, 400);
        return next;
      }

      // Normal whack
      scoreRef.current += pts;
      hitsRef.current  += 1;
      comboRef.current += 1;
      const newCombo = comboRef.current;

      setScore(scoreRef.current);
      setHits(hitsRef.current);
      setCombo(newCombo);
      setMaxCombo(mc => Math.max(mc, newCombo));

      if (newCombo >= 3) {
        setComboFlash(true);
        setTimeout(() => setComboFlash(false), 600);
      }

      const next = [...prev];
      next[idx] = { ...next[idx], isWhacked: true, isUp: false };
      setTimeout(() => {
        setHoles(p => {
          const n = [...p];
          n[idx] = { critter: null, isUp: false, isWhacked: false, isMissed: false, isBombHit: false };
          return n;
        });
      }, 380);
      return next;
    });
  }, []);

  // Countdown → playing
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown === 0) {
      const t = setTimeout(() => setPhase("playing"), 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // Game timer + wave transitions
  useEffect(() => {
    if (phase !== "playing") return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        timeRef.current = next;

        // Wave transitions
        const elapsed = GAME_DURATION - next;
        const newWave = Math.min(Math.floor(elapsed / WAVE_DURATION), TOTAL_WAVES - 1);
        if (newWave !== waveRef.current) {
          waveRef.current = newWave;
          setCurrentWave(newWave);
          setWaveAnnounce(true);
          setTimeout(() => setWaveAnnounce(false), 1200);
        }

        if (next <= 0) {
          endGame();
          return 0;
        }
        return next;
      });
    }, 1000);

    const leadIn = setTimeout(() => {
      popMole();
      schedulePop();
    }, 300);

    return () => {
      clearInterval(timerRef.current!);
      clearTimeout(leadIn);
      clearAll();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const timerPct   = (timeLeft / GAME_DURATION) * 100;
  const timerColor = timeLeft <= 6 ? "#ef4444" : timeLeft <= 14 ? "#f59e0b" : "#22c55e";
  const finalXp    = xpForScore(scoreRef.current);
  const tier       = tierLabel(scoreRef.current);

  // ── INSTRUCTIONS ──────────────────────────────────────────────────────────

  if (phase === "instructions") {
    return (
      <div className={styles.root}>
        <div className={styles.instructionModal}>
          <div className={styles.instrHeader}>
            <div className={styles.instrIcon}>🐹</div>
            <h2 className={styles.instrTitle}>Whack-a-Mole</h2>
            <p className={styles.instrSub}>40 seconds. 5 waves. How many can you hit?</p>
          </div>

          <div className={styles.instrRules}>
            <div className={styles.instrRule}>
              <span className={styles.instrRuleIco}>👆</span>
              <div>
                <strong>Tap the critters</strong> as they pop up from their holes. Be quick — they duck back down fast!
              </div>
            </div>
            <div className={styles.instrRule}>
              <span className={styles.instrRuleIco}>🔥</span>
              <div>
                <strong>Build combos</strong> — hit 3 or more in a row without missing for a combo streak.
              </div>
            </div>
            <div className={styles.instrRule}>
              <span className={styles.instrRuleIco}>⚡</span>
              <div>
                <strong>Waves get faster</strong> — more moles pop up and they stay up shorter as each wave hits.
              </div>
            </div>
            <div className={styles.instrRule}>
              <span className={styles.instrRuleIco}>💣</span>
              <div>
                <strong>Avoid bombs!</strong> They appear from wave 4. Tapping one costs you 2 points and breaks your combo.
              </div>
            </div>
          </div>

          <div className={styles.instrCrewRow}>
            <div className={styles.instrCrewItem}>
              <span>🐹🐭🦔🐿️</span>
              <span className={styles.instrCrewPts}>= 1 pt</span>
            </div>
            <div className={styles.instrCrewItem}>
              <span>🦦</span>
              <span className={styles.instrCrewPts}>= 2 pts (rare!)</span>
            </div>
            <div className={styles.instrCrewItem}>
              <span>⭐</span>
              <span className={styles.instrCrewPts}>= 5 pts (wave 5 only!)</span>
            </div>
            <div className={styles.instrCrewItem}>
              <span>💣</span>
              <span className={styles.instrCrewPts} style={{ color: "#ef4444" }}>= −2 pts (avoid!)</span>
            </div>
          </div>

          <button
            className={styles.instrStartBtn}
            onClick={() => { setPhase("countdown"); setCountdown(3); }}
          >
            Let&apos;s Go! 🚀
          </button>

          {onExit && (
            <button className={styles.instrExitBtn} onClick={onExit}>
              Back
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── COUNTDOWN ─────────────────────────────────────────────────────────────

  if (phase === "countdown") {
    return (
      <div className={styles.root}>
        <div className={styles.countdownScreen}>
          <div className={styles.countdownNum} key={countdown} data-go={countdown === 0}>
            {countdown === 0 ? "GO!" : countdown}
          </div>
          <p className={styles.countdownHint}>
            {countdown === 3 ? "Get ready…" : countdown === 2 ? "Eyes on the holes…" : countdown === 1 ? "Almost…" : "TAP THEM!"}
          </p>
        </div>
      </div>
    );
  }

  // ── DONE ──────────────────────────────────────────────────────────────────

  if (phase === "done") {
    const finalScore = scoreRef.current;
    return (
      <div className={styles.root}>
        <div className={styles.doneScreen}>
          {isNewHighScore && (
            <div className={styles.newHighScore}>🎉 New High Score!</div>
          )}
          <div className={styles.doneIcon}>{tier.icon}</div>
          <div className={styles.doneTitle}>{tier.title}</div>
          <div className={styles.doneSub}>{tier.sub}</div>

          <div className={styles.scoreGrid}>
            <div className={styles.scoreStat}>
              <span className={styles.scoreNum}>{finalScore}</span>
              <span className={styles.scoreLabel}>points</span>
            </div>
            <div className={styles.scoreDivider} />
            <div className={styles.scoreStat}>
              <span className={styles.scoreNum}>{hitsRef.current}</span>
              <span className={styles.scoreLabel}>hits</span>
            </div>
            <div className={styles.scoreDivider} />
            <div className={styles.scoreStat}>
              <span className={styles.scoreNum}>{maxCombo}×</span>
              <span className={styles.scoreLabel}>best combo</span>
            </div>
          </div>

          <div className={styles.highScoreRow}>
            <span className={styles.highScoreLabel}>🏅 High score</span>
            <span className={styles.highScoreVal}>{highScore}</span>
          </div>

          {finalXp > 0 && (
            <div className={styles.xpBadge}>
              ✦ +{finalXp} XP earned
            </div>
          )}

          <button
            className={styles.donePlayAgain}
            onClick={() => {
              // Reset all state
              scoreRef.current = 0; hitsRef.current = 0;
              comboRef.current = 0; waveRef.current = 0;
              timeRef.current = GAME_DURATION;
              setScore(0); setHits(0); setCombo(0); setMaxCombo(0);
              setTimeLeft(GAME_DURATION); setCurrentWave(0);
              setIsNewHighScore(false);
              setHoles(Array.from({ length: TOTAL_HOLES }, () => ({
                critter: null, isUp: false, isWhacked: false, isMissed: false, isBombHit: false,
              })));
              setPhase("instructions");
            }}
          >
            Play Again
          </button>

          {onComplete && (
            <button
              className={styles.doneContinueBtn}
              onClick={() => onComplete({ score: finalScore, hits: hitsRef.current, maxCombo, xp: finalXp })}
            >
              Continue →
            </button>
          )}

          {onExit && (
            <button className={styles.doneExitBtn} onClick={onExit}>
              Back to Worlds
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── PLAYING ───────────────────────────────────────────────────────────────

  return (
    <div className={`${styles.root} ${screenShake ? styles.shake : ""} ${bombFlash ? styles.bombFlash : ""}`}>
      {/* HUD */}
      <div className={styles.hud}>
        <div className={styles.hudStat}>
          <span className={styles.hudVal}>{score}</span>
          <span className={styles.hudLabel}>pts</span>
        </div>

        <div className={styles.hudCenter}>
          {waveAnnounce && (
            <div className={styles.waveAnnounce} key={currentWave}>
              {WAVES[currentWave].label}!
            </div>
          )}
          <div className={styles.timerTrack}>
            <div
              className={styles.timerFill}
              style={{ width: `${timerPct}%`, background: timerColor }}
            />
          </div>
          <div className={styles.timerNum} style={{ color: timerColor }}>
            {timeLeft}s
          </div>
        </div>

        <div className={styles.hudStat}>
          <span className={styles.hudVal}>{hits}</span>
          <span className={styles.hudLabel}>hits</span>
        </div>
      </div>

      {/* Wave indicator */}
      <div className={styles.waveRow}>
        {WAVES.map((_, i) => (
          <div
            key={i}
            className={`${styles.wavePip} ${i <= currentWave ? styles.wavePipActive : ""}`}
          />
        ))}
        <span className={styles.waveLabel}>{WAVES[currentWave].label}</span>
      </div>

      {/* Combo strip */}
      <div className={`${styles.comboStrip} ${combo >= 3 && comboFlash ? styles.comboVisible : ""}`}>
        🔥 {combo}× COMBO!
      </div>

      {/* Skip */}
      <button className={styles.skipBtn} onClick={() => { clearAll(); endGame(); }}>✕</button>

      {/* Grid */}
      <div className={styles.grid}>
        {holes.map((hole, idx) => (
          <button
            key={idx}
            className={styles.holeBtn}
            onPointerDown={e => { e.preventDefault(); handleWhack(idx); }}
          >
            <div className={styles.ground} />
            <div className={styles.moleWrap}>
              {(hole.isUp || hole.isWhacked || hole.isMissed || hole.isBombHit) && hole.critter && (
                <div
                  className={[
                    styles.mole,
                    hole.isUp        ? styles.moleUp      : "",
                    hole.isWhacked   ? styles.moleWhacked : "",
                    hole.isMissed    ? styles.moleMissed  : "",
                    hole.isBombHit   ? styles.moleBombHit : "",
                    hole.critter.isGolden ? styles.moleGolden : "",
                    hole.critter.isBomb   ? styles.moleBomb   : "",
                  ].filter(Boolean).join(" ")}
                >
                  <span className={styles.moleEmoji}>{hole.critter.emoji}</span>
                  {hole.critter.points > 1 && !hole.critter.isBomb && (
                    <span className={styles.molePts}>+{hole.critter.points}</span>
                  )}
                  {hole.critter.isBomb && (
                    <span className={styles.molePtsBomb}>−2</span>
                  )}
                  {hole.isWhacked && !hole.critter.isBomb && (
                    <span className={styles.whackBurst}>💥</span>
                  )}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Hint */}
      <div className={styles.hintRow}>
        🦦 2pts · ⭐ 5pts (wave 5) · 💣 Avoid!
      </div>
    </div>
  );
}