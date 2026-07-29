// FILE: src/components/interactions/MatterSorter.tsx
"use client";

import { useState, useRef } from "react";

export interface MatterSorterConfig {
  showSummaryAtEnd?: boolean;
}

interface Item {
  id: string;
  label: string;
  emoji: string;
  isMatter: boolean;
  isInvisible?: boolean;
  mass: number; // kg, 0 for non-matter
  description: string;
}

const ITEMS: Item[] = [
  { id: "book",    label: "Book",          emoji: "📚", isMatter: true,  mass: 0.5, description: "Has mass and takes up space on your shelf" },
  { id: "rock",    label: "Rock",          emoji: "🪨", isMatter: true,  mass: 1.2, description: "Solid matter — clearly has mass and volume" },
  { id: "water",   label: "Water",         emoji: "💧", isMatter: true,  mass: 0.3, description: "Liquid matter — fills its container" },
  { id: "air",     label: "Air (balloon)", emoji: "🎈", isMatter: true,  mass: 0.05, isInvisible: true, description: "Gas matter — invisible but has mass" },
  { id: "wood",    label: "Wooden block",  emoji: "🪵", isMatter: true,  mass: 0.8, description: "Solid matter — occupies definite space" },
  { id: "light",   label: "Light beam",    emoji: "🔦", isMatter: false, mass: 0,   description: "No mass, no volume — pure energy" },
  { id: "shadow",  label: "Shadow",        emoji: "🌑", isMatter: false, mass: 0,   description: "Absence of light — not matter" },
  { id: "sound",   label: "Sound wave",    emoji: "🔊", isMatter: false, mass: 0,   description: "Energy that travels through matter" },
  { id: "heat",    label: "Heat",          emoji: "🔥", isMatter: false, mass: 0,   description: "Thermal energy — not matter itself" },
  { id: "rainbow", label: "Rainbow",       emoji: "🌈", isMatter: false, mass: 0,   description: "Optical phenomenon — light and water droplets" },
];

interface Placement {
  itemId: string;
  correct: boolean;
}

