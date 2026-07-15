"use client";
/**
 * MathQuestEngine.tsx — Math Quest v9
 *
 * ARCHITECTURE CHANGE (per EXL_Architecture.md):
 *   The game engine now knows nothing about education.
 *   It knows: ball, walls, hole, lives, score. That is it.
 *
 *   When the player runs out of hearts, the engine calls:
 *     props.onNeedHearts(resolve)
 *   The host (page.tsx or a wrapper) shows whatever learning activity
 *   it wants, then calls resolve({ heartsGranted: 3 }).
 *   The game restores hearts and continues from the ball's current position.
 *
 *   Grade/topic selection is also the host's responsibility.
 *   This engine has no questions, no grade state, no topic state.
 *
 * COURSE CHANGE:
 *   5 holes → 10 holes following the design philosophy:
 *   Difficulty comes from shape and obstacle placement, not size.
 *   Every hole fits entirely on screen. No scrolling, no camera.
 *
 *   Level 1  — Straight shot (learn controls)
 *   Level 2  — Single bend / L-shape (learn banking)
 *   Level 3  — Double bend / Z-shape (plan two shots)
 *   Level 4  — Narrow corridor with walls (precision)
 *   Level 5  — Chamber with island obstacle (obstacle angles)
 *   Level 6  — S-shaped path (think ahead)
 *   Level 7  — Split path with island (route choice)
 *   Level 8  — Zigzag corridor (controlled rebounds)
 *   Level 9  — Spiral (shot sequencing)
 *   Level 10 — Combination (everything)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import styles from "./MathQuestEngine.module.css";

if (typeof window !== "undefined" && !document.getElementById("mq-fonts")) {
  const _l = document.createElement("link");
  _l.id = "mq-fonts"; _l.rel = "stylesheet";
  _l.href = "https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito:wght@700;800&display=swap";
  document.head.appendChild(_l);
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface Vec2 { x: number; y: number; }
type Phase = "menu"|"aiming"|"rolling"|"sinking"|"hole_result"|"waiting_hearts"|"session_done";

// ── Public API — the host (page.tsx) provides these ───────────────────────────
export interface HeartRefillResult { heartsGranted: number; xpEarned?: number; }
export interface RoundResult {
  totalShots: number; holeStars: number[];
  score: number; xpEarned: number; holesPlayed: number;
}

export interface MiniGolfEngineProps {
  /** Called when player runs out of hearts. Host shows a learning activity,
   *  then calls resolve() to give hearts back and resume the game. */
  onNeedHearts: (resolve: (result: HeartRefillResult) => void) => void;
  /** Called when all holes are complete. */
  onRoundEnd: (result: RoundResult) => void;
  /** Called when player taps the menu / exit button. */
  onExit?: () => void;
  /** Initial hearts per hole. Default 3. */
  heartsPerHole?: number;
}

// ── Palette ────────────────────────────────────────────────────────────────────
const C = {
  wood:"#D9A15A", woodDark:"#B87F3B",
  gold:"#F5C444", green:"#6FCF63", yellow:"#F2C744",
  orange:"#F2984A", red:"#EE6A5F", coral:"#FF8B6B",
};

// ── Hole definitions ───────────────────────────────────────────────────────────
// Coordinates are normalised 0–1 within the course area.
// The course area itself is sized by buildCourse() to always fit on screen.
// Rule: every hole must be completable in par shots on a straight, accurate shot.
// Difficulty comes from shape, NOT from size.
interface PolyPoint { xf: number; yf: number; }
interface WallDef   { xf: number; yf: number; wf: number; hf: number; }
interface HoleDef {
  name: string; par: number;
  poly: PolyPoint[];
  ballFx: number; ballFy: number;
  holeFx: number; holeFy: number;
  walls: WallDef[];
  bgImage?: string;
  // Aspect ratio hint: "wide" (default), "tall", "square"
  // Used by buildCourse to choose better canvas dimensions for that shape
  aspect?: "wide"|"tall"|"square";
}

