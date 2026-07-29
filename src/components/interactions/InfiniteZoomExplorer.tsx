// FILE: src/components/interactions/InfiniteZoomExplorer.tsx
"use client";

import { useState, useEffect, useRef } from "react";

export interface InfiniteZoomExplorerConfig {
  autoPlayZoom?: boolean;
}

interface Material {
  id: string;
  label: string;
  state: "solid" | "liquid" | "gas";
  colour: string;
  particleColour: string;
  particleArrangement: "grid" | "random" | "spread";
  // Visual layers from macro to micro
  layers: {
    zoom: number;       // 0-4, which zoom level this layer appears
    label: string;      // what you're seeing
    description: string;
  }[];
  macroImage: string;   // emoji or text representing macro view
  surfaceColour: string;
}

const MATERIALS: Material[] = [
  {
    id: "spoon", label: "Metal spoon", state: "solid",
    colour: "#94a3b8", particleColour: "#60a5fa",
    particleArrangement: "grid",
    macroImage: "🥄",
    surfaceColour: "#c0c8d4",
    layers: [
      { zoom: 0, label: "Metal spoon",         description: "A smooth, shiny metal spoon — looks perfectly solid and uniform" },
      { zoom: 1, label: "Metal surface (×10)",  description: "Tiny scratches and imperfections appear — still looks solid" },
      { zoom: 2, label: "Metal grains (×1,000)", description: "Crystal grain boundaries become visible — the metal has structure" },
      { zoom: 3, label: "Atomic lattice (×10,000)", description: "We're approaching the particle scale — the regular lattice is emerging" },
      { zoom: 4, label: "Iron particles",       description: "Individual iron atoms — tightly packed in a regular grid, vibrating in place" },
    ],
  },
  {
    id: "water", label: "Water droplet", state: "liquid",
    colour: "#2563eb", particleColour: "#93c5fd",
    particleArrangement: "random",
    macroImage: "💧",
    surfaceColour: "#3b82f6",
    layers: [
      { zoom: 0, label: "Water droplet",        description: "Clear, transparent water — flows freely, takes the shape of its container" },
      { zoom: 1, label: "Water surface (×10)",  description: "A meniscus forms at the edge — surface tension is visible" },
      { zoom: 2, label: "Liquid interior (×1,000)", description: "No structure visible — water appears the same at every level" },
      { zoom: 3, label: "Molecular scale (×10,000)", description: "Individual molecules are almost visible — moving constantly" },
      { zoom: 4, label: "Water molecules",      description: "H₂O molecules — close together but sliding past each other continuously" },
    ],
  },
  {
    id: "wood", label: "Wood", state: "solid",
    colour: "#92400e", particleColour: "#f97316",
    particleArrangement: "grid",
    macroImage: "🪵",
    surfaceColour: "#a16207",
    layers: [
      { zoom: 0, label: "Wooden table",         description: "Brown wood with visible grain pattern — feels rough to the touch" },
      { zoom: 1, label: "Wood grain (×10)",      description: "Individual wood fibres and rings become clear" },
      { zoom: 2, label: "Cell walls (×1,000)",   description: "Plant cell walls — hollow tubes packed tightly together" },
      { zoom: 3, label: "Cellulose (×10,000)",   description: "Long cellulose chain molecules forming the cell wall structure" },
      { zoom: 4, label: "Cellulose particles",   description: "Carbon, hydrogen, oxygen atoms — in long rigid chains forming the structure" },
    ],
  },
  {
    id: "air", label: "Air (balloon)", state: "gas",
    colour: "#818cf8", particleColour: "#a5b4fc",
    particleArrangement: "spread",
    macroImage: "🎈",
    surfaceColour: "#c7d2fe",
    layers: [
      { zoom: 0, label: "Air in a balloon",     description: "Completely invisible — but the balloon is inflated, so something is there" },
      { zoom: 1, label: "Air (×10)",             description: "Still invisible — air has no colour, texture, or visible structure" },
      { zoom: 2, label: "Air (×1,000)",          description: "Completely empty-looking — the particles are too far apart and too small to see" },
      { zoom: 3, label: "Near particle scale",   description: "We're almost there — the emptiness between particles is enormous" },
      { zoom: 4, label: "Gas particles",         description: "Nitrogen and oxygen molecules — far apart, moving extremely fast in all directions" },
    ],
  },
  {
    id: "sugar", label: "Sugar cube", state: "solid",
    colour: "#d1fae5", particleColour: "#6ee7b7",
    particleArrangement: "grid",
    macroImage: "🧊",
    surfaceColour: "#f0fdf4",
    layers: [
      { zoom: 0, label: "Sugar cube",           description: "White, crystalline cube — clearly structured, sweet, dissolves in water" },
      { zoom: 1, label: "Crystal face (×10)",   description: "Perfect flat crystal faces with sharp edges — highly ordered structure" },
      { zoom: 2, label: "Crystal lattice (×1,000)", description: "The regular repeating pattern of the crystal becomes visible" },
      { zoom: 3, label: "Molecular level (×10,000)", description: "Sucrose molecules arranged in precise rows and columns" },
      { zoom: 4, label: "Sucrose molecules",    description: "C₁₂H₂₂O₁₁ molecules — in a highly ordered crystal lattice, tightly packed" },
    ],
  },
];

