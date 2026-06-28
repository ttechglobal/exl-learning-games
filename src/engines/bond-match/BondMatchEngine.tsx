"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type {
  BondMatchConfig,
  BondMatchMissionOutcome,
  BondMatchFactoryOutcome,
  BondMission,
  FactoryOrder
} from "@/engines/bond-match/bondMatch.config";
import { isValidBondPair } from "@/engines/bond-match/bondMatch.logic";
import { BOND_ELEMENTS, type BondElement } from "@/engines/bond-match/bondData";
import { Mascot } from "@/motion/Mascot";
import { fireIonicTransfer, fireCovalentSharing } from "@/motion/bondingMotion";
import { playSound } from "@/motion/sound/playSound";
import type { EngineRuntimeProps } from "@/engines/engine-types";
import type { BondMatchSharedConfig } from "@/engines/bond-match/bondMatch.config";
import { GameplayShell, type GameplayStat } from "@/components/gameplay/GameplayShell";
import { GAME_ENVIRONMENT_IMAGES } from "@/lib/content/gameEnvironments";
import styles from "@/engines/bond-match/BondMatchEngine.module.css";

interface PlacedAtom {
  id: string;
  symbol: string;
  x: number;
  y: number;
  dropIn: boolean;
}

type Outcome = BondMatchMissionOutcome | BondMatchFactoryOutcome;

/**
 * Resolves the REAL per-level config this engine should run against.
 *
 * Atom Forge needs "one game, several self-contained levels the player
 * picks from" — each level has its own element pool and missions-or-factory
 * config, which a single Game.shared_config can't hold for more than one
 * level. So: if the current mission's payload itself looks like a valid
 * shared config (has an elementPool and either missions or factory), use
 * THAT as the real config. Otherwise fall back to the top-level `shared`
 * (which covers any future bond-match game that genuinely is uniform
 * across its whole mission list, the way particle-assembly's games are).
 */
function resolveSharedConfig(topLevelShared: BondMatchSharedConfig, missionPayload: Record<string, unknown> | undefined): BondMatchSharedConfig {
  if (
    missionPayload &&
    Array.isArray(missionPayload.elementPool) &&
    (Array.isArray(missionPayload.missions) || typeof missionPayload.factory === "object")
  ) {
    return missionPayload as unknown as BondMatchSharedConfig;
  }
  return topLevelShared;
}

/**
 * MIGRATED onto GameplayShell this round (previously rendered its own
 * raw <img> backdrop + absolute-positioned .hud directly — see
 * engine-types.ts's long comment on EngineRuntimeProps.menu, which
 * explicitly flagged that bond-match had NO working in-game menu during
 * actual gameplay as a result: Restart Mission / Exit to Worlds simply
 * didn't exist once a mission started, only before/after it). Now wired
 * the same way TileMatchEngine is: `menu` renders inside GameplayShell's
 * reserved row, `isPaused` actually halts the factory timer (see the
 * countdown effect below, which now checks it the same way
 * TileMatchEngine's does), and the environment backdrop goes through the
 * shared EnvironmentBackdrop/gameEnvironments.ts registry instead of a
 * hardcoded raw <img src="...">.
 *
 * Internal gameplay logic (drag physics, bond validation, factory
 * order cycling, the compound-reveal card, the hint toast) is UNCHANGED
 * by this migration — only the outer chrome moved.
 */
