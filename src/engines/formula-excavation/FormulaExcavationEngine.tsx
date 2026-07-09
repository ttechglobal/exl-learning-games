"use client";

import { useState, useRef, useCallback } from "react";
import type {
  FormulaExcavationConfig,
  FormulaExcavationOutcome,
  ExcavationStep,
  OperationType
} from "./formulaExcavation.config";
import {
  validateStep,
  buildOperationButtons,
  resolveHintLevel,
  resolveHintText,
  computeScore,
  computeEfficiency,
  getGuidedDescription,
  OPERATION_META,
  type StepOutcome
} from "./formulaExcavation.logic";
import type { EngineRuntimeProps } from "@/engines/engine-types";
import { GameplayShell } from "@/components/gameplay/GameplayShell";
import { Mascot } from "@/motion/Mascot";
import { pickMascotLine } from "@/motion/mascotLines";
import { playSound } from "@/motion/sound/playSound";
import { GAME_ENVIRONMENT_IMAGES } from "@/lib/content/gameEnvironments";
import styles from "./FormulaExcavationEngine.module.css";

/** Safe accessor — returns a fallback if Claude generates an unknown operation string */
function getOperationMeta(op: string): { label: string; sublabel: string } {
  return OPERATION_META[op as keyof typeof OPERATION_META] ?? { label: op, sublabel: "unknown operation" };
}

type UIStage = "guided_action" | "operation_choice" | "step_confirmed" | "discovery_complete";

// ─── component ────────────────────────────────────────────────────────────────

