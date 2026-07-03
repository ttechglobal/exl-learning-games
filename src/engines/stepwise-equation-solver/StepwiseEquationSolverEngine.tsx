"use client";

import { useState, useRef, useCallback } from "react";
import type {
  StepwiseEquationSolverConfig,
  StepwiseEquationSolverOutcome,
  SolutionStep,
  DifficultyTier
} from "./stepwiseEquationSolver.config";
import {
  validateStep,
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

// ─── types ───────────────────────────────────────────────────────────────────

type PedagogicalStage =
  | "guided"
  | "assisted"
  | "supported"
  | "independent"
  | "mastery";

type UIStage =
  | "guided_action"
  | "variable_choice"
  | "operation_choice"
  | "case_closed";

interface MissionPayload {
  caseNumber: string;
  stage?: PedagogicalStage;
  equations: Array<{ id: string; display: string }>;
  learningGoal: string;
  solutionSteps: SolutionStep[];
  alternativeValidOperations: string[];
  solution: { variables: Record<string, number> };
  caseHints: string[];
}

// ─── constants ────────────────────────────────────────────────────────────────

const OPERATION_LABELS: Record<OperationType, { label: string; sublabel: string }> = {
  add:          { label: "Add the equations",        sublabel: "combine both rows" },
  subtract:     { label: "Subtract the equations",   sublabel: "remove one row from the other" },
  multiply_eq1: { label: "Scale the 1st equation",   sublabel: "multiply every term by a number" },
  multiply_eq2: { label: "Scale the 2nd equation",   sublabel: "multiply every term by a number" },
  solve:        { label: "Divide to find the value", sublabel: "isolate the remaining variable" },
  substitute:   { label: "Substitute back",          sublabel: "find the second variable" },
};

const GUIDE_PROMPTS = [
  "What do we do first?",
  "Good — now what?",
  "What's the next move?",
  "Now, what do we do?",
  "Keep going — what comes next?",
  "You're doing well. What now?",
  "Almost there — next step?",
  "What should we do here?",
  "Think it through — what's next?",
  "One more decision. What do we do?",
];

function getRelevantOperations(
  stepIndex: number,
  totalSteps: number,
  solutionSteps: SolutionStep[]
): OperationType[] {
  const upcoming = new Set(solutionSteps.slice(stepIndex).map((s) => s.operation as OperationType));
  const current = solutionSteps[stepIndex]?.operation as OperationType | undefined;
  const pool = new Set<OperationType>();
  if (current) pool.add(current);

  const isEliminationPhase = stepIndex < totalSteps - 2;
  const isSolvePhase = upcoming.has("solve") || upcoming.has("substitute");

  if (isEliminationPhase) {
    pool.add("add");
    pool.add("subtract");
    if (solutionSteps.some((s) => s.operation === "multiply_eq1")) pool.add("multiply_eq1");
    if (solutionSteps.some((s) => s.operation === "multiply_eq2")) pool.add("multiply_eq2");
  }
  if (isSolvePhase) {
    pool.add("solve");
    pool.add("substitute");
  }

  const result = Array.from(pool);
  if (result.length > 4) {
    const others = result.filter((op) => op !== current).slice(0, 3);
    return current ? [current, ...others] : others.slice(0, 4);
  }
  if (result.length < 2) {
    const fallback: OperationType[] = ["add", "subtract", "solve", "substitute"];
    for (const op of fallback) {
      if (!pool.has(op)) { pool.add(op); break; }
    }
    return Array.from(pool).slice(0, 4);
  }
  return result;
}

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
    case "solve":        return "Divide to find the value";
    case "substitute":   return "Substitute back";
    default:             return step.description;
  }
}

// ─── component ───────────────────────────────────────────────────────────────