export default function MatterSorter({ config = {}, colour = "#0284c7" }: {
  config?: MatterSorterConfig;
  colour?: string;
}) {
  const { showSummaryAtEnd = true } = config;

  const [placements, setPlacements]   = useState<Placement[]>([]);
  const [dragging, setDragging]       = useState<string | null>(null);
  const [overlay, setOverlay]         = useState<Item | null>(null);
  const [overlayTarget, setOverlayTarget] = useState<"matter" | "notmatter" | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [airInflated, setAirInflated] = useState(false);
  const dragOver                      = useRef<"matter" | "notmatter" | null>(null);

  const placed       = new Set(placements.map(p => p.itemId));
  const remaining    = ITEMS.filter(i => !placed.has(i.id));
  const matterPlaced = placements.filter(p => {
    const item = ITEMS.find(i => i.id === p.itemId);
    return item?.isMatter && p.correct;
  });
  const totalMass    = matterPlaced.reduce((sum, p) => {
    const item = ITEMS.find(i => i.id === p.itemId);
    return sum + (item?.mass ?? 0);
  }, 0);
  const maxMass      = ITEMS.filter(i => i.isMatter).reduce((s, i) => s + i.mass, 0);
  const massPct      = Math.min(100, (totalMass / maxMass) * 100);
  const fillPct      = Math.min(100, (matterPlaced.length / ITEMS.filter(i => i.isMatter).length) * 100);

  const handleDrop = (target: "matter" | "notmatter") => {
    if (!dragging) return;
    const item = ITEMS.find(i => i.id === dragging)!;
    const correct = target === "matter" ? item.isMatter : !item.isMatter;

    if (!correct) {
      // Wrong — show overlay before returning
      setOverlay(item);
      setOverlayTarget(target);
      setDragging(null);
      return;
    }

    if (item.id === "air") setAirInflated(true);
    setPlacements(prev => [...prev, { itemId: dragging, correct: true }]);
    setDragging(null);

    // Check if done
    if (placements.length + 1 === ITEMS.length && showSummaryAtEnd) {
      setTimeout(() => setShowSummary(true), 600);
    }
  };

  const dismissOverlay = () => {
    setOverlay(null);
    setOverlayTarget(null);
  };

  const resetGame = () => {
    setPlacements([]);
    setShowSummary(false);
    setAirInflated(false);
  };

  const correctMatter   = placements.filter(p => { const i = ITEMS.find(x => x.id === p.itemId); return i?.isMatter && p.correct; });
  const correctNotMatter= placements.filter(p => { const i = ITEMS.find(x => x.id === p.itemId); return !i?.isMatter && p.correct; });

  return (
    <div style={{
      background: "linear-gradient(160deg, #0a1628 0%, #060d18 100%)",
      borderRadius: 14, padding: 20, userSelect: "none", position: "relative",
    }}>

      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 800, color: colour, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
          Matter Sorter
        </div>
        <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)" }}>
          Drag each item into the correct container
        </div>
      </div>

      {/* Mass meter */}
      <div style={{ marginBottom: 14, background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "8px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>
            Mass meter
          </div>
          <div style={{ fontSize: "0.78rem", fontWeight: 800, color: colour }}>
            {totalMass.toFixed(2)} kg
          </div>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${massPct}%`, background: colour,
            borderRadius: 3, transition: "width 0.4s ease",
          }} />
        </div>
      </div>

      {/* Containers row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>

        {/* Matter container */}
        <div
          onDragOver={e => { e.preventDefault(); dragOver.current = "matter"; }}
          onDrop={() => handleDrop("matter")}
          style={{
            minHeight: 160, borderRadius: 12,
            border: `2px dashed ${dragging ? colour : "rgba(255,255,255,0.15)"}`,
            background: "rgba(255,255,255,0.04)",
            transition: "border-color 0.2s",
            position: "relative", overflow: "hidden",
          }}
        >
          {/* Fill level */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            height: `${fillPct}%`, background: `${colour}18`,
            transition: "height 0.4s ease", borderRadius: "0 0 10px 10px",
          }} />

          <div style={{ position: "relative", zIndex: 1, padding: 10 }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 800, color: colour, marginBottom: 6, textAlign: "center" }}>
              MATTER ✓
            </div>

            {/* Air balloon special render */}
            {airInflated && (
              <div style={{ textAlign: "center", marginBottom: 4 }}>
                <div style={{
                  display: "inline-block", fontSize: "1.2rem",
                  border: `1px solid ${colour}60`, borderRadius: "50%",
                  padding: "4px 8px", background: `${colour}10`,
                  animation: "pulse 2s infinite",
                }}>🎈</div>
                <div style={{ fontSize: "0.6rem", color: colour, marginTop: 2 }}>expanding!</div>
              </div>
            )}

            {/* Placed matter items */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
              {correctMatter.map(p => {
                const item = ITEMS.find(i => i.id === p.itemId)!;
                if (item.id === "air") return null;
                return (
                  <div key={p.itemId} style={{
                    fontSize: "1.1rem", background: "rgba(255,255,255,0.08)",
                    borderRadius: 6, padding: "3px 5px",
                    animation: "dropIn 0.3s ease",
                  }} title={item.label}>{item.emoji}</div>
                );
              })}
            </div>
          </div>

          {correctMatter.length === 0 && !airInflated && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.72rem", color: "rgba(255,255,255,0.2)",
            }}>Drop matter here</div>
          )}
        </div>

        {/* Not Matter container */}
        <div
          onDragOver={e => { e.preventDefault(); dragOver.current = "notmatter"; }}
          onDrop={() => handleDrop("notmatter")}
          style={{
            minHeight: 160, borderRadius: 12,
            border: `2px dashed ${dragging ? "#7c3aed" : "rgba(255,255,255,0.1)"}`,
            background: "rgba(255,255,255,0.02)",
            transition: "border-color 0.2s", position: "relative",
          }}
        >
          <div style={{ padding: 10 }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#7c3aed", marginBottom: 6, textAlign: "center" }}>
              NOT MATTER ✗
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
              {correctNotMatter.map(p => {
                const item = ITEMS.find(i => i.id === p.itemId)!;
                return (
                  <div key={p.itemId} style={{
                    fontSize: "1.1rem", background: "rgba(124,58,237,0.1)",
                    borderRadius: 6, padding: "3px 5px", opacity: 0.7,
                  }} title={item.label}>{item.emoji}</div>
                );
              })}
            </div>
          </div>
          {correctNotMatter.length === 0 && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.72rem", color: "rgba(255,255,255,0.15)",
            }}>Drop non-matter here</div>
          )}
        </div>
      </div>

      {/* Draggable items */}
      {remaining.length > 0 && (
        <div>
          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 8 }}>
            Items to sort ({remaining.length} left)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {remaining.map(item => (
              <div
                key={item.id}
                draggable
                onDragStart={() => setDragging(item.id)}
                onDragEnd={() => setDragging(null)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  padding: "8px 10px", borderRadius: 8, cursor: "grab",
                  background: dragging === item.id ? `${colour}20` : "rgba(255,255,255,0.06)",
                  border: `1px solid ${dragging === item.id ? colour : "rgba(255,255,255,0.1)"}`,
                  transition: "all 0.15s",
                  opacity: dragging && dragging !== item.id ? 0.5 : 1,
                }}
              >
                <div style={{ fontSize: "1.4rem" }}>{item.emoji}</div>
                <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.6)", textAlign: "center", maxWidth: 60 }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress */}
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ height: 3, flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
          <div style={{
            height: "100%", borderRadius: 2,
            width: `${(placements.length / ITEMS.length) * 100}%`,
            background: colour, transition: "width 0.3s",
          }} />
        </div>
        <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.3)" }}>
          {placements.length}/{ITEMS.length}
        </div>
      </div>

      {/* Wrong placement overlay */}
      {overlay && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 14,
          background: "rgba(0,0,0,0.88)", display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 14, padding: 24, zIndex: 10,
        }}>
          <div style={{ fontSize: "2rem" }}>{overlay.emoji}</div>
          <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "#fff" }}>{overlay.label}</div>
          <div style={{ fontSize: "0.78rem", color: "#f87171", fontWeight: 700 }}>
            That&apos;s not quite right — let&apos;s check:
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%" }}>
            {[
              { q: "Has mass?", yes: overlay.isMatter },
              { q: "Occupies space?", yes: overlay.isMatter },
            ].map((check, i) => (
              <div key={i} style={{
                padding: 12, borderRadius: 10, textAlign: "center",
                background: check.yes ? "rgba(5,150,105,0.15)" : "rgba(239,68,68,0.12)",
                border: `1px solid ${check.yes ? "#05965060" : "#ef444440"}`,
              }}>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>{check.q}</div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: check.yes ? "#34d399" : "#f87171" }}>
                  {check.yes ? "Yes ✓" : "No ✗"}
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", textAlign: "center", lineHeight: 1.5 }}>
            {overlay.description}
          </div>

          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>
            Matter must have BOTH mass AND volume.
          </div>

          <button onClick={dismissOverlay} style={{
            padding: "9px 24px", borderRadius: 8, border: "none",
            background: colour, color: "#fff", fontSize: "0.82rem",
            fontWeight: 700, cursor: "pointer",
          }}>Got it — try again</button>
        </div>
      )}

      {/* Summary */}
      {showSummary && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 14,
          background: "rgba(6,13,24,0.96)", padding: 20,
          overflowY: "auto", zIndex: 10,
        }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#fff", marginBottom: 4 }}>
            Summary — What is Matter?
          </div>
          <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>
            Matter = has mass + occupies space
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: colour, textTransform: "uppercase", marginBottom: 8 }}>
              ✓ Matter
            </div>
            {ITEMS.filter(i => i.isMatter).map(item => (
              <div key={item.id} style={{
                display: "flex", gap: 10, alignItems: "center",
                padding: "6px 10px", background: `${colour}10`,
                borderRadius: 8, marginBottom: 5,
              }}>
                <div style={{ fontSize: "1.1rem" }}>{item.emoji}</div>
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fff" }}>{item.label}</div>
                  <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.45)" }}>{item.description}</div>
                </div>
                <div style={{ marginLeft: "auto", fontSize: "0.65rem", fontWeight: 700, color: colour }}>
                  {item.mass} kg
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", marginBottom: 8 }}>
              ✗ Not Matter (energy / phenomena)
            </div>
            {ITEMS.filter(i => !i.isMatter).map(item => (
              <div key={item.id} style={{
                display: "flex", gap: 10, alignItems: "center",
                padding: "6px 10px", background: "rgba(124,58,237,0.08)",
                borderRadius: 8, marginBottom: 5,
              }}>
                <div style={{ fontSize: "1.1rem" }}>{item.emoji}</div>
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fff" }}>{item.label}</div>
                  <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.45)" }}>{item.description}</div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={resetGame} style={{
            width: "100%", padding: "10px", borderRadius: 8, border: "none",
            background: colour, color: "#fff", fontSize: "0.82rem",
            fontWeight: 700, cursor: "pointer",
          }}>Play again</button>
        </div>
      )}

      <style>{`
        @keyframes dropIn {
          from { transform: scale(0.5) translateY(-10px); opacity: 0; }
          to   { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}