"use client";

import { useState, useRef, useCallback } from "react";
import type {
  ParticleAssemblyConfig,
  ParticleAssemblyOutcome,
  Generator
} from "@/engines/particle-assembly/particleAssembly.config";
import { checkComposition, buildFeedback } from "@/engines/particle-assembly/particleAssembly.logic";
import { computeClusterJitterPlacement, computeOrbitShellPlacement, computeArrivalTrail, type TrailDot } from "@/motion/orbitalMotion";
import { createPressHandlers } from "@/motion/touchTarget";
import { runSuccessSequence, runFailureSequence } from "@/motion/payoffSequence";
import { playSound, primeAudioOnUserGesture } from "@/motion/sound/playSound";
import { Mascot } from "@/motion/Mascot";
import type { EngineRuntimeProps } from "@/engines/engine-types";
import styles from "@/engines/particle-assembly/ParticleAssemblyEngine.module.css";

type Composition = Record<string, number>;

interface VisualParticle {
  key: string;
  generatorId: string;
  color: string;
  kind: "nucleon" | "electron";
  x?: number;
  y?: number;
  jitterDelay?: number;
  shellRadius?: number;
  shellDuration?: number;
  startAngle?: number;
}

interface ActiveTrail {
  key: string;
  color: string;
  dots: TrailDot[];
}

/**
 * particle-assembly engine runtime. Ported from the Build The Atom v2 HTML
 * prototype — same orbital motion, multi-beat payoff, and touch/sound
 * behavior, now driven by React state and the shared motion/ modules instead
 * of imperative DOM manipulation.
 *
 * This component handles ONE mission's gameplay screen. GameRuntime is
 * responsible for the Concept Snapshot before it and the Reflection screen
 * after it — this component only renders between those two and calls
 * onComplete when the mission resolves.
 */