const HOLES: HoleDef[] = [
  // ── 1: Straight shot ──────────────────────────────────────────────────────
  // Pure rectangle. Ball left, hole right. One barrier with a gap.
  // Lesson: learn to drag and aim.
  {
    name:"First Drive", par:2, aspect:"wide",
    poly:[{xf:0,yf:0},{xf:1,yf:0},{xf:1,yf:1},{xf:0,yf:1}],
    ballFx:.10, ballFy:.50, holeFx:.90, holeFy:.50,
    walls:[
      {xf:.48, yf:.00, wf:.07, hf:.30},
      {xf:.48, yf:.70, wf:.07, hf:.30},
    ],
  },

  // ── 2: Single bend / L-shape ──────────────────────────────────────────────
  // Ball top-left of left arm, hole bottom-right of right arm.
  // Lesson: ball cannot go straight — must bend.
  {
    name:"The Bend", par:2, aspect:"square",
    poly:[
      {xf:0,   yf:0},
      {xf:.48, yf:0},
      {xf:.48, yf:.52},
      {xf:1,   yf:.52},
      {xf:1,   yf:1},
      {xf:0,   yf:1},
    ],
    ballFx:.18, ballFy:.22, holeFx:.82, holeFy:.80,
    walls:[],
  },

  // ── 3: Double bend / Z-shape ──────────────────────────────────────────────
  // Three rooms in a Z: top-right, connector strip, bottom-left.
  // Lesson: plan two shots ahead.
  {
    name:"Double Turn", par:3, aspect:"square",
    poly:[
      {xf:.34, yf:0  },
      {xf:1,   yf:0  },
      {xf:1,   yf:.42},
      {xf:.60, yf:.42},
      {xf:.60, yf:1  },
      {xf:0,   yf:1  },
      {xf:0,   yf:.58},
      {xf:.40, yf:.58},
    ],
    ballFx:.22, ballFy:.82, holeFx:.75, holeFy:.18,
    walls:[],
  },

  // ── 4: Right-angle dog-leg — L bend with tight entrance ──────────────────
  // Wide horizontal arm (ball enters left) bends 90° down to a narrow vertical arm.
  // Lesson: aim for the corner, not the hole — angle matters.
  {
    name:"Dog-Leg Right", par:2, aspect:"square",
    poly:[
      {xf:0,   yf:0  },
      {xf:1,   yf:0  },
      {xf:1,   yf:.52},
      {xf:.62, yf:.52},
      {xf:.62, yf:1  },
      {xf:.38, yf:1  },
      {xf:.38, yf:.52},
      {xf:0,   yf:.52},
    ],
    ballFx:.12, ballFy:.28, holeFx:.50, holeFy:.84,
    walls:[],
    // NOTE: The T-shape corner is the obstacle. No extra walls needed.
  },

  // ── 5: Chamber with island obstacle ───────────────────────────────────────
  // Square room. Single rectangular obstacle forces player to go around it.
  // Lesson: obstacle changes the shot angle.
  {
    name:"The Chamber", par:2, aspect:"square",
    poly:[{xf:0,yf:0},{xf:1,yf:0},{xf:1,yf:1},{xf:0,yf:1}],
    ballFx:.12, ballFy:.50, holeFx:.88, holeFy:.50,
    walls:[
      // Central island — player must go above or below
      {xf:.35, yf:.30, wf:.30, hf:.40},
    ],
  },

  // ── 6: S-shaped path ──────────────────────────────────────────────────────
  // Classic S-bend. Ball bottom-left, hole top-right.
  // Lesson: think two–three shots ahead.
  {
    name:"Snake Pass", par:3, aspect:"square",
    poly:[
      {xf:.36, yf:0  },
      {xf:1,   yf:0  },
      {xf:1,   yf:.50},
      {xf:.62, yf:.50},
      {xf:.62, yf:1  },
      {xf:0,   yf:1  },
      {xf:0,   yf:.50},
      {xf:.38, yf:.50},
    ],
    ballFx:.20, ballFy:.82, holeFx:.80, holeFy:.18,
    walls:[],
  },

  // ── 7: Split path ─────────────────────────────────────────────────────────
  // Wide rectangle with a long central island creating two channels.
  // Top channel: shorter, tighter. Bottom channel: wider, safer.
  // Lesson: risk vs reward — choose your route.
  {
    name:"Fork Road", par:2, aspect:"wide",
    poly:[{xf:0,yf:0},{xf:1,yf:0},{xf:1,yf:1},{xf:0,yf:1}],
    ballFx:.10, ballFy:.50, holeFx:.90, holeFy:.50,
    walls:[
      // Long central divider — does NOT reach left or right edge
      {xf:.20, yf:.36, wf:.60, hf:.28},
    ],
  },

  // ── 8: Zigzag corridor ────────────────────────────────────────────────────
  // Three-section staircase shape. Must rebound through two 90° bends.
  // Lesson: controlled rebounds.
  {
    name:"Zigzag", par:3, aspect:"square",
    poly:[
      // Top-left room
      {xf:0,   yf:0  },
      {xf:.55, yf:0  },
      {xf:.55, yf:.38},
      // Step right into middle room
      {xf:1,   yf:.38},
      {xf:1,   yf:.68},
      {xf:.45, yf:.68},
      // Step left into bottom room
      {xf:.45, yf:1  },
      {xf:0,   yf:1  },
      {xf:0,   yf:.62},
      // Connector left side of middle
      {xf:.45, yf:.62},
      {xf:.45, yf:.32},
      {xf:0,   yf:.32},
    ],
    ballFx:.22, ballFy:.16, holeFx:.22, holeFy:.84,
    walls:[],
  },

  // ── 9: The Horseshoe ──────────────────────────────────────────────────────
  // U-shaped fairway. Ball starts at one end, hole at the other end of the U.
  // Player must shoot around the curved bottom — cannot go straight.
  // Lesson: play the shape, not the straight line.
  {
    name:"Horseshoe", par:3, aspect:"square",
    poly:[
      // Left arm (top to bottom)
      {xf:0,   yf:0  },
      {xf:.38, yf:0  },
      {xf:.38, yf:.72},
      // Bottom bridge connecting the two arms
      {xf:.62, yf:.72},
      // Right arm (bottom to top)
      {xf:.62, yf:0  },
      {xf:1,   yf:0  },
      {xf:1,   yf:1  },
      {xf:0,   yf:1  },
    ],
    ballFx:.18, ballFy:.18, holeFx:.82, holeFy:.18,
    walls:[
      // Peg inside the bottom curve — forces a precise path through the bridge
      {xf:.40, yf:.80, wf:.20, hf:.12},
    ],
  },

  // ── 10: Combination ───────────────────────────────────────────────────────
  // L-shape with a narrow corridor section and an island in the corner room.
  // Uses everything learned: bend, precision, obstacle angle.
  {
    name:"The Final", par:3, aspect:"square",
    poly:[
      {xf:0,   yf:0  },
      {xf:.52, yf:0  },
      {xf:.52, yf:.48},
      {xf:1,   yf:.48},
      {xf:1,   yf:1  },
      {xf:0,   yf:1  },
    ],
    ballFx:.20, ballFy:.80, holeFx:.42, holeFy:.22,
    walls:[
      // Narrow passage barrier in the left column
      {xf:.10, yf:.55, wf:.32, hf:.14},
      // Small obstacle in the top-left arm
      {xf:.15, yf:.12, wf:.22, hf:.18},
    ],
  },

  // ════════════════════════════════════════════════════════════════
  //  ADVENTURE 3 — THE CANYON  (holes 11–15)
  //  Theme: tight, angled, precision demanded
  // ════════════════════════════════════════════════════════════════

  // ── 11: Narrow Bridge ─────────────────────────────────────────────────────
  // A long thin rectangle — tiny width, long length.
  // Even a small mis-aim misses the entire fairway.
  {
    name:"Narrow Bridge", par:2, aspect:"tall",
    poly:[{xf:0,yf:0},{xf:1,yf:0},{xf:1,yf:1},{xf:0,yf:1}],
    ballFx:.50, ballFy:.92, holeFx:.50, holeFy:.06,
    walls:[],
  },

  // ── 12: Staircase ──────────────────────────────────────────────────────────
  // Three-step staircase — each step slightly offset, forcing a series of banks.
  {
    name:"Staircase", par:3, aspect:"square",
    poly:[
      {xf:0,   yf:0   },
      {xf:.65, yf:0   },
      {xf:.65, yf:.35 },
      {xf:1,   yf:.35 },
      {xf:1,   yf:1   },
      {xf:.35, yf:1   },
      {xf:.35, yf:.65 },
      {xf:0,   yf:.65 },
    ],
    ballFx:.18, ballFy:.48, holeFx:.78, holeFy:.72,
    walls:[],
  },

  // ── 13: The Cross ──────────────────────────────────────────────────────────
  // Plus/cross shape — four arms meeting at the centre.
  // Ball enters from bottom arm, hole is in the top arm.
  {
    name:"The Cross", par:2, aspect:"square",
    poly:[
      {xf:.35, yf:0   },
      {xf:.65, yf:0   },
      {xf:.65, yf:.35 },
      {xf:1,   yf:.35 },
      {xf:1,   yf:.65 },
      {xf:.65, yf:.65 },
      {xf:.65, yf:1   },
      {xf:.35, yf:1   },
      {xf:.35, yf:.65 },
      {xf:0,   yf:.65 },
      {xf:0,   yf:.35 },
      {xf:.35, yf:.35 },
    ],
    ballFx:.50, ballFy:.88, holeFx:.50, holeFy:.12,
    walls:[],
  },

  // ── 14: The Bottleneck ─────────────────────────────────────────────────────
  // Wide room → pinched narrow channel → wide room.
  // Must thread through the pinch precisely.
  {
    name:"Bottleneck", par:2, aspect:"wide",
    poly:[{xf:0,yf:0},{xf:1,yf:0},{xf:1,yf:1},{xf:0,yf:1}],
    ballFx:.08, ballFy:.50, holeFx:.92, holeFy:.50,
    walls:[
      {xf:.36, yf:.00, wf:.28, hf:.38},
      {xf:.36, yf:.62, wf:.28, hf:.38},
    ],
  },

  // ── 15: Diagonal Canyon ────────────────────────────────────────────────────
  // A diagonal corridor — neither horizontal nor vertical.
  // Forces an angled shot from the start.
  {
    name:"Diagonal Run", par:2, aspect:"square",
    poly:[
      {xf:0,   yf:.25 },
      {xf:.25, yf:0   },
      {xf:1,   yf:.50 },
      {xf:.75, yf:1   },
      {xf:0,   yf:.60 },
    ],
    ballFx:.12, ballFy:.44, holeFx:.82, holeFy:.55,
    walls:[],
  },

  // ════════════════════════════════════════════════════════════════
  //  ADVENTURE 4 — THE ARCHIPELAGO  (holes 16–20)
  //  Theme: multiple obstacles, islands, routes
  // ════════════════════════════════════════════════════════════════

  // ── 16: Twin Islands ───────────────────────────────────────────────────────
  // Wide rectangle with two large islands — three narrow channels.
  {
    name:"Twin Islands", par:2, aspect:"wide",
    poly:[{xf:0,yf:0},{xf:1,yf:0},{xf:1,yf:1},{xf:0,yf:1}],
    ballFx:.06, ballFy:.50, holeFx:.94, holeFy:.50,
    walls:[
      {xf:.22, yf:.08, wf:.22, hf:.42},
      {xf:.22, yf:.58, wf:.22, hf:.34},
      {xf:.56, yf:.08, wf:.22, hf:.34},
      {xf:.56, yf:.50, wf:.22, hf:.42},
    ],
  },

  // ── 17: The Maze ───────────────────────────────────────────────────────────
  // Open rectangle with an H-barrier system — two exits, one leads to the hole.
  {
    name:"The Maze", par:3, aspect:"square",
    poly:[{xf:0,yf:0},{xf:1,yf:0},{xf:1,yf:1},{xf:0,yf:1}],
    ballFx:.10, ballFy:.50, holeFx:.90, holeFy:.50,
    walls:[
      {xf:.30, yf:.00, wf:.14, hf:.60},
      {xf:.56, yf:.40, wf:.14, hf:.60},
    ],
  },

  // ── 18: Boomerang ─────────────────────────────────────────────────────────
  // Wide U with the opening on the right side — must curve around the top.
  {
    name:"Boomerang", par:3, aspect:"square",
    poly:[
      {xf:0,  yf:0  },
      {xf:.60,yf:0  },
      {xf:.60,yf:.38},
      {xf:.40,yf:.38},
      {xf:.40,yf:.62},
      {xf:.60,yf:.62},
      {xf:.60,yf:1  },
      {xf:0,  yf:1  },
    ],
    ballFx:.20, ballFy:.82, holeFx:.20, holeFy:.18,
    walls:[],
  },

  // ── 19: The Arena ─────────────────────────────────────────────────────────
  // Large square with 4 corner pillars — 8 paths, hole dead centre.
  {
    name:"The Arena", par:2, aspect:"square",
    poly:[{xf:0,yf:0},{xf:1,yf:0},{xf:1,yf:1},{xf:0,yf:1}],
    ballFx:.50, ballFy:.10, holeFx:.50, holeFy:.50,
    walls:[
      {xf:.00, yf:.00, wf:.28, hf:.28},
      {xf:.72, yf:.00, wf:.28, hf:.28},
      {xf:.00, yf:.72, wf:.28, hf:.28},
      {xf:.72, yf:.72, wf:.28, hf:.28},
    ],
  },

  // ── 20: Switchback ────────────────────────────────────────────────────────
  // Four-section zigzag — like stairs but tighter alternating.
  {
    name:"Switchback", par:4, aspect:"square",
    poly:[
      {xf:0,   yf:0  },
      {xf:.50, yf:0  },
      {xf:.50, yf:.28},
      {xf:1,   yf:.28},
      {xf:1,   yf:.58},
      {xf:.50, yf:.58},
      {xf:.50, yf:.82},
      {xf:1,   yf:.82},
      {xf:1,   yf:1  },
      {xf:0,   yf:1  },
      {xf:0,   yf:.72},
      {xf:.50, yf:.72},
      {xf:.50, yf:.42},
      {xf:0,   yf:.42},
    ],
    ballFx:.22, ballFy:.14, holeFx:.78, holeFy:.92,
    walls:[],
  },

  // ════════════════════════════════════════════════════════════════
  //  ADVENTURE 5 — THE CHAMPIONSHIP  (holes 21–25)
  //  Theme: expert-level, everything combined
  // ════════════════════════════════════════════════════════════════

  // ── 21: The Snake King ────────────────────────────────────────────────────
  // Triple S-bend — three corridors chained.
  {
    name:"Snake King", par:4, aspect:"square",
    poly:[
      {xf:.36, yf:0  },
      {xf:1,   yf:0  },
      {xf:1,   yf:.36},
      {xf:.64, yf:.36},
      {xf:.64, yf:.64},
      {xf:1,   yf:.64},
      {xf:1,   yf:1  },
      {xf:0,   yf:1  },
      {xf:0,   yf:.64},
      {xf:.36, yf:.64},
      {xf:.36, yf:.36},
      {xf:0,   yf:.36},
    ],
    ballFx:.18, ballFy:.18, holeFx:.82, holeFy:.82,
    walls:[],
  },

  // ── 22: The Gauntlet ──────────────────────────────────────────────────────
  // Long narrow with 4 staggered barriers — like a slalom.
  {
    name:"The Gauntlet", par:3, aspect:"tall",
    poly:[{xf:0,yf:0},{xf:1,yf:0},{xf:1,yf:1},{xf:0,yf:1}],
    ballFx:.50, ballFy:.94, holeFx:.50, holeFy:.06,
    walls:[
      {xf:.00, yf:.18, wf:.55, hf:.10},
      {xf:.45, yf:.36, wf:.55, hf:.10},
      {xf:.00, yf:.54, wf:.55, hf:.10},
      {xf:.45, yf:.72, wf:.55, hf:.10},
    ],
  },

  // ── 23: Pinball ───────────────────────────────────────────────────────────
  // Wide square with a pinball-style grid of obstacles.
  {
    name:"Pinball", par:3, aspect:"square",
    poly:[{xf:0,yf:0},{xf:1,yf:0},{xf:1,yf:1},{xf:0,yf:1}],
    ballFx:.10, ballFy:.50, holeFx:.90, holeFy:.50,
    walls:[
      {xf:.28, yf:.15, wf:.12, hf:.25},
      {xf:.60, yf:.15, wf:.12, hf:.25},
      {xf:.28, yf:.60, wf:.12, hf:.25},
      {xf:.60, yf:.60, wf:.12, hf:.25},
      {xf:.42, yf:.38, wf:.16, hf:.24},
    ],
  },

  // ── 24: The Spiral King ───────────────────────────────────────────────────
  // Tighter inward spiral — three concentric rings, ball starts outside.
  {
    name:"Spiral King", par:4, aspect:"square",
    poly:[{xf:0,yf:0},{xf:1,yf:0},{xf:1,yf:1},{xf:0,yf:1}],
    ballFx:.10, ballFy:.50, holeFx:.50, holeFy:.50,
    walls:[
      // Outer ring: top wall (gap right)
      {xf:.15, yf:.15, wf:.70, hf:.10},
      // Outer ring: right wall (gap bottom)
      {xf:.75, yf:.15, wf:.10, hf:.50},
      // Outer ring: bottom wall (gap left)
      {xf:.25, yf:.75, wf:.50, hf:.10},
      // Inner ring: left wall (gap top)
      {xf:.25, yf:.35, wf:.10, hf:.40},
      // Inner ring: top wall (gap right)
      {xf:.35, yf:.35, wf:.30, hf:.10},
      // Inner ring: right wall (gap bottom — leads to centre)
      {xf:.55, yf:.35, wf:.10, hf:.20},
    ],
  },

  // ── 25: The Final Boss ────────────────────────────────────────────────────
  // Everything: cross + diagonal strips + island. No forgiving shapes.
  {
    name:"Final Boss", par:4, aspect:"square",
    poly:[
      {xf:.30, yf:0   },
      {xf:.70, yf:0   },
      {xf:.70, yf:.30 },
      {xf:1,   yf:.30 },
      {xf:1,   yf:.70 },
      {xf:.70, yf:.70 },
      {xf:.70, yf:1   },
      {xf:.30, yf:1   },
      {xf:.30, yf:.70 },
      {xf:0,   yf:.70 },
      {xf:0,   yf:.30 },
      {xf:.30, yf:.30 },
    ],
    ballFx:.50, ballFy:.88, holeFx:.50, holeFy:.12,
    walls:[
      {xf:.38, yf:.38, wf:.24, hf:.24},
    ],
  },
];

