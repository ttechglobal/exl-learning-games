/**
 * PrincipalAxis
 *
 * The horizontal reference line all optics/mirror experiments are drawn
 * relative to. Renders as a dashed white/grey line in the SVG coordinate
 * space provided by the parent engine.
 *
 * Used by: OpticsExperimentEngine (Mirror Lab)
 * Planned: LensLabEngine, RefractionLabEngine
 */

interface PrincipalAxisProps {
  /** Start x (left edge) */
  x1: number;
  /** End x (right edge) */
  x2: number;
  /** y position of the axis */
  y: number;
  color?: string;
  opacity?: number;
}

export function PrincipalAxis({
  x1, x2, y,
  color = "rgba(255,255,255,0.22)",
  opacity = 1
}: PrincipalAxisProps) {
  return (
    <line
      x1={x1} y1={y} x2={x2} y2={y}
      stroke={color}
      strokeWidth={1.5}
      strokeDasharray="8 6"
      opacity={opacity}
    />
  );
}
