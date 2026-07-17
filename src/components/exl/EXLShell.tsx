"use client";

/**
 * EXLShell.tsx
 *
 * The EXL Learning World visual standard — shared shell that every
 * game screen (narration, objectives, reflection) renders inside.
 *
 * Structure:
 *   .shell
 *     .scene          ← illustrated night environment, full-bleed
 *       SceneBackground (SVG, per subject)
 *       CharacterFigure (SVG, per subject + pose)
 *       .nameBadge     ← character nameplate
 *       .topLeft slot  ← back button
 *       .topRight slot ← mission chip / XP badge
 *     .card            ← parchment dialogue card, EXL signature element
 *       .cardNotch     ← upward triangle connecting card to character
 *       children       ← screen-specific content
 *
 * Every screen passes its own content as children into the card slot.
 * The character pose changes per screen (idle / focused / celebrate).
 * The scene background tints slightly per subject but stays the same
 * illustrated night environment — familiar across all subjects.
 */

import styles from "./EXLShell.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CharacterPose = "idle" | "focused" | "celebrate";

export interface EXLShellProps {
  subject: string;
  pose?: CharacterPose;
  /** Rendered top-left inside the scene (typically a back button) */
  topLeft?: React.ReactNode;
  /** Rendered top-right inside the scene (mission chip, XP badge, etc.) */
  topRight?: React.ReactNode;
  /** Content rendered inside the parchment card */
  children: React.ReactNode;
}

// ─── Character definitions ────────────────────────────────────────────────────

const CHARACTERS: Record<string, {
  name: string;
  role: string;
  coatFill: string;
  coatShadow: string;
  shirtFill: string;
  tieFill: string;
}> = {
  chemistry: {
    name: "Dr. Adaobi",
    role: "Lab Director",
    coatFill: "#e8eef8",
    coatShadow: "#c4d0e4",
    shirtFill: "#2a4a8a",
    tieFill: "#FFD700",
  },
  physics: {
    name: "Prof. Emeka",
    role: "Physics Lead",
    coatFill: "#e8f0e8",
    coatShadow: "#c0d4c0",
    shirtFill: "#1a5a1a",
    tieFill: "#FF9800",
  },
  mathematics: {
    name: "Ms. Chidera",
    role: "Maths Tutor",
    coatFill: "#eeecf8",
    coatShadow: "#ccc8e8",
    shirtFill: "#4a2a8a",
    tieFill: "#00BCD4",
  },
  biology: {
    name: "Dr. Fatima",
    role: "Biology Dept.",
    coatFill: "#e8f4ee",
    coatShadow: "#c0d8c8",
    shirtFill: "#1a5a3a",
    tieFill: "#FF5722",
  },
};

const FALLBACK = CHARACTERS.chemistry;

// ─── Scene SVG background ─────────────────────────────────────────────────────