export function FormulaExcavationEngine({
  config,
  onComplete,
  isPaused,
  menu,
  gameTitle
}: EngineRuntimeProps<FormulaExcavationConfig, FormulaExcavationOutcome>) {
  const { shared, mission } = config;
  const payload = mission.payload as unknown as import("./formulaExcavation.config").FormulaExcavationMissionPayload;

  const tier =
    shared.tiers.find((t) => t.tier === (mission.difficulty ?? "").toLowerCase()) ??
    shared.tiers[0];

  const stage = payload.stage ?? "practice";

  // ── state ─────────────────────────────────────────────────────────────────
  const [uiStage, setUIStage] = useState<UIStage>(
    stage === "practice" ? "guided_action" : "operation_choice"
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [wrongAttemptsOnStep, setWrongAttemptsOnStep] = useState(0);
  const [totalWrong, setTotalWrong] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintRequestedByPlayer, setHintRequestedByPlayer] = useState(false);
  const [hintsRevealedForStep, setHintsRevealedForStep] = useState(false);
  const [expeditionLog, setExpeditionLog] = useState<string[]>([]);
  const [lastFeedback, setLastFeedback] = useState<{ text: string; tone: StepOutcome } | null>(null);
  const [flashedButton, setFlashedButton] = useState<{ id: OperationType; tone: StepOutcome } | null>(null);
  const [mascotPose, setMascotPose] = useState<"idle" | "celebrate" | "encourage" | null>("idle");
  const [mascotLine, setMascotLine] = useState<string | null>(null);

  const startTimeRef = useRef(Date.now());
  const endedRef = useRef(false);
  const stepLogRef = useRef<Array<{ operation: string; outcome: "correct" | "invalid" }>>([]);
  const totalStepsRef = useRef(0);
  // Outcome stored in a ref so it is readable synchronously when the
  // Continue button fires — avoids the React batching race where
  // setPendingOutcome hasn't flushed yet at the point onComplete is called.
  const outcomeRef = useRef<FormulaExcavationOutcome | null>(null);

  const currentStep: ExcavationStep | undefined = payload.excavationSteps[stepIndex];
  const totalSteps = payload.excavationSteps.length;

  const hintLevel = resolveHintLevel(wrongAttemptsOnStep, tier.hintAfterAttempts);
  const showHints = stage !== "master" || hintRequestedByPlayer;
  const hintText =
    showHints && hintsRevealedForStep && hintLevel >= 0
      ? resolveHintText(hintLevel, stepIndex, payload, shared.hints.levels)
      : null;

  const operationButtons = currentStep
    ? buildOperationButtons(currentStep, stepIndex, payload, showHints ? hintLevel : -1)
    : [];

  // ── complete mission ──────────────────────────────────────────────────────
  const completeMission = useCallback((finalWrong: number, finalHints: number, finalStepsTaken: number) => {
    if (endedRef.current) return;
    endedRef.current = true;
    const timeSpentSec = Math.round((Date.now() - startTimeRef.current) / 1000);
    const score = computeScore({
      wrongAttempts: finalWrong,
      hintsUsed: finalHints,
      totalSteps: finalStepsTaken,
      optimalSteps: totalSteps,
      timeSpentSec,
      config: shared
    });
    const efficiency = computeEfficiency(totalSteps, finalStepsTaken);
    const outcome: FormulaExcavationOutcome = {
      success: true,
      score,
      finalScore: Math.round(score * 100),
      wrongAttempts: finalWrong,
      hintsUsed: finalHints,
      timeSpentSec,
      efficiency,
      stepLog: stepLogRef.current,
      xpEarned: Math.round(mission.xpReward * score)
    };
    // Write to ref first (synchronous) so the Continue button always has it
    outcomeRef.current = outcome;
  }, [shared, mission, totalSteps]);

  // ── advance step ──────────────────────────────────────────────────────────
  const advanceToNextStep = useCallback((isFinal: boolean) => {
    if (isFinal) {
      setUIStage("discovery_complete");
    } else {
      const next = stepIndex + 1;
      setStepIndex(next);
      setWrongAttemptsOnStep(0);
      setHintsRevealedForStep(false);
      setHintRequestedByPlayer(false);
      setLastFeedback(null);
      setFlashedButton(null);
      setMascotPose("idle");
      setMascotLine(null);
      setUIStage(stage === "practice" ? "guided_action" : "operation_choice");
    }
  }, [stepIndex, stage]);

  // ── handle guided tap ─────────────────────────────────────────────────────
  const handleGuidedTap = useCallback(() => {
    if (!currentStep || uiStage !== "guided_action") return;
    playSound("submit");
    setMascotPose("celebrate");
    setMascotLine("Exactly right. Watch what happens.");
    setExpeditionLog((prev) => [...prev, ...currentStep.resultDisplay]);
    stepLogRef.current.push({ operation: currentStep.operation, outcome: "correct" });
    totalStepsRef.current += 1;

    if (currentStep.isFinal) {
      // Final guided step — compute outcome immediately, go straight to discovery
      playSound("success");
      completeMission(totalWrong, hintsUsed, totalStepsRef.current);
      setUIStage("discovery_complete");
    } else {
      setUIStage("step_confirmed");
    }
  }, [currentStep, uiStage, totalWrong, hintsUsed, completeMission]);

  // ── handle operation select ───────────────────────────────────────────────
  const handleOperationSelect = useCallback((opId: OperationType) => {
    if (!currentStep || uiStage !== "operation_choice") return;

    const result = validateStep(opId, currentStep);
    stepLogRef.current.push({ operation: opId, outcome: result.outcome });

    if (result.outcome === "correct") {
      setExpeditionLog((prev) => [...prev, ...(result.resultDisplay ?? [])]);
      totalStepsRef.current += 1;

      if (result.isFinal) {
        // Final step — compute outcome immediately, go straight to discovery
        playSound("success");
        completeMission(totalWrong, hintsUsed, totalStepsRef.current);
        setUIStage("discovery_complete");
      } else {
        // Non-final step — show confirmation, wait for "Next step" tap
        playSound("submit");
        setFlashedButton({ id: opId, tone: "correct" });
        setMascotPose("celebrate");
        setMascotLine(pickMascotLine("correct") ?? shared.feedback.correctStep[0]);
        setLastFeedback({
          text: shared.feedback.correctStep[
            Math.floor(Math.random() * shared.feedback.correctStep.length)
          ],
          tone: "correct"
        });
        setUIStage("step_confirmed");
      }
    } else {
      playSound("fail");
      setFlashedButton({ id: opId, tone: "invalid" });
      setMascotPose("encourage");
      setLastFeedback({ text: shared.feedback.invalidStep, tone: "invalid" });
      const nextWrong = totalWrong + 1;
      const nextWrongOnStep = wrongAttemptsOnStep + 1;
      setTotalWrong(nextWrong);
      setWrongAttemptsOnStep(nextWrongOnStep);

      if (stage !== "master") {
        const newLevel = resolveHintLevel(nextWrongOnStep, tier.hintAfterAttempts);
        if (newLevel >= 0 && !hintsRevealedForStep) {
          setHintsRevealedForStep(true);
          setHintsUsed((h) => h + 1);
        }
      }

      setTimeout(() => {
        setFlashedButton(null);
        setLastFeedback(null);
        setMascotPose("idle");
        setMascotLine(null);
      }, 900);
    }
  }, [
    currentStep, uiStage, shared, stage, tier,
    totalWrong, wrongAttemptsOnStep, hintsRevealedForStep, hintsUsed,
    completeMission
  ]);

  // ── handle continue after non-final step confirmed ────────────────────────
  const handleContinue = useCallback(() => {
    setMascotPose("idle");
    setMascotLine(null);
    setLastFeedback(null);
    setFlashedButton(null);
    advanceToNextStep(false);
  }, [advanceToNextStep]);

  const environmentImages = GAME_ENVIRONMENT_IMAGES["nova-explorer"] ??
    GAME_ENVIRONMENT_IMAGES["simultaneous-equations-detective"];

  // ── discovery complete screen ─────────────────────────────────────────────
  if (uiStage === "discovery_complete") {
    return (
      <div className={styles.discoveryOverlay}>
        <div className={styles.discoveryBadge}>{shared.feedback.discoveryPrimary}</div>
        <div className={styles.discoveryLine}>{shared.feedback.discoverySecondary}</div>

        {payload.discoveryName && (
          <div className={styles.artifactBadge}>
            🏺 {payload.discoveryName} recovered
          </div>
        )}

        {/* Expedition Log — the key learning moment */}
        <div className={styles.expeditionLog}>
          <div className={styles.expeditionLogTitle}>Expedition Route</div>
          <div className={styles.expeditionLogFormula}>{payload.formula}</div>
          {payload.excavationSteps.map((step, i) => (
            <div key={i} className={styles.expeditionLogStep}>
              <div className={styles.expeditionLogArrow}>↓</div>
              <div className={styles.expeditionLogDesc}>{step.description}</div>
              {step.resultDisplay.map((line, j) => (
                <div key={j} className={styles.expeditionLogResult}>{line}</div>
              ))}
            </div>
          ))}
        </div>

        <button
          className={styles.continueBtn}
          onClick={() => {
            // Read from ref — always synchronously available, no state race
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
      fallbackGradient="linear-gradient(160deg, #0e1a0a 0%, #0a1a0e 50%, #061410 100%)"
      accentColor="var(--eg-subject-mathematics)"
      stats={[{
        label: tier.label,
        value: payload.world ?? "Expedition",
        tone: "default"
      }]}
      missionPrompt={{
        label: `Make ${payload.targetVariable} the subject`,
        text: payload.formula
      }}
      menu={menu}
      isPaused={isPaused}
    >
      <div className={styles.engineColumn}>

        {/* ── Mission Statement ── */}
        <div className={styles.missionStatement}>
          <div className={styles.missionTask}>
            Make <span className={styles.missionVar}>{payload.targetVariable}</span> the subject
          </div>
          <div className={styles.missionFormula}>{payload.formula}</div>
          {payload.world && (
            <div className={styles.missionWorld}>{payload.world}</div>
          )}
        </div>

        {/* ── Formula Tablet ── */}
        <div className={styles.tablet}>

          <div className={styles.progressRow}>
            <div className={styles.progressLabel}>
              {stepIndex === 0
                ? "Remove the obstacles protecting " + payload.targetVariable
                : stepIndex + " of " + totalSteps + " obstacles cleared"}
            </div>
            <div className={styles.progressDots}>
              {payload.excavationSteps.map((_, i) => (
                <div
                  key={i}
                  className={[
                    styles.progressDot,
                    i < stepIndex ? styles.progressDotDone : "",
                    i === stepIndex ? styles.progressDotActive : ""
                  ].filter(Boolean).join(" ")}
                />
              ))}
            </div>
          </div>

          <div className={styles.workingState}>
            {expeditionLog.length === 0 ? (
              <div className={styles.workingFormula}>{payload.formula}</div>
            ) : (
              <div className={styles.workingLog}>
                <div className={styles.workingLogOrigin}>{payload.formula}</div>
                {expeditionLog.map((line, i) => (
                  <div key={i} className={[
                    styles.workingLogLine,
                    i === expeditionLog.length - 1 ? styles.workingLogLatest : ""
                  ].filter(Boolean).join(" ")}>
                    {i === 0 ? "↓  " : ""}{line}
                  </div>
                ))}
              </div>
            )}
          </div>

          {(uiStage === "operation_choice" || uiStage === "guided_action") && currentStep && (
            <div className={styles.obstacleRow}>
              <span className={styles.obstacleIcon}>🔒</span>
              <div className={styles.obstacleText}>
                <span className={styles.obstacleLabel}>{payload.targetVariable} is protected by: </span>
                <span className={styles.obstacleValue}>{currentStep.obstacleLabel}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Guided stage ── */}
        {uiStage === "guided_action" && currentStep && (
          <div className={styles.guidedSection}>
            <div className={styles.guidedLabel}>Next step</div>
            <div className={styles.guidedInstruction}>
              {getGuidedDescription(currentStep.operation, currentStep.obstacleLabel)}
            </div>
            <button className={styles.guidedBtn} onClick={handleGuidedTap}>
              {getOperationMeta(currentStep.operation).label} →
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
            <button className={styles.nextStepBtn} onClick={handleContinue}>
              Next step →
            </button>
          </div>
        )}

        {/* ── Operation choice ── */}
        {uiStage === "operation_choice" && (
          <div className={styles.operationSection}>
            <div className={styles.sectionLabel}>
              {stepIndex === 0
                ? `Which operation removes the ${currentStep?.obstacleLabel ?? "obstacle"}?`
                : `Layer cleared. What removes the ${currentStep?.obstacleLabel ?? "next obstacle"}?`}
            </div>
            <div className={styles.operationGrid}>
              {operationButtons.map((btn) => {
                const isFlashed = flashedButton?.id === btn.id;
                const flashTone = isFlashed ? flashedButton?.tone : undefined;
                return (
                  <button
                    key={btn.id}
                    className={[
                      styles.operationBtn,
                      btn.highlighted ? styles.hintHighlight : "",
                      isFlashed && flashTone === "correct" ? styles.correct : "",
                      isFlashed && flashTone === "invalid" ? styles.wrong : ""
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
                  setHintsUsed((h) => h + 1);
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
            {mascotLine && (
              <div className={styles.mascotSpeech}>{mascotLine}</div>
            )}
          </div>
        )}

      </div>
    </GameplayShell>
  );
}