const EXPLORED_KEY = "infiniteZoom_explored";

// ── Particle canvas ───────────────────────────────────────────────────────────

function drawParticles(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  material: Material,
  alpha: number
) {
  const col = material.particleColour;
  const arr = material.particleArrangement;
  const pr = arr === "spread" ? 5 : 7;
  const spacing = arr === "grid" ? 22 : arr === "random" ? 18 : 45;
  const count = arr === "spread" ? 20 : 60;

  const pts: { x: number; y: number }[] = [];
  if (arr === "grid") {
    for (let x = 18; x < W - 10; x += spacing) {
      for (let y = 18; y < H - 10; y += spacing) {
        pts.push({ x: x + (Math.random() - 0.5) * 2, y: y + (Math.random() - 0.5) * 2 });
      }
    }
  } else {
    for (let i = 0; i < count; i++) {
      pts.push({ x: 12 + Math.random() * (W - 24), y: 12 + Math.random() * (H - 24) });
    }
  }

  ctx.globalAlpha = alpha;

  // Bond lines for solids
  if (arr === "grid") {
    pts.forEach((p, i) => {
      pts.slice(i + 1).forEach(p2 => {
        if (Math.hypot(p.x - p2.x, p.y - p2.y) < 30) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = col; ctx.globalAlpha = alpha * 0.25;
          ctx.lineWidth = 1; ctx.stroke();
          ctx.globalAlpha = alpha;
        }
      });
    });
  }

  pts.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  });

  ctx.globalAlpha = 1;
}

// ── Main canvas rendering for a zoom level ────────────────────────────────────

