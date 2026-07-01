/**
 * ImageArrow
 *
 * Renders the image arrow in an optics experiment. Visual treatment
 * communicates image type at a glance:
 *   Real image   — solid green arrow, full opacity
 *   Virtual image — dashed purple arrow, reduced opacity
 *
 * The arrow points UP for upright images and DOWN for inverted ones,
 * determined by the sign of magnification m from the mirror/lens formula.
 *
 * Used by: OpticsExperimentEngine (Mirror Lab)
 * Planned: LensLabEngine
 */

interface ImageArrowProps {
  x: number;
  axisY: number;
  /** Tip y — axisY - m * objectHeight in SVG coords */
  tipY: number;
  isReal: boolean;
  label?: string;
}

export function ImageArrow({ x, axisY, tipY, isReal, label = "Image" }: ImageArrowProps) {
  const color = isReal ? "#34d399" : "#a78bfa";
  const opacity = isReal ? 1 : 0.75;
  const inverted = tipY > axisY; // tip below axis = inverted image
  const arrowheadOffset = inverted ? 15 : -15;
  const arrowPoints = `${x - 7},${tipY + arrowheadOffset} ${x + 7},${tipY + arrowheadOffset} ${x},${tipY}`;
  const labelY = inverted ? tipY - 12 : tipY + 24;

  return (
    <g opacity={opacity}>
      {/* Arrow body */}
      <line
        x1={x} y1={axisY}
        x2={x} y2={tipY}
        stroke={color} strokeWidth={2.5}
        strokeDasharray={isReal ? undefined : "7 4"}
      />

      {/* Arrowhead */}
      <polygon points={arrowPoints} fill={color} />

      {/* Label */}
      <text x={x} y={labelY}
        textAnchor="middle" fill={color}
        fontSize="11" fontFamily="var(--eg-font-display)" fontWeight="700">
        {isReal ? label : `Virtual ${label}`}
      </text>
    </g>
  );
}
