"use client";

/**
 * NarrationScene.tsx
 *
 * Shared visual components for NarrationScreen and DifficultySelectScreen.
 *
 * Each subject gets a VISUALLY DISTINCT character:
 *   chemistry    → Dr. Adaobi     — woman, natural hair, blue lab coat, holds flask
 *   physics      → Prof. Emeka    — man, close-cut hair, green lab coat, holds physics equipment
 *   mathematics  → Ms. Chidera    — woman, braided hair, purple coat, holds geometric tools
 *   biology      → Dr. Fatima     — woman, hijab, white coat with green trim, holds specimen jar
 *
 * Each character is a fully-separate SVG so they read as different people,
 * not just colour swaps of the same figure.
 */

import styles from "./NarrationScreen.module.css";

// ─── Character metadata ───────────────────────────────────────────────────────

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
    coatColor: "#dde8f8",
    coatShade: "#b8cce8",
    accentColor: "#2a4a8a",
  },
  physics: {
    name: "Prof. Emeka",
    role: "Physics Lead",
    coatColor: "#d8eedd",
    coatShade: "#aed4b4",
    accentColor: "#1a5a2a",
  },
  mathematics: {
    name: "Ms. Chidera",
    role: "Mathematics",
    coatColor: "#ece8f8",
    coatShade: "#ccc4e8",
    accentColor: "#4a2a8a",
  },
  biology: {
    name: "Dr. Fatima",
    role: "Biology Dept.",
    coatColor: "#edf8ee",
    coatShade: "#bcdec0",
    accentColor: "#1a5a3a",
  },
};

export const FALLBACK_CHARACTER = CHARACTERS.chemistry;

// ─── Scene background (shared) ────────────────────────────────────────────────