function SceneBackground({ subject }: { subject: string }) {
  const isChemistry = subject === "chemistry";
  const isPhysics = subject === "physics";
  const isMaths = subject === "mathematics";

  return (
    <svg
      className={styles.sceneBg}
      viewBox="0 0 360 300"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      {/* Sky */}
      <rect width="360" height="300" fill="#090f18" />
      {/* Upper wall / indoor tint */}
      <rect x="0" y="0" width="360" height="185" fill="#0c1a2e" />

      {/* Large window */}
      <rect x="55" y="10" width="210" height="148" fill="#091830" rx="6" />
      {/* Window panes */}
      <rect x="62" y="17" width="95" height="62" fill="#0e2650" rx="2" opacity="0.8" />
      <rect x="163" y="17" width="96" height="62" fill="#0b1e40" rx="2" opacity="0.7" />
      <rect x="62" y="85" width="95" height="67" fill="#0b1e40" rx="2" opacity="0.7" />
      <rect x="163" y="85" width="96" height="67" fill="#0e2650" rx="2" opacity="0.8" />
      {/* Window cross frame */}
      <rect x="55" y="79" width="210" height="5" fill="#060e1c" />
      <rect x="155" y="10" width="5" height="148" fill="#060e1c" />
      {/* Window sill */}
      <rect x="50" y="156" width="220" height="8" fill="#060e1c" rx="2" />

      {/* Stars through window */}
      <circle cx="88" cy="32" r="1.2" fill="#fff" opacity="0.75" />
      <circle cx="230" cy="24" r="0.9" fill="#fff" opacity="0.6" />
      <circle cx="260" cy="50" r="1.5" fill="#fff" opacity="0.85" />
      <circle cx="105" cy="105" r="0.9" fill="#fff" opacity="0.5" />
      <circle cx="245" cy="98" r="1.2" fill="#fff" opacity="0.65" />
      <circle cx="200" cy="38" r="1" fill="#fff" opacity="0.55" />
      <circle cx="78" cy="110" r="1.3" fill="#fff" opacity="0.6" />
      {/* Moon */}
      <circle cx="198" cy="55" r="16" fill="#e8f0ff" opacity="0.12" />
      <circle cx="198" cy="55" r="11" fill="#e8f0ff" opacity="0.1" />

      {/* Subject-specific shelf items (right wall) */}
      {isChemistry && (
        <>
          <rect x="286" y="78" width="62" height="84" fill="#080f08" rx="2" />
          {/* Erlenmeyer flask */}
          <path d="M312 88 L312 112 L298 132 L326 132 Z" fill="#1a4a3a" opacity="0.7" />
          <rect x="309" y="85" width="6" height="6" fill="#1a4a3a" opacity="0.7" rx="1" />
          {/* Liquid level */}
          <path d="M302 122 L322 122 L326 132 L298 132 Z" fill="#0d8a4a" opacity="0.5" />
          {/* Test tube */}
          <rect x="332" y="88" width="8" height="30" fill="#1a6a4a" opacity="0.5" rx="4" />
          <ellipse cx="336" cy="88" rx="4" ry="2" fill="#2a8a5a" opacity="0.5" />
        </>
      )}
      {isPhysics && (
        <>
          <rect x="286" y="78" width="62" height="84" fill="#08100f" rx="2" />
          {/* Circuit board */}
          <rect x="292" y="86" width="48" height="34" fill="#081820" rx="1" />
          <rect x="296" y="92" width="18" height="2" fill="#1a6a2a" opacity="0.9" />
          <rect x="296" y="98" width="12" height="2" fill="#1a6a2a" opacity="0.9" />
          <circle cx="308" cy="110" r="5" fill="#1a7a2a" opacity="0.6" />
          <circle cx="308" cy="110" r="2" fill="#4aff4a" opacity="0.4" />
          {/* Pendulum */}
          <line x1="320" y1="128" x2="320" y2="150" stroke="#4a8aaa" strokeWidth="1" />
          <circle cx="320" cy="153" r="5" fill="#3a6a8a" opacity="0.8" />
        </>
      )}
      {isMaths && (
        <>
          <rect x="286" y="78" width="62" height="84" fill="#080808" rx="2" />
          {/* Chalkboard mini */}
          <rect x="292" y="85" width="48" height="32" fill="#1a2a1a" rx="2" />
          <text x="316" y="96" fill="#c8e8c8" fontSize="7" textAnchor="middle" fontFamily="monospace" opacity="0.8">x² + y²</text>
          <text x="316" y="107" fill="#c8e8c8" fontSize="6" textAnchor="middle" fontFamily="monospace" opacity="0.7">= r²</text>
          {/* Ruler */}
          <rect x="294" y="126" width="44" height="8" fill="#c8a840" rx="2" opacity="0.7" />
          <line x1="298" y1="126" x2="298" y2="134" stroke="#8a7020" strokeWidth="0.8" opacity="0.8" />
          <line x1="306" y1="126" x2="306" y2="134" stroke="#8a7020" strokeWidth="0.8" opacity="0.8" />
          <line x1="314" y1="126" x2="314" y2="134" stroke="#8a7020" strokeWidth="0.8" opacity="0.8" />
          <line x1="322" y1="126" x2="322" y2="134" stroke="#8a7020" strokeWidth="0.8" opacity="0.8" />
          <line x1="330" y1="126" x2="330" y2="134" stroke="#8a7020" strokeWidth="0.8" opacity="0.8" />
        </>
      )}
      {!isChemistry && !isPhysics && !isMaths && (
        <>
          <rect x="286" y="78" width="62" height="84" fill="#081008" rx="2" />
          <ellipse cx="317" cy="110" rx="16" ry="22" fill="#1a4a1a" opacity="0.5" />
          <ellipse cx="317" cy="102" rx="10" ry="12" fill="#2a6a2a" opacity="0.5" />
        </>
      )}

      {/* Left wall / door suggestion */}
      <rect x="0" y="90" width="48" height="98" fill="#070e08" rx="2" />
      <rect x="4" y="95" width="20" height="40" fill="#0d1a0d" rx="1" opacity="0.7" />
      <rect x="28" y="95" width="16" height="40" fill="#0a1508" rx="1" opacity="0.6" />
      <circle cx="42" cy="115" r="3" fill="#2a4a2a" opacity="0.8" />

      {/* Floor / fence line */}
      <rect x="0" y="235" width="360" height="10" fill="#111f0e" />
      {[15,42,69,96,123,150,177,204,231,258,285,312,339].map(x => (
        <rect key={x} x={x} y="225" width="4" height="20" fill="#0e1808" rx="1" />
      ))}

      {/* Ground */}
      <rect x="0" y="243" width="360" height="57" fill="#090e08" />
      <ellipse cx="180" cy="246" rx="200" ry="12" fill="#0b120a" />

      {/* Trees */}
      <rect x="20" y="200" width="5" height="46" fill="#090e08" />
      <ellipse cx="22" cy="196" rx="20" ry="24" fill="#0c200c" />
      <ellipse cx="14" cy="189" rx="13" ry="17" fill="#102a10" />
      <rect x="320" y="208" width="5" height="38" fill="#090e08" />
      <ellipse cx="322" cy="204" rx="18" ry="21" fill="#0c200c" />
      <ellipse cx="330" cy="198" rx="12" ry="15" fill="#102a10" />

      {/* Ambient light patches on ground */}
      <ellipse cx="180" cy="260" rx="60" ry="8" fill="#141e12" opacity="0.5" />
    </svg>
  );
}