// ── Adventures: 5 adventures × 5 holes = 25 holes total ─────────────────────
interface AdventureDef {
  id: string;
  name: string;
  subtitle: string;
  emoji: string;
  accentColor: string;     // card accent colour
  accentDark: string;      // darker shade for gradient
  difficulty: "Beginner"|"Easy"|"Medium"|"Hard"|"Expert";
  holeRange: [number, number]; // inclusive indices into HOLES[]
}

const ADVENTURES: AdventureDef[] = [
  {
    id:"meadow", name:"The Meadow", subtitle:"Learn the fundamentals",
    emoji:"🌿", accentColor:"#5FB94A", accentDark:"#2E7A22",
    difficulty:"Beginner", holeRange:[0, 4],
  },
  {
    id:"forest", name:"The Forest", subtitle:"Find your rhythm",
    emoji:"🌲", accentColor:"#3A8A6A", accentDark:"#1A5A40",
    difficulty:"Easy", holeRange:[5, 9],
  },
  {
    id:"canyon", name:"The Canyon", subtitle:"Precision under pressure",
    emoji:"🏔️", accentColor:"#C87840", accentDark:"#8A4820",
    difficulty:"Medium", holeRange:[10, 14],
  },
  {
    id:"archipelago", name:"The Archipelago", subtitle:"Navigate the islands",
    emoji:"🏝️", accentColor:"#2A90C8", accentDark:"#1A5A88",
    difficulty:"Hard", holeRange:[15, 19],
  },
  {
    id:"championship", name:"Championship", subtitle:"Only the best survive",
    emoji:"🏆", accentColor:"#C89820", accentDark:"#8A6010",
    difficulty:"Expert", holeRange:[20, 24],
  },
];

function getAdventure(holeIdx: number): number {
  return ADVENTURES.findIndex(a => holeIdx >= a.holeRange[0] && holeIdx <= a.holeRange[1]);
}

// Legacy getRound alias
function getRound(holeIdx: number): number { return getAdventure(holeIdx); }
const ROUNDS = ADVENTURES; // legacy alias

// ── Per-hole environment themes ────────────────────────────────────────────────
interface EnvTheme {
  skyTop:string; skyBot:string; grass1:string; grass2:string;
  putt1:string;  putt2:string;  tree1:string;  tree2:string;
}
const ENV: EnvTheme[] = [
  { skyTop:"#C8ECFF", skyBot:"#E4F8FF", grass1:"#7FC76B", grass2:"#6FB85D", putt1:"#6EC3EC", putt2:"#4EA0D0", tree1:"#5AA84A", tree2:"#E8A0C0" },
  { skyTop:"#FFF0CC", skyBot:"#FFE8A0", grass1:"#A8C86A", grass2:"#93B455", putt1:"#7FCFAA", putt2:"#5AB890", tree1:"#C8A840", tree2:"#A8C870" },
  { skyTop:"#D4EEFF", skyBot:"#C0DCFF", grass1:"#68B85C", grass2:"#58A04E", putt1:"#88D0F0", putt2:"#60B4DC", tree1:"#408038", tree2:"#D0A0D0" },
  { skyTop:"#E8F4FF", skyBot:"#D0E8F8", grass1:"#85C470", grass2:"#74B060", putt1:"#A0D8C8", putt2:"#78C0B0", tree1:"#507850", tree2:"#C890C0" },
  { skyTop:"#DDEEFF", skyBot:"#C8E0F0", grass1:"#5A9E50", grass2:"#4A8A40", putt1:"#5CB8D8", putt2:"#3890B8", tree1:"#385830", tree2:"#B07040" },
  { skyTop:"#FFE8CC", skyBot:"#FFD0A0", grass1:"#C8A840", grass2:"#B09030", putt1:"#D0B060", putt2:"#B09040", tree1:"#A07820", tree2:"#E8C060" },
  { skyTop:"#E0F0FF", skyBot:"#C8E0F8", grass1:"#70B060", grass2:"#60A050", putt1:"#78C0A8", putt2:"#58A890", tree1:"#406030", tree2:"#C8A0B0" },
  { skyTop:"#F0E8FF", skyBot:"#E0D0F8", grass1:"#8A9E5A", grass2:"#7A8E4A", putt1:"#A090D0", putt2:"#8070B8", tree1:"#506840", tree2:"#D0A0C0" },
  { skyTop:"#C8FFE8", skyBot:"#A0F0D0", grass1:"#5AB88A", grass2:"#48A078", putt1:"#60D0A8", putt2:"#40B888", tree1:"#306850", tree2:"#A0E8C0" },
  { skyTop:"#FFD0D0", skyBot:"#FFB8B8", grass1:"#A8584A", grass2:"#984840", putt1:"#C07868", putt2:"#A05848", tree1:"#783828", tree2:"#E09080" },
];

// ── Course geometry ────────────────────────────────────────────────────────────
interface CourseGeom {
  poly:  Vec2[];
  bbox:  { x:number; y:number; w:number; h:number };
  hole:  { x:number; y:number; r:number };
  start: { x:number; y:number };
  walls: Array<{ x:number; y:number; w:number; h:number }>;
}

function buildCourse(idx:number, W:number, H:number): CourseGeom {
  const def = HOLES[idx % HOLES.length];

  // ── SIZING PHILOSOPHY ─────────────────────────────────────────────────────
  // Bars: top 80px (header) + bottom 72px (controls) = 152px reserved.
  // The remaining "game zone" gets the course.
  //
  // KEY MOBILE INSIGHT:
  // Portrait phones (W < H × 0.65) have a tall, narrow game zone.
  // "wide" aspect holes (ball left → hole right) would be tiny on a 390px
  // wide phone. So on portrait mobile we SWAP width and height for "wide"
  // holes — the course runs top-to-bottom instead of left-to-right.
  // Ball and hole positions are also swapped (ballFy↔holeFy for "portrait").
  // "square" holes work fine as-is — the side is limited by width not height.

  const TOP_BAR = 80;
  const BOT_BAR = 72;
  const zoneH   = H - TOP_BAR - BOT_BAR;
  const zoneW   = W;

  // Portrait phone if the game zone is taller than it is wide
  const isPortrait = zoneH > zoneW * 1.1;

  const aspect = def.aspect ?? "wide";
  let courseW: number, courseH: number;
  // Whether this hole should be rotated 90° on portrait (wide→tall)
  const rotateOnPortrait = isPortrait && aspect === "wide";

  if (aspect === "square") {
    // Square: constrained by whichever dimension is smaller
    const side = Math.round(Math.min(zoneW * 0.84, zoneH * 0.78));
    courseW = side; courseH = side;
  } else if (aspect === "tall" || rotateOnPortrait) {
    // Tall: use the height, constrain width
    courseW = Math.round(Math.min(zoneW * 0.80, zoneH * 0.55));
    courseH = Math.round(zoneH * 0.80);
  } else {
    // Wide (landscape/desktop): use the width, constrain height
    courseW = Math.round(zoneW * 0.82);
    courseH = Math.round(Math.min(zoneH * 0.62, courseW * 0.38));
  }

  // Centre the course in the game zone
  const originX = Math.round((zoneW - courseW) / 2);
  const originY = Math.round(TOP_BAR + (zoneH - courseH) / 2);

  // For rotated "wide" holes on portrait: swap xf/yf and flip the axis
  // so the hole runs top-to-bottom using the long axis of the phone.
  const transformPt = (xf: number, yf: number) => {
    if (!rotateOnPortrait) return { x: originX + xf * courseW, y: originY + yf * courseH };
    // Rotate 90° clockwise: new_x = yf, new_y = 1 - xf
    return { x: originX + yf * courseW, y: originY + (1 - xf) * courseH };
  };

  const poly: Vec2[] = def.poly.map(p => transformPt(p.xf, p.yf));

  const xs = poly.map(p => p.x), ys = poly.map(p => p.y);
  const bbox = {
    x: Math.min(...xs), y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };

  const holePos  = transformPt(def.holeFx, def.holeFy);
  const startPos = transformPt(def.ballFx, def.ballFy);

  // Walls don't rotate — they are always axis-aligned rectangles.
  // On portrait rotation we approximate rotated walls by swapping axes.
  const walls = def.walls.map(w => {
    if (!rotateOnPortrait) {
      return { x: originX + w.xf * courseW, y: originY + w.yf * courseH, w: w.wf * courseW, h: w.hf * courseH };
    }
    // Rotate wall rect: new origin is top-left after 90° CW rotation
    const rx = originX + w.yf * courseW;
    const ry = originY + (1 - w.xf - w.wf) * courseH;
    return { x: rx, y: ry, w: w.hf * courseW, h: w.wf * courseH };
  });

  return { poly, bbox, hole: { ...holePos, r: 13 }, start: startPos, walls };
}

// ── Physics ────────────────────────────────────────────────────────────────────
const BALL_R = 10;

function pointInPoly(x:number, y:number, poly:Vec2[]) {
  let inside = false;
  for (let i=0, j=poly.length-1; i<poly.length; j=i++) {
    const xi=poly[i].x, yi=poly[i].y, xj=poly[j].x, yj=poly[j].y;
    if (((yi>y)!==(yj>y)) && (x<(xj-xi)*(y-yi)/(yj-yi)+xi)) inside=!inside;
  }
  return inside;
}
function closestPt(px:number, py:number, ax:number, ay:number, bx:number, by:number): Vec2 {
  const dx=bx-ax, dy=by-ay, len2=dx*dx+dy*dy;
  if (!len2) return {x:ax, y:ay};
  const t=Math.max(0, Math.min(1, ((px-ax)*dx+(py-ay)*dy)/len2));
  return {x:ax+t*dx, y:ay+t*dy};
}
function collidePoly(b:{x:number;y:number;vx:number;vy:number}, poly:Vec2[]) {
  if (pointInPoly(b.x, b.y, poly)) return false;
  let minD=Infinity, cp={x:poly[0].x, y:poly[0].y}, nx=0, ny=0;
  for (let i=0, j=poly.length-1; i<poly.length; j=i++) {
    const c=closestPt(b.x,b.y,poly[j].x,poly[j].y,poly[i].x,poly[i].y);
    const d=Math.hypot(b.x-c.x, b.y-c.y);
    if (d<minD) {
      minD=d; cp=c;
      const ex=poly[i].x-poly[j].x, ey=poly[i].y-poly[j].y, l=Math.hypot(ex,ey);
      nx=-ey/l; ny=ex/l;
    }
  }
  b.x=cp.x+nx*(BALL_R+1); b.y=cp.y+ny*(BALL_R+1);
  const dot=b.vx*nx+b.vy*ny;
  if (dot<0) { b.vx=(b.vx-2*dot*nx)*.62; b.vy=(b.vy-2*dot*ny)*.62; }
  return true;
}
function collideWall(b:{x:number;y:number;vx:number;vy:number}, w:{x:number;y:number;w:number;h:number}) {
  const nx=Math.max(w.x,Math.min(b.x,w.x+w.w)), ny=Math.max(w.y,Math.min(b.y,w.y+w.h));
  const dx=b.x-nx, dy=b.y-ny, d=Math.hypot(dx,dy);
  if (d<BALL_R && d>.001) {
    const ex=dx/d, ey=dy/d;
    b.x=nx+ex*(BALL_R+.5); b.y=ny+ey*(BALL_R+.5);
    const dot=b.vx*ex+b.vy*ey;
    b.vx=(b.vx-2*dot*ex)*.65; b.vy=(b.vy-2*dot*ey)*.65;
    return true;
  }
  return false;
}

