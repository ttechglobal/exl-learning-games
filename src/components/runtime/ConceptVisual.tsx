"use client";

/**
 * ConceptVisual.tsx
 *
 * SVG illustration registry for Quick Concept cards.
 *
 * Each visual is a small, self-contained educational diagram that renders
 * inside the concept card, above the body text. Visuals use viewBox-based
 * scaling so they always fill the card width cleanly.
 *
 * Adding a new visual: create a component below and add a case in the
 * switch. Reference the key in a game's snapshot.cards[].visual field.
 *
 * Color guide: use these tokens so visuals work on both the light card
 * background (#fff) and dark mode card (#181c28):
 *   Lines/structure: #475569  (slate-600, readable on both)
 *   Accent/rays:     #3b82f6  (blue-500)
 *   Real image:      #10b981  (emerald-500)
 *   Virtual image:   #8b5cf6  (violet-500)
 *   Mirror surface:  #64748b  (slate-500)
 *   Labels:          #1e293b  (slate-800, dark) / #e2e8f0 (slate-200, light)
 *   Background panel:#f1f5f9  (slate-100)
 */

interface VisualProps {
  className?: string;
}

export function ConceptVisual({ visualKey, className }: { visualKey: string; className?: string }) {
  switch (visualKey) {
    case "mirror-concave":
      return <MirrorConcaveOnly className={className} />;
    case "mirror-convex":
      return <MirrorConvexOnly className={className} />;
    case "mirror-concave-vs-convex":
      return <MirrorConcaveVsConvex className={className} />;
    case "mirror-object-position":
      return <MirrorObjectPosition className={className} />;
    case "mirror-real-vs-virtual":
      return <MirrorRealVsVirtual className={className} />;
    case "mirror-how-to-play":
      return <MirrorHowToPlay className={className} />;
    default:
      return null;
  }
}

// ─── Mirror: Concave only ─────────────────────────────────────────────────────
function MirrorConcaveOnly({ className }: VisualProps) {
  return (
    <svg viewBox="0 0 280 140" className={className}
      style={{ display: "block", width: "100%", height: "auto" }}
      aria-label="Diagram showing a concave mirror with light rays converging at the focal point">

      <rect x="2" y="2" width="276" height="136" rx="8" fill="#f1f5f9" />

      {/* Principal axis */}
      <line x1="20" y1="70" x2="250" y2="70" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 4" />

      {/* Concave mirror — arc bows left */}
      <path d="M 220,18 Q 188,70 220,122"
        fill="none" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
      <path d="M 222,18 Q 192,70 222,122"
        fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />

      {/* 3 parallel incident rays */}
      <line x1="28" y1="32" x2="220" y2="32" stroke="#3b82f6" strokeWidth="2" />
      <line x1="28" y1="70" x2="220" y2="70" stroke="#3b82f6" strokeWidth="2" />
      <line x1="28" y1="108" x2="220" y2="108" stroke="#3b82f6" strokeWidth="2" />
      {/* Arrowheads */}
      <polygon points="215,28 215,36 220,32" fill="#3b82f6" />
      <polygon points="215,66 215,74 220,70" fill="#3b82f6" />
      <polygon points="215,104 215,112 220,108" fill="#3b82f6" />

      {/* Reflected rays converging at F (x=150, y=70) */}
      <line x1="220" y1="32" x2="150" y2="70" stroke="#3b82f6" strokeWidth="2" />
      <line x1="220" y1="70" x2="150" y2="70" stroke="#3b82f6" strokeWidth="2" />
      <line x1="220" y1="108" x2="150" y2="70" stroke="#3b82f6" strokeWidth="2" />

      {/* F dot and label */}
      <circle cx="150" cy="70" r="6" fill="#10b981" />
      <text x="150" y="92" textAnchor="middle" fontSize="12" fill="#059669" fontWeight="800">F</text>
      <text x="150" y="106" textAnchor="middle" fontSize="9" fill="#059669">Focal Point</text>

      {/* Label */}
      <text x="140" y="130" textAnchor="middle" fontSize="11" fill="#1e293b" fontWeight="800">Concave — gathers light at F</text>
    </svg>
  );
}

