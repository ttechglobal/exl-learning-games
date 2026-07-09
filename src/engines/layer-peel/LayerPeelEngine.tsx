"use client";

import { useState, useRef, useCallback } from "react";
import type { EngineRuntimeProps } from "@/engines/engine-types";
import { GameplayShell } from "@/components/gameplay/GameplayShell";
import { Mascot } from "@/motion/Mascot";
import { playSound } from "@/motion/sound/playSound";
import { GAME_ENVIRONMENT_IMAGES } from "@/lib/content/gameEnvironments";
import type {
  LayerPeelConfig,
  LayerPeelOutcome,
  LayerPeelMissionPayload,
  PeelStep,
  LayerPeelOperation,
} from "./layer-peel.config";
import {
  getLayerPeelOperationMeta,
  normaliseOperation,
  LAYER_PEEL_OPERATION_META,
} from "./layer-peel.config";
import styles from "./LayerPeelEngine.module.css";

// ─── types ────────────────────────────────────────────────────────────────────

type UIStage =
  | "guided_action"       // practice: system shows next step, student taps to confirm
  | "operation_choice"    // challenge/master: student picks the operation
  | "step_confirmed"      // brief "correct" moment before advancing
  | "breach_complete";    // mission won

// ─── helpers ──────────────────────────────────────────────────────────────────

function buildOperationButtons(
  currentStep: PeelStep,
  stepIndex: number,
  payload: LayerPeelMissionPayload,
  hintLevel: number,
): Array<{ id: LayerPeelOperation; label: string; sublabel: string; highlighted: boolean }> {
  const correct = currentStep.operation;

  // Use authored distractors if available, otherwise build default ones
  const distractors = payload.stepDistractors?.[stepIndex];

  let wrongOps: Array<{ id: LayerPeelOperation; label: string }>;

  if (distractors && distractors.length >= 3) {
    wrongOps = distractors.slice(0, 3).map(d => ({
      id: normaliseOperation(d.operation) as LayerPeelOperation,
      label: d.label,
    }));
  } else {
    // Default distractors — opposite direction + adjacent operations
    const allOps = Object.keys(LAYER_PEEL_OPERATION_META) as LayerPeelOperation[];
    const opposites: Partial<Record<LayerPeelOperation, LayerPeelOperation>> = {
      divide_both:   "multiply_both",
      multiply_both: "divide_both",
      subtract_both: "add_both",
      add_both:      "subtract_both",
      square_root:   "square_both",
      square_both:   "square_root",
      cube_root:     "cube_both",
      cube_both:     "cube_root",
    };
    const opposite = opposites[correct];
    const others = allOps.filter(op => op !== correct && op !== opposite).slice(0, 2);
    wrongOps = [
      ...(opposite ? [{ id: opposite, label: getLayerPeelOperationMeta(opposite).label }] : []),
      ...others.map(op => ({ id: op, label: getLayerPeelOperationMeta(op).label })),
    ].slice(0, 3);
  }

  const all = [
    { id: correct, label: getLayerPeelOperationMeta(correct).label, sublabel: getLayerPeelOperationMeta(correct).sublabel, highlighted: hintLevel >= 2 },
    ...wrongOps.map(op => ({ id: op.id, label: op.label, sublabel: getLayerPeelOperationMeta(op.id).sublabel, highlighted: false })),
  ];

  // Shuffle so the correct answer isn't always first
  return all.sort(() => Math.random() - 0.5);
}

function resolveHintText(
  hintLevel: number,
  stepIndex: number,
  payload: LayerPeelMissionPayload,
  fallback: string[],
): string | null {
  if (hintLevel < 0) return null;
  const perStep = payload.stepHints?.[stepIndex];
  if (perStep && perStep[hintLevel]) return perStep[hintLevel];
  return fallback[hintLevel] ?? fallback[fallback.length - 1] ?? null;
}

function resolveHintLevel(wrongAttempts: number, hintAfterAttempts: number): number {
  if (wrongAttempts < hintAfterAttempts) return -1;
  return Math.min(wrongAttempts - hintAfterAttempts, 2);
}

function computeScore(wrongAttempts: number, hintsUsed: number, timeSpentSec: number, baselineSec: number): number {
  const wrongPenalty  = Math.min(wrongAttempts * 0.08, 0.4);
  const hintPenalty   = Math.min(hintsUsed    * 0.05, 0.2);
  const speedBonus    = timeSpentSec < baselineSec ? 0.05 : 0;
  return Math.max(0.1, 1 - wrongPenalty - hintPenalty + speedBonus);
}

