/**
 * CurvedMirror
 *
 * Renders a concave or convex mirror as a curved SVG arc with a hatched
 * backing (the non-reflective side). The reflecting surface faces leftward
 * in the standard optics-lab layout (object on the left, mirror on the right).
 *
 * Used by: OpticsExperimentEngine (Mirror Lab)
 * Planned: LensLabEngine (will add a ConvexLens companion component)
 *
 * The curve is a quadratic bezier. The "depth" prop controls how far the
 * arc bows — for concave it bows toward the object (leftward), for convex
 * it bows away (rightward).
 */

export type MirrorType = "concave" | "convex";

interface CurvedMirrorProps {
  /** x position of the mirror pole (where the principal axis meets the mirror) */
  x: number;
  /** y position of the principal axis */
  y: number;
  /** Half-height of the mirror arc in SVG units */
  halfHeight?: number;
  /** How far the arc bows from the pole, in SVG units */
  depth?: number;
  mirrorType: MirrorType;
  /** Unique id suffix for SVG defs — use a stable per-engine string */
  id?: string;
}

export function CurvedMirror({
  x, y,
  halfHeight = 130,
  depth = 30,
  mirrorType,
  id = "mirror"
}: CurvedMirrorProps) {
  // Concave: arc bows LEFT (toward object). Convex: arc bows RIGHT.
  const bowX = mirrorType === "concave" ? x - depth : x + depth;

  const arcPath = `M ${x},${y - halfHeight} Q ${bowX},${y} ${x},${y + halfHeight}`;

  // Hatched backing region — on the non-reflecting side
  const backW = depth + 5;
  const backingClip =
    mirrorType === "concave"
      ? `M ${x},${y - halfHeight} Q ${bowX},${y} ${x},${y + halfHeight} L ${x + backW},${y + halfHeight} L ${x + backW},${y - halfHeight} Z`
      : `M ${x},${y - halfHeight} Q ${bowX},${y} ${x},${y + halfHeight} L ${x - backW},${y + halfHeight} L ${x - backW},${y - halfHeight} Z`;

  const hatchId = `mirrorHatch_${id}`;
  const clipId = `mirrorClip_${id}`;

  return (
    <g>
      <defs>
        <pattern id={hatchId} patternUnits="userSpaceOnUse"
          width="8" height="8" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8"
            stroke="#1e3a5f" strokeWidth="3.5" />
        </pattern>
        <clipPath id={clipId}>
          <path d={backingClip} />
        </clipPath>
      </defs>

      {/* Hatched backing */}
      <rect
        x={mirrorType === "concave" ? x - backW : x - backW}
        y={y - halfHeight}
        width={backW * 2}
        height={halfHeight * 2}
        fill={`url(#${hatchId})`}
        clipPath={`url(#${clipId})`}
      />

      {/* Reflective surface — base silver */}
      <path d={arcPath}
        fill="none"
        stroke="#94a3b8"
        strokeWidth={5}
        strokeLinecap="round"
      />

      {/* Highlight sheen */}
      <path d={arcPath}
        fill="none"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </g>
  );
}
