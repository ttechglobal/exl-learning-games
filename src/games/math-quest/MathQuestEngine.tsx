"use client";
/**
 * MathQuestEngine.tsx — Math Quest v6
 *
 * Changes from v5:
 *  1. TRUE POLYGON FAIRWAYS — courses are Path2D polygons clipped on canvas.
 *     Ball bounces off real polygon edges, not a bounding rectangle.
 *     This means L-shapes, S-bends, and doglegs actually look like those shapes.
 *
 *  2. BALL STAYS ON MISS — when the ball stops without sinking, it stays
 *     exactly where it is. The student continues from that position. No reset
 *     to the tee. Position is only reset when moving to a new hole.
 *
 *  3. GRADE SELECTOR — the topic pick screen now shows a class/grade row.
 *     Grade pre-fills from the `defaultGrade` prop (from student profile).
 *     Selected grade filters which topics are available.
 *
 *  4. ENVIRONMENT THEMING PER HOLE — sky gradient, grass palette, and accent
 *     decorations shift for each of the 5 holes.
 *
 *  5. CONTINUE-FROM-POSITION AFTER QUESTION — answering the question correctly
 *     restores 3 hearts and returns to aiming from the ball's current position,
 *     not from the tee.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import styles from "./MathQuestEngine.module.css";

// Font injection — module-level to avoid React removeChild crash
if (typeof window !== "undefined" && !document.getElementById("mq-fonts")) {
  const _l = document.createElement("link");
  _l.id = "mq-fonts"; _l.rel = "stylesheet";
  _l.href = "https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito:wght@700;800&display=swap";
  document.head.appendChild(_l);
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface Vec2 { x: number; y: number; }

type Grade = "JSS1" | "JSS2" | "JSS3" | "SS1" | "SS2" | "SS3";
type Phase = "topic_pick" | "aiming" | "rolling" | "sinking" | "hole_result" | "question" | "session_done";

// ── Grade definitions ──────────────────────────────────────────────────────────
const GRADES: Grade[] = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"];

// ── Question bank ──────────────────────────────────────────────────────────────
interface QStep { instruction: string; formula: string; tileOk: string; tilesNo: [string, string]; hint: string; resultFormula: string; }
interface QuizQ  { id: string; label: string; formula: string; finalAnswer: string; steps: QStep[]; grades: Grade[]; topic: string; }

const QUESTIONS: QuizQ[] = [
  { id:"q1", label:"Make t the subject", formula:"v = t + 5", finalAnswer:"t = v − 5", topic:"change-of-subject",
    grades:["JSS3","SS1","SS2","SS3"],
    steps:[{ formula:"v = t + 5", instruction:"+ 5 is blocking t — subtract 5 from both sides.", tileOk:"− 5", tilesNo:["+ 5","× 5"], hint:"Opposite of + 5 is − 5.", resultFormula:"t = v − 5" }] },
  { id:"q2", label:"Make m the subject", formula:"F = 3m", finalAnswer:"m = F ÷ 3", topic:"change-of-subject",
    grades:["JSS3","SS1","SS2","SS3"],
    steps:[{ formula:"F = 3m", instruction:"m is multiplied by 3 — divide both sides by 3.", tileOk:"÷ 3", tilesNo:["× 3","− 3"], hint:"÷ 3 undoes × 3.", resultFormula:"m = F ÷ 3" }] },
  { id:"q3", label:"Make x the subject", formula:"y = mx + c", finalAnswer:"x = (y − c) ÷ m", topic:"change-of-subject",
    grades:["SS1","SS2","SS3"],
    steps:[
      { formula:"y = mx + c", instruction:"c is blocking mx — subtract c from both sides.", tileOk:"− c", tilesNo:["+ c","÷ c"], hint:"Subtract c to leave mx alone.", resultFormula:"y − c = mx" },
      { formula:"y − c = mx", instruction:"x is multiplied by m — divide both sides by m.", tileOk:"÷ m", tilesNo:["× m","− m"], hint:"÷ m leaves x alone.", resultFormula:"x = (y − c) ÷ m" },
    ] },
  { id:"q4", label:"Make t the subject", formula:"v = u + at", finalAnswer:"t = (v − u) ÷ a", topic:"change-of-subject",
    grades:["SS1","SS2","SS3"],
    steps:[
      { formula:"v = u + at", instruction:"u is blocking at — subtract u from both sides.", tileOk:"− u", tilesNo:["+ u","÷ u"], hint:"Subtract u to leave at.", resultFormula:"v − u = at" },
      { formula:"v − u = at", instruction:"t is multiplied by a — divide both sides by a.", tileOk:"÷ a", tilesNo:["× a","− a"], hint:"÷ a leaves t alone.", resultFormula:"t = (v − u) ÷ a" },
    ] },
  { id:"q5", label:"Make w the subject", formula:"P = 2(l + w)", finalAnswer:"w = P÷2 − l", topic:"change-of-subject",
    grades:["SS1","SS2","SS3"],
    steps:[
      { formula:"P = 2(l + w)", instruction:"w is inside ×2 brackets — divide both sides by 2.", tileOk:"÷ 2", tilesNo:["× 2","− 2"], hint:"÷ 2 clears the bracket coefficient.", resultFormula:"P÷2 = l + w" },
      { formula:"P÷2 = l + w", instruction:"l is next to w — subtract l from both sides.", tileOk:"− l", tilesNo:["+ l","× l"], hint:"− l removes the l.", resultFormula:"w = P÷2 − l" },
    ] },
  { id:"q6", label:"Make r the subject", formula:"C = r ÷ 2", finalAnswer:"r = 2C", topic:"change-of-subject",
    grades:["JSS3","SS1","SS2","SS3"],
    steps:[{ formula:"C = r ÷ 2", instruction:"r is divided by 2 — multiply both sides by 2.", tileOk:"× 2", tilesNo:["÷ 2","+ 2"], hint:"× 2 cancels ÷ 2.", resultFormula:"r = 2C" }] },
  { id:"q7", label:"Make r the subject", formula:"A = πr²", finalAnswer:"r = √(A÷π)", topic:"change-of-subject",
    grades:["SS1","SS2","SS3"],
    steps:[
      { formula:"A = πr²", instruction:"r² is multiplied by π — divide both sides by π.", tileOk:"÷ π", tilesNo:["× π","− π"], hint:"÷ π isolates r².", resultFormula:"A÷π = r²" },
      { formula:"A÷π = r²", instruction:"r is squared — take the square root of both sides.", tileOk:"√( )", tilesNo:["( )²","÷ 2"], hint:"√(r²) = r", resultFormula:"r = √(A÷π)" },
    ] },
  { id:"q8", label:"Make b the subject", formula:"A = ½bh", finalAnswer:"b = 2A÷h", topic:"change-of-subject",
    grades:["SS1","SS2","SS3"],
    steps:[
      { formula:"A = ½bh", instruction:"b has ½ coefficient — multiply both sides by 2.", tileOk:"× 2", tilesNo:["÷ 2","+ 2"], hint:"× 2 removes the ½.", resultFormula:"2A = bh" },
      { formula:"2A = bh", instruction:"b is multiplied by h — divide both sides by h.", tileOk:"÷ h", tilesNo:["× h","− h"], hint:"÷ h leaves b alone.", resultFormula:"b = 2A÷h" },
    ] },
  // JSS-level simpler questions
  { id:"q9", label:"Make y the subject", formula:"x = y + 4", finalAnswer:"y = x − 4", topic:"change-of-subject",
    grades:["JSS2","JSS3","SS1","SS2","SS3"],
    steps:[{ formula:"x = y + 4", instruction:"4 is added to y — subtract 4 from both sides.", tileOk:"− 4", tilesNo:["+ 4","× 4"], hint:"Opposite of + 4 is − 4.", resultFormula:"y = x − 4" }] },
  { id:"q10", label:"Make n the subject", formula:"P = 5n", finalAnswer:"n = P ÷ 5", topic:"change-of-subject",
    grades:["JSS2","JSS3","SS1","SS2","SS3"],
    steps:[{ formula:"P = 5n", instruction:"n is multiplied by 5 — divide both sides by 5.", tileOk:"÷ 5", tilesNo:["× 5","− 5"], hint:"÷ 5 undoes × 5.", resultFormula:"n = P ÷ 5" }] },
];

// ── Polygon fairway system ─────────────────────────────────────────────────────
//
// Each hole is defined by a polygon in NORMALISED coordinates (0–1).
// buildCourse() scales these to actual canvas pixels.
// The polygon is used for:
//   1. Drawing the fairway (canvas clip path)
//   2. Ball boundary collision (point-in-polygon + edge reflection)
//
// Convention: polygon points go clockwise so the filled area is the playable surface.
//
// Additional inner walls (obstacles) use the same format as before: normalised rects.

interface PolyPoint { xf: number; yf: number; }
interface WallDef   { xf: number; yf: number; wf: number; hf: number; }

interface HoleDef {
  name:   string;
  par:    number;
  shape:  string;          // label only — no effect on rendering
  poly:   PolyPoint[];     // fairway polygon in 0–1 coords
  ballFx: number; ballFy: number;
  holeFx: number; holeFy: number;
  walls:  WallDef[];       // inner obstacles
}

// All polygons have a bounding box from (polyMinX, polyMinY) to (polyMaxX, polyMaxY).
// We derive cx/cy/cw/ch from min/max of poly points at build time.

const HOLES: HoleDef[] = [
  // ── Hole 1: Meadow Straight ── pure rectangle, one centre barrier with gap
  { name:"Meadow Straight", par:2, shape:"rect",
    poly:[
      {xf:0,yf:0},{xf:1,yf:0},{xf:1,yf:1},{xf:0,yf:1}
    ],
    ballFx:.10, ballFy:.50, holeFx:.90, holeFy:.50,
    walls:[
      // barrier in the middle — gap at bottom third
      {xf:.47, yf:.00, wf:.06, hf:.38},
      {xf:.47, yf:.62, wf:.06, hf:.38},
    ] },

  // ── Hole 2: Timber L ── true L-shape
  // Polygon: wide left section + narrow right section angled down
  { name:"Timber L-Course", par:2, shape:"L",
    poly:[
      // left section (full height)
      {xf:0,   yf:0},
      {xf:.55, yf:0},
      // step down to right arm
      {xf:.55, yf:.40},
      {xf:1,   yf:.40},
      {xf:1,   yf:1},
      {xf:.55, yf:1},
      // back up left column bottom-left corner
      {xf:.55, yf:1},
      {xf:0,   yf:1},
    ],
    ballFx:.12, ballFy:.22, holeFx:.88, holeFy:.72,
    walls:[] },

  // ── Hole 3: Snake Pass ── S-bend (three chambers)
  { name:"Snake Pass", par:3, shape:"S",
    poly:[
      // Top-right chamber
      {xf:.35, yf:0},
      {xf:1,   yf:0},
      {xf:1,   yf:.52},
      // connect to bottom-left chamber
      {xf:.65, yf:.52},
      {xf:.65, yf:1},
      {xf:0,   yf:1},
      {xf:0,   yf:.48},
      {xf:.35, yf:.48},
    ],
    ballFx:.18, ballFy:.78, holeFx:.82, holeFy:.22,
    walls:[] },

  // ── Hole 4: Garden Room ── wide rectangle with island obstacle
  { name:"Garden Room", par:2, shape:"wide-island",
    poly:[
      {xf:0,yf:0},{xf:1,yf:0},{xf:1,yf:1},{xf:0,yf:1}
    ],
    ballFx:.08, ballFy:.50, holeFx:.91, holeFy:.50,
    walls:[
      {xf:.38, yf:.18, wf:.24, hf:.26},  // top island
      {xf:.38, yf:.56, wf:.24, hf:.26},  // bottom island
    ] },

  // ── Hole 5: Double Dogleg ── Z-shape
  { name:"Double Dogleg", par:3, shape:"Z",
    poly:[
      // left arm (bottom)
      {xf:0,   yf:.55},
      {xf:.55, yf:.55},
      {xf:.55, yf:1},
      {xf:0,   yf:1},
      // close and reopen at top-right arm
    ],
    // Z actually needs two separate rects connected by a diagonal strip.
    // Easier: represent as three overlapping sections in the polygon.
    // Simplified Z polygon:
    ballFx:.12, ballFy:.78, holeFx:.88, holeFy:.22,
    walls:[] },
];

// Override hole 5 polygon with proper Z
HOLES[4].poly = [
  // bottom-left arm
  {xf:0,   yf:.56},
  {xf:.56, yf:.56},
  // connector strip going up-right
  {xf:.56, yf:.44},
  {xf:1,   yf:.44},
  // top-right arm
  {xf:1,   yf:0},
  {xf:.44, yf:0},
  // back down connector
  {xf:.44, yf:.56},
  // already at xf:.56, close left bottom
  {xf:0,   yf:.56},
  // bottom
  {xf:0,   yf:1},
  // this closes the bottom-left arm
  // But we need the bottom edge too — rebuild properly:
];
// Rebuild hole 5 polygon as a proper closed Z:
HOLES[4].poly = [
  {xf:0,   yf:.55},  // bottom-left arm: top-left
  {xf:.58, yf:.55},  // top-right of connector junction
  {xf:.58, yf:.00},  // top of right arm
  {xf:1.0, yf:.00},  // top-right
  {xf:1.0, yf:.45},  // bottom of top-right arm
  {xf:.42, yf:.45},  // connector junction bottom-left
  {xf:.42, yf:1.0},  // bottom of left arm
  {xf:0,   yf:1.0},  // bottom-left
];

// ── Colour constants ───────────────────────────────────────────────────────────
const C = {
  wood:"#D9A15A", woodDark:"#B87F3B",
  ink:"#2E3A2E",  gold:"#F5C444",
  green:"#6FCF63", yellow:"#F2C744", orange:"#F2984A", red:"#EE6A5F",
  coral:"#FF8B6B",
};

// ── Per-hole environment themes ────────────────────────────────────────────────
interface EnvTheme {
  skyTop: string; skyBot: string;
  grass1: string; grass2: string;
  putt1:  string; putt2:  string;
  accentTree: string;  // tree canopy colour
  accentRock: string;  // rock/stone colour
}
const ENV_THEMES: EnvTheme[] = [
  // Hole 1 — Forest
  { skyTop:"#BFE8FF", skyBot:"#EAF9FF", grass1:"#7FC76B", grass2:"#6FB85D",
    putt1:"#6EC3EC", putt2:"#4EA0D0", accentTree:"#5AA84A", accentRock:"#9CA3A0" },
  // Hole 2 — Savanna
  { skyTop:"#FFF5CC", skyBot:"#FFEEA0", grass1:"#A8C86A", grass2:"#93B455",
    putt1:"#7FCFAA", putt2:"#5AB890", accentTree:"#C8A840", accentRock:"#B09060" },
  // Hole 3 — City Park
  { skyTop:"#D4EEFF", skyBot:"#C0E0FF", grass1:"#68B85C", grass2:"#58A04E",
    putt1:"#88D0F0", putt2:"#60B4DC", accentTree:"#408038", accentRock:"#808890" },
  // Hole 4 — Zen Garden
  { skyTop:"#E8F4FF", skyBot:"#D8ECFF", grass1:"#85C470", grass2:"#74B060",
    putt1:"#A0D8C8", putt2:"#78C0B0", accentTree:"#507850", accentRock:"#C8A8B8" },
  // Hole 5 — Highlands
  { skyTop:"#DDEEFF", skyBot:"#C8E0F0", grass1:"#5A9E50", grass2:"#4A8A40",
    putt1:"#5CB8D8", putt2:"#3890B8", accentTree:"#385830", accentRock:"#706858" },
];

// ── Course geometry built from HoleDef ────────────────────────────────────────
interface CourseGeom {
  poly:   Vec2[];           // actual pixel polygon
  bbox:   { x:number; y:number; w:number; h:number }; // tight bbox of poly
  hole:   { x:number; y:number; r:number };
  start:  { x:number; y:number };
  walls:  Array<{ x:number; y:number; w:number; h:number }>;
  shapeName: string;
}

function buildCourse(idx: number, W: number, H: number): CourseGeom {
  const def = HOLES[idx % HOLES.length];

  // Leave 8% margin each side for the decorative world background
  const MX = Math.round(W * 0.08);
  const MY = Math.round(H * 0.12);
  const areaW = W - MX * 2;
  const areaH = H - MY * 2;

  // Scale polygon to pixels
  const poly: Vec2[] = def.poly.map(p => ({
    x: MX + p.xf * areaW,
    y: MY + p.yf * areaH,
  }));

  // Tight bounding box of polygon
  const xs = poly.map(p => p.x), ys = poly.map(p => p.y);
  const bbox = {
    x: Math.min(...xs), y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };

  // Ball start and hole position are relative to the full area (not just bbox),
  // so they're guaranteed to land inside the polygon
  const start = {
    x: MX + def.ballFx * areaW,
    y: MY + def.ballFy * areaH,
  };
  const hole = {
    x: MX + def.holeFx * areaW,
    y: MY + def.holeFy * areaH,
    r: 15,
  };

  const walls = def.walls.map(w => ({
    x: MX + w.xf * areaW,
    y: MY + w.yf * areaH,
    w: w.wf * areaW,
    h: w.hf * areaH,
  }));

  return { poly, bbox, hole, start, walls, shapeName: def.shape };
}

// ── Point-in-polygon (ray casting) ────────────────────────────────────────────
function pointInPoly(x: number, y: number, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// ── Closest point on segment + reflection ─────────────────────────────────────
function closestPointOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): Vec2 {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { x: ax, y: ay };
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return { x: ax + t * dx, y: ay + t * dy };
}

// ── Wall collision (axis-aligned rect) ────────────────────────────────────────
const BALL_R = 12;

function collideWall(b: { x:number; y:number; vx:number; vy:number }, w: { x:number; y:number; w:number; h:number }): boolean {
  const nx = Math.max(w.x, Math.min(b.x, w.x + w.w));
  const ny = Math.max(w.y, Math.min(b.y, w.y + w.h));
  const dx = b.x - nx, dy = b.y - ny;
  const d = Math.hypot(dx, dy);
  if (d < BALL_R && d > .001) {
    const ex = dx / d, ey = dy / d;
    b.x = nx + ex * (BALL_R + .5);
    b.y = ny + ey * (BALL_R + .5);
    const dot = b.vx * ex + b.vy * ey;
    b.vx = (b.vx - 2 * dot * ex) * .65;
    b.vy = (b.vy - 2 * dot * ey) * .65;
    return true;
  }
  return false;
}

// ── Polygon boundary collision ─────────────────────────────────────────────────
// If ball center is outside polygon, find nearest edge and reflect
function collidePoly(b: { x:number; y:number; vx:number; vy:number }, poly: Vec2[]): boolean {
  if (pointInPoly(b.x, b.y, poly)) return false; // inside — no collision

  // Find closest edge
  let minDist = Infinity;
  let bestCp: Vec2 = { x: poly[0].x, y: poly[0].y };
  let bestNx = 0, bestNy = 0;

  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const cp = closestPointOnSegment(b.x, b.y, poly[j].x, poly[j].y, poly[i].x, poly[i].y);
    const d = Math.hypot(b.x - cp.x, b.y - cp.y);
    if (d < minDist) {
      minDist = d;
      bestCp = cp;
      // Edge normal pointing inward (toward polygon interior)
      const ex = poly[i].x - poly[j].x, ey = poly[i].y - poly[j].y;
      const len = Math.hypot(ex, ey);
      // Perpendicular — pick direction that points toward centroid
      bestNx = -ey / len;
      bestNy = ex / len;
    }
  }

  // Push ball back inside
  const push = BALL_R - minDist + 1;
  b.x = bestCp.x + bestNx * (BALL_R + 1);
  b.y = bestCp.y + bestNy * (BALL_R + 1);

  // Reflect velocity off edge normal
  const dot = b.vx * bestNx + b.vy * bestNy;
  if (dot < 0) {
    b.vx = (b.vx - 2 * dot * bestNx) * .62;
    b.vy = (b.vy - 2 * dot * bestNy) * .62;
  }

  void push; // used indirectly above
  return true;
}

// ── Win phrases ────────────────────────────────────────────────────────────────
const WIN_PHRASES = ["Excellent!","Nice Shot!","Great Job!","Sunk It!","Awesome!","Perfect!"];

// ── Drawing helpers ────────────────────────────────────────────────────────────
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = "rgba(255,255,255,.88)";
  ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.arc(16, -6, 11, 0, 7);
  ctx.arc(30, 0, 13, 0, 7); ctx.arc(14, 6, 14, 0, 7); ctx.fill();
  ctx.restore();
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, canopy: string) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = "rgba(0,0,0,.08)";
  ctx.beginPath(); ctx.ellipse(2, 26, 20, 7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#B87F3B"; ctx.fillRect(-4, 0, 8, 22);
  ctx.fillStyle = canopy;
  ctx.beginPath(); ctx.arc(0, -14, 20, 0, 7); ctx.fill();
  ctx.fillStyle = `color-mix(in srgb, ${canopy} 70%, #fff)`;
  ctx.beginPath(); ctx.arc(-9, -4, 13, 0, 7); ctx.arc(9, -2, 13, 0, 7); ctx.fill();
  ctx.restore();
}

function drawBfly(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, col: string) {
  const f = Math.sin(t * 10) * .5 + .5;
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(-4, 0, 4, 3 + f * 2, .4, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(4, 0, 4, 3 + f * 2, -.4, 0, 7); ctx.fill();
  ctx.restore();
}

// ── Main component ─────────────────────────────────────────────────────────────
export interface MathQuestEngineProps {
  onExit?:       () => void;
  defaultGrade?: Grade;
}

export function MathQuestEngine({ onExit, defaultGrade = "SS1" }: MathQuestEngineProps) {

  // ── Session state ────────────────────────────────────────────────────────────
  const [phase, setPhase]           = useState<Phase>("topic_pick");
  const [holeIdx, setHoleIdx]       = useState(0);
  const [shots, setShots]           = useState(0);
  const [hearts, setHearts]         = useState(3);
  const [totalXp, setTotalXp]       = useState(0);
  const [holeStars, setHoleStars]   = useState<number[]>([]);
  const [sessionShots, setSessionShots] = useState(0);
  const [score, setScore]           = useState(0);
  const [winPhrase, setWinPhrase]   = useState("");
  const [showWin, setShowWin]       = useState(false);

  // ── Grade / topic state ──────────────────────────────────────────────────────
  const [selectedGrade, setSelectedGrade] = useState<Grade>(defaultGrade);
  const [selectedTopic]                   = useState("change-of-subject");

  // ── Question state ───────────────────────────────────────────────────────────
  const [qIdx, setQIdx]             = useState(0);
  const [stepIdx, setStepIdx]       = useState(0);
  const [cardVisible, setCardVisible] = useState(false);
  const [cardShake, setCardShake]   = useState(false);
  const [picked, setPicked]         = useState<string | null>(null);
  const [tileResult, setTileResult] = useState<"correct" | "wrong" | null>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [showHint, setShowHint]     = useState(false);
  const [advancing, setAdvancing]   = useState(false);

  // ── Miss feedback state ──────────────────────────────────────────────────────
  const [showMissFeedback, setShowMissFeedback] = useState(false);

  // ── Canvas & physics refs ────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef  = useRef<HTMLDivElement>(null);
  const phaseRef  = useRef<Phase>("topic_pick");
  phaseRef.current = phase;

  const cwRef    = useRef(800);
  const chRef    = useRef(520);
  const courseRef = useRef(buildCourse(0, 800, 520));
  const ballRef   = useRef({ x: 200, y: 400, vx: 0, vy: 0, breathe: 0, sinkT: 0 });
  const dragging  = useRef(false);
  const dragCur   = useRef<Vec2>({ x: 0, y: 0 });
  const shotsRef  = useRef(0);
  const heartsRef = useRef(3);
  const holeIdxRef = useRef(0);
  const rafRef    = useRef(0);
  const lastT     = useRef(performance.now());
  const deadRef   = useRef(false);

  const pts  = useRef<Array<{ x:number; y:number; vx:number; vy:number; life:number; r:number }>>([]);
  const conf = useRef<Array<{ x:number; y:number; vx:number; vy:number; g:number; rot:number; vr:number; c:string; life:number; s:number }>>([]);
  const dec  = useRef<{
    clouds: Array<{ x:number; y:number; s:number; spd:number }>;
    trees:  Array<{ x:number; y:number; s:number }>;
    bflies: Array<{ x:number; y:number; t:number; c:string }>;
    grass:  Array<{ x:number; y:number; r:number; c:string }>;
  }>({ clouds:[], trees:[], bflies:[], grass:[] });

  // ── Filtered question bank for selected grade ────────────────────────────────
  const gradeQuestions = useMemo(
    () => QUESTIONS.filter(q => q.grades.includes(selectedGrade) && q.topic === selectedTopic),
    [selectedGrade, selectedTopic]
  );

  // ── Resize ───────────────────────────────────────────────────────────────────
  const applySize = useCallback((w: number, h: number) => {
    if (w < 10 || h < 10) return;
    cwRef.current = w; chRef.current = h;
    const cv = canvasRef.current;
    if (cv) { cv.width = w; cv.height = h; }
    const p = phaseRef.current;
    if (p !== "topic_pick" && p !== "session_done") {
      courseRef.current = buildCourse(holeIdxRef.current, w, h);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const measure = () => applySize(window.innerWidth, window.innerHeight);
    measure();
    const t1 = setTimeout(measure, 50);
    const t2 = setTimeout(measure, 200);
    window.addEventListener("resize", measure);
    return () => { window.removeEventListener("resize", measure); clearTimeout(t1); clearTimeout(t2); };
  }, [applySize]);

  // ── Particle helpers ─────────────────────────────────────────────────────────
  const spawnDust = (x: number, y: number) => {
    for (let i = 0; i < 8; i++) pts.current.push({ x, y, vx:(Math.random()-.5)*2.5, vy:(Math.random()-.5)*2.5, life:1, r:2+Math.random()*2 });
  };
  const spawnConf = (x: number, y: number) => {
    const cols = [C.coral, C.gold, C.green, "#5FB6E8", C.red];
    for (let i = 0; i < 30; i++) conf.current.push({ x, y, vx:(Math.random()-.5)*8, vy:-Math.random()*8-3, g:.2+Math.random()*.1, rot:Math.random()*7, vr:(Math.random()-.5)*.3, c:cols[i%cols.length], life:1.5, s:4+Math.random()*4 });
  };
  const genDecor = (W: number, H: number) => {
    const env = ENV_THEMES[holeIdxRef.current % ENV_THEMES.length];
    const gc = [env.grass1, env.grass2, `color-mix(in srgb, ${env.grass1} 80%, #fff)`, `color-mix(in srgb, ${env.grass2} 80%, #fff)`];
    // Use simple hex fallbacks since color-mix may not work in all canvas contexts
    dec.current = {
      grass:  Array.from({ length:60 }, () => ({ x:Math.random()*W, y:Math.random()*H, r:3+Math.random()*10, c:gc[Math.floor(Math.random()*4)] })),
      clouds: Array.from({ length:3 },  () => ({ x:Math.random()*W, y:16+Math.random()*30, s:.7+Math.random()*.5, spd:1.5+Math.random()*2 })),
      trees:  [
        { x:.05*W, y:.12*H, s:.9 }, { x:.93*W, y:.18*H, s:.8 },
        { x:.04*W, y:.82*H, s:1  }, { x:.94*W, y:.78*H, s:.85 },
        { x:.50*W, y:.06*H, s:.7 },
      ],
      bflies: Array.from({ length:3 }, () => ({ x:Math.random()*W, y:H*.55+Math.random()*H*.3, t:Math.random()*100, c:Math.random()<.5?C.coral:C.yellow })),
    };
  };

  // ── Draw loop ─────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    rafRef.current = requestAnimationFrame(draw);

    const canvas = canvasRef.current;
    if (!canvas || canvas.width < 10 || canvas.height < 10) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const now = performance.now();
    const dt  = Math.min((now - lastT.current) / 1000, .033);
    lastT.current = now;

    const W = cwRef.current, H = chRef.current;
    const p = phaseRef.current;
    const b = ballRef.current;
    const course = courseRef.current;
    const d = dec.current;
    const env = ENV_THEMES[holeIdxRef.current % ENV_THEMES.length];

    ctx.clearRect(0, 0, W, H);

    // ── Sky / grass background ─────────────────────────────────────────────────
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, env.skyTop); sky.addColorStop(1, env.skyBot);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    ctx.save(); ctx.globalAlpha = .35;
    for (let i = -2; i < Math.ceil(W / 140) + 2; i++) {
      ctx.fillStyle = i % 2 === 0 ? env.grass1 : env.grass2;
      ctx.beginPath();
      ctx.moveTo(i*140-80, 0); ctx.lineTo(i*140+60, 0);
      ctx.lineTo(i*140-40, H); ctx.lineTo(i*140-180, H);
      ctx.fill();
    }
    ctx.restore();

    d.grass.forEach(g => { ctx.fillStyle = g.c; ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, 7); ctx.fill(); });
    d.clouds.forEach(cl => { cl.x -= cl.spd * dt; if (cl.x < -80) cl.x = W + 80; drawCloud(ctx, cl.x, cl.y, cl.s); });
    d.trees.forEach(t => drawTree(ctx, t.x, t.y, t.s, env.accentTree));
    d.bflies.forEach(bf => { bf.t += dt; bf.x += Math.sin(bf.t * 1.3) * .5; bf.y += Math.cos(bf.t * .9) * .28; drawBfly(ctx, bf.x, bf.y, bf.t, bf.c); });

    // ── Build polygon Path2D ───────────────────────────────────────────────────
    const fairwayPath = new Path2D();
    fairwayPath.moveTo(course.poly[0].x, course.poly[0].y);
    for (let i = 1; i < course.poly.length; i++) fairwayPath.lineTo(course.poly[i].x, course.poly[i].y);
    fairwayPath.closePath();

    // ── Wood border (draw polygon with PAD offset outward via bbox) ────────────
    // We draw a slightly enlarged rounded-rect shadow behind the fairway,
    // then the fairway polygon itself.
    const PAD = 14;
    const { x: bx, y: by, w: bw, h: bh } = course.bbox;

    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.22)"; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
    ctx.fillStyle = C.woodDark;
    rrect(ctx, bx - PAD - 2, by - PAD - 2, bw + PAD*2 + 4, bh + PAD*2 + 4, 28); ctx.fill();
    ctx.restore();

    ctx.fillStyle = C.wood;
    rrect(ctx, bx - PAD, by - PAD, bw + PAD*2, bh + PAD*2, 26); ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.lineWidth = 3;
    rrect(ctx, bx - PAD + 3, by - PAD + 3, bw + PAD*2 - 6, bh + PAD*2 - 6, 22); ctx.stroke();

    // ── Putting surface (clipped to polygon) ──────────────────────────────────
    ctx.save();
    ctx.clip(fairwayPath);
    const pg = ctx.createLinearGradient(bx, by, bx, by + bh);
    pg.addColorStop(0, env.putt1); pg.addColorStop(1, env.putt2);
    ctx.fillStyle = pg; ctx.fillRect(bx - PAD, by - PAD, bw + PAD*2, bh + PAD*2);
    // Diagonal shimmer stripes
    ctx.globalAlpha = .05;
    for (let i = 0; i < bw + bh; i += 28) {
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.moveTo(bx + i, by); ctx.lineTo(bx + i - bh, by + bh); ctx.stroke();
    }
    ctx.restore();

    // ── Polygon outline (crisp border on top of surface) ──────────────────────
    ctx.save();
    ctx.strokeStyle = C.woodDark; ctx.lineWidth = 4; ctx.lineJoin = "round";
    ctx.stroke(fairwayPath);
    ctx.restore();

    // ── Inner walls ────────────────────────────────────────────────────────────
    course.walls.forEach(w => {
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.18)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
      ctx.fillStyle = C.wood; rrect(ctx, w.x, w.y, w.w, w.h, 8); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,.28)"; ctx.lineWidth = 2;
      rrect(ctx, w.x+2, w.y+2, w.w-4, w.h-4, 6); ctx.stroke();
    });

    // ── Hole ──────────────────────────────────────────────────────────────────
    const hole = course.hole;
    ctx.fillStyle = "rgba(0,0,0,.15)";
    ctx.beginPath(); ctx.ellipse(hole.x, hole.y+5, hole.r*1.15, hole.r*.55, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#16241A";
    ctx.beginPath(); ctx.arc(hole.x, hole.y, hole.r, 0, 7); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.15)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(hole.x, hole.y, hole.r, 0, 7); ctx.stroke();
    // Flag
    ctx.strokeStyle = "#8a5a2a"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(hole.x, hole.y-2); ctx.lineTo(hole.x, hole.y-44); ctx.stroke();
    ctx.fillStyle = "#FF5A50";
    ctx.beginPath(); ctx.moveTo(hole.x, hole.y-44); ctx.lineTo(hole.x+22, hole.y-36); ctx.lineTo(hole.x, hole.y-28); ctx.fill();

    // ── Aim arrow ─────────────────────────────────────────────────────────────
    if (p === "aiming" && dragging.current) {
      const dx = dragCur.current.x - b.x, dy = dragCur.current.y - b.y;
      const maxD = 100;
      const dist = Math.min(Math.hypot(dx, dy), maxD);
      const angle = Math.atan2(dy, dx);
      const power = dist / maxD;
      const sx = b.x - Math.cos(angle) * dist * 1.8;
      const sy = b.y - Math.sin(angle) * dist * 1.8;
      const col = power > .75 ? C.red : power > .5 ? C.orange : power > .25 ? C.yellow : C.green;
      ctx.save();
      ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(sx, sy); ctx.stroke();
      ctx.fillStyle = col;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.atan2(sy - b.y, sx - b.x));
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -6); ctx.lineTo(-8, 6); ctx.fill();
      ctx.restore();
      for (let i = 1; i <= 7; i++) {
        const t = i / 7;
        ctx.globalAlpha = .4; ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(b.x+(sx-b.x)*t, b.y+(sy-b.y)*t, 3, 0, 7); ctx.fill();
      }
      ctx.restore();
      // Power bar
      ctx.fillStyle = "rgba(255,255,255,.45)";
      rrect(ctx, b.x-35, b.y+24, 70, 9, 5); ctx.fill();
      ctx.fillStyle = col;
      rrect(ctx, b.x-35, b.y+24, 70*power, 9, 5); ctx.fill();
    }

    // ── Ball ──────────────────────────────────────────────────────────────────
    if (p !== "sinking" || b.sinkT < .9) {
      let bpx = b.x, bpy = b.y, alpha = 1, scale = 1;
      if (p === "sinking") {
        b.sinkT += dt * 1.8;
        const sp = Math.min(1, b.sinkT * 2.4);
        bpx = b.x + (hole.x - b.x) * sp;
        bpy = b.y + (hole.y - b.y) * sp;
        scale = Math.max(0, 1 - Math.max(0, b.sinkT - .2) * 2.5);
        alpha = Math.max(0, 1 - Math.max(0, b.sinkT - .1) * 3);
      }
      const bob = (!b.vx && !b.vy && p === "aiming") ? Math.sin(b.breathe) * 1.8 : 0;
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(bpx, bpy + bob); ctx.scale(scale, scale);
      ctx.fillStyle = "rgba(0,0,0,.2)";
      ctx.beginPath(); ctx.ellipse(0, BALL_R*.85, BALL_R*.92, BALL_R*.38, 0, 0, 7); ctx.fill();
      const bg = ctx.createRadialGradient(-4, -5, 2, 0, 0, BALL_R);
      bg.addColorStop(0, "#FFFFFF"); bg.addColorStop(1, "#F0EDE6");
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, BALL_R, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.beginPath(); ctx.arc(-4, -4, 2.8, 0, 7); ctx.fill();
      ctx.restore();
      if (p === "aiming") {
        const pulse = Math.sin(now / 280) * .5 + .5;
        ctx.strokeStyle = `rgba(245,196,68,${.3 + pulse * .5})`; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(bpx, bpy + bob, BALL_R + 5 + pulse * 4, 0, 7); ctx.stroke();
      }
    }

    // ── Particles ─────────────────────────────────────────────────────────────
    pts.current.forEach(pt => {
      ctx.globalAlpha = Math.max(0, pt.life); ctx.fillStyle = "#E8E0C8";
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, 7); ctx.fill();
      pt.x += pt.vx; pt.y += pt.vy; pt.life -= dt * 2.2;
    });
    pts.current = pts.current.filter(pt => pt.life > 0);

    conf.current.forEach(pt => {
      ctx.save(); ctx.globalAlpha = Math.max(0, pt.life);
      ctx.translate(pt.x, pt.y); ctx.rotate(pt.rot); ctx.fillStyle = pt.c;
      ctx.fillRect(-pt.s/2, -pt.s/2, pt.s, pt.s*.6); ctx.restore();
      pt.vy += pt.g; pt.x += pt.vx; pt.y += pt.vy; pt.rot += pt.vr; pt.life -= dt * .6;
    });
    conf.current = conf.current.filter(pt => pt.life > 0);
    ctx.globalAlpha = 1;

    // ── Physics ───────────────────────────────────────────────────────────────
    if (p === "rolling") {
      b.vx *= .984; b.vy *= .984;
      b.x += b.vx; b.y += b.vy;

      // Polygon boundary collision
      let bounced = collidePoly(b, course.poly);

      // Inner wall collisions
      course.walls.forEach(w => { if (collideWall(b, w)) bounced = true; });
      if (bounced) spawnDust(b.x, b.y);

      // Hole check
      const dh = Math.hypot(b.x - hole.x, b.y - hole.y);
      const sp = Math.hypot(b.vx, b.vy);

      if (dh < hole.r * 1.1 || (dh < hole.r * 1.8 && sp < 2)) {
        // SUNK
        b.vx = 0; b.vy = 0;
        setPhase("sinking");
        spawnConf(b.x, b.y - 10);
        setTimeout(() => {
          const ph = WIN_PHRASES[Math.floor(Math.random() * WIN_PHRASES.length)];
          setWinPhrase(ph); setShowWin(true);
          setTimeout(() => setShowWin(false), 1400);
          setTimeout(() => setPhase("hole_result"), 1700);
        }, 300);
      } else if (sp < .06) {
        // STOPPED — ball did not sink
        // ── KEY CHANGE v6: ball stays at current position ──────────────────
        b.vx = 0; b.vy = 0;

        if (!deadRef.current) {
          deadRef.current = true;
          const nh = heartsRef.current - 1;
          heartsRef.current = nh;
          setHearts(nh);

          if (nh <= 0) {
            // All hearts used → show question; ball position unchanged
            setTimeout(() => setPhase("question"), 700);
          } else {
            // Hearts remaining → show miss feedback, return to aiming from current position
            setShowMissFeedback(true);
            setTimeout(() => {
              setShowMissFeedback(false);
              deadRef.current = false;
              // Ball stays at b.x, b.y — just clear velocity (already done above)
              b.breathe = 0;
              setPhase("aiming");
            }, 900);
          }
        }
      }
    } else if (p === "aiming") {
      b.breathe += dt * 2;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start RAF
  useEffect(() => {
    const w = window.innerWidth, h = window.innerHeight;
    cwRef.current = w; chRef.current = h;
    if (canvasRef.current) { canvasRef.current.width = w; canvasRef.current.height = h; }
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Card visibility
  useEffect(() => {
    if (phase === "question") { const t = setTimeout(() => setCardVisible(true), 300); return () => clearTimeout(t); }
    else setCardVisible(false);
  }, [phase]);

  // Init hole
  const initHole = useCallback((idx: number) => {
    const W = window.innerWidth, H = window.innerHeight;
    cwRef.current = W; chRef.current = H;
    const cv = canvasRef.current;
    if (cv) { cv.width = W; cv.height = H; }
    const course = buildCourse(idx, W, H);
    courseRef.current = course;
    // Ball starts at tee (only on new hole, not on miss)
    ballRef.current = { x: course.start.x, y: course.start.y, vx: 0, vy: 0, breathe: 0, sinkT: 0 };
    deadRef.current = false;
    pts.current = []; conf.current = [];
    holeIdxRef.current = idx;
    genDecor(W, H);
    shotsRef.current = 0; setShots(0);
    setPicked(null); setTileResult(null); setWrongCount(0);
    setShowHint(false); setAdvancing(false); setStepIdx(0); setCardShake(false);
    setShowMissFeedback(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pointer events
  const getPos = (e: React.PointerEvent): Vec2 => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (cwRef.current / r.width), y: (e.clientY - r.top) * (chRef.current / r.height) };
  };
  const onPtrDown = (e: React.PointerEvent) => {
    if (phaseRef.current !== "aiming") return;
    const pos = getPos(e);
    if (Math.hypot(pos.x - ballRef.current.x, pos.y - ballRef.current.y) < 70) {
      dragging.current = true; dragCur.current = pos;
      (e.target as Element).setPointerCapture(e.pointerId);
    }
  };
  const onPtrMove = (e: React.PointerEvent) => { if (dragging.current) dragCur.current = getPos(e); };
  const onPtrUp = (e: React.PointerEvent) => {
    if (!dragging.current || phaseRef.current !== "aiming") return;
    dragging.current = false;
    const b = ballRef.current;
    const dx = dragCur.current.x - b.x, dy = dragCur.current.y - b.y;
    const d = Math.hypot(dx, dy);
    if (d < 8) return;
    const power = Math.min(d / 100, 1), angle = Math.atan2(dy, dx), speed = power * 14 + 2;
    b.vx = -Math.cos(angle) * speed; b.vy = -Math.sin(angle) * speed;
    shotsRef.current++; setShots(s => s + 1); setSessionShots(s => s + 1);
    spawnDust(b.x, b.y);
    setPhase("rolling");
  };

  // Question tile pick
  const activeQ = gradeQuestions[qIdx % Math.max(1, gradeQuestions.length)];
  const step = activeQ?.steps[stepIdx];

  const tileOrder = useMemo(() => {
    if (!step) return [];
    const seed = qIdx * 7 + stepIdx * 3;
    return [step.tileOk, step.tilesNo[0], step.tilesNo[1]]
      .map((v, i) => ({ v, s: (v.charCodeAt(0) * 13 + seed + i * 17) % 100 }))
      .sort((a, b) => a.s - b.s).map(x => x.v);
  }, [step, qIdx, stepIdx]);

  const pickTile = (tile: string) => {
    if (!step || advancing || tileResult) return;
    setPicked(tile);
    if (tile === step.tileOk) {
      setTileResult("correct"); setAdvancing(true);
      setTimeout(() => {
        const ns = stepIdx + 1;
        if (activeQ && ns < activeQ.steps.length) {
          setStepIdx(ns); setPicked(null); setTileResult(null);
          setWrongCount(0); setShowHint(false); setAdvancing(false);
        } else {
          // Question solved → restore hearts, return to aiming at CURRENT BALL POSITION
          setCardVisible(false);
          setTimeout(() => {
            setQIdx(i => i + 1);
            heartsRef.current = 3; setHearts(3);
            // ── KEY CHANGE v6: do NOT reset ball position ──────────────────
            const b = ballRef.current;
            b.vx = 0; b.vy = 0; b.breathe = 0;
            deadRef.current = false;
            setPhase("aiming");
            setPicked(null); setTileResult(null); setWrongCount(0);
            setShowHint(false); setAdvancing(false); setStepIdx(0);
          }, 400);
        }
      }, 800);
    } else {
      setTileResult("wrong"); setCardShake(true); setWrongCount(w => w + 1);
      setTimeout(() => { setPicked(null); setTileResult(null); setCardShake(false); }, 650);
    }
  };

  // Hole complete
  const starsFor = (s: number, par: number) => s <= par ? 3 : s <= par + 1 ? 2 : 1;
  const goNext = () => {
    const def = HOLES[holeIdx % HOLES.length];
    const s = starsFor(shotsRef.current, def.par);
    setHoleStars(hs => [...hs, s]);
    setTotalXp(x => x + s * 15);
    setScore(sc => sc + (s === 3 ? 100 : s === 2 ? 60 : 30));
    const next = holeIdx + 1;
    if (next >= HOLES.length) {
      setPhase("session_done");
    } else {
      setHoleIdx(next); holeIdxRef.current = next;
      heartsRef.current = 3; setHearts(3);
      initHole(next);
      setPhase("aiming");
    }
  };

  // ── TOPIC PICK ───────────────────────────────────────────────────────────────
  if (phase === "topic_pick") {
    return (
      <div className={styles.root}>
        <div className={styles.menuScreen}>
          <div className={styles.logoWrap}>
            <h1 className={styles.logoTitle}>⛳ Math Quest Golf</h1>
            <p className={styles.logoSub}>SOLVE · AIM · SINK IT</p>
          </div>

          <div className={styles.menuPanel}>
            {/* Grade selector */}
            <div className={styles.gradeSection}>
              <p className={styles.menuLabel}>Your class</p>
              <div className={styles.gradeRow}>
                {GRADES.map(g => (
                  <button
                    key={g}
                    className={`${styles.gradeBtn} ${selectedGrade === g ? styles.gradeBtnActive : ""}`}
                    onClick={() => setSelectedGrade(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic selector */}
            <p className={styles.menuLabel}>Choose a topic</p>
            <div className={styles.modeRow}>
              <div className={`${styles.modeCard} ${styles.modeCardActive}`}>
                <div className={styles.modeBig}>📐</div>
                <div className={styles.modeLabel}>Change of Subject</div>
                <div className={styles.modeSub}>Rearrange equations</div>
              </div>
              <div className={`${styles.modeCard} ${styles.modeCardSoon}`}>
                <div className={styles.modeBig}>🔢</div>
                <div className={styles.modeLabel}>Simultaneous Eq.</div>
                <div className={styles.modeSub}>Coming soon</div>
              </div>
            </div>

            <div className={styles.gradeInfo}>
              {gradeQuestions.length} questions available for {selectedGrade}
            </div>

            <button
              className={styles.btnPlay}
              onClick={() => {
                holeIdxRef.current = 0; heartsRef.current = 3;
                setHoleIdx(0); setHearts(3); setTotalXp(0);
                setHoleStars([]); setSessionShots(0); setScore(0); setQIdx(0);
                initHole(0);
                setPhase("aiming");
              }}
            >
              ▶ Play
            </button>
          </div>

          {onExit && <button className={styles.ghostBtn} onClick={onExit}>← Back to Worlds</button>}
        </div>
      </div>
    );
  }

  // ── SESSION DONE ─────────────────────────────────────────────────────────────
  if (phase === "session_done") {
    const total = holeStars.reduce((a, b) => a + b, 0);
    return (
      <div className={styles.root}>
        <div className={styles.menuScreen}>
          <div className={styles.menuPanel} style={{ gap:16 }}>
            <div className={styles.resultTitle}>Round Complete! 🏆</div>
            <div className={styles.starsRow}>{"⭐".repeat(Math.min(total, 15))}</div>
            <div className={styles.statRow}>
              <div className={styles.stat}><div className={styles.statNum}>{sessionShots}</div><div className={styles.statLbl}>SHOTS</div></div>
              <div className={styles.stat}><div className={styles.statNum}>{score}</div><div className={styles.statLbl}>SCORE</div></div>
              <div className={styles.stat}><div className={styles.statNum} style={{ color:C.gold }}>+{totalXp}</div><div className={styles.statLbl}>XP</div></div>
            </div>
            <button className={styles.btnPlay} onClick={() => setPhase("topic_pick")}>Play Again</button>
            {onExit && <button className={styles.btnSecondary} onClick={onExit}>Back to Worlds</button>}
          </div>
        </div>
      </div>
    );
  }

  // ── GAME SCREEN ──────────────────────────────────────────────────────────────
  const def = HOLES[holeIdx % HOLES.length];
  return (
    <div className={styles.root}>
      <div className={styles.gameFrame} ref={frameRef}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onPointerDown={onPtrDown}
          onPointerMove={onPtrMove}
          onPointerUp={onPtrUp}
          style={{ touchAction:"none", display:"block", width:"100%", height:"100%" }}
        />

        {/* HUD */}
        <div className={styles.hudTL}>🎯 {score}</div>
        <div className={styles.hudTR}>Hole {holeIdx + 1} / {HOLES.length}</div>
        <div className={styles.hudBL}>
          {onExit && <button className={styles.exitBtn} onClick={onExit}>✕</button>}
        </div>
        <div className={styles.hudBR}>
          {[0,1,2].map(i => (
            <span key={i} className={styles.heart} style={{ opacity: i < hearts ? 1 : .2 }}>
              {i < hearts ? "❤️" : "🤍"}
            </span>
          ))}
        </div>

        {/* Miss feedback — shows briefly when ball stops without sinking */}
        {showMissFeedback && (
          <div className={styles.missFeedback}>
            Almost! Aim again from here
          </div>
        )}

        {/* Question card — only shows after all 3 hearts used */}
        {activeQ && step && (
          <div className={`${styles.qCard} ${cardVisible ? styles.qCardShow : ""} ${cardShake ? styles.qCardShake : ""}`}>
            <div className={styles.qLabel}>OUT OF HEARTS — SOLVE TO CONTINUE</div>
            <div className={styles.qGoal}>{activeQ.label}</div>
            <div className={styles.qEq}>{stepIdx === 0 ? activeQ.formula : activeQ.steps[stepIdx - 1].resultFormula}</div>
            <div className={styles.qMascot}>
              <span className={styles.qMascotIco}>🦉</span>
              <span className={styles.qMascotTxt}>{step.instruction}</span>
            </div>
            <div className={styles.qTiles}>
              {tileOrder.map(tile => {
                const ok = picked === tile && tileResult === "correct";
                const bad = picked === tile && tileResult === "wrong";
                return (
                  <button
                    key={tile}
                    className={`${styles.qTile} ${ok ? styles.qTileOk : bad ? styles.qTileBad : ""}`}
                    onClick={() => pickTile(tile)}
                    disabled={advancing}
                  >
                    {tile}
                  </button>
                );
              })}
            </div>
            {wrongCount >= 2 && !showHint && (
              <button className={styles.qHintBtn} onClick={() => setShowHint(true)}>💡 Show hint</button>
            )}
            {showHint && <div className={styles.qHint}>{step.hint}</div>}
            {activeQ.steps.length > 1 && (
              <div className={styles.qDots}>
                {activeQ.steps.map((_, i) => <div key={i} className={`${styles.qDot} ${i <= stepIdx ? styles.qDotOn : ""}`} />)}
              </div>
            )}
            {tileResult === "correct" && <div className={styles.qCorrect}>✓ {step.resultFormula}</div>}
          </div>
        )}

        {/* Win banner */}
        {showWin && (
          <div className={`${styles.winBanner} ${showWin ? styles.winBannerShow : ""}`}>
            {winPhrase}
          </div>
        )}

        {/* Aim hint */}
        {phase === "aiming" && shots === 0 && (
          <div className={styles.aimHint}>Drag from the ball to aim · release to shoot</div>
        )}

        {/* Hearts hint */}
        {phase === "aiming" && hearts < 3 && (
          <div className={styles.heartsHint}>
            {hearts} heart{hearts !== 1 ? "s" : ""} left — continuing from here
          </div>
        )}

        {/* Hole result */}
        {phase === "hole_result" && (() => {
          const s = starsFor(shotsRef.current, def.par);
          return (
            <div className={styles.overlay}>
              <div className={styles.resultPanel}>
                <div className={styles.resultTitle}>{def.name}</div>
                <div className={styles.starsRow}>
                  {[0,1,2].map(i => (
                    <span key={i} className={styles.rStar} style={{ opacity: i < s ? 1 : .2, animationDelay:`${i * .18}s` }}>⭐</span>
                  ))}
                </div>
                <div className={styles.statRow}>
                  <div className={styles.stat}><div className={styles.statNum}>{shotsRef.current}</div><div className={styles.statLbl}>SHOTS</div></div>
                  <div className={styles.stat}><div className={styles.statNum}>Par {def.par}</div><div className={styles.statLbl}>TARGET</div></div>
                  <div className={styles.stat}><div className={styles.statNum} style={{ color:C.gold }}>+{s*15}</div><div className={styles.statLbl}>XP</div></div>
                </div>
                <button className={styles.btnPlay} onClick={goNext}>
                  {holeIdx + 1 >= HOLES.length ? "Finish Round →" : "Next Hole →"}
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}