export function BondMatchEngine({ config, onComplete, isPaused, menu }: EngineRuntimeProps<BondMatchConfig, Outcome>) {
  const shared = resolveSharedConfig(config.shared, config.mission.payload);
  const isFactory = Boolean(shared.factory);

  const [nodes, setNodes] = useState<Record<string, PlacedAtom>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [connector, setConnector] = useState<{ a: PlacedAtom; b: PlacedAtom; valid: boolean } | null>(null);
  const [shaking, setShaking] = useState(false);
  const [compoundCard, setCompoundCard] = useState<{ formula: string; name: string; bondType: string; xp: number } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [mascotPose, setMascotPose] = useState<"idle" | "celebrate" | "encourage" | null>(null);


  const [missionIndex, setMissionIndex] = useState(0);
  const attemptsRef = useRef(0);
  const missionStartRef = useRef(Date.now());

  const [factoryOrderIndex, setFactoryOrderIndex] = useState(0);
  const [factoryProduced, setFactoryProduced] = useState(0);
  const [factoryTimeLeft, setFactoryTimeLeft] = useState(shared.factory?.sessionDurationSec ?? 60);
  const [factoryXp, setFactoryXp] = useState(0);
  const [factoryWrongAttempts, setFactoryWrongAttempts] = useState(0);
  const [factoryCompoundsProduced, setFactoryCompoundsProduced] = useState(0);
  const factoryEndedRef = useRef(false);

  const platformRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const nodeIdRef = useRef(0);

  const currentMission: BondMission | null = !isFactory ? shared.missions![missionIndex % shared.missions!.length] : null;
  const currentOrder: FactoryOrder | null = isFactory ? shared.factory!.orders[factoryOrderIndex % shared.factory!.orders.length] : null;
  const activePair = currentMission?.pair ?? currentOrder?.pair ?? null;
  const activeBondType = currentMission?.bondType ?? currentOrder?.bondType ?? "ionic";

  useEffect(() => {
    if (!isFactory || factoryEndedRef.current) return;
    if (isPaused) return;
    if (factoryTimeLeft <= 0) {
      factoryEndedRef.current = true;
      onComplete({
        success: true,
        score: Math.min(1, factoryXp / (shared.factory!.sessionDurationSec * 4)),
        finalScore: factoryXp,
        compoundsProduced: factoryCompoundsProduced,
        wrongAttempts: factoryWrongAttempts,
        timeSpentSec: shared.factory!.sessionDurationSec
      } as BondMatchFactoryOutcome);
      return;
    }
    const t = setTimeout(() => setFactoryTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFactory, factoryTimeLeft, isPaused]);

  const clearAtoms = useCallback(() => setNodes({}), []);

  const platformPoint = useCallback((clientX: number, clientY: number) => {
    const rect = layerRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const spawnAtom = useCallback(
    (symbol: string, clientX: number, clientY: number) => {
      const pt = platformPoint(clientX, clientY);
      const id = `atom-${nodeIdRef.current++}`;
      setNodes((prev) => ({ ...prev, [id]: { id, symbol, x: pt.x, y: pt.y, dropIn: true } }));
      return id;
    },
    [platformPoint]
  );

  const startDragFromDock = useCallback(
    (e: React.PointerEvent, symbol: string) => {
      if (isPaused) return;
      e.preventDefault();
      const id = spawnAtom(symbol, e.clientX, e.clientY);
      setDragId(id);
    },
    [spawnAtom, isPaused]
  );

  const startDragFromAtom = useCallback(
    (e: React.PointerEvent, id: string) => {
      if (isPaused) return;
      e.preventDefault();
      setDragId(id);
    },
    [isPaused]
  );

  const BOND_DISTANCE = 95;

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragId) return;
      const activeDragId: string = dragId;
      const pt = platformPoint(e.clientX, e.clientY);
      setNodes((prev) => {
        const next = { ...prev, [activeDragId]: { ...prev[activeDragId], x: pt.x, y: pt.y, dropIn: false } };
        const dragged = next[activeDragId];
        let nearestFound: PlacedAtom | null = null;
        let nearestDist = Infinity;
        const candidates: PlacedAtom[] = Object.values(next);
        candidates.forEach((other: PlacedAtom) => {
          if (other.id === activeDragId) return;
          const dist = Math.hypot(other.x - dragged.x, other.y - dragged.y);
          if (dist < BOND_DISTANCE && dist < nearestDist) {
            nearestDist = dist;
            nearestFound = other;
          }
        });
        const nearest: PlacedAtom | null = nearestFound;
        // `nearest` is correctly PlacedAtom|null per the explicit annotation above,
        // but TypeScript's control-flow narrowing collapses it to `never` inside
        // this `if` block specifically (confirmed isolated compiler quirk, not a
        // real type error — `dragged.symbol` right next to it in the same
        // expression resolves fine). Re-asserting the already-correct type here
        // rather than continuing to fight the narrower at the call site.
        if (nearest && activePair) {
          const nearestAtom = nearest as PlacedAtom;
          setConnector({ a: dragged, b: nearestAtom, valid: isValidBondPair(dragged.symbol, nearestAtom.symbol, activePair) });
        } else {
          setConnector(null);
        }
        return next;
      });
    },
    [dragId, platformPoint, activePair]
  );

  const resolveBond = useCallback(
    (a: PlacedAtom, b: PlacedAtom) => {
      const rect = layerRef.current?.getBoundingClientRect();
      const toClient = (p: PlacedAtom) => ({ x: (rect?.left ?? 0) + p.x, y: (rect?.top ?? 0) + p.y });

      if (activeBondType === "ionic") {
        const aIsMetal = BOND_ELEMENTS[a.symbol]?.kind === "metal";
        fireIonicTransfer(toClient(aIsMetal ? a : b), toClient(aIsMetal ? b : a));
      } else {
        fireCovalentSharing(toClient(a), toClient(b));
      }
      playSound("success");

      setNodes((prev) => {
        const next = { ...prev };
        delete next[a.id];
        delete next[b.id];
        return next;
      });

      const formula = currentMission?.formula ?? currentOrder?.formula ?? "";
      const name = currentMission?.name ?? currentOrder?.name ?? "";
      const xp = currentMission?.xpReward ?? currentOrder?.xpReward ?? 0;

      setTimeout(
        () => {
          setCompoundCard({ formula, name, bondType: activeBondType, xp });
        },
        activeBondType === "ionic" ? 450 : 250
      );

      if (mascotPose !== "celebrate") {
        setMascotPose("celebrate");
        setTimeout(() => setMascotPose(null), 900);
      }

      if (isFactory) {
        setFactoryXp((x) => x + xp);
        setFactoryCompoundsProduced((c) => c + 1);
        setFactoryProduced((p) => {
          const next = p + 1;
          if (next >= (currentOrder?.quantity ?? 1)) {
            setFactoryOrderIndex((i) => i + 1);
            return 0;
          }
          return next;
        });
      } else {
        const timeSpentSec = Math.max(1, Math.round((Date.now() - missionStartRef.current) / 1000));
        const outcome: BondMatchMissionOutcome = {
          success: true,
          attemptsBeforeSuccess: attemptsRef.current,
          timeSpentSec,
          bondType: activeBondType,
          pair: activePair as [string, string]
        };
        setTimeout(() => {
          onComplete(outcome);
        }, 1700);
      }
    },
    [activeBondType, activePair, currentMission, currentOrder, isFactory, mascotPose, onComplete]
  );

  const rejectBond = useCallback(
    (a: PlacedAtom) => {
      setShaking(true);
      setTimeout(() => setShaking(false), 320);
      playSound("fail");
      setMascotPose("encourage");
      setTimeout(() => setMascotPose(null), 900);

      const [needA, needB] = (activePair ?? ["", ""]).map((s) => BOND_ELEMENTS[s]?.name ?? s);
      const aName = BOND_ELEMENTS[a.symbol]?.name ?? a.symbol;
      setHint(`${aName} won't bond there. This one needs ${needA} and ${needB} together.`);
      setTimeout(() => setHint(null), 2800);

      if (isFactory) {
        setFactoryWrongAttempts((n) => n + 1);
        setNodes((prev) => {
          const next = { ...prev };
          delete next[a.id];
          return next;
        });
        const rect = layerRef.current?.getBoundingClientRect();
        const emoji = document.createElement("div");
        emoji.className = styles.poofEmoji;
        emoji.textContent = ["\u{1F4A8}", "\u{1F92F}", "\u2728"][Math.floor(Math.random() * 3)];
        emoji.style.left = `${(rect?.left ?? 0) + a.x}px`;
        emoji.style.top = `${(rect?.top ?? 0) + a.y}px`;
        document.body.appendChild(emoji);
        setTimeout(() => emoji.remove(), 750);
      }
    },
    [activePair, isFactory]
  );

  const onPointerUp = useCallback(() => {
    if (!dragId) return;
    const activeDragId: string = dragId;
    setNodes((prev) => {
      const dragged = prev[activeDragId];
      if (!dragged || !activePair) return prev;

      let nearestFound: PlacedAtom | null = null;
      let nearestDist = Infinity;
      const candidates: PlacedAtom[] = Object.values(prev);
      candidates.forEach((other: PlacedAtom) => {
        if (other.id === activeDragId) return;
        const dist = Math.hypot(other.x - dragged.x, other.y - dragged.y);
        if (dist < BOND_DISTANCE && dist < nearestDist) {
          nearestDist = dist;
          nearestFound = other;
        }
      });
      const nearest: PlacedAtom | null = nearestFound;

      // Same confirmed TS narrowing quirk as onPointerMove above — re-asserting
      // the already-correct type rather than fighting the compiler further.
      if (nearest) {
        const nearestAtom = nearest as PlacedAtom;
        attemptsRef.current += 1;
        if (isValidBondPair(dragged.symbol, nearestAtom.symbol, activePair)) {
          resolveBond(dragged, nearestAtom);
        } else {
          rejectBond(dragged);
        }
      }
      return prev;
    });
    setConnector(null);
    setDragId(null);
  }, [dragId, activePair, resolveBond, rejectBond]);

  useEffect(() => {
    if (!dragId) return;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [dragId, onPointerMove, onPointerUp]);

  useEffect(() => {
    if (isFactory || !compoundCard) return;
    const t = setTimeout(() => {
      setCompoundCard(null);
      setMissionIndex((i) => i + 1);
      attemptsRef.current = 0;
      missionStartRef.current = Date.now();
      clearAtoms();
    }, 1700);
    return () => clearTimeout(t);
  }, [compoundCard, isFactory, clearAtoms]);

  useEffect(() => {
    if (!isFactory || !compoundCard) return;
    const t = setTimeout(() => setCompoundCard(null), 1500);
    return () => clearTimeout(t);
  }, [compoundCard, isFactory]);

  const dockElements: BondElement[] = [...new Set(shared.elementPool)].map((s) => BOND_ELEMENTS[s]).filter(Boolean);

  const stats: GameplayStat[] = isFactory
    ? [
        { label: "Time", value: factoryTimeLeft, tone: "danger", urgent: factoryTimeLeft <= 10 },
        { label: "XP", value: factoryXp, tone: "success" }
      ]
    : [{ label: "XP", value: currentMission?.xpReward ?? 0, tone: "success" }];

  const missionFormula = currentMission?.formula ?? currentOrder?.formula ?? "";
  const missionName = currentMission?.name ?? currentOrder?.name ?? "";
  const missionPromptText = isFactory && currentOrder
    ? `${missionFormula} \u2014 ${missionName} (${factoryProduced}/${currentOrder.quantity} made)`
    : `${missionFormula} \u2014 ${missionName}`;

  return (
    <GameplayShell
      environmentImages={GAME_ENVIRONMENT_IMAGES["atom-forge"]}
      fallbackGradient="radial-gradient(ellipse 90% 70% at 50% 0%, #2A3A5C 0%, #1B2438 55%, #11162A 100%)"
      accentColor="var(--eg-subject-chemistry)"
      stats={stats}
      missionPrompt={{ label: isFactory ? "Factory Order" : "Forge This Compound", text: missionPromptText }}
      menu={menu}
      isPaused={isPaused}
    >
      <div className={`${styles.engineColumn} ${shaking ? styles.appShakeWrap : ""} ${shaking ? "shaking" : ""}`}>
        {!isFactory && shared.showBondTypeHint && activePair && (
          <div className={styles.bondHint}>
            {activeBondType === "ionic"
              ? `${BOND_ELEMENTS[activePair[0]]?.name} gives an electron to ${BOND_ELEMENTS[activePair[1]]?.name}.`
              : `Two ${BOND_ELEMENTS[activePair[0]]?.name} atoms SHARE electrons.`}
          </div>
        )}

        <div className={styles.platformScene} ref={platformRef}>
          <div className={styles.platformSurface}>
            <svg className={styles.connectorSvg}>
              {connector && (
                <line
                  x1={connector.a.x}
                  y1={connector.a.y}
                  x2={connector.b.x}
                  y2={connector.b.y}
                  className={`${styles.connectorLine} ${connector.valid ? styles.valid : styles.invalid}`}
                />
              )}
            </svg>
            <div className={styles.atomLayer} ref={layerRef}>
              {Object.values(nodes).map((atom) => {
                const el = BOND_ELEMENTS[atom.symbol];
                if (!el) return null;
                return (
                  <div
                    key={atom.id}
                    className={`${styles.atomNode} ${dragId === atom.id ? styles.dragging : ""} ${atom.dropIn ? styles.dropping : ""}`}
                    style={{ left: atom.x, top: atom.y, "--el-color": el.hex } as React.CSSProperties}
                    onPointerDown={(e) => startDragFromAtom(e, atom.id)}
                  >
                    {el.shells.map((count, shellIdx) => {
                      const radius = 18 + shellIdx * 11;
                      const dotCount = Math.min(count, 8);
                      return (
                        <div key={shellIdx}>
                          <div
                            className={styles.shellRing}
                            style={{ width: radius * 2, height: radius * 2, marginLeft: -radius, marginTop: -radius } as React.CSSProperties}
                          />
                          {Array.from({ length: dotCount }, (_, e2) => (
                            <div
                              key={e2}
                              className={styles.electronOrbit}
                              style={{ animationDuration: `${3.5 + shellIdx * 1.3}s`, transform: `rotate(${(360 / dotCount) * e2}deg)` }}
                            >
                              <div className={styles.electronDot} style={{ left: radius - 3.5, "--el-color": el.hex } as React.CSSProperties} />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    <div className={styles.atomNucleus} style={{ "--el-color": el.hex } as React.CSSProperties}>
                      {el.symbol}
                    </div>
                    <div className={styles.atomLabel}>{el.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className={styles.dockWrap}>
          <div className={styles.dock}>
            {dockElements.map((el) => (
              <div
                key={el.symbol}
                className={styles.dockCapsule}
                style={{ "--el-color": el.hex } as React.CSSProperties}
                onPointerDown={(e) => startDragFromDock(e, el.symbol)}
              >
                <div className={styles.miniNucleus}>{el.symbol}</div>
                <div className={styles.miniSymbol}>{el.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {compoundCard && (
        <div className={`${styles.compoundCard} ${styles.showing}`}>
          <div className={styles.compoundFormula}>{compoundCard.formula}</div>
          <div className={styles.compoundName}>{compoundCard.name}</div>
          <div className={styles.compoundBondType}>
            {compoundCard.bondType === "ionic" ? "Ionic Bond \u2014 electron transferred" : "Covalent Bond \u2014 electrons shared"}
          </div>
          <div className={styles.compoundXp}>+{compoundCard.xp} XP</div>
        </div>
      )}

      {hint && (
        <div className={`${styles.hintRow} ${styles.showing}`}>
          <Mascot pose="encourage" widthPx={54} />
          <div className={styles.hintCard}>{hint}</div>
        </div>
      )}

      {mascotPose && (
        <div style={{ position: "fixed", bottom: 90, right: 14, zIndex: 7, width: 76 }}>
          <Mascot pose={mascotPose} widthPx={76} />
        </div>
      )}
    </GameplayShell>
  );
}