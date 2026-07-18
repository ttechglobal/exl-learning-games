"use client";

/**
 * engines/chemistry/matter-sort/MatterSortEngine.tsx
 *
 * Mechanic: parchment property cards drift upward through the play area.
 * Student drags each card to the correct state column (Solid / Liquid / Gas)
 * or, in Mission 3, to the correct transition arrow (Solid↔Liquid, etc.).
 *
 * The placement IS the answer — no submit button. The moment the card crosses
 * a column boundary on pointer-up, the engine evaluates and responds.
 *
 * Drag: Pointer Events API (pointerdown/pointermove/pointerup) — works on
 * both mouse and touch with no library needed.
 *
 * GameRuntime passes config as { shared: MatterSortSharedConfig, mission }.
 * Mission payload can override columns and cardPool for M3 (transition arrows).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { GameplayShell } from "@/components/gameplay/GameplayShell";
import type { EngineRuntimeProps } from "@/engines/engine-types";
import type {
  MatterSortConfig,
  MatterSortOutcome,
  Column,
  SortCard,
  ColumnDef,
} from "./matterSort.config";
import {
  drawCards,
  isCorrectPlacement,
  calculatePoints,
  generateCardX,
  applyDifficulty,
} from "./matterSort.logic";
import styles from "./MatterSortEngine.module.css";

// ─── Column class map ─────────────────────────────────────────────────────────

const COL_CLASS: Record<Column, string> = {
  solid:          styles.colSolid,
  liquid:         styles.colLiquid,
  gas:            styles.colGas,
  "solid-liquid": styles.colSolidLiquid,
  "liquid-gas":   styles.colLiquidGas,
  "solid-gas":    styles.colSolidGas,
};

// ─── Active card ──────────────────────────────────────────────────────────────

interface ActiveCard {
  instanceKey: string; // unique key per card appearance (id + spawn counter)
  card: SortCard;
  xFraction: number;
  driftDuration: number;
  feedbackState: "idle" | "correct" | "wrong";
  wrongCount: number;
  hintShown: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MatterSortEngine({
  config: rawConfig,
  onComplete,
  menu,
  isPaused,
}: EngineRuntimeProps) {
  const cfg = rawConfig as MatterSortConfig;
  const { shared } = cfg;
  const missionPayload = cfg.mission?.payload as MatterSortConfig["mission"]["payload"] ?? {};

  // Mission-level overrides (M3: transition arrows + different card pool)
  const columns: ColumnDef[] = missionPayload.columnsOverride ?? shared.columns;
  const cardPool: SortCard[] = missionPayload.cardPoolOverride ?? shared.cardPool;

  // Difficulty
  const rawDiff = missionPayload.difficulty ?? "MEDIUM";
  const difficulty = (["EASY","MEDIUM","HARD"].includes(rawDiff) ? rawDiff : "MEDIUM") as "EASY"|"MEDIUM"|"HARD";
  const params = applyDifficulty(shared, difficulty);

  // ── State ─────────────────────────────────────────────────────────────────

  const [timeLeft, setTimeLeft]         = useState(params.sessionDurationSec);
  const [score, setScore]               = useState(0);
  const [streak, setStreak]             = useState(0);
  const [bestStreak, setBestStreak]     = useState(0);
  const [cardsCorrect, setCardsCorrect] = useState(0);
  const [cardsAttempted, setCardsAttempted] = useState(0);
  const [activeCards, setActiveCards]   = useState<ActiveCard[]>([]);
  const [colCounts, setColCounts]       = useState<Record<string, number>>(
    Object.fromEntries(columns.map(c => [c.id, 0]))
  );
  const [penaltyVisible, setPenaltyVisible] = useState(false);
  const [hintCard, setHintCard]         = useState<SortCard | null>(null);
  const [dragOverCol, setDragOverCol]   = useState<Column | null>(null);

  const recentlyUsed  = useRef(new Set<string>());
  const spawnCounter  = useRef(0);
  const sessionDone   = useRef(false);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const colRefs       = useRef<Record<Column, HTMLDivElement | null>>(
    Object.fromEntries(columns.map(c => [c.id, null])) as Record<Column, HTMLDivElement | null>
  );
  const draggingId    = useRef<string | null>(null);

  // ── Spawn cards ───────────────────────────────────────────────────────────

  const spawnCards = useCallback((existing: ActiveCard[]): ActiveCard[] => {
    const needed = params.cardsOnScreen - existing.length;
    if (needed <= 0) return existing;

    const activeIds = new Set(existing.map(c => c.card.id));
    const drawn = drawCards(cardPool, activeIds, recentlyUsed.current, needed);

    // Track recently used to encourage variety
    drawn.forEach(c => {
      recentlyUsed.current.add(c.id);
      if (recentlyUsed.current.size > Math.floor(cardPool.length * 0.6)) {
        const oldest = recentlyUsed.current.values().next().value;
        if (oldest) recentlyUsed.current.delete(oldest);
      }
    });

    const newCards: ActiveCard[] = drawn.map((card, i) => ({
      instanceKey: `${card.id}-${++spawnCounter.current}`,
      card,
      xFraction: generateCardX(existing.length + i, params.cardsOnScreen),
      driftDuration: params.driftDurationSec + (Math.random() - 0.5) * 2,
      feedbackState: "idle",
      wrongCount: 0,
      hintShown: false,
    }));

    return [...existing, ...newCards];
  }, [params, cardPool]);

  // ── Initial spawn ─────────────────────────────────────────────────────────

  useEffect(() => {
    setActiveCards(prev => spawnCards(prev));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only

  // ── Timer ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isPaused || sessionDone.current) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPaused]);

  // ── Session end ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (timeLeft === 0 && !sessionDone.current) {
      sessionDone.current = true;
      const outcome: MatterSortOutcome = {
        success: true,
        score,
        cardsCorrect,
        cardsAttempted,
        bestStreak,
        timeSpentSec: params.sessionDurationSec,
      };
      onComplete(outcome as unknown as never);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // ── Placement handler ─────────────────────────────────────────────────────

  const handlePlacement = useCallback((instanceKey: string, column: Column) => {
    setActiveCards(prev => {
      const idx = prev.findIndex(c => c.instanceKey === instanceKey);
      if (idx === -1) return prev;
      const ac = prev[idx];
      const correct = isCorrectPlacement(ac.card, column);

      setCardsAttempted(a => a + 1);

      if (correct) {
        setStreak(s => {
          const ns = s + 1;
          setBestStreak(b => Math.max(b, ns));
          const pts = calculatePoints(shared, ns);
          setScore(sc => sc + pts);
          return ns;
        });
        setCardsCorrect(c => c + 1);
        setColCounts(cc => ({ ...cc, [column]: (cc[column] ?? 0) + 1 }));

        // Mark correct → dissolve → respawn
        const updated = [...prev];
        updated[idx] = { ...ac, feedbackState: "correct" };
        setTimeout(() => {
          setActiveCards(cards => spawnCards(cards.filter(c => c.instanceKey !== instanceKey)));
        }, 350);
        return updated;

      } else {
        setStreak(0);
        setTimeLeft(t => Math.max(0, t - shared.wrongPenaltySec));
        setPenaltyVisible(true);
        setTimeout(() => setPenaltyVisible(false), 900);

        const newWrong = ac.wrongCount + 1;
        const showHint = params.hintsEnabled && !ac.hintShown &&
          newWrong >= shared.hints.showAfterWrongPlacements && !!ac.card.hint;
        if (showHint) setHintCard(ac.card);

        const updated = [...prev];
        updated[idx] = { ...ac, feedbackState: "wrong", wrongCount: newWrong, hintShown: ac.hintShown || showHint };

        setTimeout(() => {
          setActiveCards(cards =>
            cards.map(c => c.instanceKey === instanceKey ? { ...c, feedbackState: "idle" } : c)
          );
        }, 450);
        return updated;
      }
    });
  }, [shared, params, spawnCards]);

  // ── Drag (Pointer Events) ─────────────────────────────────────────────────

  function colAtPoint(x: number, y: number): Column | null {
    for (const col of columns) {
      const el = colRefs.current[col.id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return col.id;
    }
    return null;
  }

  function onPointerDown(e: React.PointerEvent, instanceKey: string) {
    if (isPaused) return;
    draggingId.current = instanceKey;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draggingId.current) return;
    setDragOverCol(colAtPoint(e.clientX, e.clientY));
  }

  function onPointerUp(e: React.PointerEvent) {
    const id = draggingId.current;
    draggingId.current = null;
    const col = colAtPoint(e.clientX, e.clientY);
    setDragOverCol(null);
    if (id && col) handlePlacement(id, col);
  }

  // ── HUD ───────────────────────────────────────────────────────────────────

  const mins = Math.floor(timeLeft / 60);
  const secs = String(timeLeft % 60).padStart(2, "0");

  const stats = [
    {
      label: "Time",
      value: `${mins}:${secs}`,
      tone: timeLeft <= 15 ? ("danger" as const) : ("default" as const),
      urgent: timeLeft <= 10,
    },
    { label: "Score", value: score, tone: "gold" as const },
    {
      label: "Streak",
      value: streak,
      tone: streak >= 3 ? ("success" as const) : ("default" as const),
      caption: streak >= 3 ? "🔥 Bonus!" : "",
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <GameplayShell
      fallbackGradient="linear-gradient(160deg, #031012 0%, #061820 100%)"
      accentColor="#00c4e0"
      stats={stats}
      menu={menu}
      isPaused={isPaused}
    >
      {/* Play area */}
      <div
        className={styles.playArea}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => { setDragOverCol(null); draggingId.current = null; }}
      >
        {activeCards.map(ac => (
          <div
            key={ac.instanceKey}
            className={[
              styles.card,
              ac.feedbackState === "correct" ? styles.cardCorrect : "",
              ac.feedbackState === "wrong"   ? styles.cardWrong   : "",
            ].filter(Boolean).join(" ")}
            style={{
              "--card-x": `${ac.xFraction * 100}%`,
              "--drift-duration": `${ac.driftDuration}s`,
            } as React.CSSProperties}
            data-dragging={draggingId.current === ac.instanceKey}
            onPointerDown={e => onPointerDown(e, ac.instanceKey)}
          >
            <div className={styles.cardFace}>{ac.card.text}</div>
          </div>
        ))}

        {penaltyVisible && (
          <div className={styles.timePenalty}>−{shared.wrongPenaltySec}s</div>
        )}

        {hintCard?.hint && (
          <div className={styles.hint} onClick={() => setHintCard(null)}>
            💡 {hintCard.hint}
            <span className={styles.hintDismiss}>Tap to dismiss</span>
          </div>
        )}
      </div>

      {/* Column targets */}
      <div className={styles.columns}>
        {columns.map((col: ColumnDef) => (
          <div
            key={col.id}
            ref={el => { colRefs.current[col.id] = el; }}
            className={[styles.column, COL_CLASS[col.id] ?? ""].join(" ")}
            data-dragover={dragOverCol === col.id}
          >
            <div className={styles.columnEmoji}>{col.emoji}</div>
            <div className={styles.columnLabel}>{col.label}</div>
            <div className={styles.columnCount}>
              {colCounts[col.id] ? `${colCounts[col.id]} sorted` : ""}
            </div>
          </div>
        ))}
      </div>
    </GameplayShell>
  );
}