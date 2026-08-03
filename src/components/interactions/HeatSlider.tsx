// FILE: src/components/interactions/HeatSlider.tsx
"use client";

import { useEffect, useRef, useState } from "react";

export interface HeatSliderConfig {
  [key: string]: unknown;
  startState?: "solid" | "liquid" | "gas";
  minTemp?: number;
  maxTemp?: number;
  meltingPoint?: number;
  boilingPoint?: number;
  particleCount?: number;
  substanceName?: string;
  showThermometer?: boolean;
  showStateLabel?: boolean;
  allowCooling?: boolean;
  goalTemp?: number;
}

interface HeatSliderProps {
  config: HeatSliderConfig;
  onGoalReached?: () => void;
  colour?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

function getState(temp: number, meltingPoint: number, boilingPoint: number): "solid" | "liquid" | "gas" {
  if (temp < meltingPoint) return "solid";
  if (temp < boilingPoint) return "liquid";
  return "gas";
}

function stateColour(state: "solid" | "liquid" | "gas", accent: string): string {
  if (state === "solid") return "#60a5fa";
  if (state === "liquid") return "#34d399";
  return `${accent}cc`;
}

export default function HeatSlider({ config, onGoalReached, colour = "#f5a623" }: HeatSliderProps) {
  const {
    startState     = "solid",
    minTemp        = 0,
    maxTemp        = 200,
    meltingPoint   = 60,
    boilingPoint   = 120,
    particleCount  = 24,
    substanceName  = "Substance",
    showThermometer = true,
    showStateLabel  = true,
    allowCooling    = true,
    goalTemp,
  } = config;

  const startTemp = startState === "gas" ? boilingPoint + 20 : startState === "liquid" ? meltingPoint + 10 : minTemp;
  const [temp, setTemp] = useState(startTemp);
  const [goalReached, setGoalReached] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const animRef   = useRef<number>(0);
  const tempRef   = useRef(temp);
  tempRef.current = temp;

  const state = getState(temp, meltingPoint, boilingPoint);
  const pct   = (temp - minTemp) / (maxTemp - minTemp);

  // Init particles
  useEffect(() => {
    const W = 260, H = 200;
    particles.current = Array.from({ length: particleCount }, (_, i) => {
      const cols = Math.ceil(Math.sqrt(particleCount));
      const col  = i % cols;
      const row  = Math.floor(i / cols);
      return {
        x: 20 + (col / cols) * (W - 40) + Math.random() * 8,
        y: 20 + (row / Math.ceil(particleCount / cols)) * (H - 40) + Math.random() * 8,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        r: 7,
      };
    });
  }, [particleCount]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;

    const draw = () => {
      const t = tempRef.current;
      const st = getState(t, meltingPoint, boilingPoint);
      const speed = st === "solid" ? 0.4 : st === "liquid" ? 1.8 : 4.5;
      const spread = st === "solid" ? 0.015 : st === "liquid" ? 0.04 : 0.12;

      ctx.clearRect(0, 0, W, H);

      // Background
      const bgAlpha = 0.06 + pct * 0.08;
      ctx.fillStyle = `rgba(255,120,0,${bgAlpha})`;
      ctx.fillRect(0, 0, W, H);

      // Update + draw particles
      particles.current.forEach((p, i) => {
        // Attraction to grid position (solid) or free (gas)
        const cols = Math.ceil(Math.sqrt(particleCount));
        const col  = i % cols;
        const row  = Math.floor(i / cols);
        const homeX = 20 + (col / cols) * (W - 40);
        const homeY = 20 + (row / Math.ceil(particleCount / cols)) * (H - 40);

        if (st === "solid") {
          p.vx += (homeX - p.x) * spread;
          p.vy += (homeY - p.y) * spread;
        } else if (st === "liquid") {
          p.vx += (homeX - p.x) * spread * 0.3;
          p.vy += (homeY - p.y) * spread * 0.3;
          p.vx += (Math.random() - 0.5) * 0.3;
          p.vy += (Math.random() - 0.5) * 0.3;
        } else {
          p.vx += (Math.random() - 0.5) * 0.6;
          p.vy += (Math.random() - 0.5) * 0.6;
        }

        // Clamp speed
        const spd = Math.sqrt(p.vx ** 2 + p.vy ** 2);
        if (spd > speed) { p.vx = (p.vx / spd) * speed; p.vy = (p.vy / spd) * speed; }

        p.x += p.vx;
        p.y += p.vy;

        // Bounce walls
        if (p.x < p.r) { p.x = p.r; p.vx = Math.abs(p.vx); }
        if (p.x > W - p.r) { p.x = W - p.r; p.vx = -Math.abs(p.vx); }
        if (p.y < p.r) { p.y = p.r; p.vy = Math.abs(p.vy); }
        if (p.y > H - p.r) { p.y = H - p.r; p.vy = -Math.abs(p.vy); }

        // Draw
        const col2 = stateColour(st, colour);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = col2;
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Bond lines (solid only)
        if (st === "solid") {
          particles.current.forEach((p2, j) => {
            if (j <= i) return;
            const d = Math.hypot(p.x - p2.x, p.y - p2.y);
            if (d < 38) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = `${col2}40`;
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          });
        }
      });

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [meltingPoint, boilingPoint, particleCount, colour]);

  // Goal check
  useEffect(() => {
    if (goalTemp && temp >= goalTemp && !goalReached) {
      setGoalReached(true);
      onGoalReached?.();
    }
  }, [temp, goalTemp, goalReached, onGoalReached]);

  const stateLabels: Record<string, string> = {
    solid: "Solid — particles vibrate in fixed positions",
    liquid: "Liquid — particles slide past each other",
    gas: "Gas — particles move freely and fast",
  };

  const stateTitle = state === "solid"
    ? "Particles locked in place"
    : state === "liquid"
    ? "Particles flowing freely"
    : "Particles escaping as gas";

  const stateHint = state === "solid"
    ? `${substanceName} is solid — drag up to add heat`
    : state === "liquid"
    ? `${substanceName} has melted — keep heating to boil it`
    : `${substanceName} is now a gas — all particles are free`;

  return (
    <div style={{
      background: "linear-gradient(160deg, #0a1220 0%, #060d18 100%)",
      borderRadius: 12,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      gap: 0,
      userSelect: "none",
    }}>
      {/* ── Prototype-style header: bold title + dim subtitle ── */}
      <div style={{
        background: "rgba(255,255,255,0.025)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "14px 18px 12px",
        textAlign: "center",
        transition: "opacity 0.25s",
      }}>
        <div style={{
          fontFamily: "var(--eg-font-display, 'Space Grotesk', sans-serif)",
          fontSize: "1.05rem", fontWeight: 900,
          color: "#fff", lineHeight: 1.25, marginBottom: 4,
          letterSpacing: "-0.01em",
          transition: "all 0.25s",
        }}>
          {stateTitle}
        </div>
        <div style={{
          fontFamily: "var(--eg-font-body, 'Space Grotesk', sans-serif)",
          fontSize: "0.75rem", fontWeight: 500,
          color: "rgba(255,255,255,0.45)",
          lineHeight: 1.4, transition: "all 0.25s",
        }}>
          {stateHint}
        </div>
      </div>

      <div style={{ padding: "14px 16px 0", display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Canvas */}
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          width={260} height={200}
          style={{ borderRadius: 8, display: "block", border: "1px solid rgba(255,255,255,0.06)", width: "100%" }}
        />
        {/* State label overlay */}
        {showStateLabel && (
          <div style={{
            position: "absolute", bottom: 8, left: 8, right: 8,
            background: "rgba(0,0,0,0.55)", borderRadius: 6,
            padding: "5px 10px", fontSize: "0.72rem",
            color: stateColour(state, colour), fontWeight: 600,
            backdropFilter: "blur(4px)",
          }}>
            {stateLabels[state]}
          </div>
        )}
        {/* Goal reached */}
        {goalReached && (
          <div style={{
            position: "absolute", top: 8, right: 8,
            background: "#059669", borderRadius: 6,
            padding: "4px 10px", fontSize: "0.7rem", color: "#fff", fontWeight: 700,
          }}>✓ Goal reached</div>
        )}
      </div>

      {/* Thermometer + slider */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
        {showThermometer && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.3)" }}>°C</div>
            <div style={{
              width: 14, height: 80, background: "rgba(255,255,255,0.08)",
              borderRadius: 7, position: "relative", overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.1)",
            }}>
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                height: `${pct * 100}%`,
                background: pct > 0.7 ? "#ef4444" : pct > 0.4 ? "#f59e0b" : "#60a5fa",
                borderRadius: "0 0 7px 7px",
                transition: "height 0.1s, background 0.3s",
              }} />
            </div>
            <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>
              {Math.round(temp)}
            </div>
          </div>
        )}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Melting / boiling markers */}
          <div style={{ position: "relative", height: 12 }}>
            {[
              { val: meltingPoint, label: "Melting", col: "#34d399" },
              { val: boilingPoint, label: "Boiling", col: "#f59e0b" },
            ].map(m => (
              <div key={m.label} style={{
                position: "absolute",
                left: `${((m.val - minTemp) / (maxTemp - minTemp)) * 100}%`,
                transform: "translateX(-50%)",
                fontSize: "0.58rem", color: m.col, fontWeight: 700, whiteSpace: "nowrap",
              }}>
                ▼ {m.label}
              </div>
            ))}
          </div>

          <input
            type="range"
            min={minTemp}
            max={maxTemp}
            value={temp}
            disabled={!allowCooling && false}
            onChange={e => setTemp(Number(e.target.value))}
            style={{ width: "100%", accentColor: colour, cursor: "pointer" }}
          />

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.62rem", color: "rgba(255,255,255,0.3)" }}>
            <span>❄ {minTemp}°C</span>
            <span style={{ color: colour, fontWeight: 700 }}>{Math.round(temp)}°C</span>
            <span>🔥 {maxTemp}°C</span>
          </div>
        </div>
      </div>

      {/* Milestone labels */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[
          { label: "Solid", active: state === "solid", col: "#60a5fa" },
          { label: "Melting point", active: temp >= meltingPoint - 5 && temp <= meltingPoint + 5, col: "#34d399" },
          { label: "Liquid", active: state === "liquid", col: "#34d399" },
          { label: "Boiling point", active: temp >= boilingPoint - 5 && temp <= boilingPoint + 5, col: "#f59e0b" },
          { label: "Gas", active: state === "gas", col: `${colour}` },
        ].map(m => (
          <div key={m.label} style={{
            fontSize: "0.62rem", fontWeight: 700, padding: "2px 8px",
            borderRadius: 20,
            background: m.active ? `${m.col}20` : "rgba(255,255,255,0.04)",
            border: `1px solid ${m.active ? m.col : "rgba(255,255,255,0.08)"}`,
            color: m.active ? m.col : "rgba(255,255,255,0.25)",
            transition: "all 0.2s",
          }}>{m.label}</div>
        ))}
      </div>
      </div>{/* end inner padding div */}
    </div>
    
  );
}