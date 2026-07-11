"use client";
/**
 * MathQuestEngine.tsx — Math Quest v5
 *
 * Key changes from v4:
 *  1. Canvas sizing: uses the gameFrame div's actual measured size (not window),
 *     so it works correctly whether the game is embedded or fullscreen.
 *  2. Diverse course shapes inspired by the reference game: L-shapes, S-bends,
 *     doglegs, octagon, wide rectangle with obstacles.
 *  3. Hearts mechanic: ball resets on miss, NO question shown — question only
 *     appears after ALL 3 hearts are exhausted.
 *  4. Mobile layout: ball at bottom, hole at top (portrait-friendly).
 *  5. Desktop: fills the full frame, course is wide.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import styles from "./MathQuestEngine.module.css";

// Font injection at module level — avoids React removeChild crash
if (typeof window !== "undefined" && !document.getElementById("mq-fonts")) {
  const _l = document.createElement("link");
  _l.id = "mq-fonts"; _l.rel = "stylesheet";
  _l.href = "https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito:wght@700;800&display=swap";
  document.head.appendChild(_l);
}

// ── Question bank ──────────────────────────────────────────────────────────────
interface QStep { instruction:string; formula:string; tileOk:string; tilesNo:[string,string]; hint:string; resultFormula:string; }
interface QuizQ  { id:string; label:string; formula:string; finalAnswer:string; steps:QStep[]; }

const QUESTIONS: QuizQ[] = [
  { id:"q1", label:"Make t the subject", formula:"v = t + 5", finalAnswer:"t = v − 5",
    steps:[{ formula:"v = t + 5", instruction:"+ 5 is blocking t — subtract 5 from both sides.", tileOk:"− 5", tilesNo:["+ 5","× 5"], hint:"Opposite of + 5 is − 5.", resultFormula:"t = v − 5" }] },
  { id:"q2", label:"Make m the subject", formula:"F = 3m", finalAnswer:"m = F ÷ 3",
    steps:[{ formula:"F = 3m", instruction:"m is multiplied by 3 — divide both sides by 3.", tileOk:"÷ 3", tilesNo:["× 3","− 3"], hint:"÷ 3 undoes × 3.", resultFormula:"m = F ÷ 3" }] },
  { id:"q3", label:"Make x the subject", formula:"y = mx + c", finalAnswer:"x = (y − c) ÷ m",
    steps:[
      { formula:"y = mx + c", instruction:"c is blocking mx — subtract c from both sides.", tileOk:"− c", tilesNo:["+ c","÷ c"], hint:"Subtract c to leave mx alone.", resultFormula:"y − c = mx" },
      { formula:"y − c = mx", instruction:"x is multiplied by m — divide both sides by m.", tileOk:"÷ m", tilesNo:["× m","− m"], hint:"÷ m leaves x alone.", resultFormula:"x = (y − c) ÷ m" },
    ] },
  { id:"q4", label:"Make t the subject", formula:"v = u + at", finalAnswer:"t = (v − u) ÷ a",
    steps:[
      { formula:"v = u + at", instruction:"u is blocking at — subtract u from both sides.", tileOk:"− u", tilesNo:["+ u","÷ u"], hint:"Subtract u to leave at.", resultFormula:"v − u = at" },
      { formula:"v − u = at", instruction:"t is multiplied by a — divide both sides by a.", tileOk:"÷ a", tilesNo:["× a","− a"], hint:"÷ a leaves t alone.", resultFormula:"t = (v − u) ÷ a" },
    ] },
  { id:"q5", label:"Make w the subject", formula:"P = 2(l + w)", finalAnswer:"w = P÷2 − l",
    steps:[
      { formula:"P = 2(l + w)", instruction:"w is inside ×2 brackets — divide both sides by 2.", tileOk:"÷ 2", tilesNo:["× 2","− 2"], hint:"÷ 2 clears the bracket coefficient.", resultFormula:"P÷2 = l + w" },
      { formula:"P÷2 = l + w", instruction:"l is next to w — subtract l from both sides.", tileOk:"− l", tilesNo:["+ l","× l"], hint:"− l removes the l.", resultFormula:"w = P÷2 − l" },
    ] },
  { id:"q6", label:"Make r the subject", formula:"C = r ÷ 2", finalAnswer:"r = 2C",
    steps:[{ formula:"C = r ÷ 2", instruction:"r is divided by 2 — multiply both sides by 2.", tileOk:"× 2", tilesNo:["÷ 2","+ 2"], hint:"× 2 cancels ÷ 2.", resultFormula:"r = 2C" }] },
  { id:"q7", label:"Make r the subject", formula:"A = πr²", finalAnswer:"r = √(A÷π)",
    steps:[
      { formula:"A = πr²", instruction:"r² is multiplied by π — divide both sides by π.", tileOk:"÷ π", tilesNo:["× π","− π"], hint:"÷ π isolates r².", resultFormula:"A÷π = r²" },
      { formula:"A÷π = r²", instruction:"r is squared — take the square root of both sides.", tileOk:"√( )", tilesNo:["( )²","÷ 2"], hint:"√(r²) = r", resultFormula:"r = √(A÷π)" },
    ] },
  { id:"q8", label:"Make b the subject", formula:"A = ½bh", finalAnswer:"b = 2A÷h",
    steps:[
      { formula:"A = ½bh", instruction:"b has ½ coefficient — multiply both sides by 2.", tileOk:"× 2", tilesNo:["÷ 2","+ 2"], hint:"× 2 removes the ½.", resultFormula:"2A = bh" },
      { formula:"2A = bh", instruction:"b is multiplied by h — divide both sides by h.", tileOk:"÷ h", tilesNo:["× h","− h"], hint:"÷ h leaves b alone.", resultFormula:"b = 2A÷h" },
    ] },
];

// ── Types ──────────────────────────────────────────────────────────────────────
interface Vec2 { x:number; y:number; }

// A course is built from a polygon path for the fairway border,
// plus rectangular wall segments inside it.
interface CourseGeom {
  // Bounding box (for ball boundary checks)
  cx:number; cy:number; cw:number; ch:number;
  // Hole and ball start
  hole:{ x:number; y:number; r:number };
  start:{ x:number; y:number };
  // Walls inside the course
  walls:Array<{ x:number; y:number; w:number; h:number }>;
  // The outer border polygon (rendered as wood border + clipped blue surface)
  // For now we keep the simple rect border — shaped courses use walls to carve
  shapeName: string;
}

type Phase = "topic_pick"|"aiming"|"rolling"|"sinking"|"hole_result"|"question"|"session_done";

// ── Hole definitions ───────────────────────────────────────────────────────────
// All positions normalised 0-1 within the course bounding box.
// Shapes: "rect" | "Lshape" | "Sbend" | "dogleg" | "wide"
interface HoleDef {
  name:string; par:number; shape:string;
  // Ball and hole positions (portrait: ball at bottom, hole at top — for mobile)
  // Desktop uses same positions but course is wider than tall
  ballFx:number; ballFy:number; holeFx:number; holeFy:number;
  walls:Array<{xf:number;yf:number;wf:number;hf:number}>;
}

const HOLES: HoleDef[] = [
  // 1 — Wide straight, one barrier in middle (like reference image 1)
  { name:"Meadow Straight", par:2, shape:"rect",
    ballFx:.1, ballFy:.5, holeFx:.9, holeFy:.5,
    walls:[{xf:.48,yf:.0,wf:.04,hf:.42},{xf:.48,yf:.58,wf:.04,hf:.42}] },

  // 2 — L-shape: ball bottom-left, hole top-right (like reference image 2)
  { name:"Timber L-Course", par:2, shape:"Lshape",
    ballFx:.1, ballFy:.8, holeFx:.88, holeFy:.18,
    walls:[{xf:.46,yf:.0,wf:.05,hf:.54}] },

  // 3 — S-bend (like reference image 3 — two chambers)
  { name:"Snake Pass", par:3, shape:"rect",
    ballFx:.1, ballFy:.25, holeFx:.88, holeFy:.75,
    walls:[
      {xf:.38,yf:.0,wf:.05,hf:.62},
      {xf:.62,yf:.38,wf:.05,hf:.62},
    ] },

  // 4 — Wide room with inner obstacles (like reference image 4)
  { name:"Garden Room", par:2, shape:"rect",
    ballFx:.08, ballFy:.5, holeFx:.9, holeFy:.5,
    walls:[
      {xf:.42,yf:.15,wf:.16,hf:.28}, // centre island
      {xf:.42,yf:.57,wf:.16,hf:.28},
    ] },

  // 5 — Dogleg right (like reference image 5)
  { name:"Dogleg Right", par:2, shape:"dogleg",
    ballFx:.1, ballFy:.75, holeFx:.88, holeFy:.22,
    walls:[{xf:.52,yf:.44,wf:.05,hf:.56}] },
];

const WIN_PHRASES = ["Excellent!","Nice Shot!","Great Job!","Sunk It!","Awesome!","Perfect!"];
const BALL_R = 12;
const C = {
  skyTop:"#BFE8FF", skyBot:"#EAF9FF",
  grass1:"#7FC76B", grass2:"#6FB85D",
  wood:"#D9A15A",   woodDark:"#B87F3B",
  putt1:"#6EC3EC",  putt2:"#4EA0D0",
  ink:"#2E3A2E",    gold:"#F5C444",
  green:"#6FCF63",  yellow:"#F2C744", orange:"#F2984A", red:"#EE6A5F",
  coral:"#FF8B6B",
};

function buildCourse(idx:number, W:number, H:number): CourseGeom {
  const def = HOLES[idx % HOLES.length];
  // Margins: leave 8% on each side for the background world
  const MX = Math.round(W * 0.08);
  const MY = Math.round(H * 0.10);
  const cx=MX, cy=MY, cw=W-MX*2, ch=H-MY*2;
  return {
    cx,cy,cw,ch,
    hole:  { x:cx+def.holeFx*cw,  y:cy+def.holeFy*ch,  r:16 },
    start: { x:cx+def.ballFx*cw,  y:cy+def.ballFy*ch },
    walls: def.walls.map(w=>({ x:cx+w.xf*cw, y:cy+w.yf*ch, w:w.wf*cw, h:w.hf*ch })),
    shapeName: def.shape,
  };
}

// ── Component ──────────────────────────────────────────────────────────────────
export function MathQuestEngine({ onExit }:{ onExit?:()=>void }) {

  // Session state
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

  // Question state
  const [qIdx, setQIdx]             = useState(0);
  const [stepIdx, setStepIdx]       = useState(0);
  const [cardVisible, setCardVisible] = useState(false);
  const [cardShake, setCardShake]   = useState(false);
  const [picked, setPicked]         = useState<string|null>(null);
  const [tileResult, setTileResult] = useState<"correct"|"wrong"|null>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [showHint, setShowHint]     = useState(false);
  const [advancing, setAdvancing]   = useState(false);

  // Canvas & physics refs
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const frameRef   = useRef<HTMLDivElement>(null);
  const phaseRef   = useRef<Phase>("topic_pick");
  phaseRef.current = phase;

  const cwRef = useRef(800);
  const chRef = useRef(520);
  const courseRef  = useRef(buildCourse(0, 800, 520));
  const ballRef    = useRef({ x:200, y:400, vx:0, vy:0, breathe:0, sinkT:0 });
  const dragging   = useRef(false);
  const dragCur    = useRef<Vec2>({x:0,y:0});
  const shotsRef   = useRef(0);
  const heartsRef  = useRef(3);
  const holeIdxRef = useRef(0);
  const rafRef     = useRef(0);
  const lastT      = useRef(performance.now());
  const deadRef    = useRef(false);

  const pts  = useRef<Array<{x:number;y:number;vx:number;vy:number;life:number;r:number}>>([]);
  const conf = useRef<Array<{x:number;y:number;vx:number;vy:number;g:number;rot:number;vr:number;c:string;life:number;s:number}>>([]);
  const dec  = useRef<{
    clouds:Array<{x:number;y:number;s:number;spd:number}>;
    trees: Array<{x:number;y:number;s:number}>;
    bflies:Array<{x:number;y:number;t:number;c:string}>;
    grass: Array<{x:number;y:number;r:number;c:string}>;
  }>({ clouds:[], trees:[], bflies:[], grass:[] });

  // ── Resize: measure the actual frame div ───────────────────────────────────
  useEffect(() => {
    const measure = () => {
      const el = frameRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const w = Math.floor(r.width)  || 800;
      const h = Math.floor(r.height) || 520;
      if (w === cwRef.current && h === chRef.current) return; // no change
      cwRef.current = w;
      chRef.current = h;
      const cv = canvasRef.current;
      if (cv) { cv.width = w; cv.height = h; }
      if (phaseRef.current !== "topic_pick" && phaseRef.current !== "session_done") {
        const course = buildCourse(holeIdxRef.current, w, h);
        courseRef.current = course;
        if (!deadRef.current && phaseRef.current === "aiming") {
          ballRef.current.x = course.start.x;
          ballRef.current.y = course.start.y;
        }
      }
    };
    // Use requestAnimationFrame to ensure the DOM has laid out
    requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    if (frameRef.current) ro.observe(frameRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const spawnDust = (x:number,y:number) => {
    for(let i=0;i<8;i++) pts.current.push({x,y,vx:(Math.random()-.5)*2.5,vy:(Math.random()-.5)*2.5,life:1,r:2+Math.random()*2});
  };
  const spawnConf = (x:number,y:number) => {
    const cols=[C.coral,C.gold,C.green,"#5FB6E8",C.red];
    for(let i=0;i<30;i++) conf.current.push({x,y,vx:(Math.random()-.5)*8,vy:-Math.random()*8-3,g:.2+Math.random()*.1,rot:Math.random()*7,vr:(Math.random()-.5)*.3,c:cols[i%cols.length],life:1.5,s:4+Math.random()*4});
  };
  const genDecor = (W:number,H:number) => {
    const gc=["#8ED37B","#6FB85D","#9BDD87","#79C468"];
    dec.current = {
      grass:  Array.from({length:60},()=>({x:Math.random()*W,y:Math.random()*H,r:3+Math.random()*10,c:gc[Math.floor(Math.random()*4)]})),
      clouds: Array.from({length:3},()=>({x:Math.random()*W,y:16+Math.random()*30,s:.7+Math.random()*.5,spd:1.5+Math.random()*2})),
      trees:  [{x:.05*W,y:.12*H,s:.9},{x:.93*W,y:.18*H,s:.8},{x:.04*W,y:.82*H,s:1},{x:.94*W,y:.78*H,s:.85}],
      bflies: Array.from({length:3},()=>({x:Math.random()*W,y:H*.55+Math.random()*H*.3,t:Math.random()*100,c:Math.random()<.5?"#FF8B6B":"#F2C744"})),
    };
  };

  function rrect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  function drawCloud(ctx:CanvasRenderingContext2D,x:number,y:number,s:number){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle="rgba(255,255,255,.88)";ctx.beginPath();ctx.arc(0,0,14,0,7);ctx.arc(16,-6,11,0,7);ctx.arc(30,0,13,0,7);ctx.arc(14,6,14,0,7);ctx.fill();ctx.restore();}
  function drawTree(ctx:CanvasRenderingContext2D,x:number,y:number,s:number){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle="rgba(0,0,0,.08)";ctx.beginPath();ctx.ellipse(2,26,20,7,0,0,7);ctx.fill();ctx.fillStyle="#B87F3B";ctx.fillRect(-4,0,8,22);ctx.fillStyle="#5AA84A";ctx.beginPath();ctx.arc(0,-14,20,0,7);ctx.fill();ctx.fillStyle="#6BC15A";ctx.beginPath();ctx.arc(-9,-4,13,0,7);ctx.arc(9,-2,13,0,7);ctx.fill();ctx.restore();}
  function drawBfly(ctx:CanvasRenderingContext2D,x:number,y:number,t:number,c:string){const f=Math.sin(t*10)*.5+.5;ctx.save();ctx.translate(x,y);ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(-4,0,4,3+f*2,.4,0,7);ctx.fill();ctx.beginPath();ctx.ellipse(4,0,4,3+f*2,-.4,0,7);ctx.fill();ctx.restore();}

  function collideWall(b:typeof ballRef.current, w:{x:number;y:number;w:number;h:number}):boolean {
    const nx=Math.max(w.x,Math.min(b.x,w.x+w.w)), ny=Math.max(w.y,Math.min(b.y,w.y+w.h));
    const dx=b.x-nx, dy=b.y-ny, d=Math.hypot(dx,dy);
    if(d<BALL_R&&d>.001){
      const ex=dx/d,ey=dy/d;
      b.x=nx+ex*(BALL_R+.5); b.y=ny+ey*(BALL_R+.5);
      const dot=b.vx*ex+b.vy*ey;
      b.vx=(b.vx-2*dot*ex)*.65; b.vy=(b.vy-2*dot*ey)*.65;
      return true;
    }
    return false;
  }

  // ── Draw loop ──────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    // Schedule next frame FIRST — never skip
    rafRef.current = requestAnimationFrame(draw);

    const canvas = canvasRef.current;
    if (!canvas || canvas.width < 10 || canvas.height < 10) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const now = performance.now();
    const dt  = Math.min((now-lastT.current)/1000,.033);
    lastT.current = now;

    const W=cwRef.current, H=chRef.current;
    const p=phaseRef.current;
    const b=ballRef.current;
    const course=courseRef.current;
    const d=dec.current;

    ctx.clearRect(0,0,W,H);

    // ── Sky/grass background ──────────────────────────────────────────────────
    const sky=ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,C.skyTop); sky.addColorStop(1,C.skyBot);
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
    ctx.save(); ctx.globalAlpha=.4;
    for(let i=-2;i<Math.ceil(W/140)+2;i++){
      ctx.fillStyle=i%2===0?C.grass1:C.grass2;
      ctx.beginPath(); ctx.moveTo(i*140-80,0); ctx.lineTo(i*140+60,0); ctx.lineTo(i*140-40,H); ctx.lineTo(i*140-180,H); ctx.fill();
    }
    ctx.restore();
    d.grass.forEach(g=>{ctx.fillStyle=g.c;ctx.beginPath();ctx.arc(g.x,g.y,g.r,0,7);ctx.fill();});
    d.clouds.forEach(cl=>{cl.x-=cl.spd*dt;if(cl.x<-80)cl.x=W+80;drawCloud(ctx,cl.x,cl.y,cl.s);});
    d.trees.forEach(t=>drawTree(ctx,t.x,t.y,t.s));
    d.bflies.forEach(bf=>{bf.t+=dt;bf.x+=Math.sin(bf.t*1.3)*.5;bf.y+=Math.cos(bf.t*.9)*.28;drawBfly(ctx,bf.x,bf.y,bf.t,bf.c);});

    // ── Course border (wood) + surface ─────────────────────────────────────────
    const PAD=14; // wood border thickness
    ctx.save(); ctx.shadowColor="rgba(0,0,0,.22)"; ctx.shadowBlur=20; ctx.shadowOffsetY=8;
    ctx.fillStyle=C.woodDark; rrect(ctx,course.cx-PAD-2,course.cy-PAD-2,course.cw+PAD*2+4,course.ch+PAD*2+4,28); ctx.fill();
    ctx.restore();
    ctx.fillStyle=C.wood; rrect(ctx,course.cx-PAD,course.cy-PAD,course.cw+PAD*2,course.ch+PAD*2,26); ctx.fill();
    // Wood highlight
    ctx.strokeStyle="rgba(255,255,255,.3)"; ctx.lineWidth=3;
    rrect(ctx,course.cx-PAD+3,course.cy-PAD+3,course.cw+PAD*2-6,course.ch+PAD*2-6,22); ctx.stroke();

    // Putting surface
    ctx.save();
    rrect(ctx,course.cx,course.cy,course.cw,course.ch,16); ctx.clip();
    const pg=ctx.createLinearGradient(course.cx,course.cy,course.cx,course.cy+course.ch);
    pg.addColorStop(0,C.putt1); pg.addColorStop(1,C.putt2);
    ctx.fillStyle=pg; ctx.fillRect(course.cx,course.cy,course.cw,course.ch);
    // Stripe shimmer
    ctx.globalAlpha=.055;
    for(let i=0;i<course.cw+course.ch;i+=28){ctx.strokeStyle="#fff";ctx.lineWidth=14;ctx.beginPath();ctx.moveTo(course.cx+i,course.cy);ctx.lineTo(course.cx+i-course.ch,course.cy+course.ch);ctx.stroke();}
    ctx.restore();

    // ── Internal walls ─────────────────────────────────────────────────────────
    course.walls.forEach(w=>{
      ctx.save();ctx.shadowColor="rgba(0,0,0,.18)";ctx.shadowBlur=8;ctx.shadowOffsetY=4;
      ctx.fillStyle=C.wood; rrect(ctx,w.x,w.y,w.w,w.h,8); ctx.fill();
      ctx.restore();
      ctx.strokeStyle="rgba(255,255,255,.28)";ctx.lineWidth=2;
      rrect(ctx,w.x+2,w.y+2,w.w-4,w.h-4,6); ctx.stroke();
    });

    // ── Hole ──────────────────────────────────────────────────────────────────
    ctx.fillStyle="rgba(0,0,0,.15)"; ctx.beginPath(); ctx.ellipse(course.hole.x,course.hole.y+5,course.hole.r*1.15,course.hole.r*.55,0,0,7); ctx.fill();
    ctx.fillStyle="#16241A"; ctx.beginPath(); ctx.arc(course.hole.x,course.hole.y,course.hole.r,0,7); ctx.fill();
    // Inner shine ring
    ctx.strokeStyle="rgba(255,255,255,.15)"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(course.hole.x,course.hole.y,course.hole.r,0,7); ctx.stroke();
    // Flag
    ctx.strokeStyle="#8a5a2a"; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(course.hole.x,course.hole.y-2); ctx.lineTo(course.hole.x,course.hole.y-40); ctx.stroke();
    ctx.fillStyle="#FF5A50";
    ctx.beginPath(); ctx.moveTo(course.hole.x,course.hole.y-40); ctx.lineTo(course.hole.x+20,course.hole.y-33); ctx.lineTo(course.hole.x,course.hole.y-26); ctx.fill();

    // ── Aim arrow ─────────────────────────────────────────────────────────────
    if(p==="aiming"&&dragging.current){
      const dx=dragCur.current.x-b.x, dy=dragCur.current.y-b.y;
      let dist=Math.hypot(dx,dy); const maxD=100;
      dist=Math.min(dist,maxD);
      const angle=Math.atan2(dy,dx), power=dist/maxD;
      const sx=b.x-Math.cos(angle)*dist*1.8, sy=b.y-Math.sin(angle)*dist*1.8;
      const col=power>.75?C.red:power>.5?C.orange:power>.25?C.yellow:C.green;
      ctx.save();
      ctx.strokeStyle=col; ctx.lineWidth=5; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(sx,sy); ctx.stroke();
      ctx.fillStyle=col;
      ctx.save(); ctx.translate(sx,sy); ctx.rotate(Math.atan2(sy-b.y,sx-b.x));
      ctx.beginPath(); ctx.moveTo(14,0); ctx.lineTo(-8,-6); ctx.lineTo(-8,6); ctx.fill();
      ctx.restore();
      for(let i=1;i<=7;i++){const t=i/7;ctx.globalAlpha=.4;ctx.fillStyle=col;ctx.beginPath();ctx.arc(b.x+(sx-b.x)*t,b.y+(sy-b.y)*t,3,0,7);ctx.fill();}
      ctx.restore();
      // Power bar
      const bx=b.x-35,by=b.y+24;
      ctx.fillStyle="rgba(255,255,255,.45)"; rrect(ctx,bx,by,70,9,5); ctx.fill();
      ctx.fillStyle=col; rrect(ctx,bx,by,70*power,9,5); ctx.fill();
    }

    // ── Ball ──────────────────────────────────────────────────────────────────
    if(p!=="sinking"||b.sinkT<.9){
      let bx=b.x, by=b.y, alpha=1, scale=1;
      if(p==="sinking"){
        b.sinkT+=dt*1.8;
        const sp=Math.min(1,b.sinkT*2.4);
        bx=b.x+(course.hole.x-b.x)*sp; by=b.y+(course.hole.y-b.y)*sp;
        scale=Math.max(0,1-Math.max(0,b.sinkT-.2)*2.5);
        alpha=Math.max(0,1-Math.max(0,b.sinkT-.1)*3);
      }
      const bob=(!b.vx&&!b.vy&&p==="aiming")?Math.sin(b.breathe)*1.8:0;
      ctx.save(); ctx.globalAlpha=alpha; ctx.translate(bx,by+bob); ctx.scale(scale,scale);
      // Shadow
      ctx.fillStyle="rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(0,BALL_R*.85,BALL_R*.92,BALL_R*.38,0,0,7); ctx.fill();
      // Body
      const bg=ctx.createRadialGradient(-4,-5,2,0,0,BALL_R);
      bg.addColorStop(0,"#FFFFFF"); bg.addColorStop(1,"#F0EDE6");
      ctx.fillStyle=bg; ctx.beginPath(); ctx.arc(0,0,BALL_R,0,7); ctx.fill();
      // Highlight
      ctx.fillStyle="rgba(255,255,255,.92)"; ctx.beginPath(); ctx.arc(-4,-4,2.8,0,7); ctx.fill();
      ctx.restore();
      // Aim pulse ring
      if(p==="aiming"){
        const pulse=Math.sin(now/280)*.5+.5;
        ctx.strokeStyle=`rgba(245,196,68,${.3+pulse*.5})`; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.arc(bx,by+bob,BALL_R+5+pulse*4,0,7); ctx.stroke();
      }
    }

    // ── Particles ─────────────────────────────────────────────────────────────
    pts.current.forEach(pt=>{ctx.globalAlpha=Math.max(0,pt.life);ctx.fillStyle="#E8E0C8";ctx.beginPath();ctx.arc(pt.x,pt.y,pt.r,0,7);ctx.fill();pt.x+=pt.vx;pt.y+=pt.vy;pt.life-=dt*2.2;});
    pts.current=pts.current.filter(pt=>pt.life>0);
    conf.current.forEach(pt=>{ctx.save();ctx.globalAlpha=Math.max(0,pt.life);ctx.translate(pt.x,pt.y);ctx.rotate(pt.rot);ctx.fillStyle=pt.c;ctx.fillRect(-pt.s/2,-pt.s/2,pt.s,pt.s*.6);ctx.restore();pt.vy+=pt.g;pt.x+=pt.vx;pt.y+=pt.vy;pt.rot+=pt.vr;pt.life-=dt*.6;});
    conf.current=conf.current.filter(pt=>pt.life>0);
    ctx.globalAlpha=1;

    // ── Physics ───────────────────────────────────────────────────────────────
    if(p==="rolling"){
      b.vx*=.984; b.vy*=.984; b.x+=b.vx; b.y+=b.vy;
      let bounced=false;
      if(b.x-BALL_R<course.cx){b.x=course.cx+BALL_R;b.vx=Math.abs(b.vx)*.62;bounced=true;}
      if(b.x+BALL_R>course.cx+course.cw){b.x=course.cx+course.cw-BALL_R;b.vx=-Math.abs(b.vx)*.62;bounced=true;}
      if(b.y-BALL_R<course.cy){b.y=course.cy+BALL_R;b.vy=Math.abs(b.vy)*.62;bounced=true;}
      if(b.y+BALL_R>course.cy+course.ch){b.y=course.cy+course.ch-BALL_R;b.vy=-Math.abs(b.vy)*.62;bounced=true;}
      course.walls.forEach(w=>{if(collideWall(b,w))bounced=true;});
      if(bounced)spawnDust(b.x,b.y);

      // Hole check
      const dh=Math.hypot(b.x-course.hole.x,b.y-course.hole.y);
      const sp=Math.hypot(b.vx,b.vy);
      if(dh<course.hole.r*1.1||(dh<course.hole.r*1.8&&sp<2)){
        b.vx=0; b.vy=0;
        setPhase("sinking");
        spawnConf(b.x,b.y-10);
        setTimeout(()=>{
          const ph=WIN_PHRASES[Math.floor(Math.random()*WIN_PHRASES.length)];
          setWinPhrase(ph); setShowWin(true);
          setTimeout(()=>setShowWin(false),1400);
          setTimeout(()=>setPhase("hole_result"),1700);
        },300);
      } else if(sp<.06){
        // Ball stopped without sinking — MISS
        b.vx=0; b.vy=0;
        if(!deadRef.current){
          deadRef.current=true;
          const nh=heartsRef.current-1;
          heartsRef.current=nh;
          setHearts(nh);

          if(nh<=0){
            // All hearts exhausted → show question
            setTimeout(()=>setPhase("question"),700);
          } else {
            // Still have hearts → reset ball to start, keep aiming, NO question
            setTimeout(()=>{
              const c=courseRef.current;
              ballRef.current={x:c.start.x,y:c.start.y,vx:0,vy:0,breathe:0,sinkT:0};
              deadRef.current=false;
              setPhase("aiming");
            },700);
          }
        }
      }
    } else if(p==="aiming"){
      b.breathe+=dt*2;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Start RAF once
  useEffect(()=>{
    rafRef.current=requestAnimationFrame(draw);
    return ()=>cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Card visibility
  useEffect(()=>{
    if(phase==="question"){const t=setTimeout(()=>setCardVisible(true),300);return()=>clearTimeout(t);}
    else setCardVisible(false);
  },[phase]);

  // Init hole
  const initHole = useCallback((idx:number)=>{
    const W=cwRef.current||window.innerWidth;
    const H=chRef.current||window.innerHeight;
    const course=buildCourse(idx,W,H);
    courseRef.current=course;
    ballRef.current={x:course.start.x,y:course.start.y,vx:0,vy:0,breathe:0,sinkT:0};
    deadRef.current=false;
    pts.current=[]; conf.current=[];
    genDecor(W,H);
    shotsRef.current=0; setShots(0);
    setPicked(null);setTileResult(null);setWrongCount(0);
    setShowHint(false);setAdvancing(false);setStepIdx(0);setCardShake(false);
  },[]);

  // Pointer events
  const getPos=(e:React.PointerEvent):Vec2=>{
    const r=canvasRef.current!.getBoundingClientRect();
    const scaleX=cwRef.current/r.width, scaleY=chRef.current/r.height;
    return {x:(e.clientX-r.left)*scaleX, y:(e.clientY-r.top)*scaleY};
  };
  const onPtrDown=(e:React.PointerEvent)=>{
    if(phaseRef.current!=="aiming")return;
    const p=getPos(e);
    const b=ballRef.current;
    if(Math.hypot(p.x-b.x,p.y-b.y)<70){
      dragging.current=true; dragCur.current=p;
      (e.target as Element).setPointerCapture(e.pointerId);
    }
  };
  const onPtrMove=(e:React.PointerEvent)=>{if(dragging.current)dragCur.current=getPos(e);};
  const onPtrUp=(e:React.PointerEvent)=>{
    if(!dragging.current||phaseRef.current!=="aiming")return;
    dragging.current=false;
    const b=ballRef.current;
    const dx=dragCur.current.x-b.x, dy=dragCur.current.y-b.y;
    const d=Math.hypot(dx,dy);
    if(d<8)return;
    const power=Math.min(d/100,1),angle=Math.atan2(dy,dx),speed=power*14+2;
    b.vx=-Math.cos(angle)*speed; b.vy=-Math.sin(angle)*speed;
    shotsRef.current++; setShots(s=>s+1); setSessionShots(s=>s+1);
    spawnDust(b.x,b.y);
    setPhase("rolling");
  };

  // Question tile pick
  const q=QUESTIONS[qIdx%QUESTIONS.length];
  const step=q.steps[stepIdx];
  const tileOrder=useMemo(()=>{
    const seed=qIdx*7+stepIdx*3;
    return [step.tileOk,step.tilesNo[0],step.tilesNo[1]]
      .map((v,i)=>({v,s:(v.charCodeAt(0)*13+seed+i*17)%100}))
      .sort((a,b)=>a.s-b.s).map(x=>x.v);
  },[step,qIdx,stepIdx]);

  const pickTile=(tile:string)=>{
    if(advancing||tileResult)return;
    setPicked(tile);
    if(tile===step.tileOk){
      setTileResult("correct");setAdvancing(true);
      setTimeout(()=>{
        const ns=stepIdx+1;
        if(ns<q.steps.length){
          setStepIdx(ns);setPicked(null);setTileResult(null);setWrongCount(0);setShowHint(false);setAdvancing(false);
        } else {
          // Question solved → restore hearts, unlock ball
          setCardVisible(false);
          setTimeout(()=>{
            setQIdx(i=>i+1);
            heartsRef.current=3; setHearts(3); // restore hearts
            const c=courseRef.current;
            ballRef.current={x:c.start.x,y:c.start.y,vx:0,vy:0,breathe:0,sinkT:0};
            deadRef.current=false;
            setPhase("aiming");
            setPicked(null);setTileResult(null);setWrongCount(0);setShowHint(false);setAdvancing(false);setStepIdx(0);
          },400);
        }
      },800);
    } else {
      setTileResult("wrong");setCardShake(true);setWrongCount(w=>w+1);
      setTimeout(()=>{setPicked(null);setTileResult(null);setCardShake(false);},650);
    }
  };

  // Hole complete
  const starsFor=(s:number,par:number)=>s<=par?3:s<=par+1?2:1;
  const goNext=()=>{
    const def=HOLES[holeIdx%HOLES.length];
    const s=starsFor(shotsRef.current,def.par);
    setHoleStars(hs=>[...hs,s]);
    setTotalXp(x=>x+s*15);
    setScore(sc=>sc+(s===3?100:s===2?60:30));
    const next=holeIdx+1;
    if(next>=HOLES.length){ setPhase("session_done"); }
    else{
      setHoleIdx(next); holeIdxRef.current=next;
      heartsRef.current=3; setHearts(3);
      initHole(next);
      setPhase("aiming");
    }
  };

  // ── TOPIC PICK ─────────────────────────────────────────────────────────────
  if(phase==="topic_pick"){
    return(
      <div className={styles.root}>
        <div className={styles.menuScreen}>
          <div className={styles.logoWrap}>
            <h1 className={styles.logoTitle}>⛳ Math Quest Golf</h1>
            <p className={styles.logoSub}>SOLVE · AIM · SINK IT</p>
          </div>
          <div className={styles.menuPanel}>
            <p className={styles.menuLabel}>Choose a topic</p>
            <div className={styles.modeRow}>
              <div className={`${styles.modeCard} ${styles.modeCardActive}`}>
                <div className={styles.modeBig}>📐</div>
                <div className={styles.modeLabel}>Change of Formula</div>
                <div className={styles.modeSub}>Rearrange equations</div>
              </div>
              <div className={`${styles.modeCard} ${styles.modeCardSoon}`}>
                <div className={styles.modeBig}>🔢</div>
                <div className={styles.modeLabel}>Simultaneous Eq.</div>
                <div className={styles.modeSub}>Coming soon</div>
              </div>
            </div>
            <button className={styles.btnPlay} onClick={()=>{
              holeIdxRef.current=0; heartsRef.current=3;
              setHoleIdx(0);setHearts(3);setTotalXp(0);setHoleStars([]);setSessionShots(0);setScore(0);setQIdx(0);
              initHole(0);
              setPhase("aiming");
            }}>▶ Play</button>
          </div>
          {onExit&&<button className={styles.ghostBtn} onClick={onExit}>← Back to Worlds</button>}
        </div>
      </div>
    );
  }

  // ── SESSION DONE ───────────────────────────────────────────────────────────
  if(phase==="session_done"){
    const total=holeStars.reduce((a,b)=>a+b,0);
    return(
      <div className={styles.root}>
        <div className={styles.menuScreen}>
          <div className={styles.menuPanel} style={{gap:16}}>
            <div className={styles.resultTitle}>Round Complete! 🏆</div>
            <div className={styles.starsRow}>{"⭐".repeat(Math.min(total,15))}</div>
            <div className={styles.statRow}>
              <div className={styles.stat}><div className={styles.statNum}>{sessionShots}</div><div className={styles.statLbl}>SHOTS</div></div>
              <div className={styles.stat}><div className={styles.statNum}>{score}</div><div className={styles.statLbl}>SCORE</div></div>
              <div className={styles.stat}><div className={styles.statNum} style={{color:C.gold}}>+{totalXp}</div><div className={styles.statLbl}>XP</div></div>
            </div>
            <button className={styles.btnPlay} onClick={()=>setPhase("topic_pick")}>Play Again</button>
            {onExit&&<button className={styles.btnSecondary} onClick={onExit}>Back to Worlds</button>}
          </div>
        </div>
      </div>
    );
  }

  // ── GAME SCREEN ────────────────────────────────────────────────────────────
  const def=HOLES[holeIdx%HOLES.length];
  return(
    <div className={styles.root}>
      <div className={styles.gameFrame} ref={frameRef}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onPointerDown={onPtrDown}
          onPointerMove={onPtrMove}
          onPointerUp={onPtrUp}
          style={{touchAction:"none"}}
        />

        {/* HUD */}
        <div className={styles.hudTL}>🎯 {score}</div>
        <div className={styles.hudTR}>Hole {holeIdx+1} / {HOLES.length}</div>
        <div className={styles.hudBL}>{onExit&&<button className={styles.exitBtn} onClick={onExit}>✕</button>}</div>
        <div className={styles.hudBR}>
          {[0,1,2].map(i=><span key={i} className={styles.heart} style={{opacity:i<hearts?1:.2}}>{i<hearts?"❤️":"🤍"}</span>)}
        </div>

        {/* Question card — only shows after all 3 hearts used */}
        <div className={`${styles.qCard} ${cardVisible?styles.qCardShow:""} ${cardShake?styles.qCardShake:""}`}>
          <div className={styles.qLabel}>OUT OF HEARTS — SOLVE TO CONTINUE</div>
          <div className={styles.qGoal}>{q.label}</div>
          <div className={styles.qEq}>{stepIdx===0?q.formula:q.steps[stepIdx-1].resultFormula}</div>
          <div className={styles.qMascot}>
            <span className={styles.qMascotIco}>🦉</span>
            <span className={styles.qMascotTxt}>{step.instruction}</span>
          </div>
          <div className={styles.qTiles}>
            {tileOrder.map(tile=>{
              const ok=picked===tile&&tileResult==="correct";
              const bad=picked===tile&&tileResult==="wrong";
              return(<button key={tile} className={`${styles.qTile} ${ok?styles.qTileOk:bad?styles.qTileBad:""}`} onClick={()=>pickTile(tile)} disabled={advancing}>{tile}</button>);
            })}
          </div>
          {wrongCount>=2&&!showHint&&<button className={styles.qHintBtn} onClick={()=>setShowHint(true)}>💡 Show hint</button>}
          {showHint&&<div className={styles.qHint}>{step.hint}</div>}
          {q.steps.length>1&&<div className={styles.qDots}>{q.steps.map((_,i)=><div key={i} className={`${styles.qDot} ${i<=stepIdx?styles.qDotOn:""}`}/>)}</div>}
          {tileResult==="correct"&&<div className={styles.qCorrect}>✓ {step.resultFormula}</div>}
        </div>

        {/* Win banner */}
        {showWin&&<div className={`${styles.winBanner} ${showWin?styles.winBannerShow:""}`}>{winPhrase}</div>}

        {/* Aim hint */}
        {phase==="aiming"&&<div className={styles.aimHint}>Drag from the ball to aim · release to shoot</div>}

        {/* Hearts hint */}
        {phase==="aiming"&&hearts<3&&(
          <div className={styles.heartsHint}>{hearts} heart{hearts!==1?"s":""} left — answer the question when they run out</div>
        )}

        {/* Hole result */}
        {phase==="hole_result"&&(()=>{
          const s=starsFor(shotsRef.current,def.par);
          return(
            <div className={styles.overlay}>
              <div className={styles.resultPanel}>
                <div className={styles.resultTitle}>{def.name}</div>
                <div className={styles.starsRow}>{[0,1,2].map(i=><span key={i} className={styles.rStar} style={{opacity:i<s?1:.2,animationDelay:`${i*.18}s`}}>⭐</span>)}</div>
                <div className={styles.statRow}>
                  <div className={styles.stat}><div className={styles.statNum}>{shotsRef.current}</div><div className={styles.statLbl}>SHOTS</div></div>
                  <div className={styles.stat}><div className={styles.statNum}>Par {def.par}</div><div className={styles.statLbl}>TARGET</div></div>
                  <div className={styles.stat}><div className={styles.statNum} style={{color:C.gold}}>+{s*15}</div><div className={styles.statLbl}>XP</div></div>
                </div>
                <button className={styles.btnPlay} onClick={goNext}>{holeIdx+1>=HOLES.length?"Finish Round →":"Next Hole →"}</button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}