"use client";

import { useState, useRef } from "react";
import { Mascot } from "@/motion/Mascot";
import { GameplayShell } from "@/components/gameplay/GameplayShell";
import type { EngineRuntimeProps } from "@/engines/engine-types";
import type {
  OpticsExperimentConfig,
  OpticsExperimentOutcome,
  MirrorType,
  MirrorLabPayload
} from "./opticsExperiment.config";
import {
  calculateImage,
  checkWinConditions,
  getHintMessage,
  getContextualGuide,
  describeImage,
  describeWinConditions
} from "./opticsExperiment.logic";
import { OpticsSharedConfigSchema } from "./opticsExperiment.config";
import { PrincipalAxis, CurvedMirror, ObjectArrow, ImageArrow, RayLine, PointMarker } from "@/components/science-lab";
import styles from "./OpticsExperimentEngine.module.css";

// ─── SVG layout constants ─────────────────────────────────────────────────────
// All positions in SVG user units (viewBox 0 0 900 400).
// SCALE = 70 SVG units per one "physics unit" of distance.
// With focalLength = 2, this gives F at 700-140=560, C at 700-280=420 —
// comfortably centred in the diagram on both desktop and tablet.
const SVG_W = 900;
const SVG_H = 430; // taller for marker sublabels
const MIRROR_X = 700;
const AXIS_Y = 182; // shifted up so sublabels fit below axis
const SCALE = 70;
const OBJ_H_SVG = 72; // object arrow height — 1.03 physics units at SCALE=70
const MIRROR_HALF_H = 130; // half-height of the mirror arc in SVG units
const MIRROR_DEPTH = 30; // how much the arc bows (concave left, convex right)

// Object can be placed anywhere from u≈0.26 to u≈6.3 units
const MIN_OBJ_X = 260;
const MAX_OBJ_X = MIRROR_X - 18;
// Default: start at u=5 (beyond C) so Mission 1 opens with a visible real image
const DEFAULT_OBJ_X = MIRROR_X - 5 * SCALE; // u=5 (beyond C), opens with a real diminished image

// Cap very-far images so the diagram doesn't break for near-focal positions
const MAX_REAL_V = 6.5; // physics units — real image cap
const MAX_VIRTUAL_V = 3.5; // physics units — virtual image cap (behind mirror)

// ─── Small helper ─────────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Extend (or shrink) the line through (x1,y1)→(x2,y2) to the given targetX. */
function extendTo(
  x1: number, y1: number,
  x2: number, y2: number,
  targetX: number
): [number, number] {
  if (x2 === x1) return [x2, y2];
  const t = (targetX - x1) / (x2 - x1);
  return [targetX, y1 + t * (y2 - y1)];
}

