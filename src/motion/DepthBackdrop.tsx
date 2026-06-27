"use client";

/**
 * motion/DepthBackdrop.tsx
 *
 * Three-layer parallax-ish backdrop: two slow-drifting glow planes (CSS
 * gradients, transform-animated only — see tokens.css) plus the existing
 * drifting-particle layer. Meant to replace a single flat background on
 * "moment" screens (entry, world map, reflection) where the product brief
 * asks for the lab/quest backdrop to feel alive without competing with the
 * actual learning task — gameplay screens themselves stay calmer.
 *
 * `accentColor` lets each subject tint its glow planes differently while
 * reusing the same component (per the "studio style, subject accent" rule
 * in Section 7 of the architecture doc).
 */
export function DepthBackdrop({ accentColor = "var(--eg-brand)" }: { accentColor?: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0 }}>
      <div
        className="eg-depth-layer eg-depth-layer--back"
        style={{
          background: `radial-gradient(circle at 30% 20%, color-mix(in srgb, ${accentColor} 18%, transparent), transparent 60%)`
        }}
      />
      <div
        className="eg-depth-layer eg-depth-layer--mid"
        style={{
          background: `radial-gradient(circle at 75% 70%, color-mix(in srgb, ${accentColor} 14%, transparent), transparent 55%)`
        }}
      />
    </div>
  );
}