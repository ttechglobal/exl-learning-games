// FILE: src/components/interactions/AtomReveal.tsx
"use client";

import { useState, useEffect, useRef } from "react";

// ─── Config ──────────────────────────────────────────────────────────────────

export interface AtomRevealConfig {
  [key: string]: unknown;
  coachName?: string;
  electronCount?: number;   // 2, 3, or 4 — default 3
  objectName?: string;      // what's being peeled — default "Wood"
  accentColour?: string;
}

interface AtomRevealProps {
  config: AtomRevealConfig;
  onGoalReached?: () => void;
  colour?: string;
}

// ─── Layer data ───────────────────────────────────────────────────────────────

const LAYERS = [
  {
    id: "outer",
    label: "Outer layer",
    fill: "#6b4c2a",
    stroke: "#4a3420",
    radius: 130,
    coachLine: "There's more inside than we thought.",
  },
  {
    id: "middle",
    label: "Inner layer",
    fill: "#a07850",
    stroke: "#7a5830",
    radius: 95,
    coachLine: "Keep going — what else is in here?",
  },
  {
    id: "inner",
    label: "Molecule layer",
    fill: "#c8a87c",
    stroke: "#a08060",
    radius: 65,
    coachLine: "We're getting smaller and smaller…",
  },
];

const ATOM_REVEAL_STEPS = [
  {
    id: "atom",
    label: "Atom",
    coachLine: "This is an atom — the tiny building block of all matter.",
  },
  {
    id: "nucleus",
    label: "Nucleus",
    coachLine: "Tap the nucleus — the tiny centre of the atom.",
  },
  {
    id: "electron",
    label: "Electron",
    coachLine: "Tap an electron — they move around the nucleus.",
  },
  {
    id: "done",
    label: "Done",
    coachLine: "You discovered it — atoms have smaller parts inside!",
  },
];

// ─── Electron orbit paths ─────────────────────────────────────────────────────