// ─── Main component ───────────────────────────────────────────────────────────
export function OpticsExperimentEngine({
  config,
  onComplete,
  isPaused,
  menu,
  gameTitle
}: EngineRuntimeProps<OpticsExperimentConfig, OpticsExperimentOutcome>) {
  const { shared: rawShared, mission } = config;
  const payload = (mission.payload ?? {}) as Partial<MirrorLabPayload>;
  const winConditions = payload.winConditions ?? {};
  const effectiveMirrorOptions: MirrorType[] =
    payload.mirrorOptions ?? shared.mirrorOptions;

  // Parse shared config then overlay any per-mission scaffolding
  // settings from the payload. This lets each mission control its own
  // difficulty scaffolding (show/hide F and C, ray defaults) without
  // a separate upfront difficulty picker confusing the player.
  const shared = OpticsSharedConfigSchema.parse({
    ...rawShared,
    ...(payload.showFocusLabels  !== undefined && { showFocusLabels:  payload.showFocusLabels }),
    ...(payload.showCenterLabels !== undefined && { showCenterLabels: payload.showCenterLabels }),
    ...(payload.showRaysToggle   !== undefined && { showRaysToggle:   payload.showRaysToggle }),
    ...(payload.defaultShowRays  !== undefined && { defaultShowRays:  payload.defaultShowRays }),
  });

  // ─── State ──────────────────────────────────────────────────────────────────
  const [objX, setObjX] = useState(DEFAULT_OBJ_X);
  const [mirrorType, setMirrorType] = useState<MirrorType>(
    effectiveMirrorOptions[0] ?? "concave"
  );
  const [showRays, setShowRays] = useState(shared.defaultShowRays);
  const [attempts, setAttempts] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [feedback, setFeedback] = useState<{
    text: string;
    kind: "hint" | "success" | "noimage";
  } | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  // Stores the completed outcome until the student clicks "Done ✓" —
  // keeps the educational success explanation on screen as long as they
  // want to read it, instead of auto-advancing after a fixed delay.
  const [pendingOutcome, setPendingOutcome] = useState<OpticsExperimentOutcome | null>(null);
  // Show lab onboarding guide on the very first play — explains F, C,
  // the object arrow, and the image before the student touches anything.
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("lab_guide_seen_mirror-lab");
  });
  const svgRef = useRef<SVGSVGElement>(null);
  const startTimeRef = useRef(Date.now());

  // ─── Physics ────────────────────────────────────────────────────────────────
  const f = shared.focalLength;
  const F_X = MIRROR_X - f * SCALE;
  const C_X = MIRROR_X - 2 * f * SCALE;
  const u = (MIRROR_X - objX) / SCALE; // object distance in physics units
  const imgResult = calculateImage(u, f, mirrorType);

  // Convert image position to SVG coordinates, capping extreme values
  const imgSvgX: number | null = imgResult.exists
    ? imgResult.isReal
      ? MIRROR_X - clamp(imgResult.v, 0.1, MAX_REAL_V) * SCALE
      : MIRROR_X + clamp(-imgResult.v, 0.1, MAX_VIRTUAL_V) * SCALE
    : null;
  const imgTopY: number | null =
    imgResult.exists && imgSvgX !== null
      ? AXIS_Y - imgResult.m * OBJ_H_SVG
      : null;
  const objTopY = AXIS_Y - OBJ_H_SVG;

  // ─── Ray geometry ───────────────────────────────────────────────────────────
  // Two principal rays from the object arrow's tip:
  //   Ray 1 — parallel to axis → reflects through F
  //   Ray 2 — directed through F → reflects parallel to axis
  //
  // For REAL images:  both reflected rays converge at the image tip (solid lines)
  // For VIRTUAL images: reflected rays diverge; dashed lines extend behind
  //                     the mirror to show where they appear to come from

  type Seg = [number, number, number, number]; // x1,y1,x2,y2
  let r1Inc: Seg | null = null, r1Ref: Seg | null = null, r1Dash: Seg | null = null;
  let r2Inc: Seg | null = null, r2Ref: Seg | null = null, r2Dash: Seg | null = null;

  if (showRays && imgResult.exists && imgSvgX !== null && imgTopY !== null) {
    const isV = !imgResult.isReal;

    // — Ray 1 —
    r1Inc = [objX, objTopY, MIRROR_X, objTopY]; // horizontal incident

    if (!isV) {
      // Real: reflected ray passes through F, converges at image
      const [ex, ey] = extendTo(MIRROR_X, objTopY, F_X, AXIS_Y, imgSvgX - 15);
      r1Ref = [MIRROR_X, objTopY, ex, ey];
    } else {
      // Virtual: reflected ray goes toward F (leftward), appears to come from right
      const [leftX, leftY] = extendTo(MIRROR_X, objTopY, F_X, AXIS_Y, 30);
      r1Ref = [MIRROR_X, objTopY, leftX, leftY]; // actual reflected (going left)
      const [virtX, virtY] = extendTo(F_X, AXIS_Y, MIRROR_X, objTopY, imgSvgX + 15);
      r1Dash = [MIRROR_X, objTopY, virtX, virtY]; // dashed virtual extension
    }

    // — Ray 2 —
    // Incident direction: from object top through F to mirror
    // (when u < f, the direction is AWAY from F — line still passes through F extended)
    const t2 = (MIRROR_X - objX) / (F_X - objX);
    const y2m = objTopY + t2 * (AXIS_Y - objTopY); // y where ray 2 hits mirror
    r2Inc = [objX, objTopY, MIRROR_X, y2m];

    if (!isV) {
      // Real: reflects parallel to axis, converges at image
      r2Ref = [MIRROR_X, y2m, imgSvgX - 15, y2m];
    } else {
      // Virtual: reflects parallel (leftward); dashed extension goes right to virtual image
      r2Ref = [MIRROR_X, y2m, 30, y2m];
      r2Dash = [MIRROR_X, y2m, imgSvgX + 15, y2m];
    }
  }

  // ─── Run experiment ─────────────────────────────────────────────────────────
  function handleRun() {
    if (isPaused || succeeded) return;

    if (!imgResult.exists) {
      setFeedback({
        text: "The image is at infinity — the object is exactly at the focal point F, so reflected rays run parallel and never meet. Move the object slightly away from F.",
        kind: "noimage"
      });
      return;
    }

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    if (checkWinConditions(imgResult, winConditions, mirrorType)) {
      setSucceeded(true);
      const successText = buildSuccessMessage(imgResult, winConditions, mirrorType);
      setFeedback({ text: successText, kind: "success" });
      const xpEarned = Math.max(
        Math.round(mission.xpReward * 0.35),
        Math.round(mission.xpReward * (1 - (nextAttempts - 1) * 0.12 - hintsUsed * 0.08))
      );
      // Store the outcome — onComplete fires when the student presses
      // "Done ✓", not on a timer, so they can read the explanation.
      setPendingOutcome({
        success: true,
        attempts: nextAttempts,
        hintsUsed,
        timeSpentSec: Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000)),
        xpEarned
      });
    } else {
      // Educational failure message — explain what is actually happening physically
      const failText = buildFailureMessage(imgResult, winConditions, mirrorType, payload.hint, nextAttempts);
      setFeedback({ text: failText, kind: "hint" });
      if (nextAttempts > 1) setHintsUsed(h => h + 1);
    }
  }

  /** Tells the student exactly WHAT they produced and WHY — reinforces
   *  the concept at the moment of success, not just "well done." */
  function buildSuccessMessage(result: ImageResult, cond: WinConditions, mirror: MirrorType): string {
    const mag = result.magnitudeM;

    if (cond.targetImageType === "real") {
      if (cond.targetMagnificationMin !== undefined && mag >= cond.targetMagnificationMin) {
        return `✓ Experiment successful! You produced a real, ${result.isInverted ? "inverted" : "upright"}, ${mag.toFixed(1)}× magnified image. The object was between F and C, so the reflected rays converged further away — that's why the image is bigger than the object.`;
      }
      return `✓ Experiment successful! You produced a real image. Because your object was beyond the focal point F, the reflected rays converged in front of the mirror. Real images always form this way — they can be projected onto a screen.`;
    }

    if (cond.targetImageType === "virtual") {
      if (mirror === "convex") {
        return `✓ Experiment successful! The convex mirror spread the reflected rays outward — they never meet. Your eye traces them back and sees a virtual image behind the mirror. Convex mirrors always form virtual images like this.`;
      }
      return `✓ Experiment successful! You produced a virtual image. Because the object was inside F, the reflected rays diverged. Extended behind the mirror, they appear to meet there — that's the virtual image. It can't be projected, only seen in the mirror.`;
    }

    if (cond.targetMagnificationMax !== undefined && mag <= cond.targetMagnificationMax) {
      return `✓ Experiment successful! Image size is ${mag.toFixed(2)}× the object. The further the object from a convex mirror, the smaller the virtual image it forms.`;
    }

    return `✓ Experiment successful! Image: ${result.isReal ? "Real" : "Virtual"} · ${result.isInverted ? "Inverted" : "Upright"} · ${mag.toFixed(1)}× size.`;
  }

  /** Explains what is PHYSICALLY HAPPENING right now and what to change. */
  function buildFailureMessage(
    result: ImageResult, cond: WinConditions,
    mirror: MirrorType, payloadHint?: string, attempt = 1
  ): string {
    // First failure: use authored hint
    if (attempt === 1 && payloadHint) return payloadHint;

    if (cond.targetImageType === "real" && !result.isReal) {
      return `Your image is virtual — the reflected rays are diverging instead of converging. This happens because the object is inside F. Move the object to the left, past F, so the rays converge and form a real image in front of the mirror.`;
    }
    if (cond.targetImageType === "virtual" && result.isReal) {
      return `Your image is real — the reflected rays are converging. To get a virtual image, move the object inside F (between the mirror and F), or switch to the convex mirror.`;
    }
    if (cond.targetMirror && cond.targetMirror !== mirror) {
      return `Switch to the ${cond.targetMirror} mirror using the button below.`;
    }
    if (cond.targetMagnificationMin !== undefined && result.magnitudeM < cond.targetMagnificationMin) {
      return `Your image is ${result.magnitudeM.toFixed(1)}× the object — not big enough yet. Move the object closer to F (but keep it beyond F). The closer to F, the bigger the real image.`;
    }
    if (cond.targetMagnificationMax !== undefined && result.magnitudeM > cond.targetMagnificationMax) {
      return `Your image is ${result.magnitudeM.toFixed(1)}× the object — too big. Move the object further from the mirror to reduce the image size.`;
    }
    return getHintMessage(result, winConditions, mirrorType, payloadHint, attempt);
  }

  // ─── Contextual guide ───────────────────────────────────────────────────────
  // Live guidance shown below the SVG — tells the student what to DO next,
  // not just what the physics currently is. Only shown when there is no
  // active feedback panel (feedback takes priority after Run Experiment).
  const guide = !feedback && !succeeded
    ? getContextualGuide(imgResult, winConditions, mirrorType)
    : null;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <GameplayShell
      fallbackGradient="radial-gradient(ellipse 100% 80% at 60% 30%, #0c1c3a 0%, #060e1f 100%)"
      accentColor="var(--eg-subject-physics)"
      gameTitle={gameTitle ?? "Mirror Lab"}
      stats={[{ label: "Attempts", value: attempts, tone: "neutral" }]}
      missionPrompt={{ label: "Mission", text: describeWinConditions(winConditions) }}
      menu={menu}
      isPaused={isPaused}
    >
      <div className={styles.wrap}>

        {/* ── First-time lab guide overlay ────────────────────────────────── */}
        {showOnboarding && (
          <div className={styles.onboarding}>
            <div className={styles.onboardingCard}>
              <div className={styles.onboardingTitle}>🔬 Welcome to Mirror Lab</div>
              <p className={styles.onboardingBody}>
                Here's what you're looking at:
              </p>
              <svg viewBox="0 0 320 160" className={styles.onboardingDiagram}
                aria-label="Annotated lab diagram">
                {/* Lab background */}
                <rect x="0" y="0" width="320" height="160" fill="#0c1c3a" rx="8" />
                {/* Axis */}
                <line x1="15" y1="80" x2="285" y2="80" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeDasharray="6 4" />
                {/* Mirror */}
                <path d="M 268,30 Q 250,80 268,130" fill="none" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />
                {/* C marker */}
                <line x1="190" y1="74" x2="190" y2="86" stroke="#94a3b8" strokeWidth="2" />
                <text x="190" y="98" textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="800">C</text>
                {/* F marker */}
                <line x1="230" y1="74" x2="230" y2="86" stroke="#60a5fa" strokeWidth="2" />
                <text x="230" y="98" textAnchor="middle" fontSize="9" fill="#60a5fa" fontWeight="800">F</text>
                {/* Object */}
                <line x1="140" y1="80" x2="140" y2="56" stroke="#f8fafc" strokeWidth="2.5" />
                <polygon points="134,63 146,63 140,56" fill="#f8fafc" />
                {/* Image */}
                <line x1="215" y1="80" x2="215" y2="96" stroke="#34d399" strokeWidth="2" />
                <polygon points="209,89 221,89 215,96" fill="#34d399" />
                {/* Annotation callouts */}
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
              <button
                className={styles.onboardingBtn}
                onClick={() => {
                  localStorage.setItem("lab_guide_seen_mirror-lab", "1");
                  setShowOnboarding(false);
                }}
              >
                OK, let's start →
              </button>
            </div>
          </div>
        )}

        {/* ── Lab SVG ──────────────────────────────────────────────────────── */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className={styles.labSvg}
          style={{ touchAction: "none" }}
          aria-label="Optics lab diagram"
        >
          {/* Subtle vertical grid lines */}
          {Array.from({ length: 8 }, (_, i) => (
            <line key={i}
              x1={MIRROR_X - (i + 1) * SCALE} y1={50}
              x2={MIRROR_X - (i + 1) * SCALE} y2={SVG_H - 50}
              stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          ))}

          {/* Principal axis */}
          <PrincipalAxis x1={20} x2={SVG_W - 20} y={AXIS_Y} />

          {/* C marker */}
          {shared.showCenterLabels && C_X > 20 && (
            <PointMarker x={C_X} y={AXIS_Y} label="C" sublabel="Centre of Curvature" color="#94a3b8" />
          )}

          {/* F marker */}
          {shared.showFocusLabels && F_X > 20 && (
            <PointMarker x={F_X} y={AXIS_Y} label="F" sublabel="Focal Point" color="#60a5fa" />
          )}

          {/* Principal rays */}
          {showRays && (
            <g>
              {r1Inc && <RayLine x1={r1Inc[0]} y1={r1Inc[1]} x2={r1Inc[2]} y2={r1Inc[3]} color="#f59e0b" />}
              {r1Ref && <RayLine x1={r1Ref[0]} y1={r1Ref[1]} x2={r1Ref[2]} y2={r1Ref[3]} color="#f59e0b" />}
              {r1Dash && <RayLine x1={r1Dash[0]} y1={r1Dash[1]} x2={r1Dash[2]} y2={r1Dash[3]} color="#f59e0b" dashed />}
              {r2Inc && <RayLine x1={r2Inc[0]} y1={r2Inc[1]} x2={r2Inc[2]} y2={r2Inc[3]} color="#22d3ee" />}
              {r2Ref && <RayLine x1={r2Ref[0]} y1={r2Ref[1]} x2={r2Ref[2]} y2={r2Ref[3]} color="#22d3ee" />}
              {r2Dash && <RayLine x1={r2Dash[0]} y1={r2Dash[1]} x2={r2Dash[2]} y2={r2Dash[3]} color="#22d3ee" dashed />}
            </g>
          )}

          {/* Mirror */}
          <CurvedMirror
            x={MIRROR_X} y={AXIS_Y}
            halfHeight={MIRROR_HALF_H}
            depth={MIRROR_DEPTH}
            mirrorType={mirrorType}
            id="main"
          />

          {/* Image arrow */}
          {imgResult.exists && imgSvgX !== null && imgTopY !== null && (
            <ImageArrow
              x={imgSvgX}
              axisY={AXIS_Y}
              tipY={imgTopY}
              isReal={imgResult.isReal}
            />
          )}

          {/* "No image" notice */}
          {!imgResult.exists && (
            <text x={(objX + MIRROR_X) / 2} y={AXIS_Y - 36}
              textAnchor="middle" fill="#fbbf24" fontSize="12"
              fontFamily="var(--eg-font-display)" fontWeight="600">
              Image at ∞ — object is at the focal point
            </text>
          )}

          {/* Object arrow (draggable) */}
          <ObjectArrow
            x={objX}
            axisY={AXIS_Y}
            height={OBJ_H_SVG}
            onDragX={(newX) => {
              setObjX(clamp(newX, MIN_OBJ_X, MAX_OBJ_X));
              setFeedback(null);
            }}
            svgRef={svgRef}
            svgWidth={SVG_W}
            disabled={isPaused || succeeded}
          />
        </svg>

        {/* ── Status panel ─────────────────────────────────────────────────── */}
        <div className={styles.statusPanel}>
          <div className={styles.imageReadout}>
            <span className={styles.readoutLabel}>Image:</span>
            <span className={styles.readoutValue}>{describeImage(imgResult)}</span>
          </div>
          {guide && (
            <div className={`${styles.guide} ${styles[`guide_${guide.tone}`]}`}>
              {guide.tone === "success" ? "✓ " : guide.tone === "warning" ? "⚠ " : "→ "}
              {guide.text}
            </div>
          )}
        </div>

        {/* ── Feedback ─────────────────────────────────────────────────────── */}
        {feedback && (
          <div className={`${styles.feedback} ${styles[`feedback_${feedback.kind}`]}`}>
            <Mascot
              pose={feedback.kind === "success" ? "celebrate" : "encourage"}
              widthPx={42}
            />
            <p className={styles.feedbackText}>{feedback.text}</p>
            {feedback.kind === "hint" && (
              <button className={styles.feedbackClose}
                onClick={() => setFeedback(null)}
                aria-label="Dismiss hint">✕</button>
            )}
          </div>
        )}

        {/* ── Controls ─────────────────────────────────────────────────────── */}
        <div className={styles.controls}>
          {/* Mirror type picker — only when multiple options are available */}
          {effectiveMirrorOptions.length > 1 && (
            <div className={styles.mirrorPicker}>
              {(["concave", "convex"] as MirrorType[])
                .filter(m => effectiveMirrorOptions.includes(m))
                .map(m => (
                  <button key={m}
                    className={`${styles.mirrorBtn} ${mirrorType === m ? styles.mirrorBtnActive : ""}`}
                    onClick={() => { setMirrorType(m); setFeedback(null); }}
                  >
                    {m === "concave" ? "⌓ Concave" : "⌔ Convex"}
                  </button>
                ))}
            </div>
          )}

          {/* Rays toggle (Medium/Hard) */}
          {shared.showRaysToggle && (
            <button
              className={`${styles.raysBtn} ${showRays ? styles.raysBtnOn : ""}`}
              onClick={() => setShowRays(r => !r)}
            >
              {showRays ? "Hide Rays" : "Show Rays"}
            </button>
          )}

          {/* Run experiment / Done */}
          <button
            className={`${styles.runBtn} ${succeeded ? styles.runBtnDone : ""}`}
            onClick={() => {
              if (succeeded && pendingOutcome) {
                onComplete(pendingOutcome);
              } else {
                handleRun();
              }
            }}
            disabled={isPaused}
          >
            {succeeded ? "✓ Done!" : "▶  Run Experiment"}
          </button>
        </div>
      </div>
    </GameplayShell>
  );
}