export function SceneBackground({ subject }: { subject: string }) {
  const isChem    = subject === "chemistry";
  const isPhysics = subject === "physics";
  const isMaths   = subject === "mathematics";
  const isBio     = subject === "biology";

  return (
    <svg
      className={styles.sceneBg}
      viewBox="0 0 360 320"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      {/* Sky / room background */}
      <rect width="360" height="320" fill="#0a100a" />
      <rect x="0" y="0" width="360" height="210" fill="#0b1628" />

      {/* Bookshelf / whiteboard background */}
      <rect x="55" y="10" width="210" height="160" fill="#091a35" rx="4" />
      {[0,1,2,3].map(row => (
        <g key={row}>
          {[0,1].map(col => (
            <rect key={col}
              x={63 + col * 100} y={18 + row * 37}
              width={94} height={32}
              fill={row % 2 === 0 ? "#0d2248" : "#0a1c3c"}
              rx="2" opacity="0.7"
            />
          ))}
        </g>
      ))}
      <rect x="55" y="168" width="210" height="6" fill="#040e1c" rx="2" />

      {/* Subject-specific prop on right side */}
      {isChem && (
        <g>
          {/* Chemistry: glassware shelf */}
          <rect x="290" y="88" width="58" height="84" fill="#071210" rx="2" />
          <ellipse cx="310" cy="120" rx="8" ry="14" fill="#00c4e0" opacity="0.25" />
          <ellipse cx="310" cy="120" rx="5" ry="10" fill="#00c4e0" opacity="0.18" />
          <rect x="307" y="108" width="6" height="4" fill="#00c4e0" opacity="0.3" />
          <ellipse cx="332" cy="130" rx="6" ry="9" fill="#a78bfa" opacity="0.22" />
          <rect x="304" y="133" width="20" height="2" fill="#00a8c0" opacity="0.4" rx="1" />
          <rect x="325" y="139" width="14" height="2" fill="#8060d0" opacity="0.4" rx="1" />
        </g>
      )}
      {isPhysics && (
        <g>
          {/* Physics: pendulum / magnet diagram */}
          <rect x="292" y="85" width="56" height="88" fill="#071520" rx="2" />
          <line x1="320" y1="95" x2="320" y2="125" stroke="#7dd3fc" strokeWidth="1.5" opacity="0.6" />
          <circle cx="320" cy="130" r="6" fill="#7dd3fc" opacity="0.4" />
          <path d="M298 140 Q310 148 322 140" fill="none" stroke="#34d399" strokeWidth="1.5" opacity="0.5" />
          <path d="M322 140 Q334 148 346 140" fill="none" stroke="#34d399" strokeWidth="1.5" opacity="0.5" />
        </g>
      )}
      {isMaths && (
        <g>
          {/* Maths: chalkboard equations */}
          <rect x="290" y="85" width="58" height="90" fill="#0a0a1a" rx="2" />
          <text x="296" y="103" fill="#c4b5fd" fontSize="8" fontFamily="monospace" opacity="0.7">x² + y²</text>
          <text x="296" y="117" fill="#a5f3fc" fontSize="7" fontFamily="monospace" opacity="0.6">= r²</text>
          <line x1="296" y1="125" x2="342" y2="125" stroke="#6d28d9" strokeWidth="0.8" opacity="0.4" />
          <text x="296" y="138" fill="#c4b5fd" fontSize="7" fontFamily="monospace" opacity="0.6">∑ n = n(n+1)</text>
          <text x="308" y="150" fill="#a5f3fc" fontSize="7" fontFamily="monospace" opacity="0.5">    2</text>
        </g>
      )}
      {isBio && (
        <g>
          {/* Biology: microscope silhouette + cell */}
          <rect x="292" y="88" width="54" height="84" fill="#071510" rx="2" />
          <ellipse cx="318" cy="132" rx="12" ry="12" fill="none" stroke="#4ade80" strokeWidth="1.2" opacity="0.4" />
          <ellipse cx="318" cy="132" rx="5" ry="5" fill="#4ade80" opacity="0.2" />
          <ellipse cx="315" cy="130" rx="2" ry="2" fill="#4ade80" opacity="0.3" />
          <ellipse cx="321" cy="135" rx="1.5" ry="1.5" fill="#4ade80" opacity="0.25" />
          <rect x="315" y="143" width="6" height="18" fill="#2d4a2d" rx="1" opacity="0.6" />
          <rect x="310" y="160" width="16" height="3" fill="#2d4a2d" rx="1" opacity="0.5" />
        </g>
      )}

      {/* Stars */}
      {[[85,35],[220,28],[252,52],[100,110],[242,95]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r={i%2===0?1.2:0.9} fill="#fff" opacity={0.5+i*0.05} />
      ))}

      {/* Ground level foliage */}
      <ellipse cx="48" cy="228" rx="16" ry="28" fill="#122012" />
      <ellipse cx="48" cy="198" rx="11" ry="13" fill="#1a301a" />
      <rect x="42" y="225" width="5" height="20" fill="#0e180e" />
      <rect x="51" y="225" width="5" height="20" fill="#0e180e" />
      <rect x="0" y="248" width="360" height="8" fill="#182810" />
      {[18,46,74,102,130,158,186,214,242,270,298,326].map(x => (
        <rect key={x} x={x} y="238" width="4" height="18" fill="#142010" rx="1" />
      ))}
      <rect x="0" y="255" width="360" height="65" fill="#0a1208" />
      <ellipse cx="180" cy="258" rx="200" ry="12" fill="#0c1c0a" />
      <rect x="24" y="212" width="5" height="48" fill="#091208" />
      <ellipse cx="26" cy="207" rx="20" ry="24" fill="#0d280d" />
      <rect x="325" y="218" width="5" height="42" fill="#091208" />
      <ellipse cx="327" cy="213" rx="18" ry="22" fill="#0d280d" />
    </svg>
  );
}

// ─── Character figures — one per subject ──────────────────────────────────────

