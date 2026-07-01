/**
 * PointMarker
 *
 * A labelled tick mark on the principal axis — used for the focal
 * point F, centre of curvature C, and any other significant positions.
 *
 * Now supports an optional sublabel (full name) shown below the letter,
 * so students know what F and C actually mean without having to guess.
 */

interface PointMarkerProps {
  x: number;
  y: number;
  label: string;
  /** Full name, e.g. "Focal Point" or "Centre of Curvature" */
  sublabel?: string;
  color?: string;
  tickHeight?: number;
}

export function PointMarker({
  x, y,
  label,
  sublabel,
  color = "#60a5fa",
  tickHeight = 10
}: PointMarkerProps) {
  return (
    <g>
      {/* Tick mark */}
      <line
        x1={x} y1={y - tickHeight}
        x2={x} y2={y + tickHeight}
        stroke={color} strokeWidth={2.5}
      />
      {/* Main letter label (large) */}
      <text
        x={x} y={y + tickHeight + 18}
        textAnchor="middle" fill={color}
        fontSize="15" fontFamily="var(--eg-font-display)" fontWeight="800">
        {label}
      </text>
      {/* Sublabel — full name in smaller text */}
      {sublabel && (
        <text
          x={x} y={y + tickHeight + 32}
          textAnchor="middle" fill={color}
          fontSize="9.5" fontFamily="var(--eg-font-body)" fontWeight="600"
          opacity={0.8}>
          {sublabel}
        </text>
      )}
    </g>
  );
}
