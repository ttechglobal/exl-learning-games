// FILE: src/app/(admin)/admin/content/[topicId]/InteractionSelector.tsx
"use client";

import { useState, lazy, Suspense } from "react";
import { INTERACTION_REGISTRY, getInteraction, type InteractionDefinition } from "@/lib/interactions/registry";
import type { HeatSliderConfig } from "@/components/interactions/HeatSlider";

// Lazy-load interaction components so unused ones don't add to bundle
const COMPONENTS: Record<string, React.ComponentType<{ config: Record<string, unknown>; colour?: string }>> = {
  HeatSlider:           lazy(() => import("@/components/interactions/HeatSlider")),
  MatterSorter:         lazy(() => import("@/components/interactions/MatterSorter")),
  InfiniteZoomExplorer: lazy(() => import("@/components/interactions/InfiniteZoomExplorer")),
};

export interface InteractionRef {
  component: string;
  config: Record<string, unknown>;
}

interface Props {
  value: InteractionRef | null;
  onChange: (ref: InteractionRef | null) => void;
  subject: string;
  colour: string;
  readOnly?: boolean;
}

const inp: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "var(--surface-2)", border: "1px solid var(--border)",
  borderRadius: 6, padding: "7px 10px", color: "var(--text)",
  fontSize: "0.82rem", fontFamily: "inherit", outline: "none",
};

function defaultConfig(def: InteractionDefinition): Record<string, unknown> {
  const cfg: Record<string, unknown> = {};
  def.configSchema.forEach((f: import("@/lib/interactions/registry").ConfigField) => { cfg[f.key] = f.default; });
  return cfg;
}

