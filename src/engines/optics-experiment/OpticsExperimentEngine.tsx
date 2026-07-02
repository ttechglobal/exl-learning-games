"use client";

import { useState, useRef } from "react";
import { Mascot } from "@/motion/Mascot";
import { GameplayShell } from "@/components/gameplay/GameplayShell";
import type { EngineRuntimeProps } from "@/engines/engine-types";
import type {
  OpticsExperimentConfig,
  OpticsExperimentOutcome,
  MirrorType,
  MirrorLabPayload,
} from "./opticsExperiment.config";
import {
  calculateImage,
  checkWinConditions,
  checkFormulaEntry,
  checkMagnificationEntry,
  getHintMessage,
  getContextualGuide,
  describeImage,
  describeWinConditions,
  buildWorkedSolution,
  getRealWorldApplication,
} from "./opticsExperiment.logic";
import { OpticsSharedConfigSchema } from "./opticsExperiment.config";
import styles from "./OpticsExperimentEngine.module.css";

const SVG_W = 900;
const SVG_H = 430;
const MIRROR_X = 700;
const AXIS_Y = 182;
const SCALE = 70;
const OBJ_H_SVG = 72;
const MIRROR_HALF_H = 130;
const MIRROR_DEPTH = 30;
const MIN_OBJ_X = 260;
const MAX_OBJ_X = MIRROR_X - 18;
const DEFAULT_OBJ_X = MIRROR_X - 5 * SCALE;
const MAX_REAL_V = 6.5;
const MAX_VIRTUAL_V = 3.5;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function extendTo(x1: number, y1: number, x2: number, y2: number, tx: number): [number, number] {
  if (x2 === x1) return [x2, y2];
  const t = (tx - x1) / (x2 - x1);
  return [tx, y1 + t * (y2 - y1)];
}
type Seg = [number, number, number, number];

