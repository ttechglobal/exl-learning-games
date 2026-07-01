import type { MirrorType, WinConditions } from "./opticsExperiment.config";

export interface ImageResult {
  v: number;
  m: number;
  isReal: boolean;
  isInverted: boolean;
  magnitudeM: number;
  exists: boolean;
}

/**
 * Mirror formula: 1/v + 1/u = 1/f
 *
 * Sign convention used throughout:
 *   u  — object distance, always positive (real object in front of mirror)
 *   f  — positive for concave, negative for convex
 *   v  — positive = real image (in front of mirror)
 *        negative = virtual image (behind mirror)
 *   m  — magnification = −v/u
 *        positive → upright image
 *        negative → inverted image
 *        |m| > 1 → magnified
 *        |m| < 1 → diminished
 *
 * This is the standard New Cartesian sign convention taught at secondary
 * school level, matching WAEC/JAMB syllabi.
 */
export function calculateImage(
  u: number,
  focalLength: number,
  mirrorType: MirrorType
): ImageResult {
  const f = mirrorType === "concave" ? focalLength : -focalLength;

  // Object exactly at focal point → image at infinity
  if (Math.abs(u - f) < 0.06) {
    return { v: Infinity, m: 0, isReal: false, isInverted: false, magnitudeM: 0, exists: false };
  }

  const invV = 1 / f - 1 / u;
  // v → ∞ (image very far away — treat as no displayable image)
  if (Math.abs(invV) < 0.001) {
    return { v: Infinity, m: 0, isReal: false, isInverted: false, magnitudeM: 0, exists: false };
  }

  const v = 1 / invV;
  const m = -(v / u);

  return {
    v,
    m,
    isReal: v > 0,
    isInverted: m < 0,
    magnitudeM: Math.abs(m),
    exists: true
  };
}

/**
 * Returns true only when every specified win condition is satisfied.
 * Unspecified conditions (undefined) are treated as "any value is fine".
 */
export function checkWinConditions(
  result: ImageResult,
  cond: WinConditions,
  mirrorType: MirrorType
): boolean {
  if (!result.exists) return false;
  if (cond.targetMirror && cond.targetMirror !== mirrorType) return false;
  if (cond.targetImageType === "real" && !result.isReal) return false;
  if (cond.targetImageType === "virtual" && result.isReal) return false;
  if (cond.targetOrientation === "inverted" && !result.isInverted) return false;
  if (cond.targetOrientation === "upright" && result.isInverted) return false;
  if (cond.targetMagnificationMin !== undefined && result.magnitudeM < cond.targetMagnificationMin) return false;
  if (cond.targetMagnificationMax !== undefined && result.magnitudeM > cond.targetMagnificationMax) return false;
  return true;
}

/**
 * Returns a guiding hint — never reveals the answer directly.
 * First failure uses the mission-authored hint if one is set.
 * Later failures become more specific based on which condition failed.
 */
export function getHintMessage(
  result: ImageResult,
  cond: WinConditions,
  mirrorType: MirrorType,
  payloadHint?: string,
  attempt = 1
): string {
  if (!result.exists) {
    return "The image is at infinity. Move the object slightly away from the focal point F.";
  }
  // First miss: use the authored per-mission hint
  if (attempt === 1 && payloadHint) return payloadHint;

  // Subsequent misses: diagnose which condition failed
  if (cond.targetMirror && cond.targetMirror !== mirrorType)
    return `Switch to the ${cond.targetMirror} mirror.`;
  if (cond.targetImageType === "real" && !result.isReal)
    return "You need a real image. Move the object beyond the focal point F — keep it further from the mirror than F.";
  if (cond.targetImageType === "virtual" && result.isReal)
    return "You need a virtual image. Try a convex mirror, or move the object closer to the mirror than F.";
  if (cond.targetOrientation === "upright" && result.isInverted)
    return "The image needs to be upright. Virtual images are always upright — bring the object inside F, or try a convex mirror.";
  if (cond.targetOrientation === "inverted" && !result.isInverted)
    return "The image needs to be inverted. All real images in a concave mirror are inverted — move the object beyond F.";
  if (cond.targetMagnificationMin !== undefined && result.magnitudeM < cond.targetMagnificationMin)
    return "The image needs to be bigger. Move the object closer to F (but keep it beyond F for a real image).";
  if (cond.targetMagnificationMax !== undefined && result.magnitudeM > cond.targetMagnificationMax)
    return "The image needs to be smaller. Move the object further away from the mirror.";
  return "Almost there! Check each requirement in the mission card again.";
}