// ─── component ────────────────────────────────────────────────────────────────

export function LayerPeelEngine({
  config,
  onComplete,
  isPaused,
  menu,
}: EngineRuntimeProps<LayerPeelConfig, LayerPeelOutcome>) {
  const { shared, mission } = config;
  const rawPayload = mission.payload as unknown as Record<string, unknown>;

  // The mission JSON may use either field name:
  //   "excavationSteps" — what Claude generates by default
  //   "peelSteps"       — the canonical layer-peel field name
  // Normalise here so the rest of the component always reads `steps`.
  const steps = (
    (rawPayload.excavationSteps as unknown[] | undefined) ??
    (rawPayload.peelSteps       as unknown[] | undefined) ??
    (rawPayload.steps           as unknown[] | undefined) ??
    (rawPayload.shells          as unknown[] | undefined) ??
    []
  );

  // Normalise each step — map whatever field names Claude used to canonical shape.
  // Confirmed live field names from DB: shellIndex, expectedInverse, resultingEquation
  const normalisedSteps: LayerPeelMissionPayload["excavationSteps"] = (steps as Record<string, unknown>[]).map((s, i, arr) => {
    const op = normaliseOperation((
      s.operation        ??
      s.expectedInverse  ??
      s.action           ??
      s.op               ??
      s.inverseOperation ??
      ""
    ) as string);

    const resultLines = (
      Array.isArray(s.resultDisplay)              ? s.resultDisplay as string[]
      : Array.isArray(s.result)                   ? s.result as string[]
      : Array.isArray(s.formulaAfter)             ? s.formulaAfter as string[]
      : Array.isArray(s.after)                    ? s.after as string[]
      : Array.isArray(s.equations)                ? s.equations as string[]
      : typeof s.resultingEquation === "string"   ? [s.resultingEquation as string]
      : typeof s.resultDisplay     === "string"   ? [s.resultDisplay]
      : typeof s.result            === "string"   ? [s.result]
      : typeof s.formulaAfter      === "string"   ? [s.formulaAfter]
      : typeof s.after             === "string"   ? [s.after]
      : []
    );

    // Auto-generate a readable description when the data doesn't include one
    const opMeta = getLayerPeelOperationMeta(op);
    const autoDescription = opMeta.sublabel !== "unknown operation"
      ? `${opMeta.label} — ${opMeta.sublabel}`
      : op;

    // Derive obstacle label from operation or shell index
    const obstacleLabel = (
      s.obstacleLabel ??
      s.shellLabel    ??
      s.label         ??
      s.shell         ??
      s.obstacle      ??
      `${opMeta.sublabel !== "unknown operation" ? opMeta.sublabel.replace("removes ", "") : `shell ${i + 1}`}`
    ) as string;

    return {
      operation:     op,
      obstacleLabel,
      description:   ((s.description ?? s.desc ?? s.instruction ?? s.step ?? autoDescription) as string),
      resultDisplay: resultLines,
      isFinal:       Boolean(s.isFinal ?? s.final ?? s.isLast ?? s.last ?? (i === arr.length - 1)),
    };
  });

  const payload: LayerPeelMissionPayload = {
    ...(rawPayload as unknown as LayerPeelMissionPayload),
    excavationSteps: normalisedSteps,
  };

  const tier =
    shared.tiers.find(t => t.tier === (mission.difficulty ?? "").toLowerCase()) ??
    shared.tiers[0];

  const stage = payload.stage ?? "practice";
  const hintLevels = shared.hints?.levels ?? [
    "What operation is wrapped around the target variable at this layer?",
    "Think about the inverse: what undoes the operation on this shell?",
    "The correct operation to breach this shell is highlighted.",
  ];
  const baselineSec = shared.scoring?.speedBaselineSec ?? 120;

  // ── state ─────────────────────────────────────────────────────────────────
  const [uiStage, setUIStage]                   = useState<UIStage>(
    stage === "practice" ? "guided_action" : "operation_choice"
  );
  const [stepIndex, setStepIndex]               = useState(0);
  const [wrongAttemptsOnStep, setWrongAttemptsOnStep] = useState(0);
  const [totalWrong, setTotalWrong]             = useState(0);
  const [hintsUsed, setHintsUsed]               = useState(0);
  const [hintRequestedByPlayer, setHintRequestedByPlayer] = useState(false);
  const [hintsRevealedForStep, setHintsRevealedForStep]   = useState(false);
  const [breachLog, setBreachLog]               = useState<string[]>([]);
  const [lastFeedback, setLastFeedback]         = useState<{ text: string; tone: "correct" | "invalid" } | null>(null);
  const [flashedBtn, setFlashedBtn]             = useState<{ id: LayerPeelOperation; tone: "correct" | "invalid" } | null>(null);
  const [mascotPose, setMascotPose]             = useState<"idle" | "celebrate" | "encourage" | null>("idle");

  const startTimeRef  = useRef(Date.now());
  const endedRef      = useRef(false);
  const outcomeRef    = useRef<LayerPeelOutcome | null>(null);
  const stepLogRef    = useRef<Array<{ operation: string; outcome: "correct" | "invalid" }>>([]);

  const currentStep: PeelStep | undefined = payload.excavationSteps[stepIndex];
  const totalSteps = payload.excavationSteps.length;

  const hintLevel  = resolveHintLevel(wrongAttemptsOnStep, tier.hintAfterAttempts);
  const showHints  = stage !== "master" || hintRequestedByPlayer;
  const hintText   = showHints && hintsRevealedForStep && hintLevel >= 0
    ? resolveHintText(hintLevel, stepIndex, payload, hintLevels)
    : null;

  const opButtons = currentStep
    ? buildOperationButtons(currentStep, stepIndex, payload, showHints ? hintLevel : -1)
    : [];

  // ── complete ───────────────────────────────────────────────────────────────
  const completeMission = useCallback((finalWrong: number, finalHints: number) => {
    if (endedRef.current) return;
    endedRef.current = true;
    const timeSpentSec = Math.round((Date.now() - startTimeRef.current) / 1000);
    const score = computeScore(finalWrong, finalHints, timeSpentSec, baselineSec);
    const outcome: LayerPeelOutcome = {
      success: true,
      score,
      finalScore: Math.round(score * 100),
      wrongAttempts: finalWrong,
      hintsUsed: finalHints,
      timeSpentSec,
      xpEarned: Math.round(mission.xpReward * score),
      stepLog: stepLogRef.current,
    };
    outcomeRef.current = outcome;
  }, [mission, baselineSec]);

  // ── advance ────────────────────────────────────────────────────────────────
  const advanceToNextStep = useCallback((isFinal: boolean) => {
    if (isFinal) {
      setUIStage("breach_complete");
    } else {
      setStepIndex(i => i + 1);
      setWrongAttemptsOnStep(0);
      setHintsRevealedForStep(false);
      setHintRequestedByPlayer(false);
      setLastFeedback(null);
      setFlashedBtn(null);
      setMascotPose("idle");
      setUIStage(stage === "practice" ? "guided_action" : "operation_choice");
    }
  }, [stage]);

  // ── guided tap ─────────────────────────────────────────────────────────────
  const handleGuidedTap = useCallback(() => {
    if (!currentStep || uiStage !== "guided_action") return;
    playSound("submit");
    setMascotPose("celebrate");
    setBreachLog(prev => [...prev, ...currentStep.resultDisplay]);
    stepLogRef.current.push({ operation: currentStep.operation, outcome: "correct" });
    if (currentStep.isFinal) {
      playSound("success");
      completeMission(totalWrong, hintsUsed);
      setUIStage("breach_complete");
    } else {
      setUIStage("step_confirmed");
    }
  }, [currentStep, uiStage, totalWrong, hintsUsed, completeMission]);

  // ── operation select ───────────────────────────────────────────────────────
  const handleOperationSelect = useCallback((opId: LayerPeelOperation) => {
    if (!currentStep || uiStage !== "operation_choice") return;

    const isCorrect = opId === currentStep.operation;
    stepLogRef.current.push({ operation: opId, outcome: isCorrect ? "correct" : "invalid" });

    if (isCorrect) {
      setBreachLog(prev => [...prev, ...currentStep.resultDisplay]);
      setFlashedBtn({ id: opId, tone: "correct" });

      if (currentStep.isFinal) {
        playSound("success");
        completeMission(totalWrong, hintsUsed);
        setUIStage("breach_complete");
      } else {
        playSound("submit");
        setMascotPose("celebrate");
        const lines = shared.feedback.correct;
        setLastFeedback({ text: lines[Math.floor(Math.random() * lines.length)], tone: "correct" });
        setUIStage("step_confirmed");
      }
    } else {
      playSound("fail");
      setFlashedBtn({ id: opId, tone: "invalid" });
      setMascotPose("encourage");
      setLastFeedback({ text: shared.feedback.invalid, tone: "invalid" });
      const nextWrong        = totalWrong + 1;
      const nextWrongOnStep  = wrongAttemptsOnStep + 1;
      setTotalWrong(nextWrong);
      setWrongAttemptsOnStep(nextWrongOnStep);

      if (stage !== "master") {
        const newLevel = resolveHintLevel(nextWrongOnStep, tier.hintAfterAttempts);
        if (newLevel >= 0 && !hintsRevealedForStep) {
          setHintsRevealedForStep(true);
          setHintsUsed(h => h + 1);
        }
      }

      setTimeout(() => {
        setFlashedBtn(null);
        setLastFeedback(null);
        setMascotPose("idle");
      }, 900);
    }
  }, [
    currentStep, uiStage, shared, stage, tier,
    totalWrong, wrongAttemptsOnStep, hintsRevealedForStep, hintsUsed,
    completeMission,
  ]);

  // ── continue after confirmed step ─────────────────────────────────────────
  const handleContinue = useCallback(() => {
    setMascotPose("idle");
    setLastFeedback(null);
    setFlashedBtn(null);
    advanceToNextStep(false);
  }, [advanceToNextStep]);

  const environmentImages =
    GAME_ENVIRONMENT_IMAGES["vault-breach"] ??
    GAME_ENVIRONMENT_IMAGES["nova-explorer"] ??
    Object.values(GAME_ENVIRONMENT_IMAGES)[0];

  // ── breach complete ────────────────────────────────────────────────────────
  if (uiStage === "breach_complete") {
    const reviewLines = shared.review?.successLines ?? ["Vault breached. Variable extracted."];
    return (
      <div className={styles.breachOverlay}>
        <div className={styles.breachBadge}>BREACH COMPLETE</div>
        <div className={styles.breachLine}>{shared.feedback.success}</div>

        {payload.discoveryName && (
          <div className={styles.discoveryBadge}>🔐 {payload.discoveryName} extracted</div>
        )}

        <div className={styles.breachLog}>
          <div className={styles.breachLogTitle}>{shared.review?.title ?? "BREACH LOG"}</div>
          <div className={styles.breachLogFormula}>{payload.formula}</div>
          {payload.excavationSteps.map((step, i) => (
            <div key={i} className={styles.breachLogStep}>
              <div className={styles.breachLogArrow}>↓</div>
              <div className={styles.breachLogDesc}>{step.description}</div>
              {step.resultDisplay.map((line, j) => (
                <div key={j} className={styles.breachLogResult}>{line}</div>
              ))}
            </div>
          ))}
        </div>

        <div className={styles.breachSuccessLine}>
          {reviewLines[Math.floor(Math.random() * reviewLines.length)]}
        </div>

        <button
          className={styles.continueBtn}
          onClick={() => {
            const outcome = outcomeRef.current;
            if (outcome) onComplete(outcome);
          }}
        >
          Continue →
        </button>
      </div>
    );
  }

  // ── main render ───────────────────────────────────────────────────────────
  return (
    <GameplayShell
      environmentImages={environmentImages}
      fallbackGradient="linear-gradient(160deg, #020917 0%, #061428 50%, #0a1e3d 100%)"
      accentColor="#38bdf8"
      stats={[{
        label: tier.label ?? stage.toUpperCase(),
        value: payload.world ?? shared.entry.missionLabel,
        tone: "default",
      }]}
      missionPrompt={{
        label: `Make ${payload.targetVariable} the subject`,
        text:  payload.formula,
      }}
      menu={menu}
      isPaused={isPaused}
    >
      <div className={styles.engineColumn}>

        {/* ── Progress + working formula ── */}
        <div className={styles.capsule}>
          {/* Shell dots */}
          <div className={styles.progressRow}>
            <div className={styles.progressLabel}>
              {totalSteps - stepIndex} shell{totalSteps - stepIndex !== 1 ? "s" : ""} protecting {payload.targetVariable}
            </div>
            <div className={styles.progressShells}>
              {payload.excavationSteps.map((_, i) => (
                <div
                  key={i}
                  className={[
                    styles.shellDot,
                    i < stepIndex   ? styles.shellDotBreached : "",
                    i === stepIndex ? styles.shellDotActive   : "",
                  ].filter(Boolean).join(" ")}
                />
              ))}
            </div>
          </div>

          {/* Live formula — updates as shells are peeled */}
          <div className={styles.formulaDisplay}>
            {breachLog.length === 0 ? (
              <div className={styles.formulaCurrent}>{payload.formula}</div>
            ) : (
              <div className={styles.formulaLog}>
                <div className={styles.formulaLogOrigin}>{payload.formula}</div>
                {breachLog.map((line, i) => (
                  <div
                    key={i}
                    className={[
                      styles.formulaLogLine,
                      i === breachLog.length - 1 ? styles.formulaLogLatest : "",
                    ].filter(Boolean).join(" ")}
                  >
                    {i === 0 ? "↓  " : "   "}{line}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Current shell label */}
          {(uiStage === "guided_action" || uiStage === "operation_choice") && currentStep && (
            <div className={styles.shellIndicator}>
              <span className={styles.shellIcon}>⬡</span>
              <div>
                <div className={styles.shellLabel}>
                  Outer layer: {currentStep.obstacleLabel}
                </div>
                {currentStep.description && (
                  <div className={styles.shellProtecting}>{currentStep.description}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Practice: guided action ── */}
        {uiStage === "guided_action" && currentStep && (
          <div className={styles.guidedSection}>
            <div className={styles.guidedLabel}>Next step</div>
            <div className={styles.guidedInstruction}>
              {getLayerPeelOperationMeta(currentStep.operation).label} to remove the {currentStep.obstacleLabel}
            </div>
            <button className={styles.guidedBtn} onClick={handleGuidedTap}>
              {getLayerPeelOperationMeta(currentStep.operation).label} →
            </button>
          </div>
        )}

        {/* ── Step confirmed ── */}
        {uiStage === "step_confirmed" && (
          <div className={styles.confirmedSection}>
            {lastFeedback && (
              <div className={`${styles.feedbackStrip} ${styles[lastFeedback.tone]}`}>
                {lastFeedback.text}
              </div>
            )}
            <div className={styles.formulaLog}>
              {breachLog.length > 0 && (
                <div className={styles.formulaLogLatest}>
                  → {breachLog[breachLog.length - 1]}
                </div>
              )}
            </div>
            <button className={styles.nextStepBtn} onClick={handleContinue}>
              {currentStep?.isFinal ? "Complete →" : "Next shell →"}
            </button>
          </div>
        )}

        {/* ── Challenge/Master: operation buttons ── */}
        {uiStage === "operation_choice" && (
          <div className={styles.operationSection}>
            <div className={styles.sectionLabel}>
              Which operation removes the {currentStep?.obstacleLabel ?? "outer shell"}?
            </div>

            <div className={styles.operationGrid}>
              {opButtons.map(btn => {
                const isFlashed = flashedBtn?.id === btn.id;
                const flashTone = isFlashed ? flashedBtn?.tone : undefined;
                return (
                  <button
                    key={btn.id}
                    className={[
                      styles.operationBtn,
                      btn.highlighted                       ? styles.hintHighlight : "",
                      isFlashed && flashTone === "correct" ? styles.correct        : "",
                      isFlashed && flashTone === "invalid" ? styles.wrong          : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => handleOperationSelect(btn.id)}
                  >
                    <span className={styles.operationBtnLabel}>{btn.label}</span>
                    <span className={styles.operationBtnSublabel}>{btn.sublabel}</span>
                  </button>
                );
              })}
            </div>

            {lastFeedback && (
              <div className={`${styles.feedbackStrip} ${styles[lastFeedback.tone]}`}>
                {lastFeedback.text}
              </div>
            )}

            {hintText && (
              <div className={styles.hintPanel}>
                <span className={styles.hintIcon}>💡</span>
                <span className={styles.hintText}>{hintText}</span>
              </div>
            )}

            {stage === "master" && !hintRequestedByPlayer && (
              <button
                className={styles.hintRequestBtn}
                onClick={() => {
                  setHintRequestedByPlayer(true);
                  setHintsRevealedForStep(true);
                  setHintsUsed(h => h + 1);
                }}
              >
                💡 I need a hint
              </button>
            )}
          </div>
        )}

        {/* ── Mascot ── */}
        {mascotPose && (
          <div className={styles.mascotRow}>
            <Mascot pose={mascotPose} />
          </div>
        )}

      </div>
    </GameplayShell>
  );
}