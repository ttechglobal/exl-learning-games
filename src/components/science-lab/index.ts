/**
 * src/components/science-lab/index.ts
 *
 * Reusable SVG components for science experiment engines.
 *
 * ARCHITECTURE NOTE (per direct discussion):
 * Many experiment-style games need the same physical objects:
 *   - Optics:      mirrors, lenses, rays, object arrows
 *   - Electricity: batteries, wires, bulbs, switches
 *   - Waves:       oscillators, wavefronts, barriers
 *
 * Rather than re-drawing a "battery" SVG from scratch in every engine
 * that needs one, these are extracted here as standalone components.
 * Each is a pure SVG <g> element — the parent engine's <svg> provides
 * the coordinate space. Components receive x, y, scale, and any
 * interactive callbacks they need.
 *
 * CURRENT COMPONENTS (from Mirror Lab):
 *   PrincipalAxis    — horizontal axis with optional tick marks
 *   CurvedMirror     — concave or convex mirror arc with backing
 *   ObjectArrow      — draggable vertical arrow (the object)
 *   ImageArrow       — image arrow (real=solid green, virtual=dashed purple)
 *   RayLine          — a single principal ray (solid or dashed)
 *   PointMarker      — labelled point on the axis (F, C, etc.)
 *
 * PLANNED (add as new engines are built):
 *   ConvexLens       — biconvex/biconcave lens shape for Lens Lab
 *   WireSegment      — straight wire segment for Electricity
 *   Battery          — battery symbol (long+short lines) for Electricity
 *   Bulb             — light bulb circle with filament for Electricity
 *   Switch           — open/closed switch for Electricity
 *
 * USAGE:
 *   All components render as SVG <g> elements. The parent SVG sets
 *   the coordinate system. Pass x/y/scale to position and size them.
 *
 *   <svg viewBox="0 0 900 400">
 *     <PrincipalAxis x1={20} x2={880} y={200} />
 *     <CurvedMirror x={700} y={200} mirrorType="concave" halfHeight={130} />
 *     <ObjectArrow x={420} y={200} height={72} onDrag={setObjX} />
 *   </svg>
 */

export { PrincipalAxis } from "./PrincipalAxis";
export { CurvedMirror } from "./CurvedMirror";
export { ObjectArrow } from "./ObjectArrow";
export { ImageArrow } from "./ImageArrow";
export { RayLine } from "./RayLine";
export { PointMarker } from "./PointMarker";
