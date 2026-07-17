"use client";

/**
 * NarrationScene.tsx
 *
 * Shared visual components used by both NarrationScreen and
 * DifficultySelectScreen (and any future screen that wants the same
 * dark-forest scene with a character figure).
 *
 * Extracted here so DifficultySelectScreen can import them without
 * depending on NarrationScreen — previously they were defined inside
 * NarrationScreen.tsx which caused a circular-style coupling and
 * required NarrationScreen to export internal implementation details.
 */

import styles from "./NarrationScreen.module.css";

// ─── Character definitions ────────────────────────────────────────────────────

export const CHARACTERS: Record<string, {
  name: string;
  role: string;
  coatColor: string;
  coatShade: string;
  accentColor: string;
}> = {
  chemistry: {
    name: "Dr. Adaobi",
    role: "Lab Director",
    coatColor: "#e8eef8",
    coatShade: "#c8d4e8",
    accentColor: "#3a5a9a",
  },
  physics: {
    name: "Prof. Emeka",
    role: "Physics Lead",
    coatColor: "#e8f2e8",
    coatShade: "#c4d8c4",
    accentColor: "#2a6a2a",
  },
  mathematics: {
    name: "Ms. Chidera",
    role: "Maths Tutor",
    coatColor: "#f0eef8",
    coatShade: "#d4cce8",
    accentColor: "#5a3a9a",
  },
  biology: {
    name: "Dr. Fatima",
    role: "Biology Dept.",
    coatColor: "#eef4ee",
    coatShade: "#c8dcc8",
    accentColor: "#2a6a4a",
  },
};

export const FALLBACK_CHARACTER = CHARACTERS.chemistry;

// ─── Scene background SVG ─────────────────────────────────────────────────────

export function SceneBackground({ subject }: { subject: string }) {
  const isChemistry = subject === "chemistry";
  const isPhysics = subject === "physics";

  return (
    <svg
      className={styles.sceneBg}
      viewBox="0 0 360 320"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <rect width="360" height="320" fill="#0e1e0e" />
      <rect x="0" y="0" width="360" height="200" fill="#0c1a30" />

      <rect x="60" y="12" width="200" height="148" fill="#0a1e3a" rx="5" />
      <rect x="66" y="18" width="90" height="64" fill="#0f2850" rx="2" opacity="0.7" />
      <rect x="162" y="18" width="92" height="64" fill="#0c2040" rx="2" opacity="0.6" />
      <rect x="66" y="88" width="90" height="66" fill="#0c2040" rx="2" opacity="0.6" />
      <rect x="162" y="88" width="92" height="66" fill="#0f2850" rx="2" opacity="0.7" />
      <rect x="60" y="158" width="200" height="7" fill="#05101a" rx="2" />

      {isChemistry && (
        <>
          <rect x="290" y="90" width="55" height="80" fill="#0a1808" rx="2" />
          <rect x="294" y="98" width="47" height="66" fill="#0d2010" rx="1" />
          <ellipse cx="318" cy="118" rx="9" ry="13" fill="#1a6a3a" opacity="0.6" />
          <rect x="314" y="108" width="8" height="4" fill="#1a6a3a" opacity="0.5" />
        </>
      )}

      {isPhysics && (
        <>
          <rect x="292" y="88" width="54" height="82" fill="#081820" rx="2" />
          <rect x="296" y="96" width="20" height="2" fill="#1a4a2a" opacity="0.8" />
          <rect x="296" y="104" width="14" height="2" fill="#1a4a2a" opacity="0.8" />
          <circle cx="308" cy="116" r="4" fill="#1a6a2a" opacity="0.6" />
        </>
      )}

      <circle cx="85" cy="35" r="1.2" fill="#fff" opacity="0.7" />
      <circle cx="220" cy="28" r="0.9" fill="#fff" opacity="0.6" />
      <circle cx="250" cy="52" r="1.4" fill="#fff" opacity="0.8" />
      <circle cx="100" cy="110" r="0.9" fill="#fff" opacity="0.5" />
      <circle cx="240" cy="95" r="1.2" fill="#fff" opacity="0.6" />

      <ellipse cx="48" cy="226" rx="16" ry="28" fill="#152415" />
      <ellipse cx="48" cy="196" rx="11" ry="13" fill="#1e301e" />
      <rect x="42" y="224" width="5" height="20" fill="#122012" />
      <rect x="51" y="224" width="5" height="20" fill="#122012" />

      <rect x="0" y="248" width="360" height="9" fill="#1a2810" />
      {[18, 46, 74, 102, 130, 158, 186, 214, 242, 270, 298, 326].map(x => (
        <rect key={x} x={x} y="238" width="5" height="20" fill="#152010" rx="1" />
      ))}

      <rect x="0" y="255" width="360" height="65" fill="#0a1808" />
      <ellipse cx="180" cy="258" rx="200" ry="12" fill="#0c1c0a" />

      <rect x="24" y="210" width="6" height="50" fill="#0a1208" />
      <ellipse cx="27" cy="205" rx="22" ry="26" fill="#0e2a0e" />
      <ellipse cx="19" cy="198" rx="15" ry="18" fill="#122e12" />
      <rect x="324" y="218" width="6" height="42" fill="#0a1208" />
      <ellipse cx="327" cy="213" rx="19" ry="23" fill="#0e2a0e" />
      <ellipse cx="334" cy="207" rx="14" ry="16" fill="#122e12" />
    </svg>
  );
}

// ─── Character figure SVG ─────────────────────────────────────────────────────

