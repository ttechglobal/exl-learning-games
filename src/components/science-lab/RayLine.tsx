/**
 * RayLine
 *
 * A single ray segment in an optics experiment. Solid for real
 * reflected/refracted rays, dashed for virtual ray extensions
 * (showing where the ray appears to come from behind the mirror/lens).
 *
 * Used by: OpticsExperimentEngine (Mirror Lab)
 * Planned: LensLabEngine, RefractionLabEngine
 */

interface RayLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  /** Dashed = virtual ray extension behind mirror/lens */
  dashed?: boolean;
  opacity?: number;
  strokeWidth?: number;
}

export function RayLine({
  x1, y1, x2, y2,
  color,
  dashed = false,
  opacity = 0.85,
  strokeWidth = 1.8
}: RayLineProps) {
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeDasharray={dashed ? "5 4" : undefined}
      opacity={dashed ? opacity * 0.55 : opacity}
    />
  );
}