/** Human-readable description of the current image state — shown live
 *  as the student moves the object. */
export function describeImage(result: ImageResult): string {
  if (!result.exists) return "No image — object is at the focal point";
  const type = result.isReal ? "Real" : "Virtual";
  const orient = result.isInverted ? "Inverted" : "Upright";
  const mag =
    result.magnitudeM > 1.08
      ? `${result.magnitudeM.toFixed(1)}× bigger`
      : result.magnitudeM < 0.92
        ? `${result.magnitudeM.toFixed(1)}× smaller`
        : "Same size";
  return `${type}  ·  ${orient}  ·  ${mag}`;
}

/** Compact mission-card label from a WinConditions object. */
export function describeWinConditions(cond: WinConditions): string {
  const parts: string[] = [];
  if (cond.targetMirror)
    parts.push(cond.targetMirror === "concave" ? "Concave mirror" : "Convex mirror");
  if (cond.targetImageType)
    parts.push(cond.targetImageType === "real" ? "Real image" : "Virtual image");
  if (cond.targetOrientation)
    parts.push(cond.targetOrientation === "inverted" ? "Inverted" : "Upright");
  if (cond.targetMagnificationMin !== undefined && cond.targetMagnificationMax !== undefined) {
    const mid = (cond.targetMagnificationMin + cond.targetMagnificationMax) / 2;
    parts.push(`~${mid.toFixed(1)}× size`);
  } else if (cond.targetMagnificationMin !== undefined) {
    parts.push(`≥${cond.targetMagnificationMin.toFixed(1)}× magnified`);
  } else if (cond.targetMagnificationMax !== undefined) {
    parts.push(`≤${cond.targetMagnificationMax.toFixed(1)}× size`);
  }
  return parts.join("  ·  ") || "Observe the image";
}

/**
 * Returns a live, state-aware guide message shown inside the lab as the
 * student drags the object. Tells them WHAT TO DO RIGHT NOW, not just
 * what the physics is. This is the "guidance" that was missing — students
 * were seeing F, C, rays, and a readout but had no idea what action to
 * take to meet the mission target.
 *
 * Three states:
 *   guide   — neutral instruction, student is experimenting
 *   success — they've met the target, nudge them to run
 *   warning — something is blocking progress (object at F, etc.)
 */
export function getContextualGuide(
  result: ImageResult,
  cond: WinConditions,
  mirrorType: MirrorType
): { text: string; tone: "guide" | "success" | "warning" } {
  if (!result.exists) {
    return {
      text: "Move the object slightly away from F — the image disappears when the object is exactly at the focal point.",
      tone: "warning"
    };
  }

  // Already meeting all conditions → encourage them to run
  if (checkWinConditions(result, cond, mirrorType)) {
    return {
      text: "✓ Looks right! Press Run Experiment to confirm your result.",
      tone: "success"
    };
  }

  // Diagnose what still needs to change
  if (cond.targetMirror && cond.targetMirror !== mirrorType) {
    return {
      text: `Switch to the ${cond.targetMirror} mirror using the button below.`,
      tone: "guide"
    };
  }
  if (cond.targetImageType === "real" && !result.isReal) {
    return {
      text: "Drag the object to the LEFT, past F. A real image forms when the object is beyond the focal point.",
      tone: "guide"
    };
  }
  if (cond.targetImageType === "virtual" && result.isReal) {
    return {
      text: "Move the object to the RIGHT, inside F — or switch to the convex mirror.",
      tone: "guide"
    };
  }
  if (cond.targetOrientation === "upright" && result.isInverted) {
    return {
      text: "You need an upright image. Virtual images are always upright — move the object inside F.",
      tone: "guide"
    };
  }
  if (cond.targetMagnificationMin !== undefined && result.magnitudeM < cond.targetMagnificationMin) {
    return {
      text: "The image needs to be bigger. Move the object closer to F — but keep it beyond F.",
      tone: "guide"
    };
  }
  if (cond.targetMagnificationMax !== undefined && result.magnitudeM > cond.targetMagnificationMax) {
    return {
      text: "The image needs to be smaller. Move the object further from the mirror.",
      tone: "guide"
    };
  }

  return {
    text: "Drag the arrow left or right and observe how the image changes. Press Run Experiment when ready.",
    tone: "guide"
  };
}