/** Dr. Adaobi — Chemistry. Woman with natural afro, blue lab coat, holds flask */
function ChemistryCharacter() {
  return (
    <svg viewBox="0 0 240 310" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ width: "100%", height: "100%" }}>
      {/* Shadow */}
      <ellipse cx="120" cy="302" rx="55" ry="9" fill="rgba(0,0,0,0.35)" />
      {/* Legs / shoes */}
      <rect x="90" y="268" width="22" height="28" fill="#2a3050" rx="4" />
      <rect x="128" y="268" width="22" height="28" fill="#2a3050" rx="4" />
      <ellipse cx="101" cy="296" rx="14" ry="7" fill="#181820" />
      <ellipse cx="139" cy="296" rx="14" ry="7" fill="#181820" />
      {/* Lab coat body */}
      <rect x="70" y="198" width="100" height="74" fill="#dde8f8" rx="8" />
      {/* Coat lapels */}
      <path d="M108 198 L120 230 L132 198Z" fill="#b8cce8" />
      {/* Blue shirt under coat */}
      <rect x="109" y="198" width="22" height="28" fill="#2a4a8a" />
      {/* Name badge */}
      <rect x="130" y="218" width="22" height="16" fill="#b8cce8" rx="3" />
      <rect x="132" y="220" width="8" height="2.5" fill="#2a4a8a" opacity="0.6" rx="1" />
      <rect x="132" y="224" width="6" height="2" fill="#2a4a8a" opacity="0.4" rx="1" />
      {/* Arms */}
      <rect x="58" y="202" width="20" height="58" fill="#dde8f8" rx="10" />
      <rect x="162" y="202" width="20" height="58" fill="#dde8f8" rx="10" />
      {/* Left hand */}
      <ellipse cx="68" cy="266" rx="10" ry="9" fill="#c8956a" />
      {/* Right hand — holding flask */}
      <ellipse cx="172" cy="260" rx="10" ry="9" fill="#c8956a" />
      {/* Flask */}
      <rect x="166" y="238" width="12" height="6" fill="#a0c0e0" rx="2" />
      <path d="M162 244 L178 244 L184 268 L156 268Z" fill="#60a0e0" opacity="0.55" rx="2" />
      <ellipse cx="170" cy="264" rx="12" ry="5" fill="#4080c0" opacity="0.4" />
      {/* Neck */}
      <rect x="112" y="180" width="16" height="22" fill="#c8956a" rx="5" />
      {/* Head */}
      <ellipse cx="120" cy="160" rx="40" ry="44" fill="#c8956a" />
      {/* Natural afro hair */}
      <ellipse cx="120" cy="118" rx="48" ry="35" fill="#1a0800" />
      <ellipse cx="98" cy="130" rx="20" ry="24" fill="#1a0800" />
      <ellipse cx="142" cy="130" rx="20" ry="24" fill="#1a0800" />
      <ellipse cx="120" cy="110" rx="40" ry="22" fill="#1a0800" />
      {/* Ear studs */}
      <circle cx="80" cy="162" r="3" fill="#f0c040" />
      <circle cx="160" cy="162" r="3" fill="#f0c040" />
      {/* Ear */}
      <ellipse cx="80" cy="162" rx="8" ry="11" fill="#c8956a" />
      <ellipse cx="160" cy="162" rx="8" ry="11" fill="#c8956a" />
      {/* Glasses */}
      <rect x="91" y="152" width="22" height="16" fill="none" stroke="#2a3050" strokeWidth="2" rx="4" />
      <rect x="127" y="152" width="22" height="16" fill="none" stroke="#2a3050" strokeWidth="2" rx="4" />
      <line x1="113" y1="160" x2="127" y2="160" stroke="#2a3050" strokeWidth="1.8" />
      <line x1="80" y1="160" x2="91" y2="160" stroke="#2a3050" strokeWidth="1.8" />
      <line x1="149" y1="160" x2="160" y2="160" stroke="#2a3050" strokeWidth="1.8" />
      {/* Eyes */}
      <ellipse cx="102" cy="159" rx="7" ry="7" fill="#fff" />
      <ellipse cx="138" cy="159" rx="7" ry="7" fill="#fff" />
      <ellipse cx="103" cy="160" rx="4.5" ry="4.5" fill="#3a2010" />
      <ellipse cx="139" cy="160" rx="4.5" ry="4.5" fill="#3a2010" />
      <ellipse cx="101.5" cy="158.5" rx="1.5" ry="1.5" fill="#fff" />
      <ellipse cx="137.5" cy="158.5" rx="1.5" ry="1.5" fill="#fff" />
      {/* Eyebrows */}
      <path d="M93 150 Q102 145 111 150" fill="none" stroke="#1a0800" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M129 150 Q138 145 147 150" fill="none" stroke="#1a0800" strokeWidth="2.2" strokeLinecap="round" />
      {/* Nose */}
      <ellipse cx="120" cy="172" rx="3.5" ry="2.5" fill="#b07050" />
      {/* Smile */}
      <path d="M110 182 Q120 190 130 182" fill="none" stroke="#9a6040" strokeWidth="2" strokeLinecap="round" />
      {/* Cheeks */}
      <ellipse cx="90" cy="175" rx="9" ry="5.5" fill="#e89080" opacity="0.28" />
      <ellipse cx="150" cy="175" rx="9" ry="5.5" fill="#e89080" opacity="0.28" />
    </svg>
  );
}