// ─── Mirror: Convex only ──────────────────────────────────────────────────────
function MirrorConvexOnly({ className }: VisualProps) {
  return (
    <svg viewBox="0 0 280 140" className={className}
      style={{ display: "block", width: "100%", height: "auto" }}
      aria-label="Diagram showing a convex mirror with light rays diverging">

      <rect x="2" y="2" width="276" height="136" rx="8" fill="#f1f5f9" />

      {/* Principal axis */}
      <line x1="20" y1="70" x2="250" y2="70" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 4" />

      {/* Convex mirror — arc bows RIGHT */}
      <path d="M 175,18 Q 207,70 175,122"
        fill="none" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
      <path d="M 173,18 Q 203,70 173,122"
        fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />

      {/* 3 parallel incident rays */}
      <line x1="28" y1="32" x2="175" y2="32" stroke="#3b82f6" strokeWidth="2" />
      <line x1="28" y1="70" x2="175" y2="70" stroke="#3b82f6" strokeWidth="2" />
      <line x1="28" y1="108" x2="175" y2="108" stroke="#3b82f6" strokeWidth="2" />
      <polygon points="170,28 170,36 175,32" fill="#3b82f6" />
      <polygon points="170,66 170,74 175,70" fill="#3b82f6" />
      <polygon points="170,104 170,112 175,108" fill="#3b82f6" />

      {/* Reflected rays DIVERGING from the mirror */}
      <line x1="175" y1="32" x2="28" y2="14" stroke="#3b82f6" strokeWidth="2" />
      <line x1="175" y1="70" x2="28" y2="70" stroke="#3b82f6" strokeWidth="2" />
      <line x1="175" y1="108" x2="28" y2="126" stroke="#3b82f6" strokeWidth="2" />

      {/* Virtual F behind mirror — dashed lines converging */}
      <line x1="175" y1="32" x2="218" y2="70" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="5 3" />
      <line x1="175" y1="70" x2="218" y2="70" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="5 3" />
      <line x1="175" y1="108" x2="218" y2="70" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="5 3" />

      {/* Virtual F dot behind mirror */}
      <circle cx="218" cy="70" r="5" fill="#8b5cf6" opacity="0.8" />
      <text x="218" y="88" textAnchor="middle" fontSize="11" fill="#7c3aed" fontWeight="800">F</text>
      <text x="218" y="102" textAnchor="middle" fontSize="8.5" fill="#7c3aed">(virtual)</text>

      {/* Label */}
      <text x="130" y="130" textAnchor="middle" fontSize="11" fill="#1e293b" fontWeight="800">Convex — spreads light outward</text>
    </svg>
  );
}