// ── Drawing helpers ────────────────────────────────────────────────────────────
function rrect(ctx:CanvasRenderingContext2D, x:number, y:number, w:number, h:number, r:number) {
  ctx.beginPath();
  ctx.moveTo(x+r, y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}

function drawIsoTree(ctx:CanvasRenderingContext2D, cx:number, cy:number, sz:number, c1:string, c2:string) {
  ctx.fillStyle="rgba(0,0,0,.10)";
  ctx.beginPath(); ctx.ellipse(cx+2, cy+sz*.55, sz*.38, sz*.14, 0, 0, 7); ctx.fill();
  ctx.fillStyle="#7A4A28"; ctx.fillRect(cx-sz*.10, cy+sz*.22, sz*.20, sz*.34);
  ctx.fillStyle="#5A3010"; ctx.fillRect(cx+sz*.04, cy+sz*.22, sz*.06, sz*.34);
  const blk=(x:number, y:number, s:number, top:string) => {
    ctx.fillStyle=top; rrect(ctx,x-s*.5,y-s*.5,s,s,s*.12); ctx.fill();
    ctx.fillStyle="rgba(0,0,0,.12)"; ctx.fillRect(x+s*.28,y-s*.3,s*.22,s*.36);
    ctx.fillStyle="rgba(255,255,255,.25)"; ctx.fillRect(x-s*.38,y-s*.38,s*.18,s*.18);
  };
  blk(cx-sz*.22, cy+sz*.02, sz*.52, c2);
  blk(cx+sz*.22, cy+sz*.02, sz*.52, c2);
  blk(cx,        cy-sz*.20, sz*.60, c1);
}
function drawRock(ctx:CanvasRenderingContext2D, x:number, y:number, sz:number) {
  ctx.fillStyle="rgba(0,0,0,.10)";
  ctx.beginPath(); ctx.ellipse(x+1,y+sz*.38,sz*.36,sz*.14,0,0,7); ctx.fill();
  ctx.fillStyle="#90989A"; rrect(ctx,x-sz*.28,y-sz*.22,sz*.56,sz*.48,sz*.12); ctx.fill();
  ctx.fillStyle="#A8B0B2"; rrect(ctx,x-sz*.22,y-sz*.18,sz*.30,sz*.24,sz*.08); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.20)"; ctx.fillRect(x-sz*.16,y-sz*.14,sz*.10,sz*.10);
}
function drawFlower(ctx:CanvasRenderingContext2D, x:number, y:number, sz:number, col:string) {
  ctx.fillStyle="#6B9E4A";
  for (let i=-1; i<=1; i++) {
    ctx.beginPath(); ctx.moveTo(x+i*sz*.18,y); ctx.lineTo(x+i*sz*.18-sz*.04,y-sz*.28);
    ctx.lineTo(x+i*sz*.18+sz*.04,y-sz*.28); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,y-sz*.28,sz*.10,0,7); ctx.fill();
}
function drawCloud(ctx:CanvasRenderingContext2D, x:number, y:number, s:number) {
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  ctx.fillStyle="rgba(255,255,255,.90)";
  ctx.beginPath(); ctx.arc(0,0,14,0,7); ctx.arc(18,-7,11,0,7);
  ctx.arc(32,0,13,0,7); ctx.arc(16,7,14,0,7); ctx.fill();
  ctx.restore();
}

const WIN_PHRASES = ["Excellent!","Nice Shot!","Great Job!","Sunk It!","Awesome!","Perfect!"];

// -- Auto-advance helper
function HoleAutoAdvance({ onAdvance, delay }: { onAdvance: () => void; delay: number }) {
  useEffect(() => {
    const t = setTimeout(onAdvance, delay);
    return () => clearTimeout(t);
  }, [onAdvance, delay]);
  return null;
}

// ── Decoration ────────────────────────────────────────────────────────────────
interface Decor {
  clouds:  {x:number;y:number;s:number;spd:number}[];
  trees:   {x:number;y:number;sz:number;c1:string;c2:string}[];
  rocks:   {x:number;y:number;sz:number}[];
  flowers: {x:number;y:number;sz:number;col:string}[];
}
const bgImageCache = new Map<string, HTMLImageElement>();

// ── Adventure SVG Art ──────────────────────────────────────────────────────────
function AdventureArt({ id, accent, locked }: { id: string; accent: string; locked: boolean }) {
  const arts: Record<string, React.ReactNode> = {
    meadow: (
      <svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%"}}>
        <defs><linearGradient id="sky-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C8ECFF"/><stop offset="1" stopColor="#E4F8FF"/></linearGradient></defs>
        <rect width="120" height="80" fill="url(#sky-m)"/>
        <ellipse cx="90" cy="14" rx="14" ry="7" fill="rgba(255,255,255,.9)"/>
        <ellipse cx="80" cy="16" rx="10" ry="6" fill="rgba(255,255,255,.9)"/>
        <rect y="54" width="120" height="26" fill="#7FC76B"/>
        <rect y="58" width="120" height="22" fill="#6FB85D"/>
        <ellipse cx="20" cy="58" rx="28" ry="10" fill="#85CF73"/>
        <ellipse cx="100" cy="56" rx="32" ry="12" fill="#85CF73"/>
        <rect x="10" y="32" width="5" height="18" fill="#7A4A28"/>
        <circle cx="12" cy="28" r="12" fill="#5AA84A"/><circle cx="8" cy="32" r="9" fill="#4A9840"/>
        <rect x="85" y="28" width="5" height="22" fill="#7A4A28"/>
        <circle cx="87" cy="24" r="13" fill="#5AA84A"/><circle cx="82" cy="28" r="10" fill="#4A9840"/>
        <line x1="58" y1="20" x2="58" y2="56" stroke="#8a5a2a" strokeWidth="2"/>
        <polygon points="58,20 78,28 58,36" fill="#FF5A50"/>
        <circle cx="32" cy="53" r="5" fill="#fff" stroke="#ddd" strokeWidth="1"/>
      </svg>
    ),
    forest: (
      <svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%"}}>
        <rect width="120" height="80" fill="#1E4A30"/>
        <rect y="58" width="120" height="22" fill="#3A6A30"/>
        <rect x="10" y="12" width="5" height="46" fill="#5A3010"/>
        <polygon points="12,6 -2,40 26,40" fill="#2E6A30"/>
        <polygon points="12,18 -1,44 25,44" fill="#3A8A3A"/>
        <rect x="55" y="8" width="5" height="50" fill="#5A3010"/>
        <polygon points="57,2 42,36 72,36" fill="#2E6A30"/>
        <polygon points="57,14 44,40 70,40" fill="#3A8A3A"/>
        <rect x="100" y="15" width="5" height="43" fill="#5A3010"/>
        <polygon points="102,9 88,38 116,38" fill="#2E6A30"/>
        <polygon points="102,21 90,42 114,42" fill="#3A8A3A"/>
        <path d="M10 72 Q40 62 60 66 Q80 70 110 62" stroke="#78B268" strokeWidth="5" fill="none" strokeLinecap="round"/>
        <line x1="75" y1="38" x2="75" y2="62" stroke="#C8A040" strokeWidth="2"/>
        <polygon points="75,38 92,44 75,50" fill="#FF5A50"/>
      </svg>
    ),
    canyon: (
      <svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%"}}>
        <rect width="120" height="80" fill="#FFD0A0"/>
        <polygon points="0,0 0,80 42,80 42,38 22,28 0,0" fill="#C87840"/>
        <polygon points="120,0 120,80 78,80 78,38 98,28 120,0" fill="#C87840"/>
        <line x1="0" y1="22" x2="40" y2="50" stroke="#B06830" strokeWidth="2" opacity=".6"/>
        <line x1="0" y1="36" x2="40" y2="58" stroke="#A05828" strokeWidth="1.5" opacity=".5"/>
        <line x1="120" y1="22" x2="80" y2="50" stroke="#B06830" strokeWidth="2" opacity=".6"/>
        <line x1="120" y1="36" x2="80" y2="58" stroke="#A05828" strokeWidth="1.5" opacity=".5"/>
        <rect x="38" y="56" width="44" height="24" fill="#D4A870"/>
        <rect x="50" y="42" width="20" height="38" fill="#E0B880"/>
        <line x1="60" y1="28" x2="60" y2="54" stroke="#8a5a2a" strokeWidth="2"/>
        <polygon points="60,28 76,34 60,40" fill="#FF5A50"/>
        <circle cx="60" cy="65" r="4" fill="#fff" stroke="#ddd" strokeWidth="1"/>
      </svg>
    ),
    archipelago: (
      <svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%"}}>
        <rect width="120" height="80" fill="#2A90C8"/>
        <ellipse cx="28" cy="54" rx="22" ry="14" fill="#F5C85A"/>
        <ellipse cx="28" cy="50" rx="18" ry="10" fill="#7FC76B"/>
        <ellipse cx="90" cy="50" rx="20" ry="12" fill="#F5C85A"/>
        <ellipse cx="90" cy="46" rx="16" ry="8" fill="#7FC76B"/>
        <ellipse cx="58" cy="62" rx="14" ry="8" fill="#F5C85A"/>
        <ellipse cx="58" cy="59" rx="11" ry="6" fill="#7FC76B"/>
        <line x1="28" y1="50" x2="28" y2="28" stroke="#8a5a2a" strokeWidth="3"/>
        <ellipse cx="20" cy="26" rx="10" ry="5" fill="#5AA84A" transform="rotate(-20 20 26)"/>
        <ellipse cx="36" cy="24" rx="10" ry="5" fill="#5AA84A" transform="rotate(20 36 24)"/>
        <line x1="90" y1="46" x2="90" y2="24" stroke="#8a5a2a" strokeWidth="2"/>
        <polygon points="90,24 106,30 90,36" fill="#FF5A50"/>
        <path d="M0 72 Q30 68 60 72 Q90 76 120 72" stroke="rgba(255,255,255,.35)" strokeWidth="2" fill="none"/>
        <path d="M0 65 Q30 61 60 65 Q90 69 120 65" stroke="rgba(255,255,255,.2)" strokeWidth="2" fill="none"/>
      </svg>
    ),
    championship: (
      <svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%"}}>
        <defs><linearGradient id="sky-ch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1A1A2E"/><stop offset="1" stopColor="#2A2A50"/></linearGradient></defs>
        <rect width="120" height="80" fill="url(#sky-ch)"/>
        {([10,8,30,15,55,5,75,12,95,8,110,18,20,22,45,18,85,20,105,6] as number[]).reduce((acc: number[][], v, i, arr) => i%2===0 ? [...acc, [v, arr[i+1]]] : acc, []).map(([x,y],i)=>(
          <circle key={i} cx={x} cy={y} r={1+i%2} fill="#FFD700" opacity=".8"/>
        ))}
        <rect x="53" y="46" width="14" height="4" fill="#C89820"/>
        <rect x="50" y="50" width="20" height="4" fill="#C89820"/>
        <path d="M50,20 L50,46 Q60,52 70,46 L70,20 Z" fill="#F5C444"/>
        <path d="M44,24 Q40,30 42,38 Q46,44 50,44 L50,24 Z" fill="#E8B83A"/>
        <path d="M76,24 Q80,30 78,38 Q74,44 70,44 L70,24 Z" fill="#E8B83A"/>
        <rect y="64" width="120" height="16" fill="#1A3A1A"/>
        <rect y="58" width="120" height="8" fill="#2A5A2A"/>
        <line x1="90" y1="38" x2="90" y2="60" stroke="#C89820" strokeWidth="2"/>
        <polygon points="90,38 106,44 90,50" fill="#FF5A50"/>
      </svg>
    ),
  };
  const art = arts[id] ?? arts.meadow;
  return <div style={{width:"100%",height:"100%",opacity:locked?.45:1}}>{art}</div>;
}