/** Prof. Emeka — Physics. Man with close-cut hair, green coat, holds a magnet */
function PhysicsCharacter() {
  return (
    <svg viewBox="0 0 240 310" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ width: "100%", height: "100%" }}>
      <ellipse cx="120" cy="302" rx="55" ry="9" fill="rgba(0,0,0,0.35)" />
      {/* Legs */}
      <rect x="88" y="268" width="24" height="28" fill="#1a2a1a" rx="4" />
      <rect x="128" y="268" width="24" height="28" fill="#1a2a1a" rx="4" />
      <ellipse cx="100" cy="296" rx="15" ry="7" fill="#101410" />
      <ellipse cx="140" cy="296" rx="15" ry="7" fill="#101410" />
      {/* Lab coat */}
      <rect x="68" y="196" width="104" height="76" fill="#d8eedd" rx="8" />
      <path d="M106 196 L120 232 L134 196Z" fill="#aed4b4" />
      <rect x="107" y="196" width="26" height="30" fill="#1a5a2a" />
      {/* Tie */}
      <path d="M118 196 L122 196 L124 226 L120 232 L116 226Z" fill="#2a8040" />
      {/* Name badge */}
      <rect x="130" y="216" width="22" height="16" fill="#aed4b4" rx="3" />
      <rect x="132" y="218" width="8" height="2.5" fill="#1a5a2a" opacity="0.6" rx="1" />
      {/* Arms */}
      <rect x="56" y="200" width="20" height="62" fill="#d8eedd" rx="10" />
      <rect x="164" y="200" width="20" height="62" fill="#d8eedd" rx="10" />
      {/* Hands */}
      <ellipse cx="66" cy="268" rx="10" ry="9" fill="#a07850" />
      <ellipse cx="174" cy="264" rx="10" ry="9" fill="#a07850" />
      {/* U-shaped magnet in right hand */}
      <path d="M164 248 Q164 236 175 236 Q186 236 186 248" fill="none" stroke="#e03030" strokeWidth="5" strokeLinecap="round" />
      <rect x="161" y="248" width="6" height="10" fill="#e03030" rx="1" />
      <rect x="183" y="248" width="6" height="10" fill="#3060e0" rx="1" />
      {/* Neck */}
      <rect x="112" y="180" width="16" height="20" fill="#a07850" rx="5" />
      {/* Head — wider, more angular */}
      <ellipse cx="120" cy="157" rx="42" ry="46" fill="#a07850" />
      {/* Close-cut hair */}
      <ellipse cx="120" cy="112" rx="42" ry="26" fill="#0f0800" />
      <rect x="78" y="125" width="84" height="16" fill="#0f0800" rx="4" />
      {/* Beard / stubble */}
      <path d="M94 185 Q120 196 146 185 Q140 200 120 202 Q100 200 94 185Z" fill="#0f0800" opacity="0.35" />
      {/* Ears */}
      <ellipse cx="78" cy="160" rx="9" ry="12" fill="#a07850" />
      <ellipse cx="162" cy="160" rx="9" ry="12" fill="#a07850" />
      {/* Eyes */}
      <ellipse cx="104" cy="156" rx="9" ry="9" fill="#fff" />
      <ellipse cx="136" cy="156" rx="9" ry="9" fill="#fff" />
      <ellipse cx="105" cy="157" rx="5.5" ry="5.5" fill="#2a1808" />
      <ellipse cx="137" cy="157" rx="5.5" ry="5.5" fill="#2a1808" />
      <ellipse cx="103.5" cy="155.5" rx="1.5" ry="1.5" fill="#fff" />
      <ellipse cx="135.5" cy="155.5" rx="1.5" ry="1.5" fill="#fff" />
      {/* Eyebrows — thicker */}
      <path d="M95 146 Q104 141 113 146" fill="none" stroke="#0f0800" strokeWidth="3" strokeLinecap="round" />
      <path d="M127 146 Q136 141 145 146" fill="none" stroke="#0f0800" strokeWidth="3" strokeLinecap="round" />
      {/* Nose — more prominent */}
      <path d="M118 165 Q115 175 118 178 Q120 180 122 178 Q125 175 122 165" fill="#906840" opacity="0.5" />
      {/* Mouth */}
      <path d="M108 186 Q120 194 132 186" fill="none" stroke="#704828" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Ms. Chidera — Mathematics. Woman with braids, purple coat, holds a protractor */
