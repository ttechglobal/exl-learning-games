/**
 * ObjectArrow
 *
 * A draggable vertical arrow representing the object in an optics
 * experiment. The arrow sits on the principal axis and points upward.
 * The student drags it left/right to change the object distance.
 *
 * Used by: OpticsExperimentEngine (Mirror Lab)
 * Planned: LensLabEngine (same interaction, different constraints)
 *
 * INTERACTION: uses pointer capture so drag works reliably on touch.
 * The parent engine owns the x position in state and passes it in;
 * this component calls onDragX with the new SVG x coordinate on each
 * pointer move.
 */

interface ObjectArrowProps {
  /** Current x position in SVG coordinates */
  x: number;
  /** y of the principal axis (arrow base) */
  axisY: number;
  /** Height of the arrow in SVG units */
  height: number;
  /** Called with new SVG x during drag — parent clamps to valid range */
  onDragX: (svgX: number) => void;
  /** Parent SVG element ref — used to convert clientX to SVG coordinates */
  svgRef: React.RefObject<SVGSVGElement>;
  svgWidth: number;
  disabled?: boolean;
  color?: string;
  label?: string;
}

export function ObjectArrow({
  x, axisY, height,
  onDragX, svgRef, svgWidth,
  disabled = false,
  color = "#f8fafc",
  label = "Object"
}: ObjectArrowProps) {
  const topY = axisY - height;

  function toSvgX(clientX: number): number {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return x;
    return ((clientX - rect.left) / rect.width) * svgWidth;
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!(e.target as Element).hasPointerCapture(e.pointerId)) return;
    onDragX(toSvgX(e.clientX));
  }

  function handlePointerUp(e: React.PointerEvent) {
    (e.target as Element).releasePointerCapture(e.pointerId);
  }

  return (
    <g
      style={{ cursor: disabled ? "default" : "grab" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Large transparent hit area for easy touch */}
      <rect x={x - 28} y={topY - 16} width={56} height={height + 32}
        fill="transparent" />

      {/* Arrow body */}
      <line x1={x} y1={axisY} x2={x} y2={topY}
        stroke={color} strokeWidth={3.5} strokeLinecap="round" />

      {/* Arrowhead pointing up */}
      <polygon
        points={`${x - 9},${topY + 18} ${x + 9},${topY + 18} ${x},${topY}`}
        fill={color}
      />

      {/* Base tick on axis */}
      <line x1={x - 9} y1={axisY} x2={x + 9} y2={axisY}
        stroke={color} strokeWidth={2.5} strokeLinecap="round" />

      {/* Label */}
      <text x={x} y={topY - 12}
        textAnchor="middle" fill={color}
        fontSize="11" fontFamily="var(--eg-font-display)" fontWeight="700">
        {label}
      </text>

      {/* Drag cue */}
      {!disabled && (
        <text x={x} y={axisY + 30}
          textAnchor="middle" fill="rgba(255,255,255,0.35)"
          fontSize="10" fontFamily="var(--eg-font-body)">
          ← drag →
        </text>
      )}
    </g>
  );
}
