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
 * Sign convention (New Cartesian — WAEC/JAMB standard):
 *   u  — object distance, always positive (real object in front of mirror)
 *   f  — positive for concave, negative for convex
 *   v  — positive = real image (in front of mirror)
 *        negative = virtual image (behind mirror)
 *   m  — magnification = −v/u
 */
export function calculateImage(
  u: number,
  focalLength: number,
  mirrorType: MirrorType
): ImageResult {
  const f = mirrorType === "concave" ? focalLength : -focalLength;

  if (Math.abs(u - f) < 0.06) {
    return { v: Infinity, m: 0, isReal: false, isInverted: false, magnitudeM: 0, exists: false };
  }

  const invV = 1 / f - 1 / u;
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
    exists: true,
  };
}

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
 * Check if a student's formula entry is correct within tolerance.
 * Returns { correct: boolean, expectedV: number, expectedM: number }
 */
export function checkFormulaEntry(
  enteredV: number,
  enteredM: number,
  result: ImageResult,
  tolerance = 0.08
): { correct: boolean; vOk: boolean; mOk: boolean } {
  if (!result.exists) return { correct: false, vOk: false, mOk: false };
  const vOk = Math.abs((enteredV - result.v) / result.v) <= tolerance;
  const mOk = Math.abs((enteredM - result.m) / (result.m || 0.001)) <= tolerance;
  return { correct: vOk && mOk, vOk, mOk };
}

/**
 * Check if only magnification entry is required.
 */
export function checkMagnificationEntry(
  enteredM: number,
  result: ImageResult,
  tolerance = 0.08
): boolean {
  if (!result.exists) return false;
  return Math.abs((enteredM - result.m) / (result.m || 0.001)) <= tolerance;
}

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
  if (attempt === 1 && payloadHint) return payloadHint;

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

export function describeImage(result: ImageResult): string {
  if (!result.exists) return "No image — object is at the focal point";
  const type = result.isReal ? "Real" : "Virtual";
  const orient = result.isInverted ? "Inverted" : "Upright";
  const mag =
    result.magnitudeM > 1.08
      ? `${result.magnitudeM.toFixed(2)}× bigger`
      : result.magnitudeM < 0.92
      ? `${result.magnitudeM.toFixed(2)}× smaller`
      : "Same size";
  return `${type}  ·  ${orient}  ·  ${mag}`;
}

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
  if (cond.requiresFormulaEntry) parts.push("+ Calculate v & m");
  if (cond.requiresMagnificationEntry) parts.push("+ Calculate m");
  return parts.join("  ·  ") || "Observe the image";
}

export function getContextualGuide(
  result: ImageResult,
  cond: WinConditions,
  mirrorType: MirrorType
): { text: string; tone: "guide" | "success" | "warning" } {
  if (!result.exists) {
    return {
      text: "Move the object slightly away from F — the image disappears when the object is exactly at the focal point.",
      tone: "warning",
    };
  }

  if (checkWinConditions(result, cond, mirrorType)) {
    if (cond.requiresFormulaEntry || cond.requiresMagnificationEntry) {
      return {
        text: "✓ Correct position! Now calculate the values below and press Check.",
        tone: "success",
      };
    }
    return {
      text: "✓ Looks right! Press Run Experiment to confirm your result.",
      tone: "success",
    };
  }

  if (cond.targetMirror && cond.targetMirror !== mirrorType) {
    return { text: `Switch to the ${cond.targetMirror} mirror using the button below.`, tone: "guide" };
  }
  if (cond.targetImageType === "real" && !result.isReal) {
    return {
      text: "Drag the object to the LEFT, past F. A real image forms when the object is beyond the focal point.",
      tone: "guide",
    };
  }
  if (cond.targetImageType === "virtual" && result.isReal) {
    return {
      text: "Move the object to the RIGHT, inside F — or switch to the convex mirror.",
      tone: "guide",
    };
  }
  if (cond.targetOrientation === "upright" && result.isInverted) {
    return {
      text: "You need an upright image. Virtual images are always upright — move the object inside F.",
      tone: "guide",
    };
  }
  if (cond.targetMagnificationMin !== undefined && result.magnitudeM < cond.targetMagnificationMin) {
    return {
      text: "The image needs to be bigger. Move the object closer to F — but keep it beyond F.",
      tone: "guide",
    };
  }
  if (cond.targetMagnificationMax !== undefined && result.magnitudeM > cond.targetMagnificationMax) {
    return {
      text: "The image needs to be smaller. Move the object further from the mirror.",
      tone: "guide",
    };
  }

  return {
    text: "Drag the arrow left or right and observe how the image changes. Press Run Experiment when ready.",
    tone: "guide",
  };
}

/**
 * Build a worked solution string for a given image result + u value.
 * Shown to students after a formula challenge succeeds.
 */
export function buildWorkedSolution(u: number, f: number, mirrorType: MirrorType, result: ImageResult): string {
  const fUsed = mirrorType === "concave" ? f : -f;
  const fLabel = mirrorType === "concave" ? `+${f}` : `-${f}`;
  const vLabel = result.v > 0 ? `+${result.v.toFixed(2)}` : result.v.toFixed(2);
  const mLabel = result.m.toFixed(3);
  return [
    `Mirror Formula: 1/v + 1/u = 1/f`,
    `Given: u = ${u.toFixed(2)} cm,  f = ${fLabel} cm (${mirrorType})`,
    `∴ 1/v = 1/f − 1/u = 1/(${fUsed}) − 1/${u.toFixed(2)}`,
    `∴ v = ${vLabel} cm  →  ${result.isReal ? "Real image (v > 0)" : "Virtual image (v < 0)"}`,
    `Linear magnification: m = −v/u = −(${vLabel})/${u.toFixed(2)} = ${mLabel}`,
    `|m| = ${result.magnitudeM.toFixed(3)}  →  Image is ${result.magnitudeM > 1 ? "magnified" : "diminished"}, ${result.isInverted ? "inverted" : "upright"}`,
  ].join("\n");
}

/**
 * Real-world application lookup for current image state.
 * Shown as a "Did you know?" nudge during/after experiments.
 */
export function getRealWorldApplication(result: ImageResult, mirrorType: MirrorType): string | null {
  if (!result.exists) return null;
  if (mirrorType === "convex") {
    return "Convex mirrors are used as rear-view mirrors in vehicles and security mirrors in shops — they give a wide field of view with a smaller, upright image.";
  }
  if (!result.isReal) {
    return "When an object is inside F of a concave mirror, you see a magnified upright virtual image — this is how makeup mirrors and dentist's mirrors work!";
  }
  if (result.magnitudeM >= 1.8) {
    return "A large magnified real image from a concave mirror is how reflecting telescopes and satellite dishes focus incoming signals to a receiver.";
  }
  if (result.isReal && result.magnitudeM < 1) {
    return "This diminished real image is similar to how a concave mirror in a solar cooker focuses sunlight to a small hot spot.";
  }
  if (result.isReal) {
    return "Real images from concave mirrors can be projected onto screens — this principle is used in cinema projectors and ophthalmoscopes.";
  }
  return null;
}