function MathsCharacter() {
  return (
    <svg viewBox="0 0 240 310" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ width: "100%", height: "100%" }}>
      <ellipse cx="120" cy="302" rx="55" ry="9" fill="rgba(0,0,0,0.35)" />
      {/* Legs */}
      <rect x="90" y="268" width="22" height="28" fill="#281a3a" rx="4" />
      <rect x="128" y="268" width="22" height="28" fill="#281a3a" rx="4" />
      <ellipse cx="101" cy="296" rx="14" ry="7" fill="#140c1e" />
      <ellipse cx="139" cy="296" rx="14" ry="7" fill="#140c1e" />
      {/* Coat */}
      <rect x="70" y="198" width="100" height="74" fill="#ece8f8" rx="8" />
      <path d="M108 198 L120 232 L132 198Z" fill="#ccc4e8" />
      <rect x="109" y="198" width="22" height="28" fill="#4a2a8a" />
      {/* Scarf accent */}
      <path d="M109 198 Q120 210 131 198 L131 208 Q120 220 109 208Z" fill="#7c3aed" opacity="0.6" />
      {/* Name badge */}
      <rect x="130" y="220" width="20" height="14" fill="#ccc4e8" rx="3" />
      <rect x="132" y="222" width="7" height="2" fill="#4a2a8a" opacity="0.5" rx="1" />
      {/* Arms */}
      <rect x="58" y="202" width="20" height="60" fill="#ece8f8" rx="10" />
      <rect x="162" y="202" width="20" height="60" fill="#ece8f8" rx="10" />
      {/* Left hand */}
      <ellipse cx="68" cy="268" rx="10" ry="9" fill="#c8956a" />
      {/* Right hand + protractor */}
      <ellipse cx="172" cy="262" rx="10" ry="9" fill="#c8956a" />
      <path d="M158 248 A16 16 0 0 1 190 248Z" fill="none" stroke="#c4b5fd" strokeWidth="2.5" opacity="0.7" />
      <line x1="174" y1="248" x2="174" y2="232" stroke="#c4b5fd" strokeWidth="1.5" opacity="0.6" />
      <line x1="174" y1="248" x2="186" y2="238" stroke="#c4b5fd" strokeWidth="1.5" opacity="0.6" />
      {/* Neck */}
      <rect x="112" y="180" width="16" height="22" fill="#c8956a" rx="5" />
      {/* Head */}
      <ellipse cx="120" cy="158" rx="40" ry="44" fill="#c8956a" />
      {/* Braided hair — cornrows / box braids coming back */}
      <rect x="80" y="115" width="80" height="26" fill="#1a0800" rx="6" />
      <ellipse cx="120" cy="112" rx="42" ry="20" fill="#1a0800" />
      {/* Individual braid sections */}
      {[84,92,100,108,116,124,132,140,148].map((x,i) => (
        <rect key={i} x={x} y="108" width="5" height="60" fill={i%2===0?"#1a0800":"#2a1408"} rx="2.5" opacity="0.9" />
      ))}
      {/* Braid tips — gathered to one side */}
      <path d="M84 168 Q90 200 96 210 Q102 216 108 212" fill="none" stroke="#1a0800" strokeWidth="5" strokeLinecap="round" />
      <path d="M92 168 Q98 200 102 210" fill="none" stroke="#2a1408" strokeWidth="4" strokeLinecap="round" />
      {/* Gold hair beads */}
      <circle cx="90" cy="200" r="3" fill="#f0c040" />
      <circle cx="99" cy="207" r="3" fill="#f0c040" />
      <circle cx="106" cy="210" r="3" fill="#f0c040" />
      {/* Ears */}
      <ellipse cx="80" cy="160" rx="8" ry="11" fill="#c8956a" />
      <ellipse cx="160" cy="160" rx="8" ry="11" fill="#c8956a" />
      {/* Hoop earrings */}
      <circle cx="80" cy="163" r="5" fill="none" stroke="#f0c040" strokeWidth="1.5" />
      <circle cx="160" cy="163" r="5" fill="none" stroke="#f0c040" strokeWidth="1.5" />
      {/* Eyes */}
      <ellipse cx="104" cy="157" rx="8" ry="8" fill="#fff" />
      <ellipse cx="136" cy="157" rx="8" ry="8" fill="#fff" />
      <ellipse cx="105" cy="158" rx="5" ry="5" fill="#2a1808" />
      <ellipse cx="137" cy="158" rx="5" ry="5" fill="#2a1808" />
      <ellipse cx="103.5" cy="156.5" rx="1.5" ry="1.5" fill="#fff" />
      <ellipse cx="135.5" cy="156.5" rx="1.5" ry="1.5" fill="#fff" />
      {/* Eyebrows */}
      <path d="M95 148 Q104 143 113 148" fill="none" stroke="#1a0800" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M127 148 Q136 143 145 148" fill="none" stroke="#1a0800" strokeWidth="2.2" strokeLinecap="round" />
      {/* Nose */}
      <ellipse cx="120" cy="170" rx="3.5" ry="2.5" fill="#b07050" />
      {/* Smile */}
      <path d="M111 180 Q120 188 129 180" fill="none" stroke="#9a6040" strokeWidth="2" strokeLinecap="round" />
      {/* Cheeks */}
      <ellipse cx="90" cy="173" rx="9" ry="5" fill="#e89080" opacity="0.28" />
      <ellipse cx="150" cy="173" rx="9" ry="5" fill="#e89080" opacity="0.28" />
    </svg>
  );
}