function getElectronPos(angle: number, orbitA: number, orbitB: number, tilt: number) {
  const rad = (angle * Math.PI) / 180;
  const tiltRad = (tilt * Math.PI) / 180;
  const x = orbitA * Math.cos(rad);
  const y = orbitB * Math.sin(rad);
  // Apply tilt rotation
  return {
    x: x * Math.cos(tiltRad) - y * Math.sin(tiltRad),
    y: x * Math.sin(tiltRad) + y * Math.cos(tiltRad),
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AtomReveal({ config, onGoalReached, colour = "#00d4ff" }: AtomRevealProps) {
  const {
    coachName     = "Adaobi",
    electronCount = 3,
    objectName    = "Wood",
    accentColour,
  } = config;

  const accent = accentColour ?? colour;
  const numElectrons = Math.min(4, Math.max(2, electronCount));

  // How many wood layers have been peeled (0, 1, 2, 3)
  const [peeled, setPeeled]             = useState(0);
  // Which atomic step we're on after all layers peeled
  const [atomStep, setAtomStep]         = useState(0);
  // Which electron was last tapped
  const [tappedElectron, setTappedElectron] = useState<number | null>(null);
  // Nucleus tapped
  const [nucleusTapped, setNucleusTapped]   = useState(false);
  // Bounce animation on wrong tap
  const [bouncing, setBouncing]         = useState(false);
  // Electron angles for animation
  const anglesRef = useRef<number[]>(
    Array.from({ length: numElectrons }, (_, i) => (360 / numElectrons) * i)
  );
  const [angles, setAngles]             = useState<number[]>(anglesRef.current);
  const rafRef                          = useRef<number>(0);
  const doneRef                         = useRef(false);

  const allLayersPeeled = peeled >= LAYERS.length;
  const currentAtomStep = ATOM_REVEAL_STEPS[atomStep];

  // ── Electron orbit animation ──────────────────────────────────────────────
  useEffect(() => {
    if (!allLayersPeeled) return;
    const speeds = Array.from({ length: numElectrons }, (_, i) => 0.6 + i * 0.2);

    const tick = () => {
      anglesRef.current = anglesRef.current.map((a, i) => (a + speeds[i]) % 360);
      setAngles([...anglesRef.current]);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [allLayersPeeled, numElectrons]);

  // ── Tap: peel a wood layer ────────────────────────────────────────────────
  const handleObjectTap = () => {
    if (allLayersPeeled) return;
    setPeeled(p => p + 1);
  };

  // ── Tap: nucleus ──────────────────────────────────────────────────────────
  const handleNucleusTap = () => {
    if (atomStep !== 1) {
      // wrong time — gentle bounce
      setBouncing(true);
      setTimeout(() => setBouncing(false), 400);
      return;
    }
    setNucleusTapped(true);
    setTimeout(() => setAtomStep(2), 600);
  };

  // ── Tap: electron ─────────────────────────────────────────────────────────
  const handleElectronTap = (idx: number) => {
    if (atomStep !== 2) return;
    setTappedElectron(idx);
    setTimeout(() => {
      setAtomStep(3);
      if (!doneRef.current) {
        doneRef.current = true;
        onGoalReached?.();
      }
    }, 700);
  };

  // ── Coach line ────────────────────────────────────────────────────────────
  const coachLine = (() => {
    if (!allLayersPeeled) {
      if (peeled === 0) return `This ${objectName.toLowerCase()} looks solid. Let's find out what's really inside. Tap to open it.`;
      return LAYERS[peeled - 1].coachLine;
    }
    return currentAtomStep.coachLine;
  })();

  // ── Instruction ───────────────────────────────────────────────────────────
  const instruction = (() => {
    if (!allLayersPeeled) return `Tap the ${objectName.toLowerCase()} to peel a layer`;
    if (atomStep === 0) return "Tap the atom";
    if (atomStep === 1) return "Tap the nucleus";
    if (atomStep === 2) return "Tap an electron";
    return "Discovery complete!";
  })();

  // ── Orbit config: 3 ellipses at different tilts ───────────────────────────
  const orbits = [
    { a: 56, b: 22, tilt: 0,   speed: 0.6 },
    { a: 56, b: 22, tilt: 60,  speed: 0.8 },
    { a: 56, b: 22, tilt: 120, speed: 0.5 },
    { a: 56, b: 22, tilt: 90,  speed: 0.9 },
  ].slice(0, numElectrons);

  const CX = 130; // SVG centre X
  const CY = 130; // SVG centre Y

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: 0, padding: "0 0 16px",
      fontFamily: "var(--eg-font-body, 'Inter', sans-serif)",
      userSelect: "none",
      WebkitUserSelect: "none",
    }}>

      {/* ── Coach panel ── */}
      <div style={{
        width: "100%", maxWidth: 340,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14, padding: "12px 16px",
        marginBottom: 12,
        display: "flex", alignItems: "flex-start", gap: 10,
      }}>
        {/* Avatar placeholder */}
        <div style={{
          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
          background: `${accent}22`,
          border: `2px solid ${accent}55`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1rem",
        }}>🧑‍🔬</div>
        <div>
          <div style={{ fontSize: "0.58rem", fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>
            {coachName}
          </div>
          <div style={{ fontSize: "0.86rem", color: "rgba(255,255,255,0.88)", lineHeight: 1.55, transition: "opacity 0.3s" }}>
            {coachLine}
          </div>
        </div>
      </div>

      {/* ── Main SVG interaction area ── */}
      <div style={{ position: "relative", width: 260, height: 260 }}>
        <svg
          viewBox="0 0 260 260"
          width="260" height="260"
          style={{ overflow: "visible" }}
        >
          {/* ── WOOD OBJECT (before fully peeled) ── */}
          {!allLayersPeeled && (
            <g
              onClick={handleObjectTap}
              style={{ cursor: "pointer" }}
              role="button"
              aria-label={`${objectName}, tap to peel`}
            >
              {/* Render only layers that haven't been peeled yet, outermost first */}
              {LAYERS.slice(peeled).reverse().map((layer) => (
                <g key={layer.id}>
                  {/* Layer circle */}
                  <circle
                    cx={CX} cy={CY}
                    r={layer.radius}
                    fill={layer.fill}
                    stroke={layer.stroke}
                    strokeWidth={2.5}
                    style={{ transition: "r 0.35s ease, opacity 0.3s" }}
                  />
                  {/* Wood grain lines on outermost visible layer */}
                  {layer.id === LAYERS[peeled].id && (
                    <>
                      {[-30, -10, 10, 30].map((dy) => (
                        <ellipse key={dy}
                          cx={CX} cy={CY + dy}
                          rx={layer.radius * 0.7}
                          ry={layer.radius * 0.18}
                          fill="none"
                          stroke={layer.stroke}
                          strokeWidth={1}
                          opacity={0.35}
                        />
                      ))}
                    </>
                  )}
                </g>
              ))}

              {/* Layer count badge */}
              <text x={CX} y={CY + 5}
                textAnchor="middle"
                fontSize={13}
                fontWeight={700}
                fill="rgba(255,255,255,0.75)"
                style={{ pointerEvents: "none" }}
              >
                {objectName}
              </text>
              <text x={CX} y={CY + 22}
                textAnchor="middle"
                fontSize={10}
                fill="rgba(255,255,255,0.45)"
                style={{ pointerEvents: "none" }}
              >
                {LAYERS.length - peeled} layer{LAYERS.length - peeled !== 1 ? "s" : ""} left
              </text>

              {/* Tap ripple hint on first tap */}
              {peeled === 0 && (
                <circle cx={CX} cy={CY} r={LAYERS[0].radius + 8}
                  fill="none"
                  stroke={accent}
                  strokeWidth={2}
                  opacity={0.3}
                  style={{ animation: "atomPulse 1.8s ease-in-out infinite" }}
                />
              )}
            </g>
          )}

          {/* ── PEELED LAYER LABELS (shown as rings peel off) ── */}
          {LAYERS.slice(0, peeled).map((layer, i) => (
            <text key={layer.id}
              x={CX + layer.radius + 12}
              y={CY - 28 + i * 20}
              fontSize={9}
              fill={layer.fill}
              opacity={0.7}
              fontWeight={600}
            >
              ↑ {layer.label}
            </text>
          ))}

          {/* ── ATOM (revealed after all layers peeled) ── */}
          {allLayersPeeled && (
            <g>
              {/* Atom shell — faint outer glow */}
              <circle cx={CX} cy={CY} r={68}
                fill={`${accent}08`}
                stroke={`${accent}20`}
                strokeWidth={1.5}
                strokeDasharray="4 6"
              />

              {/* Orbit ellipses — decorative */}
              {orbits.map((orb, i) => {
                const tiltRad = (orb.tilt * Math.PI) / 180;
                // SVG ellipse rotated via transform
                return (
                  <ellipse key={i}
                    cx={CX} cy={CY}
                    rx={orb.a} ry={orb.b}
                    fill="none"
                    stroke={`${accent}18`}
                    strokeWidth={1}
                    transform={`rotate(${orb.tilt} ${CX} ${CY})`}
                  />
                );
              })}

              {/* Nucleus */}
              <g
                onClick={handleNucleusTap}
                style={{ cursor: atomStep === 1 ? "pointer" : "default" }}
                role="button"
                aria-label="Nucleus"
              >
                <circle cx={CX} cy={CY} r={nucleusTapped ? 15 : 12}
                  fill={nucleusTapped ? "#ff9f43" : "#e55"}
                  style={{ transition: "r 0.3s ease, filter 0.3s" }}
                  filter={nucleusTapped ? "url(#nucleusGlow)" : undefined}
                />
                {atomStep >= 1 && (
                  <text x={CX} y={CY + 28}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={700}
                    fill={nucleusTapped ? "#ff9f43" : "rgba(255,255,255,0.5)"}
                    style={{ pointerEvents: "none", transition: "fill 0.3s" }}
                  >
                    {nucleusTapped ? "NUCLEUS ✓" : "← tap nucleus"}
                  </text>
                )}
              </g>

              {/* Electrons */}
              {orbits.map((orb, i) => {
                const pos = getElectronPos(angles[i] ?? 0, orb.a, orb.b, orb.tilt);
                const ex = CX + pos.x;
                const ey = CY + pos.y;
                const isTapped = tappedElectron === i;
                return (
                  <g key={i}
                    onClick={() => handleElectronTap(i)}
                    style={{ cursor: atomStep === 2 ? "pointer" : "default" }}
                    role="button"
                    aria-label="Electron"
                  >
                    {/* Tap target (invisible larger area) */}
                    <circle cx={ex} cy={ey} r={18} fill="transparent" />
                    {/* Electron */}
                    <circle cx={ex} cy={ey}
                      r={isTapped ? 8 : 5}
                      fill={isTapped ? "#fff" : accent}
                      opacity={isTapped ? 1 : 0.9}
                      style={{ transition: "r 0.25s ease" }}
                      filter={isTapped ? "url(#electronGlow)" : undefined}
                    />
                    {isTapped && (
                      <text x={ex + 12} y={ey - 8}
                        fontSize={8} fontWeight={700}
                        fill="#fff"
                        style={{ pointerEvents: "none" }}
                      >
                        e⁻
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Atom label */}
              {atomStep === 0 && (
                <g
                  onClick={() => setAtomStep(1)}
                  style={{ cursor: "pointer" }}
                  role="button"
                  aria-label="Atom, tap to explore"
                >
                  <text x={CX} y={CY + 90}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={700}
                    fill={accent}
                    style={{ pointerEvents: "none" }}
                  >
                    ATOM — tap to explore
                  </text>
                </g>
              )}

              {/* Done label */}
              {atomStep === 3 && (
                <text x={CX} y={CY + 96}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={700}
                  fill="#34d399"
                  style={{ pointerEvents: "none" }}
                >
                  ✓ Discovery complete
                </text>
              )}

              {/* SVG filters */}
              <defs>
                <filter id="nucleusGlow" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="electronGlow" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
            </g>
          )}

          {/* Bounce-hint ring when wrong tap */}
          {bouncing && (
            <circle cx={CX} cy={CY} r={14}
              fill="none" stroke="#ef4444" strokeWidth={2}
              opacity={0.7}
            />
          )}
        </svg>
      </div>

      {/* ── Instruction bar ── */}
      <div style={{
        marginTop: 8,
        fontSize: "0.8rem",
        fontWeight: 700,
        color: atomStep === 3 ? "#34d399" : "rgba(255,255,255,0.55)",
        letterSpacing: "0.04em",
        textAlign: "center",
        transition: "color 0.3s",
        minHeight: 20,
      }}>
        {instruction}
      </div>

      {/* ── Progress dots (layers) ── */}
      {!allLayersPeeled && (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          {LAYERS.map((layer, i) => (
            <div key={layer.id} style={{
              width: i < peeled ? 16 : 6,
              height: 6, borderRadius: 3,
              background: i < peeled ? accent : "rgba(255,255,255,0.18)",
              transition: "width 0.3s, background 0.3s",
            }} />
          ))}
        </div>
      )}

      {/* ── Atom progress dots ── */}
      {allLayersPeeled && atomStep < 3 && (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          {ATOM_REVEAL_STEPS.slice(1).map((step, i) => (
            <div key={step.id} style={{
              width: i < atomStep ? 16 : 6,
              height: 6, borderRadius: 3,
              background: i < atomStep ? "#34d399" : "rgba(255,255,255,0.18)",
              transition: "width 0.3s, background 0.3s",
            }} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes atomPulse {
          0%, 100% { opacity: 0.3; r: calc(var(--base-r, 138) * 1px); }
          50%       { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}