// ── Component ──────────────────────────────────────────────────────────────────
export function MiniGolfEngine({
  onNeedHearts, onRoundEnd, onExit, heartsPerHole = 3,
}: MiniGolfEngineProps) {

  const [phase, setPhase]         = useState<Phase>("menu");
  const [holeIdx, setHoleIdx]     = useState(0);
  const [shots, setShots]         = useState(0);
  const [hearts, setHearts]       = useState(heartsPerHole);
  const [holeStars, setHoleStars] = useState<number[]>([]);
  const [sessionShots, setSessionShots] = useState(0);
  const [score, setScore]         = useState(0);
  const [totalXp, setTotalXp]     = useState(0);
  const [winPhrase, setWinPhrase] = useState("");
  const [showWin, setShowWin]     = useState(false);
  const [showMiss, setShowMiss]        = useState(false);
  const [adventureStars, setAdventureStars] = useState<Record<string,number[]>>(() => {
    try { return JSON.parse(localStorage.getItem("golf_adventureStars_v1") ?? "{}"); } catch { return {}; }
  }); // adventure id → hole stars, persisted
  const [activeAdventure, setActiveAdventure] = useState<AdventureDef|null>(null);
  const [menuOpen, setMenuOpen]   = useState(false);  // in-game pause menu
  const [swinging, setSwinging]  = useState(false);   // golf club swing animation

  // Canvas & physics refs
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const phaseRef   = useRef<Phase>("menu");
  phaseRef.current = phase;
  const cwRef      = useRef(800);
  const chRef      = useRef(520);
  const courseRef  = useRef(buildCourse(0, 800, 520));
  const ballRef    = useRef({x:200, y:300, vx:0, vy:0, breathe:0, sinkT:0});
  const dragging   = useRef(false);
  const swingRef      = useRef(false);   // tracks swing animation for draw loop
  const swingTRef     = useRef(0);       // swing start timestamp
  const swingOriginRef = useRef({x:0, y:0, angle:0}); // FROZEN club position at shot moment
  const dragCur    = useRef<Vec2>({x:0, y:0});
  const shotsRef   = useRef(0);
  const heartsRef  = useRef(heartsPerHole);
  const holeIdxRef = useRef(0);
  const rafRef     = useRef(0);
  const lastT      = useRef(performance.now());
  const deadRef    = useRef(false);
  const bgImgRef   = useRef<HTMLImageElement|null>(null);

  const pts  = useRef<{x:number;y:number;vx:number;vy:number;life:number;r:number}[]>([]);
  const conf = useRef<{x:number;y:number;vx:number;vy:number;g:number;rot:number;vr:number;c:string;life:number;s:number}[]>([]);
  const decRef = useRef<Decor>({clouds:[],trees:[],rocks:[],flowers:[]});

  // ── Canvas sizing via ResizeObserver ─────────────────────────────────────────
  const sizeCanvas = useCallback((w:number, h:number) => {
    if (w<10||h<10) return;
    cwRef.current=w; chRef.current=h;
    const cv=canvasRef.current; if (cv) { cv.width=w; cv.height=h; }
    const p=phaseRef.current;
    if (p!=="menu" && p!=="session_done") {
      const course=buildCourse(holeIdxRef.current, w, h);
      courseRef.current=course;
      // Reposition ball to its last-known normalised position.
      // This prevents the ball "disappearing" when the canvas is resized:
      // the old pixel coordinates are no longer valid after resize.
      // We snap back to the course start only if the ball is in aiming phase
      // (mid-flight balls finish their trajectory first, then land somewhere
      // that will be corrected by boundary collision on the next frame).
      if (p==="aiming") {
        const b=ballRef.current;
        // If ball is way outside the new course bounds, snap to start
        if (!pointInPoly(b.x, b.y, course.poly)) {
          b.x=course.start.x; b.y=course.start.y; b.vx=0; b.vy=0;
        }
      }
    }
  }, []);

  // Persist adventure progress whenever it changes
  useEffect(() => {
    try { localStorage.setItem("golf_adventureStars_v1", JSON.stringify(adventureStars)); } catch {}
  }, [adventureStars]);

  useEffect(() => {
    const cv=canvasRef.current; if (!cv) return;
    const measure=() => {
      const r=cv.getBoundingClientRect();
      sizeCanvas(Math.round(r.width)||window.innerWidth, Math.round(r.height)||window.innerHeight);
    };
    measure();
    const ro=new ResizeObserver(measure); ro.observe(cv);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [phase, sizeCanvas]);

  // ── Particles ────────────────────────────────────────────────────────────────
  const spawnDust=(x:number, y:number)=>{
    for(let i=0;i<8;i++) pts.current.push({x,y,vx:(Math.random()-.5)*2.5,vy:(Math.random()-.5)*2.5,life:1,r:2+Math.random()*2});
  };
  const spawnConf=(x:number, y:number)=>{
    const cols=[C.coral,C.gold,C.green,"#5FB6E8",C.red];
    for(let i=0;i<32;i++) conf.current.push({x,y,vx:(Math.random()-.5)*9,vy:-Math.random()*9-2,g:.2+Math.random()*.1,rot:Math.random()*7,vr:(Math.random()-.5)*.3,c:cols[i%cols.length],life:1.5,s:4+Math.random()*5});
  };

  const genDecor=(W:number, H:number)=>{
    const env=ENV[holeIdxRef.current%ENV.length];
    const course=courseRef.current;
    const pad=50;
    const outside=(x:number,y:number)=>!(x>course.bbox.x-pad&&x<course.bbox.x+course.bbox.w+pad&&y>course.bbox.y-pad&&y<course.bbox.y+course.bbox.h+pad);
    const rand=():{ x:number;y:number }=>{
      for(let i=0;i<30;i++){const x=30+Math.random()*(W-60),y=30+Math.random()*(H-60);if(outside(x,y))return{x,y};}
      return{x:20,y:20};
    };
    const fc=["#FF9FE0","#FFD96A","#FF7B9C","#A8E6CF"];
    decRef.current={
      clouds:[{x:W*.15,y:30,s:.8,spd:1.8},{x:W*.55,y:22,s:1,spd:2.1},{x:W*.82,y:36,s:.7,spd:1.5}],
      trees:  Array.from({length:8}, ()=>{const p=rand();return{...p,sz:26+Math.random()*18,c1:env.tree1,c2:env.tree2};}),
      rocks:  Array.from({length:5}, ()=>{const p=rand();return{...p,sz:13+Math.random()*9};}),
      flowers:Array.from({length:14},()=>{const p=rand();return{...p,sz:7+Math.random()*5,col:fc[Math.floor(Math.random()*4)]};}),
    };
  };

  const loadBgImage=(idx:number)=>{
    const url=HOLES[idx%HOLES.length].bgImage;
    if(!url){bgImgRef.current=null;return;}
    if(bgImageCache.has(url)){bgImgRef.current=bgImageCache.get(url)!;return;}
    const img=new Image(); img.onload=()=>{bgImageCache.set(url,img);bgImgRef.current=img;}; img.src=url;
  };

  // ── Draw loop ─────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    rafRef.current=requestAnimationFrame(draw);
    const canvas=canvasRef.current; if (!canvas) return;
    if (canvas.width<10) {
      const r=canvas.getBoundingClientRect();
      if (r.width>10){canvas.width=Math.round(r.width);canvas.height=Math.round(r.height);cwRef.current=canvas.width;chRef.current=canvas.height;}
      else return;
    }
    const ctx=canvas.getContext("2d"); if (!ctx) return;
    const now=performance.now(), dt=Math.min((now-lastT.current)/1000, .033);
    lastT.current=now;

    const W=cwRef.current, H=chRef.current;
    const p=phaseRef.current;
    const b=ballRef.current;
    const course=courseRef.current;
    const d=decRef.current;
    const env=ENV[holeIdxRef.current%ENV.length];

    ctx.clearRect(0,0,W,H);

    // ── Background ────────────────────────────────────────────────────────────
    if (bgImgRef.current) {
      const img=bgImgRef.current, scale=Math.max(W/img.width,H/img.height);
      const iw=img.width*scale, ih=img.height*scale;
      ctx.drawImage(img,(W-iw)/2,(H-ih)/2,iw,ih);
    } else {
      const sky=ctx.createLinearGradient(0,0,0,H);
      sky.addColorStop(0,env.skyTop); sky.addColorStop(1,env.skyBot);
      ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
      ctx.save(); ctx.globalAlpha=.20;
      for(let i=-2;i<Math.ceil(W/110)+2;i++){
        ctx.fillStyle=i%2===0?env.grass1:env.grass2;
        ctx.beginPath();ctx.moveTo(i*110-50,0);ctx.lineTo(i*110+60,0);ctx.lineTo(i*110-20,H);ctx.lineTo(i*110-130,H);ctx.fill();
      }
      ctx.restore();
      d.clouds.forEach(cl=>{cl.x-=cl.spd*dt;if(cl.x<-80)cl.x=W+80;drawCloud(ctx,cl.x,cl.y,cl.s);});
      d.flowers.forEach(f=>drawFlower(ctx,f.x,f.y,f.sz,f.col));
      d.rocks.forEach(r=>drawRock(ctx,r.x,r.y,r.sz));
      d.trees.forEach(t=>drawIsoTree(ctx,t.x,t.y,t.sz,t.c1,t.c2));
    }

    // ── Fairway ───────────────────────────────────────────────────────────────
    // Build the polygon path (the actual playable shape)
    const fp=new Path2D();
    fp.moveTo(course.poly[0].x, course.poly[0].y);
    for(let i=1;i<course.poly.length;i++) fp.lineTo(course.poly[i].x, course.poly[i].y);
    fp.closePath();

    // Build an EXPANDED polygon path for the wood border.
    // We expand each vertex outward by PAD pixels along its normal.
    // This means the wood border exactly traces the fairway shape —
    // no dead brown corners for L/S/Z shaped holes.
    const PAD=18;
    const expandPoly=(pts:Vec2[],pad:number):Path2D=>{
      const n=pts.length;
      const path=new Path2D();
      for(let i=0;i<n;i++){
        const prev=pts[(i+n-1)%n], curr=pts[i], next=pts[(i+1)%n];
        // Edge normals (outward) for the two edges meeting at this vertex
        const e1x=curr.x-prev.x,e1y=curr.y-prev.y,l1=Math.hypot(e1x,e1y)||1;
        const e2x=next.x-curr.x,e2y=next.y-curr.y,l2=Math.hypot(e2x,e2y)||1;
        const n1x=e1y/l1,n1y=-e1x/l1;
        const n2x=e2y/l2,n2y=-e2x/l2;
        // Bisector normal
        let bx=n1x+n2x,by=n1y+n2y;
        const bl=Math.hypot(bx,by)||1;
        bx/=bl;by/=bl;
        // Scale by pad / cos(half-angle) to keep consistent border width
        const dot=n1x*n2x+n1y*n2y;
        const scale=pad/Math.max(Math.sqrt((1+dot)/2),.25);
        const ex=curr.x+bx*scale,ey=curr.y+by*scale;
        i===0?path.moveTo(ex,ey):path.lineTo(ex,ey);
      }
      path.closePath();
      return path;
    };

    const woodPath=expandPoly(course.poly,PAD);

    // Shadow under the wood frame
    ctx.save();
    ctx.shadowColor="rgba(0,0,0,.30)";ctx.shadowBlur=20;ctx.shadowOffsetY=10;
    ctx.fillStyle=C.woodDark;ctx.fill(woodPath);
    ctx.restore();

    // Wood frame (slightly smaller than shadow path)
    const woodPathInner=expandPoly(course.poly,PAD-1);
    ctx.fillStyle=C.wood;ctx.fill(woodPathInner);

    // Wood highlight
    ctx.save();
    ctx.strokeStyle="rgba(255,255,255,.28)";ctx.lineWidth=3;ctx.lineJoin="round";
    ctx.stroke(expandPoly(course.poly,PAD-4));
    ctx.restore();

    // Putting surface — clipped to the polygon shape
    const{x:bx,y:by,w:bw,h:bh}=course.bbox;
    ctx.save();ctx.clip(fp);
    const pg=ctx.createLinearGradient(bx,by,bx,by+bh);
    pg.addColorStop(0,env.putt1);pg.addColorStop(1,env.putt2);
    ctx.fillStyle=pg;ctx.fillRect(bx-PAD,by-PAD,bw+PAD*2,bh+PAD*2);
    // Diagonal shimmer stripes
    ctx.globalAlpha=.045;
    for(let i=0;i<bw+bh;i+=28){ctx.strokeStyle="#fff";ctx.lineWidth=14;ctx.beginPath();ctx.moveTo(bx+i,by);ctx.lineTo(bx+i-bh,by+bh);ctx.stroke();}
    ctx.restore();

    // Crisp polygon outline on top
    ctx.strokeStyle=C.woodDark;ctx.lineWidth=4;ctx.lineJoin="round";ctx.stroke(fp);

    course.walls.forEach(w=>{
      ctx.save();ctx.shadowColor="rgba(0,0,0,.18)";ctx.shadowBlur=8;ctx.shadowOffsetY=4;
      ctx.fillStyle=C.wood;rrect(ctx,w.x,w.y,w.w,w.h,8);ctx.fill();ctx.restore();
      ctx.strokeStyle="rgba(255,255,255,.28)";ctx.lineWidth=2;rrect(ctx,w.x+2,w.y+2,w.w-4,w.h-4,6);ctx.stroke();
    });

    // ── Hole & flag ───────────────────────────────────────────────────────────
    const hole=course.hole;
    ctx.fillStyle="rgba(0,0,0,.15)";
    ctx.beginPath();ctx.ellipse(hole.x,hole.y+4,hole.r*1.1,hole.r*.5,0,0,7);ctx.fill();
    ctx.fillStyle="#16241A";ctx.beginPath();ctx.arc(hole.x,hole.y,hole.r,0,7);ctx.fill();
    ctx.strokeStyle="rgba(255,255,255,.15)";ctx.lineWidth=2;ctx.beginPath();ctx.arc(hole.x,hole.y,hole.r,0,7);ctx.stroke();
    ctx.strokeStyle="#8a5a2a";ctx.lineWidth=2.5;
    ctx.beginPath();ctx.moveTo(hole.x,hole.y-2);ctx.lineTo(hole.x,hole.y-46);ctx.stroke();
    ctx.fillStyle="#FF5A50";
    ctx.beginPath();ctx.moveTo(hole.x,hole.y-46);ctx.lineTo(hole.x+22,hole.y-38);ctx.lineTo(hole.x,hole.y-30);ctx.fill();

    // ── Aim arrow & power bar ────────────────────────────────────────────────
    if (p==="aiming" && dragging.current) {
      const dx=dragCur.current.x-b.x, dy=dragCur.current.y-b.y;
      const maxD=100, dist=Math.min(Math.hypot(dx,dy),maxD);
      const angle=Math.atan2(dy,dx), power=dist/maxD;
      const sx=b.x-Math.cos(angle)*dist*1.8, sy=b.y-Math.sin(angle)*dist*1.8;
      const col=power>.75?C.red:power>.5?C.orange:power>.25?C.yellow:C.green;
      ctx.save();
      ctx.strokeStyle=col;ctx.lineWidth=5;ctx.lineCap="round";
      ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(sx,sy);ctx.stroke();
      ctx.fillStyle=col;ctx.save();ctx.translate(sx,sy);ctx.rotate(Math.atan2(sy-b.y,sx-b.x));
      ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-8,-6);ctx.lineTo(-8,6);ctx.fill();ctx.restore();
      for(let i=1;i<=7;i++){const t=i/7;ctx.globalAlpha=.38;ctx.fillStyle=col;ctx.beginPath();ctx.arc(b.x+(sx-b.x)*t,b.y+(sy-b.y)*t,3,0,7);ctx.fill();}
      ctx.restore();
      ctx.fillStyle="rgba(255,255,255,.45)";rrect(ctx,b.x-35,b.y+22,70,9,5);ctx.fill();
      ctx.fillStyle=col;rrect(ctx,b.x-35,b.y+22,70*power,9,5);ctx.fill();
    }



    // ── Ball ──────────────────────────────────────────────────────────────────
    if (p!=="sinking" || b.sinkT<.9) {
      let bpx=b.x, bpy=b.y, alpha=1, scale=1;
      if (p==="sinking") {
        b.sinkT+=dt*1.8;
        const sp=Math.min(1,b.sinkT*2.4);
        bpx=b.x+(hole.x-b.x)*sp; bpy=b.y+(hole.y-b.y)*sp;
        scale=Math.max(0,1-Math.max(0,b.sinkT-.2)*2.5);
        alpha=Math.max(0,1-Math.max(0,b.sinkT-.1)*3);
      }
      const bob=(!b.vx&&!b.vy&&p==="aiming")?Math.sin(b.breathe)*1.8:0;
      ctx.save();ctx.globalAlpha=alpha;ctx.translate(bpx,bpy+bob);ctx.scale(scale,scale);
      ctx.fillStyle="rgba(0,0,0,.18)";ctx.beginPath();ctx.ellipse(0,BALL_R*.8,BALL_R*.88,BALL_R*.36,0,0,7);ctx.fill();
      const bg=ctx.createRadialGradient(-3,-4,2,0,0,BALL_R);
      bg.addColorStop(0,"#FFFFFF");bg.addColorStop(1,"#EEE8DC");
      ctx.fillStyle=bg;ctx.beginPath();ctx.arc(0,0,BALL_R,0,7);ctx.fill();
      ctx.fillStyle="rgba(255,255,255,.88)";ctx.beginPath();ctx.arc(-3,-3,2.5,0,7);ctx.fill();
      ctx.restore();
      if (p==="aiming") {
        const pulse=Math.sin(now/280)*.5+.5;
        ctx.strokeStyle=`rgba(245,196,68,${.3+pulse*.5})`;ctx.lineWidth=2.5;
        ctx.beginPath();ctx.arc(bpx,bpy+bob,BALL_R+5+pulse*4,0,7);ctx.stroke();
      }
    }

    // ── Particles ────────────────────────────────────────────────────────────
    pts.current.forEach(pt=>{ctx.globalAlpha=Math.max(0,pt.life);ctx.fillStyle="#E8E0C8";ctx.beginPath();ctx.arc(pt.x,pt.y,pt.r,0,7);ctx.fill();pt.x+=pt.vx;pt.y+=pt.vy;pt.life-=dt*2.2;});
    pts.current=pts.current.filter(pt=>pt.life>0);
    conf.current.forEach(pt=>{ctx.save();ctx.globalAlpha=Math.max(0,pt.life);ctx.translate(pt.x,pt.y);ctx.rotate(pt.rot);ctx.fillStyle=pt.c;ctx.fillRect(-pt.s/2,-pt.s/2,pt.s,pt.s*.6);ctx.restore();pt.vy+=pt.g;pt.x+=pt.vx;pt.y+=pt.vy;pt.rot+=pt.vr;pt.life-=dt*.6;});
    conf.current=conf.current.filter(pt=>pt.life>0);
    ctx.globalAlpha=1;

    // ── Physics ───────────────────────────────────────────────────────────────
    if (p==="rolling") {
      b.vx*=.984; b.vy*=.984; b.x+=b.vx; b.y+=b.vy;
      let bounced=collidePoly(b, course.poly);
      course.walls.forEach(w=>{ if(collideWall(b,w)) bounced=true; });
      if (bounced) spawnDust(b.x, b.y);

      const dh=Math.hypot(b.x-hole.x, b.y-hole.y), sp=Math.hypot(b.vx, b.vy);
      if (dh<hole.r*1.1 || (dh<hole.r*1.8 && sp<2)) {
        // SUNK
        b.vx=0; b.vy=0; setPhase("sinking"); spawnConf(b.x, b.y-10);
        setTimeout(()=>{
          setWinPhrase(WIN_PHRASES[Math.floor(Math.random()*WIN_PHRASES.length)]);
          setShowWin(true);
          setTimeout(()=>setShowWin(false), 1200);
          // Seamless: auto-advance after brief result flash
          setTimeout(()=>setPhase("hole_result"), 1400);
        }, 200);
      } else if (sp<.06) {
        // STOPPED without sinking
        b.vx=0; b.vy=0;
        if (!deadRef.current) {
          deadRef.current=true;
          const nh=heartsRef.current-1; heartsRef.current=nh; setHearts(nh);
          if (nh<=0) {
            // No hearts left — ask host for more
            setPhase("waiting_hearts");
            {
              onNeedHearts((result)=>{
                // Host resolved: restore hearts, resume aiming from current position
                const h=result.heartsGranted; heartsRef.current=h; setHearts(h);
                if (result.xpEarned) setTotalXp(x=>x+(result.xpEarned??0));
                b.vx=0; b.vy=0; b.breathe=0; deadRef.current=false;
                setPhase("aiming");
              });
            }
          } else {
            // Hearts remaining — show miss feedback, continue from here
            setShowMiss(true);
            setTimeout(()=>{ setShowMiss(false); deadRef.current=false; b.breathe=0; setPhase("aiming"); }, 500);
          }
        }
      }
    } else if (p==="aiming") {
      b.breathe+=dt*2;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start RAF once — ResizeObserver handles all canvas sizing
  useEffect(()=>{
    rafRef.current=requestAnimationFrame(draw);
    return()=>cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initHole=useCallback((idx:number)=>{
    const cv=canvasRef.current;
    let W=cwRef.current, H=chRef.current;
    if (cv) {
      const r=cv.getBoundingClientRect();
      if (r.width>10){ W=Math.round(r.width); H=Math.round(r.height); }
      cwRef.current=W; chRef.current=H; cv.width=W; cv.height=H;
    }
    const course=buildCourse(idx,W,H); courseRef.current=course;
    ballRef.current={x:course.start.x,y:course.start.y,vx:0,vy:0,breathe:0,sinkT:0};
    deadRef.current=false; pts.current=[]; conf.current=[]; holeIdxRef.current=idx;
    loadBgImage(idx); genDecor(W,H);
    shotsRef.current=0; setShots(0); setShowMiss(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pointer events
  const getPos=(e:React.PointerEvent):Vec2=>{
    const r=canvasRef.current!.getBoundingClientRect();
    return{x:(e.clientX-r.left)*(cwRef.current/r.width),y:(e.clientY-r.top)*(chRef.current/r.height)};
  };
  const onPtrDown=(e:React.PointerEvent)=>{
    if (phaseRef.current!=="aiming") return;
    const pos=getPos(e);
    if (Math.hypot(pos.x-ballRef.current.x,pos.y-ballRef.current.y)<70) {
      dragging.current=true; dragCur.current=pos;
      (e.target as Element).setPointerCapture(e.pointerId);
    }
  };
  const onPtrMove=(e:React.PointerEvent)=>{ if(dragging.current) dragCur.current=getPos(e); };
  const onPtrUp=(e:React.PointerEvent)=>{
    if (!dragging.current||phaseRef.current!=="aiming") return;
    dragging.current=false; const b=ballRef.current;
    const dx=dragCur.current.x-b.x, dy=dragCur.current.y-b.y, d=Math.hypot(dx,dy);
    if (d<8) return;
    const power=Math.min(d/100,1), angle=Math.atan2(dy,dx), speed=power*14+2;
    b.vx=-Math.cos(angle)*speed; b.vy=-Math.sin(angle)*speed;
    shotsRef.current++; setShots(s=>s+1); setSessionShots(s=>s+1);
    spawnDust(b.x, b.y);
    // Freeze club position at the moment of the shot, then animate
    const _shotAngle = Math.atan2(-dy, -dx); // direction of shot (ball travels -dx,-dy)
    const _CLUB_BEHIND = 90;
    swingOriginRef.current = {
      x: b.x - Math.cos(_shotAngle) * _CLUB_BEHIND,
      y: b.y - Math.sin(_shotAngle) * _CLUB_BEHIND,
      angle: _shotAngle,
    };
    swingRef.current=true; swingTRef.current=performance.now();
    setSwinging(true);
    setTimeout(()=>{ setSwinging(false); swingRef.current=false; }, 500);
    setPhase("rolling");
  };

  // Game flow
  const starsFor=(s:number,par:number)=>s<=par?3:s<=par+1?2:1;
  const startGame=(adventure?: AdventureDef)=>{
    const adv = adventure ?? activeAdventure ?? ADVENTURES[0];
    setActiveAdventure(adv);
    const startHole = adv.holeRange[0];
    holeIdxRef.current=startHole; heartsRef.current=heartsPerHole;
    setHoleIdx(startHole); setHearts(heartsPerHole); setHoleStars([]);
    setSessionShots(0); setScore(0); setTotalXp(0);
    initHole(startHole); setPhase("aiming");
  };
  const goNext=()=>{
    const def=HOLES[holeIdx%HOLES.length];
    const s=starsFor(shotsRef.current, def.par);
    const xp=s*15;
    const newStars=[...holeStars, s];
    const newScore=score+(s===3?100:s===2?60:30);
    const newXp=totalXp+xp;
    setHoleStars(newStars); setTotalXp(newXp); setScore(newScore);

    const next=holeIdx+1;
    const adv = activeAdventure ?? ADVENTURES[0];
    const adventureDone = next > adv.holeRange[1];

    if (adventureDone) {
      // Save stars for this adventure
      setAdventureStars(prev => ({...prev, [adv.id]: newStars}));
      holeIdxRef.current = next <= adv.holeRange[1] ? next : adv.holeRange[1]+1;
      setPhase("session_done");
      onRoundEnd({totalShots:sessionShots+shotsRef.current, holeStars:newStars, score:newScore, xpEarned:newXp, holesPlayed:newStars.length});
    } else {
      setHoleIdx(next); holeIdxRef.current=next;
      // +1 heart for completing a hole (not full refill)
      const newH = Math.min(heartsPerHole, heartsRef.current + 1);
      heartsRef.current=newH; setHearts(newH);
      initHole(next); setPhase("aiming");
    }
  };

  const startNextRound=()=>{
    const next=holeIdxRef.current;
    setHoleIdx(next);
    heartsRef.current=heartsPerHole; setHearts(heartsPerHole);
    initHole(next); setPhase("aiming");
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const isMenu=phase==="menu";
  const isDone=phase==="session_done";
  const isGame=!isMenu&&!isDone;
  const def=HOLES[holeIdx%HOLES.length];
  const total=holeStars.reduce((a,b)=>a+b,0);

  return (
    <div className={styles.root}>

      {/* Canvas — always in DOM so ResizeObserver always has something to watch */}
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onPointerDown={onPtrDown}
        onPointerMove={onPtrMove}
        onPointerUp={onPtrUp}
        style={{touchAction:"none"}}
      />

      {/* ── GAME HUD ─────────────────────────────────────────────────────────── */}
      {isGame && (
        <>
          {/* ── TOP BAR: ☰ Menu (left) · ❤️❤️❤️ Hearts (centre) · Score (right) ── */}
          <div className={styles.topBar}>
            {/* Left: hamburger menu button */}
            <button className={styles.topMenuBtn} onClick={()=>setMenuOpen(o=>!o)}>
              <span>{menuOpen?"✕":"☰"}</span>
            </button>

            {/* Centre: hearts */}
            <div className={styles.topBarHearts}>
              {Array.from({length:heartsPerHole},(_,i)=>(
                <span key={i} className={`${styles.heartIcon}${i<hearts?" "+styles.heartIconActive:""}`}>
                  {i<hearts?"❤️":"🤍"}
                </span>
              ))}
            </div>

            {/* Right: score */}
            <div className={styles.topBarScore}>
              <span className={styles.topBarScoreNum}>{score}</span>
              <span className={styles.topBarScoreLbl}>SCORE</span>
            </div>
          </div>

          {/* ── IN-GAME PAUSE MENU dropdown ─────────────────────────────────── */}
          {menuOpen && (
            <div className={styles.pauseMenu}>
              <div className={styles.pauseMenuTitle}>
                Hole {holeIdx+1}/{HOLES.length} · {def.name}
              </div>
              <div className={styles.pauseMenuStats}>
                <span>Shots: {shots}</span>
                <span>Par: {def.par}</span>
                <span>Score: {score}</span>
              </div>
              <button className={styles.pauseMenuBtn} onClick={()=>{
                setMenuOpen(false);
                // Restart current hole
                heartsRef.current=heartsPerHole; setHearts(heartsPerHole);
                initHole(holeIdx); setPhase("aiming");
              }}>🔄 Restart Hole</button>
              <button className={styles.pauseMenuBtn} onClick={()=>{
                setMenuOpen(false); setPhase("menu");
              }}>🏠 Main Menu</button>
              {onExit && <button className={`${styles.pauseMenuBtn} ${styles.pauseMenuBtnExit}`} onClick={()=>{
                setMenuOpen(false); onExit();
              }}>✕ Exit Game</button>}
              <button className={styles.pauseMenuClose} onClick={()=>setMenuOpen(false)}>
                Continue Playing →
              </button>
            </div>
          )}

          {/* ── BOTTOM INFO BAR ─────────────────────────────────────────────── */}
          <div className={styles.bottomBar}>
            <div className={styles.bottomBarHole}>
              <span className={styles.bottomHoleNum}>Hole {holeIdx+1}</span>
              <span className={styles.bottomHoleName}>{def.name}</span>
            </div>
            <div className={styles.bottomBarCentre}>
              {phase==="aiming"&&shots===0&&<span className={styles.aimHintInline}>Drag ball to aim</span>}
              {phase==="aiming"&&hearts<heartsPerHole&&shots>0&&<span className={styles.heartsHintInline}>{hearts} heart{hearts!==1?"s":""} left</span>}
              {phase==="waiting_hearts"&&<span className={styles.heartsHintInline}>Solving for hearts…</span>}
            </div>
            <div className={styles.bottomBarShots}>
              <div className={styles.bottomShotsChip}>
                <span className={styles.bottomShotsNum}>{shots}</span>
                <span className={styles.bottomShotsLbl}>SHOTS</span>
              </div>
              <div className={styles.bottomParChip}>
                <span className={styles.bottomParNum}>{def.par}</span>
                <span className={styles.bottomParLbl}>PAR</span>
              </div>
            </div>
          </div>

          {showMiss && <div className={styles.missFeedback}>Almost! Aim from here</div>}
          {showWin  && <div className={`${styles.winBanner} ${styles.winBannerShow}`}>{winPhrase}</div>}

          {/* Hole result overlay */}
          {phase==="hole_result" && (()=>{
            const s=starsFor(shotsRef.current, def.par);
            // Auto-advance: tap to go immediately, or wait 2s
            const adv=activeAdventure??ADVENTURES[0];
            const isLast=holeIdx>=adv.holeRange[1];
            return (
              <div className={styles.overlay} onClick={goNext} style={{cursor:"pointer"}}>
                <div className={styles.resultPanel}>
                  <div className={styles.resultHoleLabel}>Hole {holeIdx+1} Complete</div>
                  <div className={styles.resultTitle}>{def.name}</div>
                  <div className={styles.starsRow}>
                    {[0,1,2].map(i=>(
                      <span key={i} className={styles.rStar} style={{opacity:i<s?1:.2,animationDelay:`${i*.18}s`}}>⭐</span>
                    ))}
                  </div>
                  <div className={styles.statRow}>
                    <div className={styles.stat}><div className={styles.statNum}>{shotsRef.current}</div><div className={styles.statLbl}>SHOTS</div></div>
                    <div className={styles.stat}><div className={styles.statNum}>Par {def.par}</div><div className={styles.statLbl}>TARGET</div></div>
                    <div className={styles.stat}><div className={styles.statNum} style={{color:C.gold}}>+{s*15}</div><div className={styles.statLbl}>XP</div></div>
                  </div>
                  <HoleAutoAdvance onAdvance={goNext} delay={1800} />
                  <div className={styles.tapHint}>{isLast?"Tap to finish →":"Tap for next hole →"}</div>
                </div>
              </div>
            );
          })()}
        </>
      )}


      {/* ── MENU OVERLAY — Adventure select screen ─────────────────────────── */}
      {isMenu && (
        <div className={styles.menuOverlay}>
          {/* Animated background */}
          <div className={styles.menuBg}>
            {Array.from({length:20},(_,i)=>(
              <div key={i} className={styles.menuGrassTile}
                style={{left:`${(i%5)*22}%`,top:`${Math.floor(i/5)*28}%`,animationDelay:`${i*0.18}s`}}/>
            ))}
          </div>

          {/* Top bar */}
          <div className={styles.menuTopBar}>
            {onExit&&<button className={styles.menuBackBtn} onClick={onExit}>‹ Worlds</button>}
          </div>

          {/* Logo */}
          <div className={styles.menuHero}>
            <div className={styles.menuBallBounce}>⛳</div>
            <h1 className={styles.menuTitle}>Mini Golf</h1>
            <p className={styles.menuTagline}>CHOOSE YOUR ADVENTURE</p>
          </div>

          {/* Adventure cards — square grid */}
          <div className={styles.adventureGrid}>
            {ADVENTURES.map((adv, advIdx) => {
              const stars = adventureStars[adv.id] ?? [];
              const isCompleted = stars.length === 5;
              const totalStars = stars.reduce((a:number,b:number)=>a+b,0);
              const prevAdv = advIdx > 0 ? ADVENTURES[advIdx-1] : null;
              const prevStars = prevAdv ? (adventureStars[prevAdv.id] ?? []) : [1];
              const isLocked = prevAdv !== null && prevStars.length === 0;

              return (
                <div
                  key={adv.id}
                  className={`${styles.advSquareCard}${isLocked?" "+styles.advCardLocked:""}${isCompleted?" "+styles.advSquareCardDone:""}`}
                  onClick={()=>{ if(!isLocked) startGame(adv); }}
                  style={{"--adv-accent": adv.accentColor, "--adv-dark": adv.accentDark} as React.CSSProperties}
                >
                  {/* SVG environment illustration */}
                  <div className={styles.advArtBox}>
                    <AdventureArt id={adv.id} accent={adv.accentColor} locked={isLocked} />
                    {isLocked && <div className={styles.advLockOverlay}>🔒</div>}
                    {isCompleted && (
                      <div className={styles.advCompleteBadge}>
                        ⭐{totalStars}<span style={{fontSize:9}}>/15</span>
                      </div>
                    )}
                    {!isCompleted && stars.length > 0 && (
                      <div className={styles.advProgressBadge}>{stars.length}/5</div>
                    )}
                  </div>
                  {/* Info strip */}
                  <div className={styles.advSquareBody}>
                    <div className={styles.advSquareName}>{isLocked?"🔒 Locked":adv.name}</div>
                    <div className={styles.advSquareMeta}>
                      <span className={styles.advSquareDiff}>{adv.difficulty}</span>
                      <span className={styles.advSquareHoles}>5 holes</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {onExit&&<button className={styles.ghostBtn} onClick={onExit}>Back to Worlds</button>}
        </div>
      )}

      {/* ── ROUND / SESSION DONE ─────────────────────────────────────────────── */}
      {isDone && (()=>{
        const nextIdx = holeIdxRef.current;
        const hasNextRound = nextIdx < HOLES.length;
        const completedRoundIdx = getRound(Math.max(0, nextIdx - 1));
        const completedRound = ROUNDS[completedRoundIdx];
        const nextRound = hasNextRound ? ROUNDS[getRound(nextIdx)] : null;
        return (
          <div className={styles.menuOverlay}>
            <div className={styles.menuBg}>
              {Array.from({length:20},(_,i)=>(
                <div key={i} className={styles.menuGrassTile}
                  style={{left:`${(i%5)*22}%`,top:`${Math.floor(i/5)*28}%`,animationDelay:`${i*0.18}s`}}/>
              ))}
            </div>
            <div className={styles.doneWrap}>
              <div className={styles.doneTrophy}>{hasNextRound ? "🏅" : "🏆"}</div>
              <h2 className={styles.doneTitle}>{hasNextRound ? "Round Complete!" : "Champion!"}</h2>
              {completedRound && (
                <p className={styles.doneRoundName}>{completedRound.name}</p>
              )}
              <div className={styles.doneStars}>{"⭐".repeat(Math.min(total, 15))}</div>
              <div className={styles.doneStats}>
                <div className={styles.doneStat}><span className={styles.doneStatNum}>{sessionShots}</span><span className={styles.doneStatLbl}>SHOTS</span></div>
                <div className={styles.doneStat}><span className={styles.doneStatNum}>{score}</span><span className={styles.doneStatLbl}>SCORE</span></div>
                <div className={styles.doneStat}><span className={styles.doneStatNum} style={{color:C.gold}}>+{totalXp}</span><span className={styles.doneStatLbl}>XP</span></div>
              </div>
              <div className={styles.doneHoles}>
                {holeStars.map((s,i)=>(
                  <div key={i} className={styles.doneHoleRow}>
                    <span className={styles.doneHoleNum}>Hole {i+1}</span>
                    <span className={styles.doneHoleName}>{HOLES[i]?.name}</span>
                    <span className={styles.doneHoleStars}>{"⭐".repeat(s)}{"☆".repeat(3-s)}</span>
                  </div>
                ))}
              </div>
              {hasNextRound && nextRound && (
                <div className={styles.nextRoundCard}>
                  <div className={styles.nextRoundLabel}>Next up</div>
                  <div className={styles.nextRoundName}>{nextRound.name}</div>
                  <div className={styles.nextRoundSub}>{nextRound.subtitle}</div>
                </div>
              )}
              {hasNextRound && nextRound
                ? <button className={styles.menuPlayBtn} onClick={()=>startGame(nextRound as AdventureDef)}>
                    ▶ Play {nextRound.name}
                  </button>
                : null
              }
              <button className={styles.menuPlayBtn} style={{background:"rgba(255,255,255,.18)",marginTop:8,boxShadow:"none"}} onClick={()=>setPhase("menu")}>
                ← Back to Adventures
              </button>
              {onExit && <button className={styles.ghostBtn} onClick={onExit}>Back to Worlds</button>}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── MathQuestEngine — Arcade-compatible adapter ────────────────────────────────
// This is what ArcadeGameClient loads via dynamic import.
// It accepts the arcade's standard { onComplete, onExit } interface,
// while internally managing the onNeedHearts learning flow via state.
//
// The learning overlay (ChangeOfSubjectEngine) is loaded dynamically
// so it doesn't bloat the golf bundle when hearts are not needed.

export interface MathQuestEngineProps {
  onComplete?: (r: { score: number; hits: number; maxCombo: number; xp: number }) => void;
  onExit?: () => void;
}

export function MathQuestEngine({ onComplete, onExit }: MathQuestEngineProps) {
  const [showLearning, setShowLearning] = useState(false);
  const [activityKey, setActivityKey]   = useState(0);
  const resolveRef = useRef<((r: HeartRefillResult) => void) | null>(null);

  const handleNeedHearts = useCallback((resolve: (r: HeartRefillResult) => void) => {
    resolveRef.current = resolve;
    setActivityKey(k => k + 1);
    setShowLearning(true);
  }, []);

  const handleRoundEnd = useCallback((result: RoundResult) => {
    onComplete?.({
      score: result.score,
      hits: result.holesPlayed,
      maxCombo: Math.max(...(result.holeStars.length ? result.holeStars : [0])),
      xp: result.xpEarned,
    });
  }, [onComplete]);

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <MiniGolfEngine
        onNeedHearts={handleNeedHearts}
        onRoundEnd={handleRoundEnd}
        onExit={onExit}
        heartsPerHole={3}
      />
      {showLearning && (
        <MathQuestLearningOverlayInline
          key={activityKey}
          onDone={(r: HeartRefillResult) => {
            setShowLearning(false);
            resolveRef.current?.(r);
            resolveRef.current = null;
          }}
          onSkip={() => {
            setShowLearning(false);
            resolveRef.current?.({ heartsGranted: 0, xpEarned: 0 });
            resolveRef.current = null;
          }}
        />
      )}
    </div>
  );
}

// ── Inline learning overlay — self-contained, no extra file needed ────────────
// Wraps ChangeOfSubjectEngine in the glass overlay shell.
// Lives here so the MathQuestEngine export works as a single file.

import { ChangeOfSubjectEngine } from "@/engines/mathematics/change-of-subject/ChangeOfSubjectEngine";
import { randomMissionForTier }   from "@/engines/mathematics/change-of-subject/changeOfSubjectQuestions";
import type { ChangeOfSubjectOutcome } from "@/engines/mathematics/change-of-subject/changeOfSubject.config";
function buildLearningConfig() {
  const qs = randomMissionForTier("learn");
  const q  = qs[Math.floor(Math.random() * qs.length)];
  return {
    shared: {
      pointsPerQuestion:20, retryPenalty:5, hintPenalty:5, hintTimePenalty:5,
      baseTimerSecs:90, retryTimerCut:10, minTimerSecs:30, practiceTimerFromQ:99,
    },
    mission: {
      id:`golf-hearts-${Date.now()}`, missionKey:"cos-learn-m1",
      title:"Earn Hearts", xpReward:15, topicId:"change-of-subject",
      subtopicId:undefined, payload:{ questions:[q] },
    },
  };
}

function MathQuestLearningOverlayInline({
  onDone, onSkip,
}: {
  onDone: (r: HeartRefillResult) => void;
  onSkip: () => void;
}) {
  const configRef = useRef(buildLearningConfig());
  const handleComplete = useCallback((outcome: ChangeOfSubjectOutcome) => {
    onDone({ heartsGranted: 3, xpEarned: outcome.xpEarned ?? 15 });
  }, [onDone]);

  return (
    <div style={{
      position:"absolute", inset:0, zIndex:90,
      backdropFilter:"blur(6px) brightness(0.55) saturate(0.7)",
      WebkitBackdropFilter:"blur(6px) brightness(0.55) saturate(0.7)",
      display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", padding:"12px",
    }}>
      <div style={{
        background:"#fff", borderRadius:24, width:"100%", maxWidth:460,
        maxHeight:"88vh", display:"flex", flexDirection:"column",
        boxShadow:"0 24px 64px rgba(0,0,0,.45)", overflow:"hidden",
      }}>
        {/* Header */}
        <div style={{
          display:"flex", alignItems:"center", gap:10,
          padding:"14px 18px",
          background:"linear-gradient(135deg,#1A4010,#2E6A20)",
          flexShrink:0,
        }}>
          <span style={{fontSize:22}}>⛳</span>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Baloo 2',sans-serif",fontWeight:800,fontSize:14,color:"#fff"}}>
              Out of Hearts — Solve to Continue
            </div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginTop:2}}>
              Complete the activity to earn 3 hearts ❤️❤️❤️
            </div>
          </div>
          <button onClick={onSkip} style={{
            background:"rgba(255,255,255,.15)", border:"1.5px solid rgba(255,255,255,.3)",
            borderRadius:100, color:"#fff", fontSize:12, fontWeight:700,
            padding:"6px 12px", cursor:"pointer", fontFamily:"inherit",
          }}>Skip ✕</button>
        </div>
        {/* Engine */}
        <div style={{flex:1,overflow:"auto",minHeight:0}}>
          <ChangeOfSubjectEngine
            config={configRef.current as any}
            onComplete={handleComplete}
          />
        </div>
        {/* Footer */}
        <div style={{padding:"10px 16px",borderTop:"1px solid #eee",background:"#fafaf8",flexShrink:0}}>
          <button onClick={onSkip} style={{
            width:"100%", padding:"10px 16px", borderRadius:100,
            border:"1.5px solid #d4e0d0", background:"#f0f6ee",
            color:"#3A6A30", fontFamily:"inherit", fontSize:13, fontWeight:700, cursor:"pointer",
          }}>⛳ Back to Golf (skip — hearts not restored)</button>
        </div>
      </div>
    </div>
  );
}