function ZoomCanvas({
  material,
  zoomLevel,    // 0-4 integer
  zoomFraction, // 0-1 fractional progress to next level
}: {
  material: Material;
  zoomLevel: number;
  zoomFraction: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const timeRef   = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;

    const draw = (ts: number) => {
      timeRef.current = ts * 0.001;
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = "#060d18";
      ctx.fillRect(0, 0, W, H);

      const t = timeRef.current;
      const isGas = material.state === "gas";
      const isLiquid = material.state === "liquid";
      const particleAlpha = Math.max(0, (zoomLevel + zoomFraction - 3));

      if (zoomLevel === 0 && zoomFraction < 0.15) {
        // Pure macro view — canvas just shows background, HTML overlay shows object
        ctx.fillStyle = "#060d18";
        ctx.fillRect(0, 0, W, H);
      } else {
        // Zoom levels 0→4: draw progressively more "micro" texture
        const scaleEffect = 1 + (zoomLevel + zoomFraction) * 2;
        const tileSize = Math.max(4, 80 / scaleEffect);

        if (!isGas || zoomLevel >= 3) {
          // Draw surface texture
          const surfAlpha = Math.max(0, 1 - particleAlpha);
          ctx.globalAlpha = surfAlpha * 0.6;

          if (material.state === "solid") {
            // Grid-like crystal / grain texture
            ctx.strokeStyle = material.surfaceColour;
            ctx.lineWidth = 0.5;
            for (let x = 0; x < W; x += tileSize) {
              for (let y = 0; y < H; y += tileSize) {
                const jx = x + (Math.sin((x + y) * 0.3 + t * 0.5) * tileSize * 0.15);
                const jy = y + (Math.cos((x - y) * 0.3 + t * 0.3) * tileSize * 0.15);
                ctx.strokeRect(jx, jy, tileSize * 0.9, tileSize * 0.9);
              }
            }
          } else if (isLiquid) {
            // Wavy fluid texture
            ctx.strokeStyle = material.surfaceColour;
            ctx.lineWidth = 1;
            for (let y = 0; y < H; y += tileSize) {
              ctx.beginPath();
              for (let x = 0; x < W; x += 4) {
                const wy = y + Math.sin((x * 0.05) + t * 2 + y * 0.1) * tileSize * 0.3;
                x === 0 ? ctx.moveTo(x, wy) : ctx.lineTo(x, wy);
              }
              ctx.stroke();
            }
          }
          ctx.globalAlpha = 1;
        } else {
          // Gas at macro — mostly empty
          ctx.fillStyle = material.surfaceColour;
          ctx.globalAlpha = 0.03;
          ctx.fillRect(0, 0, W, H);
          ctx.globalAlpha = 1;
        }

        // Particles fade in from level 3
        if (particleAlpha > 0) {
          // Animate particle positions
          const pts: { x: number; y: number; vx: number; vy: number }[] = [];
          const seed = material.id.charCodeAt(0);
          const count = material.state === "gas" ? 18 : material.state === "liquid" ? 55 : 70;
          const spacing = material.state === "gas" ? 55 : material.state === "solid" ? 21 : 23;

          if (material.particleArrangement === "grid") {
            for (let x = 14; x < W - 8; x += spacing) {
              for (let y = 14; y < H - 8; y += spacing) {
                const jitter = material.state === "solid" ? 1.5 : 5;
                pts.push({
                  x: x + Math.sin((x * 0.8 + seed) + t * 1.2) * jitter,
                  y: y + Math.cos((y * 0.8 + seed) + t * 0.9) * jitter,
                  vx: 0, vy: 0,
                });
              }
            }
          } else {
            for (let i = 0; i < count; i++) {
              const baseX = 14 + ((i * 37 + seed * 13) % (W - 28));
              const baseY = 14 + ((i * 53 + seed * 7) % (H - 28));
              const speed = isGas ? 18 : 6;
              pts.push({
                x: baseX + Math.sin(t * speed * 0.1 + i * 1.4) * (isGas ? 22 : 8),
                y: baseY + Math.cos(t * speed * 0.1 + i * 2.1) * (isGas ? 22 : 8),
                vx: 0, vy: 0,
              });
            }
          }

          const col = material.particleColour;
          const pr = material.state === "gas" ? 5 : 7;

          // Bond lines (solid only)
          if (material.state === "solid") {
            ctx.globalAlpha = particleAlpha * 0.3;
            ctx.strokeStyle = col;
            ctx.lineWidth = 1;
            pts.forEach((p, i) => {
              pts.slice(i + 1).forEach(p2 => {
                if (Math.hypot(p.x - p2.x, p.y - p2.y) < 28) {
                  ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
                }
              });
            });
          }

          // Motion trails (gas/liquid)
          if (material.state !== "solid") {
            ctx.globalAlpha = particleAlpha * 0.15;
            ctx.strokeStyle = col;
            ctx.lineWidth = 1;
            pts.slice(0, 10).forEach((p, i) => {
              const len = isGas ? 12 : 5;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p.x + Math.cos(t * 3 + i) * len, p.y + Math.sin(t * 2 + i) * len);
              ctx.stroke();
            });
          }

          // Draw particles
          ctx.globalAlpha = particleAlpha;
          ctx.fillStyle = col;
          pts.forEach(p => {
            ctx.beginPath(); ctx.arc(p.x, p.y, pr, 0, Math.PI * 2); ctx.fill();
          });
          ctx.globalAlpha = 1;
        }
      }

      // Zoom crosshair overlay (levels 1-3)
      if (zoomLevel >= 1 && zoomLevel <= 3) {
        const cx = W / 2, cy = H / 2;
        const r = 30 - zoomLevel * 6;
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - r - 5, cy); ctx.lineTo(cx + r + 5, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy - r - 5); ctx.lineTo(cx, cy + r + 5); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [material, zoomLevel, zoomFraction]);

  return (
    <div style={{ position: "relative", borderRadius: 10, overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        width={280} height={200}
        style={{ display: "block", width: "100%", borderRadius: 10 }}
      />
      {/* Macro view overlay — shows when zoom is very low */}
      {zoomLevel === 0 && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
          opacity: Math.max(0, 1 - zoomFraction * 4),
          transition: "opacity 0.1s",
          fontSize: zoomFraction < 0.1 ? "5rem" : "4rem",
        }}>
          {material.id === "spoon" ? "🥄" :
           material.id === "water" ? "💧" :
           material.id === "wood"  ? "🪑" :
           material.id === "air"   ? "🎈" :
           material.id === "sugar" ? "🍬" :
           material.id === "glass" ? "🪟" : "⬜"}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InfiniteZoomExplorer({ config = {}, colour = "#0284c7" }: {
  config?: InfiniteZoomExplorerConfig;
  colour?: string;
}) {
  const [selectedId, setSelectedId]   = useState("spoon");
  const [zoom, setZoom]               = useState(0);          // 0-4 float
  const [explored, setExplored]       = useState<Set<string>>(new Set());
  const [showSummary, setShowSummary] = useState(false);

  const material    = MATERIALS.find(m => m.id === selectedId)!;
  const zoomLevel   = Math.min(4, Math.floor(zoom));
  const zoomFraction = zoom - zoomLevel;
  const atParticles = zoom >= 3.8;
  const maxZoom     = 4;

  const currentLayer = material.layers[Math.min(zoomLevel, material.layers.length - 1)];

  useEffect(() => {
    if (atParticles && !explored.has(selectedId)) {
      const next = new Set(explored);
      next.add(selectedId);
      setExplored(next);
      if (next.size === MATERIALS.length) {
        setTimeout(() => setShowSummary(true), 1000);
      }
    }
  }, [atParticles, selectedId, explored]);

  const selectMaterial = (id: string) => { setSelectedId(id); setZoom(0); };

  const zoomIn  = () => setZoom(z => Math.min(maxZoom, z + 0.5));
  const zoomOut = () => setZoom(z => Math.max(0, z - 0.5));

  const zoomLabels = ["Macroscopic", "×10", "×1,000", "×10,000", "Particle level"];
  const zoomLabel  = zoomLabels[zoomLevel];

  return (
    <div style={{
      background: "linear-gradient(160deg, #0a1628 0%, #060d18 100%)",
      borderRadius: 14, padding: 18, userSelect: "none", position: "relative",
    }}>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 800, color: colour, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>
          Infinite Zoom Explorer
        </div>
        <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)" }}>
          Use + / − to zoom into any material down to particle level
        </div>
      </div>

      {/* Material picker */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
        {MATERIALS.map(m => (
          <button key={m.id} onClick={() => selectMaterial(m.id)} style={{
            padding: "5px 10px", borderRadius: 8, border: "none", cursor: "pointer",
            background: selectedId === m.id ? `${colour}25` : "rgba(255,255,255,0.05)",
            color: selectedId === m.id ? colour : "rgba(255,255,255,0.55)",
            fontSize: "0.72rem", fontWeight: selectedId === m.id ? 700 : 400,
            outline: `1px solid ${selectedId === m.id ? colour : "rgba(255,255,255,0.08)"}`,
            display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s",
          }}>
            {m.label}
            {explored.has(m.id) && <span style={{ color: "#34d399", fontSize: "0.6rem" }}>✓</span>}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div style={{ position: "relative", marginBottom: 10, background: "#060d18", borderRadius: 10, overflow: "hidden" }}>
        <ZoomCanvas material={material} zoomLevel={zoomLevel} zoomFraction={zoomFraction} />

        {/* Zoom level badge */}
        <div style={{
          position: "absolute", top: 8, left: 8,
          background: "rgba(0,0,0,0.7)", borderRadius: 6,
          padding: "3px 8px", backdropFilter: "blur(4px)",
        }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 800, color: colour }}>{zoomLabel}</div>
        </div>

        {/* Particle level badge */}
        {atParticles && (
          <div style={{
            position: "absolute", top: 8, right: 8,
            background: "rgba(5,150,105,0.8)", borderRadius: 6,
            padding: "3px 8px", fontSize: "0.65rem", fontWeight: 800, color: "#fff",
          }}>Particle level ✓</div>
        )}
      </div>

      {/* Zoom controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button onClick={zoomOut} disabled={zoom <= 0} style={{
          width: 36, height: 36, borderRadius: 8, border: "none", fontSize: "1.1rem",
          background: zoom > 0 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)",
          color: zoom > 0 ? "#fff" : "rgba(255,255,255,0.2)",
          cursor: zoom > 0 ? "pointer" : "not-allowed", display: "flex",
          alignItems: "center", justifyContent: "center", fontWeight: 700,
        }}>−</button>

        {/* Zoom bar */}
        <div style={{ flex: 1 }}>
          <input type="range" min={0} max={maxZoom} step={0.05} value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            style={{ width: "100%", accentColor: colour, cursor: "pointer" }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
            {zoomLabels.map((l, i) => (
              <div key={i} style={{
                fontSize: "0.55rem", color: i === zoomLevel ? colour : "rgba(255,255,255,0.2)",
                fontWeight: i === zoomLevel ? 700 : 400, transition: "color 0.2s",
              }}>{l}</div>
            ))}
          </div>
        </div>

        <button onClick={zoomIn} disabled={zoom >= maxZoom} style={{
          width: 36, height: 36, borderRadius: 8, border: "none", fontSize: "1.1rem",
          background: zoom < maxZoom ? colour : "rgba(255,255,255,0.03)",
          color: zoom < maxZoom ? "#fff" : "rgba(255,255,255,0.2)",
          cursor: zoom < maxZoom ? "pointer" : "not-allowed", display: "flex",
          alignItems: "center", justifyContent: "center", fontWeight: 700,
        }}>+</button>
      </div>

      {/* Description panel */}
      <div style={{
        padding: 12, background: "rgba(255,255,255,0.04)",
        borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)",
        marginBottom: 10,
      }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#fff", marginBottom: 4 }}>
          {currentLayer.label}
        </div>
        <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
          {currentLayer.description}
        </div>
        {atParticles && (
          <div style={{ marginTop: 6, fontSize: "0.68rem", color: colour, fontWeight: 600 }}>
            {material.state === "solid" && "Tightly packed · Regular arrangement · Vibrate in fixed positions"}
            {material.state === "liquid" && "Close together · Random arrangement · Slide past each other"}
            {material.state === "gas"   && "Far apart · Moving very fast · No fixed positions"}
          </div>
        )}
      </div>

      {/* Progress */}
      <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.25)" }}>
        Explored to particle level: {explored.size} / {MATERIALS.length} materials
      </div>

      {/* Summary */}
      {showSummary && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 14,
          background: "rgba(6,13,24,0.96)", padding: 20, overflowY: "auto", zIndex: 10,
        }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "#fff", marginBottom: 4 }}>
            Everything is made of particles
          </div>
          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", marginBottom: 16, lineHeight: 1.5 }}>
            Every material looks smooth at normal scale. But zoom in far enough and particles always appear — no matter what the material is.
          </div>
          {(["solid","liquid","gas"] as const).map(state => {
            const mats = MATERIALS.filter(m => m.state === state);
            const sc = state === "solid" ? "#60a5fa" : state === "liquid" ? "#34d399" : "#a78bfa";
            const desc = state === "solid" ? "Tightly packed · Fixed positions · Vibrate in place"
              : state === "liquid" ? "Close together · Move past each other"
              : "Far apart · Moving fast in all directions";
            return (
              <div key={state} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 800, color: sc, textTransform: "uppercase", marginBottom: 4 }}>{state}s</div>
                <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>{desc}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {mats.map(m => (
                    <div key={m.id} style={{
                      padding: "5px 10px", borderRadius: 8,
                      background: `${sc}10`, border: `1px solid ${sc}30`,
                      fontSize: "0.72rem", color: "#fff",
                    }}>{m.label}</div>
                  ))}
                </div>
              </div>
            );
          })}
          <button onClick={() => { setShowSummary(false); setZoom(0); setSelectedId("spoon"); setExplored(new Set()); }} style={{
            width: "100%", padding: "10px", borderRadius: 8, border: "none",
            background: colour, color: "#fff", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
          }}>Explore again</button>
        </div>
      )}
    </div>
  );
}