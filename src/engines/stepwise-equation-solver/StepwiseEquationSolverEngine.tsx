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
  add:           { label: "Add the equations",           sublabel: "combine both rows" },
  subtract:      { label: "Subtract the equations",      sublabel: "remove one row from the other" },
  multiply_eq1:  { label: "Scale the 1st equation",      sublabel: "multiply every term by a number" },
  multiply_eq2:  { label: "Scale the 2nd equation",      sublabel: "multiply every term by a number" },
  solve:         { label: "Divide to find the value",    sublabel: "isolate the remaining variable" },
  substitute:    { label: "Substitute back",             sublabel: "find the second variable" },
};

// Dynamic guide prompts — rotate so the voice feels alive, not like a UI label
const GUIDE_PROMPTS = [
  "What do we do here?",
  "What's your next move?",
  "Now, what do we do?",
  "What should we do next?",
  "Your turn — what's the next step?",
  "Think it through — what comes next?",
  "What do we need to do?",
];

/**
 * Returns the 4 most contextually useful operations for the current step.
 * Reduces cognitive load — no need to see "Substitute back" when we're
 * still in the elimination phase.
 */
function getRelevantOperations(
  stepIndex: number,
  totalSteps: number,
  solutionSteps: import("./stepwiseEquationSolver.config").SolutionStep[]
): OperationType[] {
  // Look ahead at what operations appear in this mission
  const upcoming = new Set(solutionSteps.slice(stepIndex).map((s) => s.operation as OperationType));
  const current = solutionSteps[stepIndex]?.operation as OperationType | undefined;

  // Always include the correct operation for the current step
  const pool = new Set<OperationType>();
  if (current) pool.add(current);

  // Add contextually relevant alternatives based on phase
  const isEliminationPhase = stepIndex < totalSteps - 2;
  const isSolvePhase = upcoming.has("solve") || upcoming.has("substitute");

  if (isEliminationPhase) {
    pool.add("add");
    pool.add("subtract");
    // Only show multiply if it's needed in this mission
    if (solutionSteps.some((s) => s.operation === "multiply_eq1")) pool.add("multiply_eq1");
    if (solutionSteps.some((s) => s.operation === "multiply_eq2")) pool.add("multiply_eq2");
  }

  if (isSolvePhase) {
    pool.add("solve");
    pool.add("substitute");
  }

  // Cap at 4, always keeping the correct answer in the set
  const result = Array.from(pool);
  if (result.length > 4) {
    // Keep current op + pick 3 others
    const others = result.filter((op) => op !== current).slice(0, 3);
    return current ? [current, ...others] : others.slice(0, 4);
  }
  // Pad to at least 2 options so it never feels like a giveaway
  if (result.length < 2) {
    const fallback: OperationType[] = ["add", "subtract", "solve", "substitute"];
    for (const op of fallback) {
      if (!pool.has(op)) { pool.add(op); break; }
    }
    return Array.from(pool).slice(0, 4);
  }
  return result;
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

  // When the student taps "Try it yourself", we replay the mission as independent.
  // Declared before pedagogicalStage because pedagogicalStage depends on it.
  const [selfPracticeMode, setSelfPracticeMode] = useState(false);
  // After a correct step, show the result and wait for the user to tap Next
  // before advancing. This gives them time to read what happened.
  const [stepConfirmed, setStepConfirmed] = useState(false);

  // In self-practice mode treat the mission as independent regardless of authored stage.
  const authoredStage: PedagogicalStage = missionPayload.stage ?? "supported";
  const pedagogicalStage: PedagogicalStage = selfPracticeMode ? "independent" : authoredStage;

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
  // Stores the completed outcome until the student taps Continue on the
  // case-closed screen. onComplete is NOT called until that tap so GameRuntime
  // doesn't navigate away before the student has read their results.
  const [pendingOutcome, setPendingOutcome] = useState<StepwiseEquationSolverOutcome | null>(null);

  const [mascotPose, setMascotPose] = useState<"idle" | "celebrate" | "encourage" | null>("idle");
  const [mascotLine, setMascotLine] = useState<string | null>(null);
  const [flashedButton, setFlashedButton] = useState<{ id: OperationType; tone: StepOutcome } | null>(null);

  const startTimeRef = useRef(Date.now());
  const endedRef = useRef(false);
  const stepLogRef = useRef<Array<{ operation: string; outcome: StepOutcome }>>([]);
  const pendingAdvanceRef = useRef<{ finalStepsTaken: number; isFinal: boolean; nextIndex: number } | null>(null);

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

    const outcome: StepwiseEquationSolverOutcome = {
      success: true,
      score,
      finalScore: Math.round(score * 100),
      wrongAttempts: totalWrongAttempts,
      hintsUsed,
      timeSpentSec,
      efficiency,
      stepLog: stepLogRef.current,
      xpEarned: Math.round(mission.xpReward * score)
    };
    // Store outcome — onComplete fires only when the student taps Continue.
    setPendingOutcome(outcome);
  }, [totalWrongAttempts, hintsUsed, suboptimalSteps, shared, mission, onComplete, missionPayload, pedagogicalStage]);

  // ── Advance to next step ──────────────────────────────────────────────────
  const advanceStep = useCallback((finalStepsTaken: number, isFinal: boolean, nextIndex: number) => {
    if (isFinal) {
      setUIStage("case_closed");
      playSound("mission_complete");
      completeMission(finalStepsTaken); // stores pendingOutcome, does NOT call onComplete
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
      // supported/independent/mastery stay on operation_choice
    }
  }, [pedagogicalStage, completeMission]);

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
    setStepConfirmed(true);
    pendingAdvanceRef.current = { finalStepsTaken: nextTotal, isFinal: currentStep.isFinal ?? false, nextIndex: currentStepIndex + 1 };
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
      // Don't auto-advance — show result, wait for user to tap Next
      setStepConfirmed(true);
      pendingAdvanceRef.current = { finalStepsTaken: nextTotal, isFinal: validation.isFinal, nextIndex: currentStepIndex + 1 };

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

  // ── Next step — fires when user taps the "Next" / "Got it" button ──────────
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

  // ── Variable choice (assisted stage) ─────────────────────────────────────
  const handleVariableChoice = useCallback((_variable: string) => {
    setUIStage("operation_choice");
  }, []);

  const variablesInSystem = Object.keys(missionPayload.solution.variables).sort();

  // Dynamic guide prompt — cycles so it doesn't feel like a static UI label
  const guidePrompt = GUIDE_PROMPTS[currentStepIndex % GUIDE_PROMPTS.length];

  // 4 contextually relevant operation buttons for this step
  const relevantOps = getRelevantOperations(
    currentStepIndex,
    missionPayload.solutionSteps.length,
    missionPayload.solutionSteps
  );
  const environmentImages = GAME_ENVIRONMENT_IMAGES["simultaneous-equations-detective"];

  // ── Handle "Try it yourself" — reset state, replay as independent ───────────
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
    // pendingOutcome intentionally kept — if they complete again it will update
  }, []);

  // ── Case closed ───────────────────────────────────────────────────────────
  if (uiStage === "case_closed") {
    const solutionLines = getSolutionLines(missionPayload.solution.variables);
    // Build the full worked solution from the authored steps
    const workedSolution = missionPayload.solutionSteps.map((step) => ({
      label: step.description,
      lines: step.resultDisplay
    }));

    return (
      <div className={styles.caseClosedOverlay}>
        <div className={styles.caseClosedBadge}>{shared.feedback.caseClosedPrimary}</div>
        <div className={styles.caseClosedLine}>{shared.feedback.caseClosedSecondary}</div>

        {/* Final answer */}
        <div className={styles.solutionBox}>
          {solutionLines.map(({ variable, value }) => (
            <div key={variable} className={styles.solutionVar}>
              <div className={styles.solutionVarName}>{variable} =</div>
              <div className={styles.solutionVarValue}>{value}</div>
            </div>
          ))}
        </div>

        {/* Full worked solution — always shown so student can review */}
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

        {/* Mastery stage: efficiency comparison */}
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

        {/* Action buttons */}
        <div className={styles.caseClosedActions}>
          {/* Only offer "Try it yourself" if they were in a guided/assisted stage */}
          {!selfPracticeMode &&
            (pedagogicalStage === "guided" || pedagogicalStage === "assisted") && (
            <button
              className={styles.tryYourselfBtn}
              onClick={handleTryYourself}
            >
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

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <GameplayShell
      environmentImages={environmentImages}
      fallbackGradient="linear-gradient(160deg, #0b1330 0%, #0e1a2e 50%, #0b2340 100%)"
      accentColor="var(--eg-subject-mathematics)"
      stats={[]}
      menu={menu}
      isPaused={isPaused}
    >
      <div className={styles.engineColumn}>

        {/* ── Top bar: case title + menu (menu rendered by shell, we mirror the label) */}
        <div className={styles.topBar}>
          <div className={styles.topBarCase}>
            <span className={styles.topBarCaseLabel}>Case</span>
            <span className={styles.topBarCaseNumber}>{missionPayload.caseNumber}</span>
          </div>
          <span className={styles.topBarDifficulty}>{tierConfig.label}</span>
        </div>

        {/* ── Equations ────────────────────────────────────────────────── */}
        <div className={styles.caseFile}>
          <div className={styles.caseHeader}>
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

        {/* ── NEXT STEP button — appears after correct step, before advancing ── */}
        {stepConfirmed && uiStage === "operation_choice" && (
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

        {/* Feedback shown inline in nextStepSection when stepConfirmed, or here for invalid */}
        {!stepConfirmed && lastFeedback && (
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