export function ParticleAssemblyEngine({
  config,
  onComplete
}: EngineRuntimeProps<ParticleAssemblyConfig, ParticleAssemblyOutcome>) {
  const { shared, mission } = config;

  const [composition, setComposition] = useState<Composition>(
    Object.fromEntries(shared.generators.map((g) => [g.id, 0]))
  );
  const [particles, setParticles] = useState<VisualParticle[]>([]);
  const [activeTrails, setActiveTrails] = useState<ActiveTrail[]>([]);
  const [pressedGenerator, setPressedGenerator] = useState<string | null>(null);
  const [stabilized, setStabilized] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [shockwaveFiring, setShockwaveFiring] = useState(false);
  const [warning, setWarning] = useState<{ visible: boolean; text: string; entering: boolean }>({
    visible: false,
    text: "",
    entering: false
  });
  const [xpPop, setXpPop] = useState<{ visible: boolean; amount: number }>({ visible: false, amount: 0 });

  const attemptsBeforeSuccessRef = useRef(0);
  const missionStartedAtRef = useRef<number>(Date.now());
  const particleKeyCounter = useRef(0);

  const electronGeneratorIds = useRef(new Set(shared.generators.filter((g) => /electron/i.test(g.id)).map((g) => g.id)));

  // Use the first generator's color as this game's accent for glow/shockwave
  // styling — keeps the engine subject-agnostic (no hardcoded "chemistry"
  // assumption) while still giving each game's chamber a coherent accent.
  const accentColor = shared.generators[0]?.color ?? "#7b4fcb";

  const handleGeneratorAdd = useCallback(
    (generator: Generator) => {
      setComposition((prev) => ({ ...prev, [generator.id]: (prev[generator.id] ?? 0) + 1 }));

      const isElectronLike = electronGeneratorIds.current.has(generator.id);
      const key = `p-${particleKeyCounter.current++}`;

      if (isElectronLike) {
        const existingElectronCount = particles.filter((p) => p.kind === "electron").length;
        const shell = computeOrbitShellPlacement(existingElectronCount);
        setParticles((prev) => [
          ...prev,
          {
            key,
            generatorId: generator.id,
            color: generator.color,
            kind: "electron",
            shellRadius: shell.radiusPx,
            shellDuration: shell.durationSec,
            startAngle: shell.startAngleDeg
          }
        ]);
      } else {
        const placement = computeClusterJitterPlacement();
        setParticles((prev) => [
          ...prev,
          {
            key,
            generatorId: generator.id,
            color: generator.color,
            kind: "nucleon",
            x: placement.x,
            y: placement.y,
            jitterDelay: placement.jitterDelay
          }
        ]);

        const trailKey = `trail-group-${key}`;
        setActiveTrails((prev) => [
          ...prev,
          { key: trailKey, color: generator.color, dots: computeArrivalTrail(placement.x, placement.y) }
        ]);
        // Trails are a one-shot visual on arrival; clear this group once its
        // longest dot's fade animation (0.45s, see tokens.css) has finished.
        setTimeout(() => {
          setActiveTrails((prev) => prev.filter((t) => t.key !== trailKey));
        }, 500);
      }

      playSound("particleAdd");
    },
    [particles]
  );

  const handleRemoveOne = useCallback((generatorId: string) => {
    setComposition((prev) => {
      if ((prev[generatorId] ?? 0) <= 0) return prev;
      return { ...prev, [generatorId]: prev[generatorId] - 1 };
    });
    setParticles((prev) => {
      const idx = [...prev].reverse().findIndex((p) => p.generatorId === generatorId);
      if (idx === -1) return prev;
      const realIdx = prev.length - 1 - idx;
      return prev.filter((_, i) => i !== realIdx);
    });
    playSound("particleRemove");
  }, []);

  const handleSubmit = useCallback(() => {
    attemptsBeforeSuccessRef.current += 1;
    playSound("submit");

    if (checkComposition(mission.target, composition)) {
      setWarning((w) => ({ ...w, visible: false }));
      runSuccessSequence({
        onPrimaryBeat: () => {
          setStabilized(true);
          setShockwaveFiring(true);
        },
        onSecondaryBeat: () => {
          setXpPop({ visible: true, amount: mission.xpReward });
        },
        onSequenceComplete: () => {
          const timeSpentSec = Math.max(1, Math.round((Date.now() - missionStartedAtRef.current) / 1000));
          onComplete({
            success: true,
            attemptsBeforeSuccess: attemptsBeforeSuccessRef.current,
            timeSpentSec,
            finalComposition: { ...composition }
          });
        }
      });
    } else {
      const feedbackText = buildFeedback(shared, mission.target, composition);
      runFailureSequence({
        onShowFeedback: () => setWarning({ visible: true, text: feedbackText, entering: true }),
        onShake: () => setShaking(true),
        onShakeEnd: () => setShaking(false)
      });
    }
  }, [composition, mission, shared, onComplete]);

  return (
    <div className={styles.screen} style={{ "--accent-color": accentColor } as React.CSSProperties}>
      <div className={styles.lab}>
        <div className={styles.labHeader}>
          <div className={styles.labMissionTitle}>
            Mission: {mission.title}
            <span>Add particles, then submit</span>
          </div>
          <div className={styles.labXp}>
            +{mission.xpReward} XP
            {xpPop.visible && (
              <span className={`${styles.xpPop} ${styles.popping}`} onAnimationEnd={() => setXpPop({ visible: false, amount: 0 })}>
                +{xpPop.amount}
              </span>
            )}
          </div>
        </div>

        {shared.generators
          .filter((g) => g.panel !== "bottom")
          .map((generator) => (
            <GeneratorPanel
              key={generator.id}
              generator={generator}
              count={composition[generator.id] ?? 0}
              target={mission.target[generator.id] ?? 0}
              pressed={pressedGenerator === generator.id}
              onPressStart={() => setPressedGenerator(generator.id)}
              onPressEnd={() => setPressedGenerator(null)}
              onAdd={() => handleGeneratorAdd(generator)}
              onRemove={() => handleRemoveOne(generator.id)}
            />
          ))}

        <div className={styles.chamberWrap}>
          {/* Ambient glow layers behind the chamber - richer multi-plane glow instead of
              a single box-shadow, gives the chamber a sense of depth/energy at rest. */}
          <div className={styles.chamberGlowField}>
            <div className={styles.chamberGlowRing1} />
            <div className={styles.chamberGlowRing2} />
          </div>
          <div
            className={[styles.chamber, stabilized ? styles.stabilized : "", shaking ? styles.shakingLocal : ""]
              .filter(Boolean)
              .join(" ")}
            onAnimationEnd={() => setShaking(false)}
          >
            {[0, 1, 2].map((shellIndex) => {
              const shellParticles = particles.filter((p) => p.kind === "electron").filter((_, i) => i % 3 === shellIndex);
              const radius = shellParticles[0]?.shellRadius;
              if (!radius) return null;
              return (
                <div
                  key={shellIndex}
                  className={styles.orbitRing}
                  style={{
                    width: radius * 2,
                    height: radius * 2,
                    marginLeft: -radius,
                    marginTop: -radius
                  }}
                />
              );
            })}

            <div className={styles.shockwave + (shockwaveFiring ? ` ${styles.fire}` : "")} onAnimationEnd={() => setShockwaveFiring(false)} />
            <div className={styles.shockwave2 + (shockwaveFiring ? ` ${styles.fire}` : "")} />

            {activeTrails.map((trail) =>
              trail.dots.map((dot) => (
                <div
                  key={dot.key}
                  className={`${styles.nucleonTrailDot} eg-trail-dot`}
                  style={
                    {
                      width: dot.sizePx,
                      height: dot.sizePx,
                      background: trail.color,
                      boxShadow: `0 0 6px ${trail.color}`,
                      transform: `translate(-50%, -50%) translate(${dot.offsetX}px, ${dot.offsetY}px)`,
                      animationDelay: `${dot.delayMs}ms`,
                      "--eg-trail-peak-opacity": dot.peakOpacity
                    } as React.CSSProperties
                  }
                />
              ))
            )}

            {particles
              .filter((p) => p.kind === "nucleon")
              .map((p) => (
                <div
                  key={p.key}
                  className={styles.nucleon}
                  style={{
                    color: p.color,
                    background: p.color,
                    transform: `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)`,
                    animationDelay: `${p.jitterDelay}s`
                  }}
                />
              ))}

            {particles
              .filter((p) => p.kind === "electron")
              .map((p) => (
                <div
                  key={p.key}
                  className={styles.electronOrbit}
                  style={{
                    animationDuration: `${p.shellDuration}s`,
                    transform: `rotate(${p.startAngle}deg)`
                  }}
                >
                  <div
                    className={styles.electronDot}
                    style={{ left: (p.shellRadius ?? 0) - 4.5, background: p.color, boxShadow: `0 0 10px ${p.color}` }}
                  />
                </div>
              ))}

            <div className={styles.nucleusCore} />
          </div>
          <button className={styles.submitBtn} onClick={handleSubmit}>
            Stabilize Atom
          </button>
        </div>

        {shared.generators
          .filter((g) => g.panel === "bottom")
          .map((generator) => (
            <div key={generator.id} style={{ gridColumn: "1 / -1" }}>
              <GeneratorPanel
                generator={generator}
                count={composition[generator.id] ?? 0}
                target={mission.target[generator.id] ?? 0}
                pressed={pressedGenerator === generator.id}
                onPressStart={() => setPressedGenerator(generator.id)}
                onPressEnd={() => setPressedGenerator(null)}
                onAdd={() => handleGeneratorAdd(generator)}
                onRemove={() => handleRemoveOne(generator.id)}
              />
            </div>
          ))}
      </div>

      {warning.visible && (
        <div className={styles.warningRow}>
          <Mascot pose="encourage" widthPx={64} className={styles.warningMascot} />
          <div className={`${styles.warningCard} ${warning.entering ? styles.entering : ""}`}>
            <div className={styles.warningEyebrow}>Almost there</div>
            <div className={styles.warningText}>{warning.text}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function GeneratorPanel({
  generator,
  count,
  target,
  pressed,
  onPressStart,
  onPressEnd,
  onAdd,
  onRemove
}: {
  generator: Generator;
  count: number;
  target: number;
  pressed: boolean;
  onPressStart: () => void;
  onPressEnd: () => void;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const pressHandlers = createPressHandlers(onPressStart, onPressEnd, onAdd);
  const met = count === target && target > 0;

  return (
    <div className={styles.panel} style={{ "--p-color": generator.color } as React.CSSProperties}>
      <div className={styles.panelLabel}>{generator.label}</div>
      <div
        className={`${styles.generatorHit} ${pressed ? styles.pressed : ""}`}
        onPointerDown={() => {
          primeAudioOnUserGesture();
          pressHandlers.onPointerDown();
        }}
        onPointerUp={pressHandlers.onPointerUp}
        onPointerLeave={pressHandlers.onPointerLeave}
      >
        <div className={styles.generatorBtn} style={{ "--p-color": generator.color } as React.CSSProperties}>
          +
        </div>
      </div>
      <div className={`${styles.counterRow} ${met ? styles.met : ""}`} style={{ "--p-color": generator.color } as React.CSSProperties}>
        <span className={styles.counterCurrent}>{count}</span>
        <span className={styles.counterTarget}>/ {target}</span>
      </div>
      <button className={styles.removeHit} onClick={onRemove}>
        remove one
      </button>
    </div>
  );
}