// ─── Mirror: Concave vs Convex ────────────────────────────────────────────────
function MirrorConcaveVsConvex({ className }: VisualProps) {
  return (
    <svg viewBox="0 0 280 120" className={className}
      style={{ display: "block", width: "100%", height: "auto" }}
      aria-label="Diagram showing concave and convex mirror shapes with light rays">

      {/* Panel backgrounds */}
      <rect x="2" y="2" width="130" height="116" rx="8" fill="#f1f5f9" />
      <rect x="148" y="2" width="130" height="116" rx="8" fill="#f1f5f9" />

      {/* ── LEFT: Concave ── */}
      {/* Mirror arc — concave bows LEFT */}
      <path d="M 118,15 Q 90,60 118,105"
        fill="none" stroke="#475569" strokeWidth="5" strokeLinecap="round" />
      <path d="M 120,15 Q 95,60 120,105"
        fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />
      {/* 3 incident rays (horizontal from left) */}
      <line x1="15" y1="30" x2="118" y2="30" stroke="#3b82f6" strokeWidth="1.5" />
      <line x1="15" y1="60" x2="118" y2="60" stroke="#3b82f6" strokeWidth="1.5" />
      <line x1="15" y1="90" x2="118" y2="90" stroke="#3b82f6" strokeWidth="1.5" />
      {/* Arrowheads on rays */}
      <polygon points="118,27 118,33 123,30" fill="#3b82f6" />
      <polygon points="118,57 118,63 123,60" fill="#3b82f6" />
      <polygon points="118,87 118,93 123,90" fill="#3b82f6" />
      {/* Reflected rays converging at F (approx x=80, y=60) */}
      <line x1="118" y1="30" x2="80" y2="60" stroke="#3b82f6" strokeWidth="1.5" />
      <line x1="118" y1="60" x2="80" y2="60" stroke="#3b82f6" strokeWidth="1.5" />
      <line x1="118" y1="90" x2="80" y2="60" stroke="#3b82f6" strokeWidth="1.5" />
      {/* F dot */}
      <circle cx="80" cy="60" r="4" fill="#10b981" />
      <text x="80" y="74" textAnchor="middle" fontSize="9" fill="#10b981" fontWeight="bold">F</text>
      {/* Label */}
      <text x="65" y="114" textAnchor="middle" fontSize="10" fill="#1e293b" fontWeight="800">Concave</text>

      {/* ── RIGHT: Convex ── */}
      {/* Mirror arc — convex bows RIGHT */}
      <path d="M 162,15 Q 190,60 162,105"
        fill="none" stroke="#475569" strokeWidth="5" strokeLinecap="round" />
      <path d="M 160,15 Q 185,60 160,105"
        fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />
      {/* 3 incident rays (horizontal from left) */}
      <line x1="149" y1="30" x2="162" y2="30" stroke="#3b82f6" strokeWidth="1.5" />
      <line x1="149" y1="60" x2="162" y2="60" stroke="#3b82f6" strokeWidth="1.5" />
      <line x1="149" y1="90" x2="162" y2="90" stroke="#3b82f6" strokeWidth="1.5" />
      <polygon points="158,27 158,33 162,30" fill="#3b82f6" />
      <polygon points="158,57 158,63 162,60" fill="#3b82f6" />
      <polygon points="158,87 158,93 162,90" fill="#3b82f6" />
      {/* Reflected rays diverging */}
      <line x1="162" y1="30" x2="149" y2="14" stroke="#3b82f6" strokeWidth="1.5" />
      <line x1="162" y1="60" x2="149" y2="60" stroke="#3b82f6" strokeWidth="1.5" />
      <line x1="162" y1="90" x2="149" y2="107" stroke="#3b82f6" strokeWidth="1.5" />
      {/* Virtual F dot behind mirror (dashed) */}
      <line x1="162" y1="30" x2="195" y2="60" stroke="#8b5cf6" strokeWidth="1.2" strokeDasharray="4 3" />
      <line x1="162" y1="60" x2="195" y2="60" stroke="#8b5cf6" strokeWidth="1.2" strokeDasharray="4 3" />
      <line x1="162" y1="90" x2="195" y2="60" stroke="#8b5cf6" strokeWidth="1.2" strokeDasharray="4 3" />
      <circle cx="195" cy="60" r="3.5" fill="#8b5cf6" opacity="0.7" />
      <text x="195" y="74" textAnchor="middle" fontSize="9" fill="#8b5cf6" fontWeight="bold">F</text>
      {/* Label */}
      <text x="215" y="114" textAnchor="middle" fontSize="10" fill="#1e293b" fontWeight="800">Convex</text>

      {/* Center divider */}
      <line x1="140" y1="10" x2="140" y2="110" stroke="#cbd5e1" strokeWidth="1" />
    </svg>
  );
}