export default function InteractionSelector({ value, onChange, subject, colour, readOnly = false }: Props) {
  const available = INTERACTION_REGISTRY.filter((i: import("@/lib/interactions/registry").InteractionDefinition) => i.subjects.includes(subject));
  const selectedDef = value ? getInteraction(value.component) : null;
  const [showPreview, setShowPreview] = useState(true);

  const selectComponent = (key: string) => {
    const def = getInteraction(key);
    if (!def) return;
    onChange({ component: key, config: defaultConfig(def) });
  };

  const updateConfig = (key: string, val: unknown) => {
    if (!value) return;
    onChange({ ...value, config: { ...value.config, [key]: val } });
  };

  const LiveComponent = value ? COMPONENTS[value.component] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Select component */}
      <div>
        <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          Interaction component
        </div>

        {available.length === 0 ? (
          <div style={{ padding: "12px 14px", background: "var(--surface-2)", borderRadius: 8, fontSize: "0.78rem", color: "var(--text-4)" }}>
            No interactions available for {subject} yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {available.map((def: import("@/lib/interactions/registry").InteractionDefinition) => {
              const isSelected = value?.component === def.key;
              return (
                <button key={def.key} onClick={() => (!readOnly || !value) && selectComponent(def.key)} style={{
                  padding: "12px 14px", borderRadius: 8, textAlign: "left",
                  border: `1.5px solid ${isSelected ? colour : "var(--border)"}`,
                  background: isSelected ? `${colour}10` : "var(--surface-2)",
                  cursor: (!readOnly || !value) ? "pointer" : "default",
                  transition: "all 0.15s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: isSelected ? colour : "var(--border)",
                      flexShrink: 0,
                    }} />
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: isSelected ? colour : "var(--text)" }}>
                      {def.label}
                    </div>
                    {isSelected && (
                      <div style={{ marginLeft: "auto", fontSize: "0.65rem", fontWeight: 700, color: colour }}>
                        Selected ✓
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-3)", lineHeight: 1.5, paddingLeft: 16 }}>
                    {def.description}
                  </div>
                </button>
              );
            })}

            {/* Coming soon placeholder */}
            <div style={{
              padding: "10px 14px", borderRadius: 8,
              border: "1px dashed var(--border)",
              opacity: 0.4,
            }}>
              <div style={{ fontSize: "0.78rem", color: "var(--text-4)" }}>
                + More components coming — Particle Canvas, Concentration Slider, Graph Viewer…
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Config fields */}
      {selectedDef && value && !readOnly && (
        <div style={{
          background: "var(--surface-2)", border: "1px solid var(--border)",
          borderRadius: 10, overflow: "hidden",
        }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 800, color: colour, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Configure {selectedDef.label}
            </div>
            <button onClick={() => setShowPreview(p => !p)} style={{
              padding: "3px 10px", borderRadius: 5, border: "1px solid var(--border)",
              background: "transparent", color: "var(--text-3)", fontSize: "0.7rem", cursor: "pointer",
            }}>
              {showPreview ? "Hide preview" : "Show preview"}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: showPreview ? "1fr 1fr" : "1fr", gap: 0 }}>

            {/* Config form */}
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, borderRight: showPreview ? "1px solid var(--border)" : "none" }}>
              {selectedDef.configSchema.map((field: import("@/lib/interactions/registry").ConfigField) => (
                <div key={field.key}>
                  <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                    {field.label}
                    {field.description && (
                      <span style={{ fontWeight: 400, textTransform: "none", marginLeft: 6 }}>— {field.description}</span>
                    )}
                  </div>
                  {field.type === "boolean" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button onClick={() => updateConfig(field.key, !(value.config[field.key] ?? field.default))} style={{
                        width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer",
                        background: (value.config[field.key] ?? field.default) ? colour : "var(--border)",
                        position: "relative", transition: "background 0.2s", flexShrink: 0,
                      }}>
                        <div style={{
                          width: 14, height: 14, borderRadius: "50%", background: "#fff",
                          position: "absolute", top: 3,
                          left: (value.config[field.key] ?? field.default) ? 19 : 3,
                          transition: "left 0.2s",
                        }} />
                      </button>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
                        {(value.config[field.key] ?? field.default) ? "On" : "Off"}
                      </span>
                    </div>
                  ) : field.type === "select" ? (
                    <select value={String(value.config[field.key] ?? field.default)} onChange={e => updateConfig(field.key, e.target.value)}
                      style={{ ...inp, cursor: "pointer" }}>
                      {(field.options ?? []).map((opt: string) => (
                        <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                      ))}
                    </select>
                  ) : field.type === "number" ? (
                    <input type="number" style={inp}
                      value={Number(value.config[field.key] ?? field.default)}
                      onChange={e => updateConfig(field.key, Number(e.target.value))} />
                  ) : (
                    <input type="text" style={inp}
                      value={String(value.config[field.key] ?? field.default)}
                      onChange={e => updateConfig(field.key, e.target.value)} />
                  )}
                </div>
              ))}
            </div>

            {/* Live preview */}
            {showPreview && LiveComponent && (
              <div style={{ padding: 14 }}>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                  Live preview
                </div>
                <Suspense fallback={<div style={{ padding: 20, color: "var(--text-4)", fontSize: "0.78rem" }}>Loading…</div>}>
                  <LiveComponent config={value.config as HeatSliderConfig} colour={colour} />
                </Suspense>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Read-only summary */}
      {readOnly && value && selectedDef && (
        <div style={{ padding: "10px 14px", background: "var(--surface-2)", borderRadius: 8, border: `1px solid ${colour}25` }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: colour, marginBottom: 4 }}>{selectedDef.label}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-3)", fontFamily: "monospace" }}>
            {Object.entries(value.config)
              .filter(([, v]) => v !== 0 && v !== "" && v !== false)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ")}
          </div>
        </div>
      )}

      {/* Remove */}
      {value && !readOnly && (
        <button onClick={() => onChange(null)} style={{
          padding: "6px 12px", borderRadius: 6,
          border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.06)",
          color: "#f87171", fontSize: "0.72rem", cursor: "pointer",
          alignSelf: "flex-start",
        }}>Remove interaction</button>
      )}
    </div>
  );
}