/** Dr. Fatima — Biology. Woman with hijab (teal), white coat green trim, holds specimen jar */
function BiologyCharacter() {
  return (
    <svg viewBox="0 0 240 310" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ width: "100%", height: "100%" }}>
      <ellipse cx="120" cy="302" rx="55" ry="9" fill="rgba(0,0,0,0.35)" />
      {/* Legs */}
      <rect x="90" y="268" width="22" height="28" fill="#1a2a1a" rx="4" />
      <rect x="128" y="268" width="22" height="28" fill="#1a2a1a" rx="4" />
      <ellipse cx="101" cy="296" rx="14" ry="7" fill="#0e160e" />
      <ellipse cx="139" cy="296" rx="14" ry="7" fill="#0e160e" />
      {/* Lab coat white with green piping */}
      <rect x="70" y="198" width="100" height="74" fill="#edf8ee" rx="8" />
      {/* Green trim on coat */}
      <rect x="70" y="198" width="8" height="74" fill="#bcdec0" rx="4" />
      <rect x="162" y="198" width="8" height="74" fill="#bcdec0" rx="4" />
      <path d="M108 198 L120 232 L132 198Z" fill="#bcdec0" />
      <rect x="109" y="198" width="22" height="28" fill="#1a5a3a" />
      {/* Name badge */}
      <rect x="130" y="218" width="22" height="16" fill="#bcdec0" rx="3" />
      <rect x="132" y="220" width="8" height="2.5" fill="#1a5a3a" opacity="0.6" rx="1" />
      {/* Arms */}
      <rect x="58" y="202" width="20" height="60" fill="#edf8ee" rx="10" />
      <rect x="162" y="202" width="20" height="60" fill="#edf8ee" rx="10" />
      {/* Hands — lighter skin in hijab */}
      <ellipse cx="68" cy="268" rx="10" ry="9" fill="#d4a87a" />
      <ellipse cx="172" cy="262" rx="10" ry="9" fill="#d4a87a" />
      {/* Specimen jar in right hand */}
      <rect x="163" y="240" width="20" height="26" fill="#a0e8a0" opacity="0.3" rx="4" />
      <rect x="164" y="238" width="18" height="5" fill="#bcdec0" rx="2" />
      <ellipse cx="173" cy="254" rx="6" ry="6" fill="#4ade80" opacity="0.35" />
      <ellipse cx="173" cy="254" rx="3" ry="3" fill="#4ade80" opacity="0.4" />
      {/* Neck (small, mostly covered) */}
      <rect x="114" y="182" width="12" height="18" fill="#d4a87a" rx="4" />
      {/* Face */}
      <ellipse cx="120" cy="163" rx="36" ry="38" fill="#d4a87a" />
      {/* Hijab — wraps around head */}
      {/* Hijab main fabric (teal-green) */}
      <ellipse cx="120" cy="125" rx="48" ry="40" fill="#1a8a6a" />
      <ellipse cx="120" cy="110" rx="44" ry="30" fill="#1a8a6a" />
      {/* Hijab drape on sides and over chest */}
      <path d="M74 150 Q68 180 70 200 L90 198 Q84 178 82 155Z" fill="#168060" />
      <path d="M166 150 Q172 180 170 200 L150 198 Q156 178 158 155Z" fill="#168060" />
      {/* Hijab face opening (oval reveal) */}
      <ellipse cx="120" cy="160" rx="36" ry="40" fill="#d4a87a" />
      {/* Hijab border around face */}
      <path d="M84 135 Q84 120 120 118 Q156 120 156 135 Q158 155 156 172 Q148 188 120 190 Q92 188 84 172 Q82 155 84 135Z" fill="none" stroke="#128060" strokeWidth="4" />
      {/* Ears (mostly hidden) */}
      <ellipse cx="84" cy="162" rx="5" ry="7" fill="#d4a87a" />
      <ellipse cx="156" cy="162" rx="5" ry="7" fill="#d4a87a" />
      {/* Eyes */}
      <ellipse cx="105" cy="158" rx="8" ry="8" fill="#fff" />
      <ellipse cx="135" cy="158" rx="8" ry="8" fill="#fff" />
      <ellipse cx="106" cy="159" rx="5.5" ry="5.5" fill="#1a0a00" />
      <ellipse cx="136" cy="159" rx="5.5" ry="5.5" fill="#1a0a00" />
      <ellipse cx="104.5" cy="157.5" rx="1.5" ry="1.5" fill="#fff" />
      <ellipse cx="134.5" cy="157.5" rx="1.5" ry="1.5" fill="#fff" />
      {/* Kohl-lined eyes — slightly thicker lash line */}
      <path d="M97 154 Q106 150 115 154" fill="none" stroke="#1a0a00" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M125 154 Q134 150 143 154" fill="none" stroke="#1a0a00" strokeWidth="1.5" strokeLinecap="round" />
      {/* Eyebrows (slightly above hijab frame) */}
      <path d="M98 149 Q106 144 114 149" fill="none" stroke="#1a0a00" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M126 149 Q134 144 142 149" fill="none" stroke="#1a0a00" strokeWidth="2.2" strokeLinecap="round" />
      {/* Nose */}
      <ellipse cx="120" cy="170" rx="3" ry="2" fill="#b08060" />
      {/* Gentle smile */}
      <path d="M112 180 Q120 187 128 180" fill="none" stroke="#906040" strokeWidth="1.8" strokeLinecap="round" />
      {/* Cheeks */}
      <ellipse cx="94" cy="174" rx="8" ry="5" fill="#e09070" opacity="0.22" />
      <ellipse cx="146" cy="174" rx="8" ry="5" fill="#e09070" opacity="0.22" />
    </svg>
  );
}

// ─── CharacterFigure — routes to the right character SVG ─────────────────────

export function CharacterFigure({ subject }: { subject: string }) {
  switch (subject) {
    case "chemistry":    return <ChemistryCharacter />;
    case "physics":      return <PhysicsCharacter />;
    case "mathematics":  return <MathsCharacter />;
    case "biology":      return <BiologyCharacter />;
    default:             return <ChemistryCharacter />;
  }
}