// ─── Character SVG ────────────────────────────────────────────────────────────

function CharacterFigure({
  subject,
  pose,
}: {
  subject: string;
  pose: CharacterPose;
}) {
  const char = CHARACTERS[subject] ?? FALLBACK;
  const { coatFill, coatShadow, shirtFill, tieFill } = char;

  // Arm positions vary by pose
  const leftArmY = pose === "celebrate" ? 190 : 208;
  const rightArmY = pose === "celebrate" ? 190 : 208;
  const leftArmAngle = pose === "celebrate" ? "rotate(-30 72 208)" : "rotate(0)";
  const rightArmAngle = pose === "celebrate" ? "rotate(30 168 208)" : "rotate(0)";
  const eyeOffsetY = pose === "focused" ? 1 : 0; // slight downward gaze when focused
  const smilePath = pose === "celebrate"
    ? "M108 184 Q120 196 132 184"   // big smile
    : pose === "focused"
    ? "M112 184 Q120 188 128 184"   // small concentrated smile
    : "M110 184 Q120 192 130 184";  // normal smile

  return (
    <svg
      viewBox="0 0 240 320"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ width: "100%", height: "100%" }}
    >
      {/* Ground shadow */}
      <ellipse cx="120" cy="312" rx="60" ry="9" fill="rgba(0,0,0,0.35)" />

      {/* ── LEGS ── */}
      <rect x="86" y="274" width="22" height="30" fill="#354260" rx="4" />
      <rect x="132" y="274" width="22" height="30" fill="#354260" rx="4" />
      {/* Shoes */}
      <ellipse cx="97" cy="303" rx="16" ry="7" fill="#18182a" />
      <ellipse cx="143" cy="303" rx="16" ry="7" fill="#18182a" />
      {/* Shoe highlight */}
      <ellipse cx="93" cy="301" rx="6" ry="2.5" fill="#242438" />
      <ellipse cx="139" cy="301" rx="6" ry="2.5" fill="#242438" />

      {/* ── COAT BODY ── */}
      <rect x="70" y="204" width="100" height="74" fill={coatFill} rx="8" />
      {/* Coat fold / centre seam */}
      <rect x="117" y="204" width="6" height="74" fill={coatShadow} />
      {/* Lapels */}
      <path d={`M106 204 L120 238 L134 204Z`} fill={coatShadow} />
      {/* Bottom hem shadow */}
      <rect x="70" y="268" width="100" height="10" fill={coatShadow} rx="4" />
      {/* Breast pocket */}
      <rect x="134" y="224" width="18" height="14" fill={coatShadow} rx="3" />
      <rect x="136" y="226" width="6" height="2.5" fill={shirtFill} opacity="0.5" rx="1" />
      {/* Shirt / collar */}
      <rect x="108" y="204" width="24" height="28" fill={shirtFill} />
      {/* Tie */}
      <path d={`M120 204 L115 222 L120 229 L125 222Z`} fill={tieFill} />
      <path d={`M117 204 L123 204 L125 210 L120 208 L115 210Z`} fill={tieFill} opacity="0.7" />
      {/* Top coat trim */}
      <rect x="78" y="204" width="84" height="4" fill={coatShadow} rx="1" />

      {/* ── ARMS ── */}
      <g transform={leftArmAngle}>
        <rect x="56" y={leftArmY} width="20" height="62" fill={coatFill} rx="10" />
        <rect x="56" y={leftArmY} width="20" height="6" fill={coatShadow} rx="5" />
      </g>
      <g transform={rightArmAngle}>
        <rect x="164" y={rightArmY} width="20" height="62" fill={coatFill} rx="10" />
        <rect x="164" y={rightArmY} width="20" height="6" fill={coatShadow} rx="5" />
      </g>

      {/* ── HANDS ── */}
      <ellipse cx="66" cy={leftArmY + 66} rx="11" ry="9" fill="#c89060" />
      <ellipse cx="174" cy={rightArmY + 66} rx="11" ry="9" fill="#c89060" />

      {/* Clipboard (right hand, not shown when celebrating) */}
      {pose !== "celebrate" && (
        <>
          <rect x="162" y="248" width="24" height="30" fill="#c8a050" rx="3" />
          <rect x="165" y="253" width="18" height="21" fill="#f0e8d0" rx="1" />
          <rect x="167" y="256" width="14" height="2" fill="#c0b080" rx="1" />
          <rect x="167" y="261" width="14" height="2" fill="#c0b080" rx="1" />
          <rect x="167" y="266" width="9" height="2" fill="#c0b080" rx="1" />
          <rect x="167" y="244" width="10" height="8" fill="#a08030" rx="2" />
        </>
      )}
      {/* Celebrate — both arms raised, open hands */}
      {pose === "celebrate" && (
        <>
          {/* Stars / sparkles */}
          <text x="42" y="178" fill="#FFD700" fontSize="16" opacity="0.9">✦</text>
          <text x="184" y="172" fill="#FFD700" fontSize="12" opacity="0.8">✦</text>
          <text x="60" y="160" fill="#FFD700" fontSize="10" opacity="0.7">✦</text>
        </>
      )}

      {/* ── NECK ── */}
      <rect x="112" y="185" width="16" height="22" fill="#c89060" rx="6" />

      {/* ── HEAD ── */}
      <ellipse cx="120" cy="164" rx="44" ry="48" fill="#c89060" />
      {/* Face highlight */}
      <ellipse cx="108" cy="150" rx="19" ry="24" fill="#d8a07a" opacity="0.4" />
      {/* Jaw shadow */}
      <ellipse cx="120" cy="204" rx="28" ry="10" fill="#b07040" opacity="0.25" />

      {/* ── EARS ── */}
      <ellipse cx="76" cy="166" rx="10" ry="13" fill="#c89060" />
      <ellipse cx="164" cy="166" rx="10" ry="13" fill="#c89060" />
      <ellipse cx="76" cy="166" rx="6" ry="8" fill="#a87050" />
      <ellipse cx="164" cy="166" rx="6" ry="8" fill="#a87050" />

      {/* ── HAIR ── */}
      <ellipse cx="120" cy="123" rx="46" ry="34" fill="#160800" />
      <path d="M76 145 Q74 122 82 108 Q98 86 120 84 Q142 86 158 108 Q166 122 164 145" fill="#160800" />
      {/* Hair side sweeps */}
      <path d="M76 150 Q68 128 74 110" fill="none" stroke="#160800" strokeWidth="8" strokeLinecap="round" />
      <path d="M164 150 Q172 128 166 110" fill="none" stroke="#160800" strokeWidth="8" strokeLinecap="round" />
      {/* Hair highlight */}
      <ellipse cx="106" cy="108" rx="18" ry="8" fill="#2a1000" opacity="0.5" />

      {/* ── EYES ── */}
      <ellipse cx="104" cy={162 + eyeOffsetY} rx="10" ry="10" fill="#fff" />
      <ellipse cx="136" cy={162 + eyeOffsetY} rx="10" ry="10" fill="#fff" />
      <ellipse cx="105" cy={163 + eyeOffsetY} rx="6.5" ry="6.5" fill="#3a6ac0" />
      <ellipse cx="137" cy={163 + eyeOffsetY} rx="6.5" ry="6.5" fill="#3a6ac0" />
      <ellipse cx="106" cy={163 + eyeOffsetY} rx="3.5" ry="3.5" fill="#18182a" />
      <ellipse cx="138" cy={163 + eyeOffsetY} rx="3.5" ry="3.5" fill="#18182a" />
      {/* Shine */}
      <ellipse cx="104" cy={161 + eyeOffsetY} rx="1.5" ry="1.5" fill="#fff" />
      <ellipse cx="136" cy={161 + eyeOffsetY} rx="1.5" ry="1.5" fill="#fff" />

      {/* ── GLASSES ── */}
      <rect x="92" y={155 + eyeOffsetY} width="22" height="16" fill="none" stroke="#3a2a18" strokeWidth="2.2" rx="4" />
      <rect x="126" y={155 + eyeOffsetY} width="22" height="16" fill="none" stroke="#3a2a18" strokeWidth="2.2" rx="4" />
      {/* Nose bridge */}
      <line x1="114" y1={163 + eyeOffsetY} x2="126" y2={163 + eyeOffsetY} stroke="#3a2a18" strokeWidth="1.8" />
      {/* Temples */}
      <line x1="76" y1={163 + eyeOffsetY} x2="92" y2={163 + eyeOffsetY} stroke="#3a2a18" strokeWidth="1.8" />
      <line x1="148" y1={163 + eyeOffsetY} x2="164" y2={163 + eyeOffsetY} stroke="#3a2a18" strokeWidth="1.8" />

      {/* ── EYEBROWS ── */}
      <path
        d={pose === "focused"
          ? "M93 150 Q104 144 115 149"   // furrowed slightly
          : "M93 152 Q104 146 115 151"
        }
        fill="none" stroke="#160800" strokeWidth="2.4" strokeLinecap="round"
      />
      <path
        d={pose === "focused"
          ? "M125 149 Q136 144 147 150"
          : "M125 151 Q136 146 147 152"
        }
        fill="none" stroke="#160800" strokeWidth="2.4" strokeLinecap="round"
      />

      {/* ── NOSE ── */}
      <ellipse cx="120" cy="175" rx="3.5" ry="2.5" fill="#a06040" />
      <path d="M115 172 Q120 180 125 172" fill="none" stroke="#906030" strokeWidth="1.4" strokeLinecap="round" />

      {/* ── MOUTH ── */}
      <path d={smilePath} fill="none" stroke="#906030" strokeWidth="2.4" strokeLinecap="round" />

      {/* ── CHEEKS ── */}
      <ellipse cx="92" cy="178" rx="10" ry="6" fill="#e08070" opacity={pose === "celebrate" ? 0.5 : 0.3} />
      <ellipse cx="148" cy="178" rx="10" ry="6" fill="#e08070" opacity={pose === "celebrate" ? 0.5 : 0.3} />
    </svg>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export function EXLShell({
  subject,
  pose = "idle",
  topLeft,
  topRight,
  children,
}: EXLShellProps) {
  const char = CHARACTERS[subject] ?? FALLBACK;

  return (
    <div className={styles.shell}>
      {/* ── SCENE ── */}
      <div className={styles.scene}>
        <SceneBackground subject={subject} />

        {/* Top controls */}
        {topLeft && (
          <div className={styles.topLeft}>{topLeft}</div>
        )}
        {topRight && (
          <div className={styles.topRight}>{topRight}</div>
        )}

        {/* Character */}
        <div
          className={styles.characterWrap}
          data-pose={pose}
          aria-hidden="true"
        >
          <CharacterFigure subject={subject} pose={pose} />
        </div>

        {/* Name badge — floats above the card */}
        <div className={styles.nameBadge} aria-label={`${char.name}, ${char.role}`}>
          <span className={styles.badgeName}>{char.name}</span>
          <span className={styles.badgeRole}>{char.role}</span>
        </div>
      </div>

      {/* ── PARCHMENT CARD ── */}
      <div className={styles.card}>
        <div className={styles.cardNotch} aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}