export function OpticsExperimentEngine({
  config,
  onComplete,
  isPaused,
  menu,
  gameTitle,
}: EngineRuntimeProps<OpticsExperimentConfig, OpticsExperimentOutcome>) {
  const { shared: rawShared, mission } = config;
  const payload = (mission.payload ?? {}) as Partial<MirrorLabPayload>;
  const winConditions = payload.winConditions ?? {};
  const effectiveMirrorOptions: MirrorType[] =
    payload.mirrorOptions ??
    (rawShared as { mirrorOptions?: MirrorType[] }).mirrorOptions ??
    ["concave"];

  const shared = OpticsSharedConfigSchema.parse({
    ...rawShared,
    ...(payload.showFocusLabels !== undefined && { showFocusLabels: payload.showFocusLabels }),
    ...(payload.showCenterLabels !== undefined && { showCenterLabels: payload.showCenterLabels }),
    ...(payload.showRaysToggle !== undefined && { showRaysToggle: payload.showRaysToggle }),
    ...(payload.defaultShowRays !== undefined && { defaultShowRays: payload.defaultShowRays }),
  });

  // ── Prediction state ───────────────────────────────────────────────────────
  const prediction = payload.prediction;
  const [predictionPhase, setPredictionPhase] = useState<"question" | "feedback_wrong" | "feedback_right" | "done">(
    prediction ? "question" : "done"
  );
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const predictionCorrect = selectedOption !== null && prediction
    ? selectedOption === prediction.correctIndex
    : false;

  // ── Lab state ──────────────────────────────────────────────────────────────
  const [objX, setObjX] = useState(DEFAULT_OBJ_X);
  const [mirrorType, setMirrorType] = useState<MirrorType>(effectiveMirrorOptions[0] ?? "concave");
  const [showRays, setShowRays] = useState(shared.defaultShowRays);
  const [attempts, setAttempts] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [feedback, setFeedback] = useState<{
    text: string;
    kind: "hint" | "success" | "noimage" | "formula_error" | "formula_partial";
  } | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [pendingOutcome, setPendingOutcome] = useState<OpticsExperimentOutcome | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("lab_guide_seen_mirror-lab");
  });
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [enteredV, setEnteredV] = useState("");
  const [enteredM, setEnteredM] = useState("");
  const [formulaChecked, setFormulaChecked] = useState(false);
  const [formulaResult, setFormulaResult] = useState<{
    vOk: boolean; mOk: boolean; correct: boolean; solution: string;
  } | null>(null);
  const [showRealWorld, setShowRealWorld] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const isDragging = useRef(false);
  const startTimeRef = useRef(Date.now());

  const requiresFormula = !!(winConditions.requiresFormulaEntry || winConditions.requiresMagnificationEntry);
  const formulaChallenge = payload.formulaChallenge;
  const labLocked = predictionPhase !== "done";

  // ── Physics ────────────────────────────────────────────────────────────────
  const f = shared.focalLength;
  const F_X = MIRROR_X - f * SCALE;
  const C_X = MIRROR_X - 2 * f * SCALE;
  const u = (MIRROR_X - objX) / SCALE;
  const imgResult = calculateImage(u, f, mirrorType);

  const imgSvgX: number | null = imgResult.exists
    ? imgResult.isReal
      ? MIRROR_X - clamp(imgResult.v, 0.1, MAX_REAL_V) * SCALE
      : MIRROR_X + clamp(-imgResult.v, 0.1, MAX_VIRTUAL_V) * SCALE
    : null;
  const imgTopY: number | null =
    imgResult.exists && imgSvgX !== null ? AXIS_Y - imgResult.m * OBJ_H_SVG : null;
  const objTopY = AXIS_Y - OBJ_H_SVG;

  // ── Rays ───────────────────────────────────────────────────────────────────
  let r1Inc: Seg | null = null, r1Ref: Seg | null = null, r1Dash: Seg | null = null;
  let r2Inc: Seg | null = null, r2Ref: Seg | null = null, r2Dash: Seg | null = null;

  if (showRays && imgResult.exists && imgSvgX !== null && imgTopY !== null) {
    const isV = !imgResult.isReal;
    r1Inc = [objX, objTopY, MIRROR_X, objTopY];
    if (!isV) {
      const [ex, ey] = extendTo(MIRROR_X, objTopY, F_X, AXIS_Y, imgSvgX - 15);
      r1Ref = [MIRROR_X, objTopY, ex, ey];
    } else {
      const [lx, ly] = extendTo(MIRROR_X, objTopY, F_X, AXIS_Y, 30);
      r1Ref = [MIRROR_X, objTopY, lx, ly];
      const [vx, vy] = extendTo(F_X, AXIS_Y, MIRROR_X, objTopY, imgSvgX + 15);
      r1Dash = [MIRROR_X, objTopY, vx, vy];
    }
    const t2 = (MIRROR_X - objX) / (F_X - objX);
    const y2m = objTopY + t2 * (AXIS_Y - objTopY);
    r2Inc = [objX, objTopY, MIRROR_X, y2m];
    if (!isV) {
      r2Ref = [MIRROR_X, y2m, imgSvgX - 15, y2m];
    } else {
      r2Ref = [MIRROR_X, y2m, 30, y2m];
      r2Dash = [MIRROR_X, y2m, imgSvgX + 15, y2m];
    }
  }

  // ── Drag ──────────────────────────────────────────────────────────────────
  function toSvgX(clientX: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return objX;
    return ((clientX - rect.left) / rect.width) * SVG_W;
  }
  function onPointerDown(e: React.PointerEvent) {
    if (isPaused || succeeded || labLocked) return;
    e.preventDefault(); e.stopPropagation();
    isDragging.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!isDragging.current) return;
    setObjX(clamp(toSvgX(e.clientX), MIN_OBJ_X, MAX_OBJ_X));
    setFeedback(null);
    setFormulaChecked(false);
    setFormulaResult(null);
    setShowRealWorld(false);
  }
  function onPointerUp() { isDragging.current = false; }

  // ── Success/failure messages ───────────────────────────────────────────────
  function buildSuccessMsg(): string {
    const mag = imgResult.magnitudeM;
    const cond = winConditions;
    if (cond.targetImageType === "real") {
      if (cond.targetMagnificationMin !== undefined && mag >= cond.targetMagnificationMin)
        return `✓ Experiment successful! You produced a real, inverted, ${mag.toFixed(1)}× magnified image. The object was between F and C, so reflected rays converged further away — that's why the image is bigger.`;
      return `✓ Experiment successful! You produced a real image. Because your object was beyond F, the reflected rays converged in front of the mirror. Real images always form this way — they can be projected onto a screen.`;
    }
    if (cond.targetImageType === "virtual") {
      if (mirrorType === "convex")
        return `✓ Experiment successful! A convex mirror always spreads reflected rays outward — they never meet. Your eye traces them back and sees a virtual image behind the mirror.`;
      return `✓ Experiment successful! Because the object was inside F, reflected rays diverged. Extended behind the mirror, they appear to meet there — that's the virtual image. It can't be projected, only seen in the mirror.`;
    }
    if (cond.targetMagnificationMax !== undefined && mag <= cond.targetMagnificationMax)
      return `✓ Experiment successful! Image size is ${mag.toFixed(2)}× the object. The further the object from a convex mirror, the smaller the virtual image.`;
    return `✓ Experiment successful! Image: ${imgResult.isReal ? "Real" : "Virtual"} · ${imgResult.isInverted ? "Inverted" : "Upright"} · ${mag.toFixed(1)}× size.`;
  }

  function buildFailureMsg(attempt: number): string {
    const cond = winConditions;
    if (attempt === 1 && payload.hint) return payload.hint;
    if (cond.targetImageType === "real" && !imgResult.isReal)
      return `Your image is virtual — move the object to the LEFT, past F, so rays converge and form a real image.`;
    if (cond.targetImageType === "virtual" && imgResult.isReal)
      return `Your image is real. Move the object inside F, or switch to the convex mirror.`;
    if (cond.targetMirror && cond.targetMirror !== mirrorType)
      return `Switch to the ${cond.targetMirror} mirror using the button below.`;
    if (cond.targetMagnificationMin !== undefined && imgResult.magnitudeM < cond.targetMagnificationMin)
      return `Your image is ${imgResult.magnitudeM.toFixed(1)}× — not big enough. Move the object closer to F (but keep it beyond F).`;
    if (cond.targetMagnificationMax !== undefined && imgResult.magnitudeM > cond.targetMagnificationMax)
      return `Your image is ${imgResult.magnitudeM.toFixed(1)}× — too big. Move the object further from the mirror.`;
    return getHintMessage(imgResult, winConditions, mirrorType, payload.hint, attempt);
  }

  // ── Formula check ──────────────────────────────────────────────────────────
  function handleCheckFormula() {
    const vNum = parseFloat(enteredV);
    const mNum = parseFloat(enteredM);
    if (isNaN(vNum) || (winConditions.requiresFormulaEntry && isNaN(mNum))) {
      setFeedback({ text: "Enter a number in each box before checking.", kind: "hint" });
      return;
    }
    const tol = winConditions.formulaTolerance ?? 0.08;
    if (winConditions.requiresMagnificationEntry && !winConditions.requiresFormulaEntry) {
      const ok = checkMagnificationEntry(mNum, imgResult, tol);
      const solution = buildWorkedSolution(u, f, mirrorType, imgResult);
      setFormulaResult({ vOk: true, mOk: ok, correct: ok, solution });
      setFormulaChecked(true);
      if (ok) {
        setFeedback({ text: `✓ Correct! m = ${imgResult.m.toFixed(3)}.`, kind: "success" });
      } else {
        setFeedback({ text: `Not quite. m = −v/u. The sign matters — positive means upright, negative means inverted.`, kind: "formula_partial" });
        setHintsUsed((h) => h + 1);
      }
      return;
    }
    const { correct, vOk, mOk } = checkFormulaEntry(vNum, mNum, imgResult, tol);
    const solution = buildWorkedSolution(u, f, mirrorType, imgResult);
    setFormulaResult({ vOk, mOk, correct, solution });
    setFormulaChecked(true);
    if (correct) {
      setFeedback({ text: `✓ Both correct! v = ${imgResult.v.toFixed(2)} cm, m = ${imgResult.m.toFixed(3)}.`, kind: "success" });
    } else if (vOk || mOk) {
      setFeedback({
        text: `${vOk ? "✓ v is correct!" : "✗ v is wrong — use 1/v = 1/f − 1/u and check your signs."} ${mOk ? "✓ m is correct!" : "✗ m is wrong — m = −v/u, include the sign."}`,
        kind: "formula_partial",
      });
      setHintsUsed((h) => h + 1);
    } else {
      setFeedback({ text: `Both values need work. Apply 1/v + 1/u = 1/f, then m = −v/u. Watch your signs!`, kind: "formula_error" });
      setHintsUsed((h) => h + 1);
    }
  }

  // ── Run experiment ─────────────────────────────────────────────────────────
  function handleRun() {
    if (isPaused || succeeded || labLocked) return;
    if (!imgResult.exists) {
      setFeedback({ text: "The image is at infinity — object is at focal point F. Move it slightly.", kind: "noimage" });
      return;
    }
    const n = attempts + 1;
    setAttempts(n);
    const positionOk = checkWinConditions(imgResult, winConditions, mirrorType);
    if (positionOk) {
      if (requiresFormula && !formulaChecked) {
        setFeedback({ text: "✓ Object position is correct! Now complete the formula calculation below.", kind: "hint" });
        return;
      }
      if (requiresFormula && formulaResult && !formulaResult.correct) {
        setFeedback({ text: "Fix your formula calculation before finishing.", kind: "hint" });
        return;
      }
      setSucceeded(true);
      setFeedback({ text: buildSuccessMsg(), kind: "success" });
      const xpEarned = Math.max(
        Math.round(mission.xpReward * 0.35),
        Math.round(mission.xpReward * (1 - (n - 1) * 0.12 - hintsUsed * 0.08))
      );
      // Bonus XP if they predicted correctly
      const predBonus = predictionCorrect ? Math.round(mission.xpReward * 0.1) : 0;
      setPendingOutcome({
        success: true, attempts: n, hintsUsed,
        timeSpentSec: Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000)),
        xpEarned: xpEarned + predBonus,
      });
      setShowRealWorld(true);
    } else {
      setFeedback({ text: buildFailureMsg(n), kind: "hint" });
      if (n > 1) setHintsUsed((h) => h + 1);
    }
  }

  const guide = !feedback && !succeeded && !labLocked
    ? getContextualGuide(imgResult, winConditions, mirrorType) : null;
  const realWorldApp = getRealWorldApplication(imgResult, mirrorType);

  // ── Mirror arc path ────────────────────────────────────────────────────────
  const bowX = mirrorType === "concave" ? MIRROR_X - MIRROR_DEPTH : MIRROR_X + MIRROR_DEPTH;
  const mirrorArc = `M ${MIRROR_X},${AXIS_Y - MIRROR_HALF_H} Q ${bowX},${AXIS_Y} ${MIRROR_X},${AXIS_Y + MIRROR_HALF_H}`;
  const backClip =
    mirrorType === "concave"
      ? `M ${MIRROR_X},${AXIS_Y - MIRROR_HALF_H} Q ${bowX},${AXIS_Y} ${MIRROR_X},${AXIS_Y + MIRROR_HALF_H} L ${MIRROR_X + 38},${AXIS_Y + MIRROR_HALF_H} L ${MIRROR_X + 38},${AXIS_Y - MIRROR_HALF_H} Z`
      : `M ${MIRROR_X},${AXIS_Y - MIRROR_HALF_H} Q ${bowX},${AXIS_Y} ${MIRROR_X},${AXIS_Y + MIRROR_HALF_H} L ${MIRROR_X - 38},${AXIS_Y + MIRROR_HALF_H} L ${MIRROR_X - 38},${AXIS_Y - MIRROR_HALF_H} Z`;

  // ── Guide/onboarding modal shared content ─────────────────────────────────
  const guideModalContent = (
    <div className={styles.onboarding}>
      <div className={styles.onboardingCard}>
        <div className={styles.onboardingTitle}>🔬 Mirror Lab — Quick Guide</div>
        <p className={styles.onboardingBody}>Here is what you are looking at:</p>
        <svg viewBox="0 0 320 160" className={styles.onboardingDiagram}>
          <rect x="0" y="0" width="320" height="160" fill="#0c1c3a" rx="8" />
          <line x1="15" y1="80" x2="285" y2="80" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeDasharray="6 4" />
          <path d="M 268,30 Q 250,80 268,130" fill="none" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />
          <line x1="190" y1="74" x2="190" y2="86" stroke="#94a3b8" strokeWidth="2" />
          <text x="190" y="98" textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="800">C</text>
          <line x1="230" y1="74" x2="230" y2="86" stroke="#60a5fa" strokeWidth="2" />
          <text x="230" y="98" textAnchor="middle" fontSize="9" fill="#60a5fa" fontWeight="800">F</text>
          <line x1="140" y1="80" x2="140" y2="56" stroke="#f8fafc" strokeWidth="2.5" />
          <polygon points="134,63 146,63 140,56" fill="#f8fafc" />
          <line x1="215" y1="80" x2="215" y2="96" stroke="#34d399" strokeWidth="2" />
          <polygon points="209,89 221,89 215,96" fill="#34d399" />
          <line x1="140" y1="52" x2="86" y2="30" stroke="#fbbf24" strokeWidth="1" strokeDasharray="3 2" />
          <text x="82" y="26" textAnchor="end" fontSize="8.5" fill="#fbbf24" fontWeight="700">① Object — drag it!</text>
          <line x1="230" y1="98" x2="230" y2="118" stroke="#60a5fa" strokeWidth="1" strokeDasharray="3 2" />
          <text x="230" y="128" textAnchor="middle" fontSize="8.5" fill="#60a5fa" fontWeight="700">② F = Focal Point</text>
          <line x1="190" y1="98" x2="160" y2="130" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
          <text x="155" y="140" textAnchor="end" fontSize="8.5" fill="#94a3b8" fontWeight="700">③ C = Centre of Curvature</text>
          <line x1="215" y1="100" x2="255" y2="118" stroke="#34d399" strokeWidth="1" strokeDasharray="3 2" />
          <text x="258" y="128" textAnchor="start" fontSize="8.5" fill="#34d399" fontWeight="700">④ Image forms here</text>
          <line x1="268" y1="80" x2="292" y2="55" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
          <text x="295" y="52" textAnchor="start" fontSize="8.5" fill="#94a3b8" fontWeight="700">⑤ Mirror</text>
        </svg>
        <div className={styles.onboardingFormulaTip}>
          <span className={styles.formulaChip}>1/v + 1/u = 1/f</span>
          <span className={styles.formulaChip}>m = −v/u</span>
        </div>
        <button className={styles.onboardingBtn} onClick={() => {
          localStorage.setItem("lab_guide_seen_mirror-lab", "1");
          setShowOnboarding(false);
          setShowGuideModal(false);
        }}>
          OK, let&apos;s start →
        </button>
      </div>
    </div>
  );

  // ── Prediction screen ──────────────────────────────────────────────────────
  const renderPrediction = () => {
    if (!prediction) return null;
    const isAnswered = predictionPhase === "feedback_wrong" || predictionPhase === "feedback_right";

    return (
      <div className={styles.predictionOverlay}>
        <div className={styles.predictionCard}>
          <div className={styles.predictionEyebrow}>🧠 Predict First</div>
          <p className={styles.predictionQuestion}>{prediction.question}</p>
          <div className={styles.predictionOptions}>
            {prediction.options.map((opt, i) => {
              let cls = styles.predOption;
              if (isAnswered) {
                if (i === prediction.correctIndex) cls = `${styles.predOption} ${styles.predOptionCorrect}`;
                else if (i === selectedOption && selectedOption !== prediction.correctIndex)
                  cls = `${styles.predOption} ${styles.predOptionWrong}`;
              } else if (i === selectedOption) {
                cls = `${styles.predOption} ${styles.predOptionSelected}`;
              }
              return (
                <button
                  key={i}
                  className={cls}
                  disabled={isAnswered}
                  onClick={() => {
                    setSelectedOption(i);
                    if (i === prediction.correctIndex) {
                      setPredictionPhase("feedback_right");
                    } else {
                      setPredictionPhase("feedback_wrong");
                    }
                  }}
                >
                  <span className={styles.predOptionLetter}>{String.fromCharCode(65 + i)}</span>
                  {opt}
                </button>
              );
            })}
          </div>

          {isAnswered && (
            <div className={predictionPhase === "feedback_right" ? styles.predFeedbackRight : styles.predFeedbackWrong}>
              <div className={styles.predFeedbackIcon}>
                {predictionPhase === "feedback_right" ? "✓" : "✗"}
              </div>
              <div className={styles.predFeedbackBody}>
                <div className={styles.predFeedbackTitle}>
                  {predictionPhase === "feedback_right" ? "Correct prediction!" : "Not quite — here's why:"}
                </div>
                <p className={styles.predFeedbackText}>{prediction.explanation}</p>
              </div>
            </div>
          )}

          {isAnswered && (
            <button className={styles.predProceedBtn} onClick={() => setPredictionPhase("done")}>
              {predictionPhase === "feedback_right" ? "✓ Now prove it in the lab →" : "Understood — now experiment →"}
            </button>
          )}
        </div>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <GameplayShell
      fallbackGradient="radial-gradient(ellipse 100% 80% at 60% 30%, #0c1c3a 0%, #060e1f 100%)"
      accentColor="var(--eg-subject-physics)"
      gameTitle={gameTitle ?? "Mirror Lab"}
      stats={[{ label: "Attempts", value: attempts, tone: "default" }]}
      missionPrompt={{ label: "Mission", text: describeWinConditions(winConditions) }}
      menu={menu}
      isPaused={isPaused}
    >
      <div className={styles.wrap}>

        {/* Prediction overlay — shown before lab unlocks */}
        {labLocked && renderPrediction()}

        {/* Guide modal (? button) */}
        {showGuideModal && guideModalContent}

        {/* First-time onboarding */}
        {showOnboarding && !showGuideModal && guideModalContent}

        {/* ? help button */}
        {!showOnboarding && !showGuideModal && (
          <button className={styles.guideBtn} onClick={() => setShowGuideModal(true)} title="Show lab guide">?</button>
        )}

        {/* ── Lab SVG ─────────────────────────────────────────────────── */}
        <svg ref={svgRef} viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className={`${styles.labSvg} ${labLocked ? styles.labSvgLocked : ""}`}
          style={{ touchAction: "none" }}>
          <defs>
            <pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#1e3a5f" strokeWidth="3.5" />
            </pattern>
            <clipPath id="backClip"><path d={backClip} /></clipPath>
          </defs>

          {Array.from({ length: 8 }, (_, i) => (
            <line key={i} x1={MIRROR_X - (i + 1) * SCALE} y1={50}
              x2={MIRROR_X - (i + 1) * SCALE} y2={SVG_H - 50}
              stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          ))}
          <line x1={20} y1={AXIS_Y} x2={SVG_W - 20} y2={AXIS_Y}
            stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" strokeDasharray="8 6" />

          {/* u label */}
          <text x={(objX + MIRROR_X) / 2} y={AXIS_Y + 20} textAnchor="middle"
            fill="rgba(255,255,255,0.38)" fontSize="10" fontFamily="var(--eg-font-body)">
            u = {u.toFixed(2)} cm
          </text>

          {shared.showCenterLabels && C_X > 20 && (
            <g>
              <line x1={C_X} y1={AXIS_Y - 12} x2={C_X} y2={AXIS_Y + 12} stroke="#94a3b8" strokeWidth="2.5" />
              <text x={C_X} y={AXIS_Y + 27} textAnchor="middle" fill="#94a3b8" fontSize="15" fontFamily="var(--eg-font-display)" fontWeight="800">C</text>
              <text x={C_X} y={AXIS_Y + 42} textAnchor="middle" fill="#94a3b8" fontSize="9.5" fontFamily="var(--eg-font-body)" opacity={0.8}>Centre of Curvature</text>
            </g>
          )}
          {shared.showFocusLabels && F_X > 20 && (
            <g>
              <line x1={F_X} y1={AXIS_Y - 12} x2={F_X} y2={AXIS_Y + 12} stroke="#60a5fa" strokeWidth="2.5" />
              <text x={F_X} y={AXIS_Y + 27} textAnchor="middle" fill="#60a5fa" fontSize="15" fontFamily="var(--eg-font-display)" fontWeight="800">F</text>
              <text x={F_X} y={AXIS_Y + 42} textAnchor="middle" fill="#60a5fa" fontSize="9.5" fontFamily="var(--eg-font-body)" opacity={0.8}>Focal Point</text>
            </g>
          )}

          {showRays && (
            <g>
              {r1Inc && <line x1={r1Inc[0]} y1={r1Inc[1]} x2={r1Inc[2]} y2={r1Inc[3]} stroke="#f59e0b" strokeWidth="1.8" opacity="0.82" />}
              {r1Ref && <line x1={r1Ref[0]} y1={r1Ref[1]} x2={r1Ref[2]} y2={r1Ref[3]} stroke="#f59e0b" strokeWidth="1.8" opacity="0.82" />}
              {r1Dash && <line x1={r1Dash[0]} y1={r1Dash[1]} x2={r1Dash[2]} y2={r1Dash[3]} stroke="#f59e0b" strokeWidth="1.4" strokeDasharray="5 4" opacity="0.45" />}
              {r2Inc && <line x1={r2Inc[0]} y1={r2Inc[1]} x2={r2Inc[2]} y2={r2Inc[3]} stroke="#22d3ee" strokeWidth="1.8" opacity="0.82" />}
              {r2Ref && <line x1={r2Ref[0]} y1={r2Ref[1]} x2={r2Ref[2]} y2={r2Ref[3]} stroke="#22d3ee" strokeWidth="1.8" opacity="0.82" />}
              {r2Dash && <line x1={r2Dash[0]} y1={r2Dash[1]} x2={r2Dash[2]} y2={r2Dash[3]} stroke="#22d3ee" strokeWidth="1.4" strokeDasharray="5 4" opacity="0.45" />}
            </g>
          )}

          <rect x={MIRROR_X - 38} y={AXIS_Y - MIRROR_HALF_H} width={76} height={MIRROR_HALF_H * 2}
            fill="url(#hatch)" clipPath="url(#backClip)" />
          <path d={mirrorArc} fill="none" stroke="#94a3b8" strokeWidth={5} strokeLinecap="round" />
          <path d={mirrorArc} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.8} strokeLinecap="round" />

          {imgResult.exists && imgSvgX !== null && (
            <text x={imgSvgX} y={AXIS_Y + 55} textAnchor="middle"
              fill="rgba(255,255,255,0.32)" fontSize="9.5" fontFamily="var(--eg-font-body)">
              v = {imgResult.v.toFixed(2)} cm
            </text>
          )}

          {imgResult.exists && imgSvgX !== null && imgTopY !== null && (() => {
            const isV = !imgResult.isReal;
            const col = isV ? "#a78bfa" : "#34d399";
            const inv = imgTopY > AXIS_Y;
            const pts = `${imgSvgX - 7},${imgTopY + (inv ? 15 : -15)} ${imgSvgX + 7},${imgTopY + (inv ? 15 : -15)} ${imgSvgX},${imgTopY}`;
            return (
              <g opacity={isV ? 0.75 : 1}>
                <line x1={imgSvgX} y1={AXIS_Y} x2={imgSvgX} y2={imgTopY} stroke={col} strokeWidth={2.5} strokeDasharray={isV ? "7 4" : undefined} />
                <polygon points={pts} fill={col} />
                <text x={imgSvgX} y={inv ? imgTopY - 12 : imgTopY + 26} textAnchor="middle" fill={col} fontSize="11" fontFamily="var(--eg-font-display)" fontWeight="700">
                  {isV ? "Virtual Image" : "Image"}
                </text>
              </g>
            );
          })()}

          {!imgResult.exists && (
            <text x={(objX + MIRROR_X) / 2} y={AXIS_Y - 40} textAnchor="middle"
              fill="#fbbf24" fontSize="12" fontFamily="var(--eg-font-display)" fontWeight="600">
              Image at ∞ — object is at the focal point
            </text>
          )}

          <g onPointerDown={onPointerDown} onPointerMove={onPointerMove}
            onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
            style={{ cursor: labLocked ? "default" : isDragging.current ? "grabbing" : "grab" }}>
            <rect x={objX - 28} y={objTopY - 16} width={56} height={OBJ_H_SVG + 32} fill="transparent" />
            <line x1={objX} y1={AXIS_Y} x2={objX} y2={objTopY} stroke="#f8fafc" strokeWidth={3.5} strokeLinecap="round" />
            <polygon points={`${objX - 9},${objTopY + 18} ${objX + 9},${objTopY + 18} ${objX},${objTopY}`} fill="#f8fafc" />
            <line x1={objX - 9} y1={AXIS_Y} x2={objX + 9} y2={AXIS_Y} stroke="#f8fafc" strokeWidth={2.5} strokeLinecap="round" />
            <text x={objX} y={objTopY - 14} textAnchor="middle" fill="#f8fafc" fontSize="11" fontFamily="var(--eg-font-display)" fontWeight="700">Object</text>
            {!succeeded && !labLocked && (
              <text x={objX} y={AXIS_Y + 32} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="10" fontFamily="var(--eg-font-body)">← drag →</text>
            )}
          </g>
        </svg>

        {/* Status panel */}
        <div className={styles.statusPanel}>
          <div className={styles.imageReadout}>
            <span className={styles.readoutLabel}>Image:</span>
            <span className={styles.readoutValue}>{describeImage(imgResult)}</span>
            {imgResult.exists && (
              <span className={styles.readoutSub}>&nbsp;|&nbsp;m = {imgResult.m.toFixed(3)}</span>
            )}
          </div>
          {guide && (
            <div className={`${styles.guide} ${styles[`guide_${guide.tone}`]}`}>
              {guide.tone === "success" ? "✓ " : guide.tone === "warning" ? "⚠ " : "→ "}{guide.text}
            </div>
          )}
        </div>

        {/* Formula panel */}
        {requiresFormula && !succeeded && (
          <div className={styles.formulaPanel}>
            <div className={styles.formulaPanelTitle}>
              {winConditions.requiresFormulaEntry ? "📐 Calculate: find v and m" : "📐 Calculate: find m"}
              <span className={styles.formulaHint}>
                {winConditions.requiresFormulaEntry ? "1/v + 1/u = 1/f, then m = −v/u" : "m = −v/u"}
              </span>
            </div>
            <div className={styles.formulaRow}>
              {winConditions.requiresFormulaEntry && (
                <label className={styles.formulaField}>
                  <span>v (cm)</span>
                  <input
                    className={`${styles.formulaInput} ${formulaResult ? (formulaResult.vOk ? styles.inputOk : styles.inputErr) : ""}`}
                    type="number" step="0.01" placeholder="e.g. −4.00" value={enteredV}
                    onChange={(e) => { setEnteredV(e.target.value); setFormulaChecked(false); setFormulaResult(null); }}
                  />
                </label>
              )}
              <label className={styles.formulaField}>
                <span>m</span>
                <input
                  className={`${styles.formulaInput} ${formulaResult ? (formulaResult.mOk ? styles.inputOk : styles.inputErr) : ""}`}
                  type="number" step="0.001" placeholder="e.g. −2.000" value={enteredM}
                  onChange={(e) => { setEnteredM(e.target.value); setFormulaChecked(false); setFormulaResult(null); }}
                />
              </label>
              <button className={styles.formulaCheckBtn} onClick={handleCheckFormula}>Check</button>
            </div>
            {formulaResult?.correct && formulaChallenge?.showSolution !== false && (
              <details className={styles.solutionDetails}>
                <summary className={styles.solutionSummary}>📖 View worked solution</summary>
                <pre className={styles.solutionPre}>{formulaResult.solution}</pre>
              </details>
            )}
          </div>
        )}

        {succeeded && requiresFormula && formulaResult?.correct && formulaChallenge?.showSolution !== false && (
          <details className={styles.solutionDetails}>
            <summary className={styles.solutionSummary}>📖 View worked solution</summary>
            <pre className={styles.solutionPre}>{formulaResult.solution}</pre>
          </details>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`${styles.feedback} ${styles[`feedback_${feedback.kind}`]}`}>
            <Mascot pose={feedback.kind === "success" ? "celebrate" : "encourage"} widthPx={42} />
            <p className={styles.feedbackText}>{feedback.text}</p>
            {feedback.kind !== "success" && (
              <button className={styles.feedbackClose} onClick={() => setFeedback(null)}>✕</button>
            )}
          </div>
        )}

        {/* Real-world application */}
        {showRealWorld && realWorldApp && (
          <div className={styles.realWorld}>
            <span className={styles.realWorldIcon}>🌍</span>
            <p className={styles.realWorldText}>{realWorldApp}</p>
            <button className={styles.feedbackClose} onClick={() => setShowRealWorld(false)}>✕</button>
          </div>
        )}

        {/* Controls */}
        <div className={styles.controls}>
          {effectiveMirrorOptions.length > 1 && (
            <div className={styles.mirrorPicker}>
              {(["concave", "convex"] as MirrorType[])
                .filter((m) => effectiveMirrorOptions.includes(m))
                .map((m) => (
                  <button key={m}
                    className={`${styles.mirrorBtn} ${mirrorType === m ? styles.mirrorBtnActive : ""}`}
                    onClick={() => { setMirrorType(m); setFeedback(null); setFormulaChecked(false); setFormulaResult(null); }}>
                    {m === "concave" ? "⌓ Concave" : "⌔ Convex"}
                  </button>
                ))}
            </div>
          )}
          {shared.showRaysToggle && (
            <button className={`${styles.raysBtn} ${showRays ? styles.raysBtnOn : ""}`}
              onClick={() => setShowRays((r) => !r)}>
              {showRays ? "Hide Rays" : "Show Rays"}
            </button>
          )}
          <button
            className={`${styles.runBtn} ${succeeded ? styles.runBtnDone : ""} ${labLocked ? styles.runBtnLocked : ""}`}
            onClick={() => succeeded && pendingOutcome ? onComplete(pendingOutcome) : handleRun()}
            disabled={isPaused || labLocked}>
            {labLocked ? "⟳ Answer to unlock lab" : succeeded ? "✓ Done!" : "▶  Run Experiment"}
          </button>
        </div>
      </div>
    </GameplayShell>
  );
}