// ─── Mirror: Object Position Changes Everything ───────────────────────────────
function MirrorObjectPosition({ className }: VisualProps) {
  return (
    <svg viewBox="0 0 280 130" className={className}
      style={{ display: "block", width: "100%", height: "auto" }}
      aria-label="Diagram showing how object position affects image in a concave mirror">

      <rect x="2" y="2" width="276" height="126" rx="8" fill="#f1f5f9" />

      {/* Principal axis */}
      <line x1="15" y1="68" x2="248" y2="68" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 4" />

      {/* Mirror at x=232 */}
      <path d="M 232,20 Q 210,68 232,116"
        fill="none" stroke="#475569" strokeWidth="5" strokeLinecap="round" />

      {/* C marker (x=178, 2f=2×2=4 units, let's say 1 unit = 27px so C at 232-54=178) */}
      <line x1="178" y1="62" x2="178" y2="74" stroke="#94a3b8" strokeWidth="2" />
      <text x="178" y="84" textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="700">C</text>

      {/* F marker (x=205, f=1 unit = 27px so F at 232-27=205) */}
      <line x1="205" y1="62" x2="205" y2="74" stroke="#60a5fa" strokeWidth="2" />
      <text x="205" y="84" textAnchor="middle" fontSize="10" fill="#3b82f6" fontWeight="700">F</text>

      {/* ── Position 1: Object beyond C → small real image ── */}
      {/* Object arrow at x=130 */}
      <line x1="130" y1="68" x2="130" y2="50" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />
      <polygon points="124,56 136,56 130,50" fill="#f8fafc" />
      {/* Real image (small, inverted) at ~x=200 */}
      <line x1="198" y1="68" x2="198" y2="76" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
      <polygon points="193,70 203,70 198,76" fill="#10b981" />
      <text x="165" y="46" textAnchor="middle" fontSize="8" fill="#475569">beyond C</text>
      <text x="198" y="90" textAnchor="middle" fontSize="8" fill="#10b981">small real image</text>

      {/* ── Position 2: Object between F and C → big image ── */}
      {/* Object arrow at x=192 */}
      <line x1="192" y1="68" x2="192" y2="52" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
      <polygon points="186,58 198,58 192,52" fill="#fbbf24" />
      {/* Large real image far left */}
      <line x1="38" y1="68" x2="38" y2="30" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
      <polygon points="32,38 44,38 38,30" fill="#10b981" />
      <text x="192" y="45" textAnchor="middle" fontSize="8" fill="#b45309">between F &amp; C</text>
      <text x="40" y="26" textAnchor="middle" fontSize="8" fill="#10b981">big real image</text>

      {/* ── Label: "Try moving the object and watch!" ── */}
      <text x="140" y="122" textAnchor="middle" fontSize="9" fill="#64748b">
        Moving the object changes where the image appears
      </text>
    </svg>
  );
}

// ─── Mirror: Real vs Virtual ──────────────────────────────────────────────────
function MirrorRealVsVirtual({ className }: VisualProps) {
  return (
    <svg viewBox="0 0 280 120" className={className}
      style={{ display: "block", width: "100%", height: "auto" }}
      aria-label="Diagram comparing real and virtual image formation">

      <rect x="2" y="2" width="130" height="116" rx="8" fill="#f1f5f9" />
      <rect x="148" y="2" width="130" height="116" rx="8" fill="#f1f5f9" />

      {/* ── LEFT: Real image ── */}
      {/* Mirror */}
      <path d="M 118,18 Q 96,60 118,102"
        fill="none" stroke="#475569" strokeWidth="5" strokeLinecap="round" />
      {/* Rays converging at real image point */}
      <line x1="20" y1="30" x2="118" y2="30" stroke="#3b82f6" strokeWidth="1.5" />
      <line x1="20" y1="60" x2="118" y2="60" stroke="#3b82f6" strokeWidth="1.5" />
      <line x1="20" y1="90" x2="118" y2="90" stroke="#3b82f6" strokeWidth="1.5" />
      {/* Reflected: converge at ~(70, 60) */}
      <line x1="118" y1="30" x2="70" y2="60" stroke="#3b82f6" strokeWidth="1.5" />
      <line x1="118" y1="60" x2="70" y2="60" stroke="#3b82f6" strokeWidth="1.5" />
      <line x1="118" y1="90" x2="70" y2="60" stroke="#3b82f6" strokeWidth="1.5" />
      {/* Image dot */}
      <circle cx="70" cy="60" r="5" fill="#10b981" />
      {/* Screen line */}
      <line x1="70" y1="20" x2="70" y2="100" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" />
      <text x="65" y="112" textAnchor="middle" fontSize="9" fill="#059669" fontWeight="800">Real image</text>
      <text x="65" y="123" textAnchor="middle" fontSize="8" fill="#475569">can be projected</text>

      {/* ── RIGHT: Virtual image ── */}
      {/* Mirror (concave but with object inside F) */}
      <path d="M 162,18 Q 140,60 162,102"
        fill="none" stroke="#475569" strokeWidth="5" strokeLinecap="round" />
      {/* Reflected rays diverging (going left after mirror) */}
      <line x1="162" y1="35" x2="148" y2="20" stroke="#3b82f6" strokeWidth="1.5" />
      <line x1="162" y1="60" x2="148" y2="48" stroke="#3b82f6" strokeWidth="1.5" />
      <line x1="162" y1="85" x2="148" y2="100" stroke="#3b82f6" strokeWidth="1.5" />
      {/* Dashed extensions behind mirror showing virtual image */}
      <line x1="162" y1="35" x2="208" y2="60" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="5 3" />
      <line x1="162" y1="60" x2="208" y2="60" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="5 3" />
      <line x1="162" y1="85" x2="208" y2="60" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="5 3" />
      {/* Virtual image dot (behind mirror) */}
      <circle cx="208" cy="60" r="5" fill="#8b5cf6" />
      <text x="215" y="112" textAnchor="middle" fontSize="9" fill="#7c3aed" fontWeight="800">Virtual image</text>
      <text x="215" y="123" textAnchor="middle" fontSize="8" fill="#475569">appears behind mirror</text>

      {/* Mirror backing hint (hatching) */}
      <rect x="162" y="18" width="10" height="84" fill="url(#conceptHatch)" opacity="0.5" />
      <defs>
        <pattern id="conceptHatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#94a3b8" strokeWidth="2" />
        </pattern>
      </defs>

      <line x1="140" y1="10" x2="140" y2="110" stroke="#cbd5e1" strokeWidth="1" />
    </svg>
  );
}