export function CharacterFigure({ subject }: { subject: string }) {
  const char = CHARACTERS[subject] ?? FALLBACK_CHARACTER;
  const { coatColor, coatShade, accentColor } = char;

  return (
    <svg
      viewBox="0 0 240 310"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ width: "100%", height: "100%" }}
    >
      <ellipse cx="120" cy="300" rx="58" ry="10" fill="rgba(0,0,0,0.38)" />

      <rect x="88" y="272" width="24" height="26" fill="#3a4a6a" rx="4" />
      <rect x="128" y="272" width="24" height="26" fill="#3a4a6a" rx="4" />
      <ellipse cx="100" cy="297" rx="15" ry="7" fill="#1a1a2a" />
      <ellipse cx="140" cy="297" rx="15" ry="7" fill="#1a1a2a" />

      <rect x="72" y="200" width="96" height="76" fill={coatColor} rx="8" />
      <rect x="72" y="200" width="96" height="76" fill="rgba(0,0,0,0.04)" rx="8" />
      <path d={`M108 200 L120 234 L132 200Z`} fill={coatShade} />
      <rect x="130" y="222" width="20" height="15" fill={coatShade} rx="3" />
      <rect x="132" y="224" width="7" height="3" fill={accentColor} opacity="0.6" rx="1" />
      <rect x="109" y="200" width="22" height="26" fill={accentColor} />
      <path d="M120 200 L115 220 L120 226 L125 220Z" fill="#FFD700" />
      <rect x="80" y="200" width="80" height="3" fill={coatShade} rx="1" />

      <rect x="60" y="205" width="20" height="60" fill={coatColor} rx="10" />
      <rect x="160" y="205" width="20" height="60" fill={coatColor} rx="10" />
      <ellipse cx="70" cy="270" rx="10" ry="9" fill="#c8956a" />
      <ellipse cx="170" cy="270" rx="10" ry="9" fill="#c8956a" />
      <rect x="158" y="246" width="22" height="28" fill="#d4a860" rx="3" />
      <rect x="161" y="250" width="16" height="20" fill="#f0e8d0" rx="1" />
      <rect x="163" y="253" width="12" height="2" fill="#c8b890" rx="1" />
      <rect x="163" y="257" width="12" height="2" fill="#c8b890" rx="1" />
      <rect x="163" y="261" width="8" height="2" fill="#c8b890" rx="1" />
      <rect x="163" y="243" width="10" height="7" fill="#b89040" rx="2" />

      <rect x="112" y="182" width="16" height="22" fill="#c8956a" rx="5" />

      <ellipse cx="120" cy="162" rx="42" ry="46" fill="#c8956a" />
      <ellipse cx="108" cy="148" rx="18" ry="22" fill="#d8a87a" opacity="0.45" />

      <ellipse cx="78" cy="164" rx="9" ry="12" fill="#c8956a" />
      <ellipse cx="162" cy="164" rx="9" ry="12" fill="#c8956a" />
      <ellipse cx="78" cy="164" rx="5" ry="8" fill="#b87a58" />
      <ellipse cx="162" cy="164" rx="5" ry="8" fill="#b87a58" />

      <ellipse cx="120" cy="122" rx="44" ry="32" fill="#1a0a00" />
      <path d="M78 142 Q76 122 84 108 Q98 88 120 86 Q142 88 156 108 Q164 122 162 142" fill="#1a0a00" />
      <path d="M78 146 Q70 126 76 110" fill="none" stroke="#1a0a00" strokeWidth="7" strokeLinecap="round" />
      <path d="M162 146 Q170 126 164 110" fill="none" stroke="#1a0a00" strokeWidth="7" strokeLinecap="round" />

      <ellipse cx="104" cy="160" rx="9" ry="9" fill="#fff" />
      <ellipse cx="136" cy="160" rx="9" ry="9" fill="#fff" />
      <ellipse cx="105" cy="161" rx="6" ry="6" fill="#4a7acc" />
      <ellipse cx="137" cy="161" rx="6" ry="6" fill="#4a7acc" />
      <ellipse cx="106" cy="161" rx="3.2" ry="3.2" fill="#1a1a2a" />
      <ellipse cx="138" cy="161" rx="3.2" ry="3.2" fill="#1a1a2a" />
      <ellipse cx="104" cy="159" rx="1.4" ry="1.4" fill="#fff" />
      <ellipse cx="136" cy="159" rx="1.4" ry="1.4" fill="#fff" />

      <rect x="93" y="153" width="20" height="15" fill="none" stroke="#4a3a2a" strokeWidth="2.2" rx="4" />
      <rect x="127" y="153" width="20" height="15" fill="none" stroke="#4a3a2a" strokeWidth="2.2" rx="4" />
      <line x1="113" y1="160" x2="127" y2="160" stroke="#4a3a2a" strokeWidth="1.8" />
      <line x1="78" y1="160" x2="93" y2="160" stroke="#4a3a2a" strokeWidth="1.8" />
      <line x1="147" y1="160" x2="162" y2="160" stroke="#4a3a2a" strokeWidth="1.8" />

      <path d="M95 151 Q104 146 113 151" fill="none" stroke="#1a0a00" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M127 151 Q136 146 145 151" fill="none" stroke="#1a0a00" strokeWidth="2.2" strokeLinecap="round" />

      <ellipse cx="120" cy="172" rx="3.5" ry="2.5" fill="#b07050" />
      <path d="M115 169 Q120 177 125 169" fill="none" stroke="#a06040" strokeWidth="1.4" strokeLinecap="round" />

      <path d="M110 182 Q120 191 130 182" fill="none" stroke="#a06040" strokeWidth="2.2" strokeLinecap="round" />

      <ellipse cx="92" cy="176" rx="9" ry="5.5" fill="#e89080" opacity="0.35" />
      <ellipse cx="148" cy="176" rx="9" ry="5.5" fill="#e89080" opacity="0.35" />
    </svg>
  );
}