export function StepwiseEquationSolverEngine({
  config,
  onComplete,
  isPaused,
  menu,
  gameTitle
}: EngineRuntimeProps<StepwiseEquationSolverConfig, StepwiseEquationSolverOutcome>) {
  const { shared, mission } = config;
  const missionPayload = mission.payload as unknown as MissionPayload;

  // selfPracticeMode must be declared before pedagogicalStage (depends on it)
  const [selfPracticeMode, setSelfPracticeMode] = useState(false);
  const [stepConfirmed, setStepConfirmed] = useState(false);

  const authoredStage: PedagogicalStage = missionPayload.stage ?? "supported";
  const pedagogicalStage: PedagogicalStage = selfPracticeMode ? "independent" : authoredStage;

  const tierConfig: DifficultyTier =
    shared.tiers.find((t) => t.tier === (mission.difficulty ?? "").toLowerCase()) ??
    shared.tiers[0];

  const initialUIStage: UIStage = (() => {
    if (pedagogicalStage === "guided") return "guided_action";
    if (pedagogicalStage === "assisted") return "variable_choice";
    return "operation_choice";
  })();

  // ── state ─────────────────────────────────────────────────────────────────
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
  const [pendingOutcome, setPendingOutcome] = useState<StepwiseEquationSolverOutcome | null>(null);
  const [mascotPose, setMascotPose] = useState<"idle" | "celebrate" | "encourage" | null>("idle");
  const [mascotLine, setMascotLine] = useState<string | null>(null);
  const [flashedButton, setFlashedButton] = useState<{ id: OperationType; tone: StepOutcome } | null>(null);

  const startTimeRef = useRef(Date.now());
  const endedRef = useRef(false);
  const stepLogRef = useRef<Array<{ operation: string; outcome: StepOutcome }>>([]);
  const pendingAdvanceRef = useRef<{ finalStepsTaken: number; isFinal: boolean; nextIndex: number } | null>(null);

  const currentStep: SolutionStep | undefined = missionPayload.solutionSteps[currentStepIndex];

  const autoHints = pedagogicalStage === "guided" || pedagogicalStage === "assisted" || pedagogicalStage === "supported";
  const hintLevel = resolveHintLevel(wrongAttemptsOnStep, tierConfig.hintAfterAttempts);
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

  // ── complete mission ──────────────────────────────────────────────────────
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
    if (pedagogicalStage === "mastery") {
      setEfficiencyComparison(missionPayload.solutionSteps.map((s) => s.description));
    }
    setPendingOutcome({
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
  }, [totalWrongAttempts, hintsUsed, suboptimalSteps, shared, mission, missionPayload, pedagogicalStage]);

  // ── advance step ──────────────────────────────────────────────────────────
  const advanceStep = useCallback((finalStepsTaken: number, isFinal: boolean, nextIndex: number) => {
    if (isFinal) {
      setUIStage("case_closed");
      playSound("mission_complete");
      completeMission(finalStepsTaken);
    } else {
      setCurrentStepIndex(nextIndex);
      setLastFeedback(null);
      setFlashedButton(null);
      setWrongAttemptsOnStep(0);
      setHintsRevealedForStep(false);
      setHintRequestedByPlayer(false);
      setMascotPose("idle");
      setMascotLine(null);
      if (pedagogicalStage === "guided") setUIStage("guided_action");
      else if (pedagogicalStage === "assisted") setUIStage("variable_choice");
    }
  }, [pedagogicalStage, completeMission]);

  // ── handle guided tap ─────────────────────────────────────────────────────
  const handleGuidedTap = useCallback(() => {
    if (!currentStep || uiStage !== "guided_action") return;
    playSound("correct");
    setMascotPose("celebrate");
    setMascotLine("Exactly right. Watch what happens.");
    if (currentStep.resultDisplay) {
      setVisibleResults((prev) => [...prev, ...currentStep.resultDisplay]);
    }
    const nextTotal = totalStepsTaken + 1;
    setTotalStepsTaken(nextTotal);
    stepLogRef.current.push({ operation: currentStep.operation, outcome: "correct" });
    setStepConfirmed(true);
    pendingAdvanceRef.current = {
      finalStepsTaken: nextTotal,
      isFinal: currentStep.isFinal ?? false,
      nextIndex: currentStepIndex + 1
    };
  }, [currentStep, uiStage, totalStepsTaken, currentStepIndex]);

  // ── handle operation select ───────────────────────────────────────────────
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
      setStepConfirmed(true);
      pendingAdvanceRef.current = {
        finalStepsTaken: nextTotal,
        isFinal: validation.isFinal,
        nextIndex: currentStepIndex + 1
      };
    } else if (validation.outcome === "suboptimal") {
      playSound("suboptimal");
      setFlashedButton({ id: operationId, tone: "suboptimal" });
      setMascotPose("encourage");
      setMascotLine("That works, but there's a shorter path.");
      setLastFeedback({ text: shared.feedback.suboptimalStep, tone: "suboptimal" });
      setSuboptimalSteps((n) => n + 1);
      const nextTotal = totalStepsTaken + 1;
      setTotalStepsTaken(nextTotal);
      setStepConfirmed(true);
      pendingAdvanceRef.current = {
        finalStepsTaken: nextTotal,
        isFinal: false,
        nextIndex: currentStepIndex + 1
      };
    } else {
      playSound("wrong");
      setFlashedButton({ id: operationId, tone: "invalid" });
      setMascotPose("encourage");
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
  }, [currentStep, uiStage, missionPayload, shared, tierConfig, totalStepsTaken, currentStepIndex, autoHints]);

  // ── handle next step ──────────────────────────────────────────────────────
  const handleNextStep = useCallback(() => {
    const pending = pendingAdvanceRef.current;
    if (!pending) return;
    pendingAdvanceRef.current = null;
    setStepConfirmed(false);
    setFlashedButton(null);
    setLastFeedback(null);
    setMascotPose("idle");
    setMascotLine(null);
    advanceStep(pending.finalStepsTaken, pending.isFinal, pending.nextIndex);
  }, [advanceStep]);

  // ── handle variable choice ────────────────────────────────────────────────
  const handleVariableChoice = useCallback(() => {
    setUIStage("operation_choice");
  }, []);

  // ── handle try yourself ───────────────────────────────────────────────────
  const handleTryYourself = useCallback(() => {
    setSelfPracticeMode(true);
    setUIStage("operation_choice");
    setCurrentStepIndex(0);
    setWrongAttemptsOnStep(0);
    setTotalWrongAttempts(0);
    setHintsUsed(0);
    setSuboptimalSteps(0);
    setTotalStepsTaken(0);
    setHintsRevealedForStep(false);
    setHintRequestedByPlayer(false);
    setLastFeedback(null);
    setVisibleResults([]);
    setEfficiencyComparison(null);
    setMascotPose("idle");
    setMascotLine(null);
    setFlashedButton(null);
    setStepConfirmed(false);
    pendingAdvanceRef.current = null;
    startTimeRef.current = Date.now();
    endedRef.current = false;
    stepLogRef.current = [];
  }, []);

  const variablesInSystem = Object.keys(missionPayload.solution.variables).sort();
  const guidePrompt = GUIDE_PROMPTS[currentStepIndex % GUIDE_PROMPTS.length];
  const relevantOps = getRelevantOperations(
    currentStepIndex,
    missionPayload.solutionSteps.length,
    missionPayload.solutionSteps
  );
  const environmentImages = GAME_ENVIRONMENT_IMAGES["simultaneous-equations-detective"];

  // ── case closed screen ────────────────────────────────────────────────────
  if (uiStage === "case_closed") {
    const solutionLines = getSolutionLines(missionPayload.solution.variables);
    const workedSolution = missionPayload.solutionSteps.map((step) => ({
      label: step.description,
      lines: step.resultDisplay
    }));

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

        <div className={styles.workedSolution}>
          <div className={styles.workedSolutionLabel}>How it was solved</div>
          {workedSolution.map((step, i) => (
            <div key={i} className={styles.workedStep}>
              <div className={styles.workedStepHeader}>
                <span className={styles.workedStepNum}>{i + 1}</span>
                <span className={styles.workedStepLabel}>{step.label}</span>
              </div>
              {step.lines.map((line, j) => (
                <div key={j} className={styles.workedStepLine}>{line}</div>
              ))}
            </div>
          ))}
        </div>

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

        <div className={styles.caseClosedActions}>
          {!selfPracticeMode &&
            (pedagogicalStage === "guided" || pedagogicalStage === "assisted") && (
            <button className={styles.tryYourselfBtn} onClick={handleTryYourself}>
              Try it yourself →
            </button>
          )}
          <button
            className={styles.continueBtn}
            onClick={() => { if (pendingOutcome) onComplete(pendingOutcome); }}
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  // ── main render ───────────────────────────────────────────────────────────
  return (
    <GameplayShell
      environmentImages={environmentImages}
      fallbackGradient="linear-gradient(160deg, #0b1330 0%, #0e1a2e 50%, #0b2340 100%)"
      accentColor="var(--eg-subject-mathematics)"
      stats={[{
        label: tierConfig.label,
        value: `Case ${missionPayload.caseNumber}`,
        tone: "default"
      }]}
      missionPrompt={{
        label: "Learning goal",
        text: missionPayload.learningGoal
      }}
      menu={menu}
      isPaused={isPaused}
    >
      <div className={styles.engineColumn}>

        <div className={styles.caseFile}>
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

        {uiStage === "guided_action" && currentStep && (
          <div className={styles.guidedSection}>
            <div className={styles.guidedLabel}>Next step</div>
            <div className={styles.guidedInstruction}>
              {currentStep.targetVariable
                ? `We want to eliminate ${currentStep.targetVariable.toUpperCase()}. ${getGuidedDescription(currentStep)}`
                : getGuidedDescription(currentStep)}
            </div>
            {!stepConfirmed && (
              <button className={styles.guidedBtn} onClick={handleGuidedTap}>
                {getGuidedButtonLabel(currentStep)} →
              </button>
            )}
            {stepConfirmed && (
              <button className={styles.nextStepBtn} onClick={handleNextStep}>
                {pendingAdvanceRef.current?.isFinal ? "See the answer →" : "Next step →"}
              </button>
            )}
          </div>
        )}

        {uiStage === "variable_choice" && (
          <div className={styles.variableSection}>
            <div className={styles.sectionLabel}>Which variable do you want to eliminate?</div>
            <div className={styles.variableChoiceRow}>
              {variablesInSystem.map((v) => (
                <button
                  key={v}
                  className={styles.variableBtn}
                  onClick={handleVariableChoice}
                >
                  Eliminate {v.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {uiStage === "operation_choice" && !stepConfirmed && (
          <div className={styles.operationSection}>
            <div className={styles.sectionLabel}>{guidePrompt}</div>
            <div className={styles.operationGrid}>
              {relevantOps.map((opId) => {
                const { label, sublabel } = OPERATION_LABELS[opId];
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

        {uiStage === "operation_choice" && stepConfirmed && (
          <div className={styles.nextStepSection}>
            {lastFeedback && (
              <div className={`${styles.feedbackStrip} ${styles[lastFeedback.tone]}`}>
                {lastFeedback.text}
              </div>
            )}
            <button className={styles.nextStepBtn} onClick={handleNextStep}>
              {pendingAdvanceRef.current?.isFinal ? "See the answer →" : "Next step →"}
            </button>
          </div>
        )}

        {!stepConfirmed && lastFeedback && (
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

        {mascotPose && (
          <Mascot pose={mascotPose} line={mascotLine ?? undefined} />
        )}

      </div>
    </GameplayShell>
  );
}