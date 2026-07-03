"use client";

/**
 * StepwiseEquationSolverEngine.tsx
 *
 * Five-stage progression model:
 *
 *  "guided"      — Game tells you exactly what to do next. Tap to confirm and
 *                  watch the effect. Learn the shape of the procedure.
 *  "assisted"    — Game asks one question at a time (which variable? then which
 *                  operation?). One decision per turn, always with a visible prompt.
 *  "supported"   — All buttons visible, no pre-selection. You choose the full
 *                  sequence of operations independently. Hints available.
 *  "independent" — No prompts, no hints until you ask. Just the equations.
 *  "mastery"     — Independent + reflection: after solving, you see the most
 *                  efficient path and where you differed.
 *
 * The pedagogical stage lives on the mission payload (missionPayload.stage),
 * not on the difficulty tier. This separates "how much guidance" from "how
 * hard the maths is" — a guided mission can still have complex equations.
 */

import { useState, useRef, useCallback } from "react";
import type {
  StepwiseEquationSolverConfig,
  StepwiseEquationSolverOutcome,
  SolutionStep,
  DifficultyTier
} from "./stepwiseEquationSolver.config";
import {
  validateStep,
  buildOperationButtons,
  resolveHintLevel,
  resolveHintText,
  computeScore,
  computeEfficiency,
  getSolutionLines,
  type OperationType,
  type StepOutcome
} from "./stepwiseEquationSolver.logic";
import type { EngineRuntimeProps } from "@/engines/engine-types";
import { GameplayShell } from "@/components/gameplay/GameplayShell";
import { Mascot } from "@/motion/Mascot";
import { pickMascotLine } from "@/motion/mascotLines";
import { playSound } from "@/motion/sound/playSound";
import { GAME_ENVIRONMENT_IMAGES } from "@/lib/content/gameEnvironments";
import styles from "./StepwiseEquationSolverEngine.module.css";

// ─── pedagogical stage ───────────────────────────────────────────────────────

/**
 * The five stages of responsibility transfer.
 * Authored per-mission in the JSON payload.
 * Defaults to "supported" if not specified (safe middle ground).
 */
type PedagogicalStage =
  | "guided"       // Game tells you what to do — tap to confirm
  | "assisted"     // One question at a time (variable choice, then operation)
  | "supported"    // All buttons shown; you choose; hints available
  | "independent"  // No prompts, no auto-hints; hint button available on request
  | "mastery";     // Independent + post-solve efficiency comparison

// ─── UI stage ────────────────────────────────────────────────────────────────

type UIStage =
  | "guided_action"    // guided: show the next step as a single "tap to continue" button
  | "variable_choice"  // assisted+: which variable to eliminate?
  | "operation_choice" // all stages: which operation?
  | "case_closed";     // payoff screen

// ─── plain-language button labels ────────────────────────────────────────────

/**
 * Human-readable labels for each operation type.
 * "ADD" and "SUBTRACT" are fine — they're common words.
 * The multiply and other operations needed clearer language.
 */
const OPERATION_LABELS: Record<OperationType, { label: string; sublabel: string }> = {
  add:           { label: "Add both equations",         sublabel: "Eq1 + Eq2" },
  subtract:      { label: "Subtract one equation",      sublabel: "Eq1 − Eq2" },
  multiply_eq1:  { label: "Multiply the 1st equation",  sublabel: "scale Eq1 by a number" },
  multiply_eq2:  { label: "Multiply the 2nd equation",  sublabel: "scale Eq2 by a number" },
  solve:         { label: "Solve for the variable",     sublabel: "isolate x or y" },
  substitute:    { label: "Substitute back",            sublabel: "find the other variable" },
};

// ─── component ───────────────────────────────────────────────────────────────