// ─── Mirror: How to Play ──────────────────────────────────────────────────────
function MirrorHowToPlay({ className }: VisualProps) {
  return (
    <svg viewBox="0 0 280 130" className={className}
      style={{ display: "block", width: "100%", height: "auto" }}
      aria-label="Annotated diagram showing how to interact with the Mirror Lab game">

      <rect x="2" y="2" width="276" height="126" rx="8" fill="#0c1c3a" />

      {/* Principal axis */}
      <line x1="15" y1="62" x2="248" y2="62" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeDasharray="6 4" />

      {/* Mirror at x=230 */}
      <path d="M 230,22 Q 210,62 230,102"
        fill="none" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />
      <path d="M 232,22 Q 214,62 232,102"
        fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" />

      {/* F marker */}
      <line x1="195" y1="56" x2="195" y2="68" stroke="#60a5fa" strokeWidth="2" />
      <text x="195" y="78" textAnchor="middle" fontSize="10" fill="#60a5fa" fontWeight="700">F</text>

      {/* Object arrow at x=140 */}
      <line x1="140" y1="62" x2="140" y2="42" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
      <polygon points="133,50 147,50 140,42" fill="#f8fafc" />
      <line x1="133" y1="62" x2="147" y2="62" stroke="#f8fafc" strokeWidth="2" strokeLinecap="round" />

      {/* Image arrow */}
      <line x1="100" y1="62" x2="100" y2="78" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" />
      <polygon points="94,70 106,70 100,78" fill="#34d399" />

      {/* Annotation: drag the object */}
      <line x1="140" y1="100" x2="140" y2="92" stroke="#fbbf24" strokeWidth="1" strokeDasharray="2 2" />
      <text x="140" y="110" textAnchor="middle" fontSize="9" fill="#fbbf24" fontWeight="700">① drag left/right</text>

      {/* Annotation: image updates live */}
      <line x1="100" y1="88" x2="100" y2="96" stroke="#34d399" strokeWidth="1" strokeDasharray="2 2" />
      <text x="100" y="107" textAnchor="middle" fontSize="9" fill="#34d399" fontWeight="700">② image updates</text>

      {/* Run experiment button */}
      <rect x="175" y="112" width="100" height="14" rx="4" fill="#1d4ed8" />
      <text x="225" y="122" textAnchor="middle" fontSize="8.5" fill="#fff" fontWeight="700">▶ Run Experiment</text>

      {/* Annotation: run experiment */}
      <line x1="205" y1="112" x2="195" y2="106" stroke="#93c5fd" strokeWidth="1" strokeDasharray="2 2" />
      <text x="150" y="124" textAnchor="end" fontSize="9" fill="#93c5fd" fontWeight="700">③ run when ready</text>
    </svg>
  );
}