export function StepwiseEquationSolverEngine({
  config,
  onComplete,
  isPaused,
  menu,
  gameTitle
}: EngineRuntimeProps<StepwiseEquationSolverConfig, StepwiseEquationSolverOutcome>) {
  const { shared, mission } = config;

  const missionPayload = mission.payload as {
    caseNumber: string;
    stage?: PedagogicalStage;
    equations: Array<{ id: string; display: string }>;
    learningGoal: string;
    solutionSteps: SolutionStep[];
    alternativeValidOperations: string[];
    solution: { variables: Record<string, number> };
    caseHints: string[];
  };

  const pedagogicalStage: PedagogicalStage = missionPayload.stage ?? "supported";

  // ── Resolve difficulty tier config ────────────────────────────────────────
  const tierConfig: DifficultyTier =
    shared.tiers.find((t) => t.tier === (mission.difficulty ?? "").toLowerCase()) ??
    shared.tiers[0];

  // ── Determine initial UI stage based on pedagogical stage ─────────────────
  const initialUIStage: UIStage = (() => {
    if (pedagogicalStage === "guided") return "guided_action";
    if (pedagogicalStage === "assisted") return "variable_choice";
    return "operation_choice";
  })();

  // ── Session state ─────────────────────────────────────────────────────────
  const [uiStage, setUIStage] = useState<UIStage>(initialUIStage);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [wrongAttemptsOnStep, setWrongAttemptsOnStep] = useState(0);
  const [totalWrongAttempts, setTotalWrongAttempts] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [suboptimalSteps, setSuboptimalSteps] = useState(0);
  const [totalStepsTaken, setTotalStepsTaken] = useState(0);
  const [hintsRevealedForStep, setHintsRevealedForStep] = useState(false);
  const [hintRequestedByPlayer, setHintRequestedByPlayer] = useState(false);

  const [lastFeedback, setLastFeedback] = useState<{ text: string; tone: StepOutcome } | null>(null);
  const [visibleResults, setVisibleResults] = useState<string[]>([]);
  const [efficiencyComparison, setEfficiencyComparison] = useState<string[] | null>(null);

  const [mascotPose, setMascotPose] = useState<"idle" | "celebrate" | "encourage" | null>("idle");
  const [mascotLine, setMascotLine] = useState<string | null>(null);
  const [flashedButton, setFlashedButton] = useState<{ id: OperationType; tone: StepOutcome } | null>(null);

  const startTimeRef = useRef(Date.now());
  const endedRef = useRef(false);
  const stepLogRef = useRef<Array<{ operation: string; outcome: StepOutcome }>>([]);

  const currentStep: SolutionStep | undefined = missionPayload.solutionSteps[currentStepIndex];

  // Hints: auto-reveal in supported/assisted; only on request in independent/mastery
  const hintLevel = resolveHintLevel(wrongAttemptsOnStep, tierConfig.hintAfterAttempts);
  const autoHints = pedagogicalStage === "guided" || pedagogicalStage === "assisted" || pedagogicalStage === "supported";
  const showHintHighlight = autoHints && hintLevel >= 2;

  const hintText = (() => {
    if (pedagogicalStage === "independent" || pedagogicalStage === "mastery") {
      return hintRequestedByPlayer
        ? resolveHintText(0, missionPayload.caseHints, shared.hints.levels)
        : null;
    }
    return hintsRevealedForStep && hintLevel >= 0
      ? resolveHintText(hintLevel, missionPayload.caseHints, shared.hints.levels)
      : null;
  })();

  // ── Complete the mission ──────────────────────────────────────────────────
  const completeMission = useCallback((finalStepsTaken: number) => {
    if (endedRef.current) return;
    endedRef.current = true;

    const timeSpentSec = Math.round((Date.now() - startTimeRef.current) / 1000);
    const efficiency = computeEfficiency(missionPayload.solutionSteps.length, finalStepsTaken);

    const score = computeScore({
      wrongAttempts: totalWrongAttempts,
      hintsUsed,
      suboptimalSteps,
      totalSteps: finalStepsTaken,
      optimalSteps: missionPayload.solutionSteps.length,
      timeSpentSec,
      config: shared
    });

    // Mastery stage: build the efficiency comparison for the reflection screen
    if (pedagogicalStage === "mastery") {
      const optimalPath = missionPayload.solutionSteps.map((s) => s.description);
      setEfficiencyComparison(optimalPath);
    }

    onComplete({
      success: true,
      score,
      finalScore: Math.round(score * 100),
      wrongAttempts: totalWrongAttempts,
      hintsUsed,
      timeSpentSec,
      efficiency,
      stepLog: stepLogRef.current,
      xpEarned: Math.round(mission.xpReward * score)
    });
  }, [totalWrongAttempts, hintsUsed, suboptimalSteps, shared, mission, onComplete, missionPayload, pedagogicalStage]);

  // ── Advance to next step ──────────────────────────────────────────────────
  const advanceStep = useCallback((finalStepsTaken: number, isFinal: boolean) => {
    if (isFinal) {
      setTimeout(() => {
        setUIStage("case_closed");
        playSound("mission_complete");
        completeMission(finalStepsTaken);
      }, 700);
    } else {
      const nextIndex = currentStepIndex + 1;
      setTimeout(() => {
        setCurrentStepIndex(nextIndex);
        setLastFeedback(null);
        setFlashedButton(null);
        setWrongAttemptsOnStep(0);
        setHintsRevealedForStep(false);
        setHintRequestedByPlayer(false);
        setMascotPose("idle");
        setMascotLine(null);
        // Guided stage: stay on guided_action for the next step
        // Assisted stage: go back to variable_choice for each new step
        if (pedagogicalStage === "guided") setUIStage("guided_action");
        else if (pedagogicalStage === "assisted") setUIStage("variable_choice");
        // supported/independent/mastery stay on operation_choice
      }, 900);
    }
  }, [currentStepIndex, pedagogicalStage, completeMission]);

  // ── Handle guided tap (confirm the next step) ─────────────────────────────
  const handleGuidedTap = useCallback(() => {
    if (!currentStep || uiStage !== "guided_action") return;
    playSound("correct");
    setFlashedButton({ id: currentStep.operation as OperationType, tone: "correct" });
    setMascotPose("celebrate");
    setMascotLine("Exactly right. Watch what happens.");

    if (currentStep.resultDisplay) {
      setVisibleResults((prev) => [...prev, ...currentStep.resultDisplay]);
    }

    const nextTotal = totalStepsTaken + 1;
    setTotalStepsTaken(nextTotal);
    stepLogRef.current.push({ operation: currentStep.operation, outcome: "correct" });
    advanceStep(nextTotal, currentStep.isFinal ?? false);
  }, [currentStep, uiStage, totalStepsTaken, advanceStep]);

  // ── Handle operation selection ────────────────────────────────────────────
  const handleOperationSelect = useCallback((operationId: OperationType) => {
    if (!currentStep || uiStage !== "operation_choice") return;

    const validation = validateStep(
      operationId,
      currentStep,
      missionPayload.alternativeValidOperations as OperationType[]
    );

    stepLogRef.current.push({ operation: operationId, outcome: validation.outcome });

    if (validation.outcome === "correct") {
      playSound("correct");
      setFlashedButton({ id: operationId, tone: "correct" });
      setMascotPose("celebrate");
      setMascotLine(pickMascotLine("correct") ?? shared.feedback.correctStep[0]);
      setLastFeedback({
        text: shared.feedback.correctStep[Math.floor(Math.random() * shared.feedback.correctStep.length)],
        tone: "correct"
      });

      if (validation.resultDisplay) {
        setVisibleResults((prev) => [...prev, ...validation.resultDisplay!]);
      }

      const nextTotal = totalStepsTaken + 1;
      setTotalStepsTaken(nextTotal);
      advanceStep(nextTotal, validation.isFinal);

    } else if (validation.outcome === "suboptimal") {
      playSound("suboptimal");
      setFlashedButton({ id: operationId, tone: "suboptimal" });
      setMascotPose("encourage");
      setMascotLine("That works, but there's a shorter path.");
      setLastFeedback({ text: shared.feedback.suboptimalStep, tone: "suboptimal" });
      setSuboptimalSteps((n) => n + 1);

      const nextTotal = totalStepsTaken + 1;
      setTotalStepsTaken(nextTotal);
      advanceStep(nextTotal, false);

    } else {
      playSound("wrong");
      setFlashedButton({ id: operationId, tone: "invalid" });
      setMascotPose("encourage");
      setMascotLine("Not quite — think about which terms would cancel.");
      setLastFeedback({ text: shared.feedback.invalidStep, tone: "invalid" });
      setTotalWrongAttempts((n) => n + 1);
      setWrongAttemptsOnStep((n) => {
        const next = n + 1;
        if (autoHints && resolveHintLevel(next, tierConfig.hintAfterAttempts) >= 0) {
          setHintsRevealedForStep(true);
          setHintsUsed((h) => h + 1);
        }
        return next;
      });

      setTimeout(() => {
        setFlashedButton(null);
        setLastFeedback(null);
        setMascotPose("idle");
        setMascotLine(null);
      }, 900);
    }
  }, [currentStep, uiStage, missionPayload, shared, tierConfig, totalStepsTaken, autoHints, advanceStep]);

  // ── Variable choice (assisted stage) ─────────────────────────────────────
  const handleVariableChoice = useCallback((_variable: string) => {
    setUIStage("operation_choice");
  }, []);

  // ── HUD ──────────────────────────────────────────────────────────────────
  const stats = [
    {
      label: "Step",
      value: `${Math.min(currentStepIndex + 1, missionPayload.solutionSteps.length)} / ${missionPayload.solutionSteps.length}`,
      tone: "default" as const
    },
    {
      label: "Mistakes",
      value: totalWrongAttempts === 0 ? "—" : String(totalWrongAttempts),
      tone: totalWrongAttempts > 0 ? ("danger" as const) : ("default" as const)
    }
  ];

  const variablesInSystem = Object.keys(missionPayload.solution.variables).sort();
  const environmentImages = GAME_ENVIRONMENT_IMAGES["simultaneous-equations-detective"];

  // ── Case closed ───────────────────────────────────────────────────────────
  if (uiStage === "case_closed") {
    const solutionLines = getSolutionLines(missionPayload.solution.variables);
    return (
      <div className={styles.caseClosedOverlay}>
        <div className={styles.caseClosedBadge}>{shared.feedback.caseClosedPrimary}</div>
        <div className={styles.caseClosedLine}>{shared.feedback.caseClosedSecondary}</div>
        <div className={styles.solutionBox}>
          {solutionLines.map(({ variable, value }) => (
            <div key={variable} className={styles.solutionVar}>
              <div className={styles.solutionVarName}>{variable} =</div>
              <div className={styles.solutionVarValue}>{value}</div>
            </div>
          ))}
        </div>
        {/* Mastery stage: show the optimal path for comparison */}
        {efficiencyComparison && (
          <div className={styles.masteryComparison}>
            <div className={styles.masteryLabel}>Most efficient path</div>
            {efficiencyComparison.map((step, i) => (
              <div key={i} className={styles.masteryStep}>
                <span className={styles.masteryStepNum}>{i + 1}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <GameplayShell
      environmentImages={environmentImages}
      fallbackGradient="linear-gradient(160deg, #0b1330 0%, #0e1a2e 50%, #0b2340 100%)"
      accentColor="var(--eg-subject-mathematics)"
      stats={stats}
      missionPrompt={{
        label: `CASE ${missionPayload.caseNumber}`,
        text: missionPayload.learningGoal
      }}
      menu={menu}
      gameTitle={gameTitle}
      isPaused={isPaused}
    >
      <div className={styles.engineColumn}>

        {/* ── Equations ────────────────────────────────────────────────── */}
        <div className={styles.caseFile}>
          <div className={styles.caseHeader}>
            <span className={styles.caseNumber}>Case {missionPayload.caseNumber}</span>
            <span className={styles.caseDifficulty}>{tierConfig.label}</span>
          </div>
          <div className={styles.equationList}>
            {missionPayload.equations.map((eq) => (
              <div key={eq.id} className={styles.equationRow}>{eq.display}</div>
            ))}
            {visibleResults.length > 0 && (
              <>
                <div className={styles.equationDivider} />
                {visibleResults.map((line, i) => (
                  <div key={i} className={styles.resultLine}>{line}</div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── GUIDED: next step shown as a single action to confirm ─────── */}
        {uiStage === "guided_action" && currentStep && (
          <div className={styles.guidedSection}>
            <div className={styles.guidedLabel}>Next step</div>
            <div className={styles.guidedInstruction}>
              {currentStep.targetVariable
                ? `We want to eliminate ${currentStep.targetVariable.toUpperCase()}. ${getGuidedDescription(currentStep)}`
                : getGuidedDescription(currentStep)}
            </div>
            <button className={styles.guidedBtn} onClick={handleGuidedTap}>
              {getGuidedButtonLabel(currentStep)} →
            </button>
          </div>
        )}

        {/* ── ASSISTED: variable choice first ──────────────────────────── */}
        {uiStage === "variable_choice" && (
          <div className={styles.variableSection}>
            <div className={styles.sectionLabel}>Which variable do you want to eliminate?</div>
            <div className={styles.variableChoiceRow}>
              {variablesInSystem.map((v) => (
                <button
                  key={v}
                  className={styles.variableBtn}
                  onClick={() => handleVariableChoice(v)}
                >
                  Eliminate {v.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── SUPPORTED / INDEPENDENT / MASTERY: operation buttons ─────── */}
        {uiStage === "operation_choice" && (
          <div className={styles.operationSection}>
            <div className={styles.sectionLabel}>
              {pedagogicalStage === "assisted"
                ? "Now choose your operation:"
                : "What do you want to do?"}
            </div>
            <div className={styles.operationGrid}>
              {(Object.keys(OPERATION_LABELS) as OperationType[]).map((opId) => {
                const { label, sublabel } = OPERATION_LABELS[opId];
                // For multiply buttons, show the factor if we know it
                const factor = missionPayload.solutionSteps.find(
                  (s) => s.operation === opId
                )?.multiplyFactor;
                const displaySublabel = factor ? `× ${factor}` : sublabel;

                const isFlashed = flashedButton?.id === opId;
                const flashTone = isFlashed ? flashedButton?.tone : undefined;
                const isHighlighted = showHintHighlight && currentStep?.operation === opId;

                return (
                  <button
                    key={opId}
                    className={[
                      styles.operationBtn,
                      isHighlighted ? styles.hintHighlight : "",
                      isFlashed && flashTone === "correct" ? styles.correct : "",
                      isFlashed && flashTone === "invalid" ? styles.wrong : ""
                    ].filter(Boolean).join(" ")}
                    onClick={() => handleOperationSelect(opId)}
                  >
                    <span className={styles.operationBtnLabel}>{label}</span>
                    <span className={styles.operationBtnSublabel}>{displaySublabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Feedback ────────────────────────────────────────────────── */}
        {lastFeedback && (
          <div className={`${styles.feedbackStrip} ${styles[lastFeedback.tone]}`}>
            {lastFeedback.text}
          </div>
        )}

        {/* ── Hint panel ────────────────────────────────────────────────── */}
        {hintText && (
          <div className={styles.hintPanel}>
            <span className={styles.hintIcon}>💡</span>
            <span className={styles.hintText}>{hintText}</span>
          </div>
        )}

        {/* ── Hint request button (independent / mastery stages) ────────── */}
        {(pedagogicalStage === "independent" || pedagogicalStage === "mastery") &&
          uiStage === "operation_choice" &&
          !hintRequestedByPlayer && (
          <button
            className={styles.hintRequestBtn}
            onClick={() => {
              setHintRequestedByPlayer(true);
              setHintsUsed((h) => h + 1);
            }}
          >
            💡 I need a hint
          </button>
        )}

        {/* ── Mascot ───────────────────────────────────────────────────── */}
        {mascotPose && (
          <Mascot pose={mascotPose} line={mascotLine ?? undefined} />
        )}

      </div>
    </GameplayShell>
  );
}

// ─── helpers for guided stage labels ─────────────────────────────────────────

function getGuidedDescription(step: SolutionStep): string {
  switch (step.operation) {
    case "add":          return "Add the two equations together. The chosen variable will cancel out.";
    case "subtract":     return "Subtract one equation from the other. The chosen variable will cancel out.";
    case "multiply_eq1": return `Multiply the first equation by ${step.multiplyFactor ?? "a number"} so the coefficients match.`;
    case "multiply_eq2": return `Multiply the second equation by ${step.multiplyFactor ?? "a number"} so the coefficients match.`;
    case "solve":        return "We now have one variable. Divide both sides to find its value.";
    case "substitute":   return "Put the value we found back into one of the original equations to find the other variable.";
    default:             return step.description;
  }
}

function getGuidedButtonLabel(step: SolutionStep): string {
  switch (step.operation) {
    case "add":          return "Add the equations";
    case "subtract":     return "Subtract the equations";
    case "multiply_eq1": return `Multiply equation 1 by ${step.multiplyFactor ?? "?"}`;
    case "multiply_eq2": return `Multiply equation 2 by ${step.multiplyFactor ?? "?"}`;
    case "solve":        return "Solve for the variable";
    case "substitute":   return "Substitute back";
    default:             return step.description;
  }
}