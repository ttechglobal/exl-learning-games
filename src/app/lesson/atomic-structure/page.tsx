"use client";

/**
 * ATOMIC STRUCTURE  ·  /lesson/atomic-structure
 *
 * Architecture:
 *   One topic = one file.
 *   Topic contains multiple CONCEPTS.
 *   Each concept has three STAGES: Explore → Learn → Practice.
 *   Student moves through stages inside a concept,
 *   then advances to the next concept via the concept nav.
 *
 * Concepts in this topic:
 *   1. What is an Atom?
 *   2. Parts of an Atom
 *   3. Mass Number & Atomic Number
 */

import React, { useState } from "react";
import s from "./lesson.module.css";

/* ═══════════════════════════════════════════════════
   SHARED PRIMITIVES
═══════════════════════════════════════════════════ */

/** Circular atom diagram with configurable shells */
function AtomDiagram({
  shells = [[2]],         // electrons per shell, e.g. [[2],[8],[1]]
  size = 140,
  highlightShell,         // index of shell to glow
  highlightNucleus = false,
  pulseElectron,          // [shellIdx, eIdx] to animate
}: {
  shells?: number[][];
  size?: number;
  highlightShell?: number;
  highlightNucleus?: boolean;
  pulseElectron?: [number, number];
}) {
  const cx = size / 2, cy = size / 2;
  const baseR = size * 0.14;          // nucleus radius
  const shellGap = size * 0.13;       // gap between shells
  const totalShells = shells.length;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
      <defs>
        <radialGradient id={`nucGrad${size}`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#e06070" />
          <stop offset="100%" stopColor="#8a1525" />
        </radialGradient>
        {shells.map((_, si) => (
          <filter key={si} id={`glow${si}${size}`}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        ))}
      </defs>

      {/* Shells */}
      {shells.map((eList, si) => {
        const r = baseR + shellGap * (si + 1);
        const isHighlight = highlightShell === si;
        return (
          <ellipse
            key={si}
            cx={cx} cy={cy}
            rx={r} ry={r * 0.38}
            fill="none"
            stroke={isHighlight ? "#4a90d9" : "rgba(100,140,210,0.3)"}
            strokeWidth={isHighlight ? 2 : 1.5}
            opacity={isHighlight ? 1 : 0.6}
          />
        );
      })}

      {/* Nucleus */}
      <circle
        cx={cx} cy={cy} r={baseR}
        fill={highlightNucleus ? "#e06070" : `url(#nucGrad${size})`}
        stroke={highlightNucleus ? "#ff9090" : "rgba(200,80,90,0.4)"}
        strokeWidth="2"
        style={{ filter: highlightNucleus ? "drop-shadow(0 0 6px #ff606090)" : "none", transition: "all 0.4s" }}
      />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={baseR * 0.7} fontWeight="900" fill="rgba(255,255,255,0.7)">p</text>

      {/* Electrons per shell */}
      {shells.map((eList, si) => {
        const r = baseR + shellGap * (si + 1);
        const count = eList[0];
        return Array.from({ length: count }).map((_, ei) => {
          const angle = (ei / count) * 2 * Math.PI - Math.PI / 2;
          const ex = cx + r * Math.cos(angle);
          const ey = cy + r * Math.sin(angle) * 0.38;
          const isPulse = pulseElectron && pulseElectron[0] === si && pulseElectron[1] === ei;
          const isShellHighlight = highlightShell === si;
          return (
            <circle
              key={`${si}-${ei}`}
              cx={ex} cy={ey} r={size * 0.052}
              fill={isPulse ? "#ffd060" : isShellHighlight ? "#60b8ff" : "#4a90d9"}
              stroke={isPulse ? "#ffee80" : isShellHighlight ? "#a0d8ff" : "rgba(120,170,240,0.7)"}
              strokeWidth="1.5"
              style={{ transition: "all 0.3s", filter: isPulse ? "drop-shadow(0 0 4px #ffd06080)" : "none" }}
            />
          );
        });
      })}

      {/* Shell labels */}
      {totalShells > 1 && shells.map((eList, si) => {
        const r = baseR + shellGap * (si + 1);
        return (
          <text
            key={si}
            x={cx + r + 4} y={cy + 3}
            fontSize={size * 0.075} fontWeight="800"
            fill="rgba(100,140,210,0.5)"
          >
            n={si + 1}
          </text>
        );
      })}
    </svg>
  );
}

/** Coach speech bubble */
function CoachBubble({ text, color = "#3DBE5A" }: { text: string; color?: string }) {
  return (
    <div className={s.coachBubble} style={{ borderColor: color + "40" }}>
      <MascotFace />
      <div className={s.coachText}>{text}</div>
    </div>
  );
}

/** Mascot face SVG */
function MascotFace({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 90 108" fill="none" style={{ flexShrink: 0 }}>
      <rect x="22" y="58" width="46" height="44" rx="6" fill="white" stroke="#dde3f0" strokeWidth="1" />
      <rect x="34" y="70" width="22" height="26" rx="3" fill="#3DBE5A" />
      <text x="45" y="86" textAnchor="middle" fontSize="7" fontWeight="900" fill="white" fontFamily="Arial">EXL</text>
      <ellipse cx="45" cy="36" rx="18" ry="20" fill="#6B3F1F" />
      <ellipse cx="45" cy="40" rx="13" ry="13" fill="#C4814A" />
      <circle cx="39.5" cy="37.5" r="3" fill="white" /><circle cx="50.5" cy="37.5" r="3" fill="white" />
      <circle cx="40" cy="38" r="1.7" fill="#1a1a1a" /><circle cx="51" cy="38" r="1.7" fill="#1a1a1a" />
      <path d="M39 44 Q45 49 51 44" stroke="#7a3a1a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <ellipse cx="45" cy="22" rx="17" ry="6.5" fill="#1a1a1a" />
    </svg>
  );
}

/** Correct / Wrong badge */
function Badge({ correct }: { correct: boolean }) {
  return (
    <span className={correct ? s.badgeCorrect : s.badgeWrong}>
      {correct ? "✓ Correct!" : "✗ Try again"}
    </span>
  );
}

/** Multiple choice question */
function MCQ({
  question, options, correct, onCorrect,
}: {
  question: string;
  options: string[];
  correct: number;
  onCorrect?: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  function pick(i: number) {
    setSelected(i);
    if (i === correct && onCorrect) setTimeout(onCorrect, 800);
  }

  return (
    <div className={s.mcq}>
      <div className={s.mcqQ}>{question}</div>
      <div className={s.mcqOpts}>
        {options.map((opt, i) => (
          <button
            key={i}
            className={`${s.mcqOpt} ${
              selected === i
                ? i === correct ? s.mcqOptRight : s.mcqOptWrong
                : selected !== null && i === correct ? s.mcqOptReveal : ""
            }`}
            onClick={() => pick(i)}
            disabled={selected !== null}
          >
            <span className={s.mcqLetter}>{String.fromCharCode(65 + i)}</span>
            {opt}
          </button>
        ))}
      </div>
      {selected !== null && <Badge correct={selected === correct} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   CONCEPT 1 — WHAT IS AN ATOM?
═══════════════════════════════════════════════════ */

function C1Explore({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      coach: "Everything around you is made of atoms. Tap the atom to begin exploring!",
      highlight: null as "nucleus" | "shell" | null,
      tooltip: null as null | { title: string; body: string },
    },
    {
      coach: "This glowing cluster in the middle is the nucleus — the atom's core. Tap it!",
      highlight: "nucleus" as "nucleus" | "shell" | null,
      tooltip: { title: "The Nucleus", body: "At the centre of every atom. Contains protons (+) and neutrons (no charge)." },
    },
    {
      coach: "Those blue dots orbiting around? Those are electrons. Tap one to see what they do.",
      highlight: "shell" as "nucleus" | "shell" | null,
      tooltip: { title: "Electrons", body: "Negatively charged particles that orbit the nucleus in layers called shells or energy levels." },
    },
    {
      coach: "Great! You've discovered the three parts. An atom is mostly empty space — the nucleus is tiny but holds almost all the mass!",
      highlight: null,
      tooltip: { title: "Did you know?", body: "If an atom were the size of a football stadium, the nucleus would be the size of a marble." },
    },
  ];

  const cur = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className={s.exploreLayout}>
      <CoachBubble text={cur.coach} />
      <div className={s.exploreCenter}>
        <div
          className={s.atomInteractive}
          onClick={() => !isLast && setStep(step + 1)}
          style={{ cursor: isLast ? "default" : "pointer" }}
        >
          <AtomDiagram
            shells={[[3]]}
            size={170}
            highlightNucleus={cur.highlight === "nucleus"}
            highlightShell={cur.highlight === "shell" ? 0 : undefined}
            pulseElectron={cur.highlight === "shell" ? [0, 0] : undefined}
          />
          {cur.tooltip && (
            <div className={s.atomTooltip}>
              <div className={s.tooltipTitle}>{cur.tooltip.title}</div>
              <div className={s.tooltipBody}>{cur.tooltip.body}</div>
            </div>
          )}
        </div>
        <div className={s.stepPager}>{step + 1} / {steps.length}</div>
        <div className={s.stepDots}>
          {steps.map((_, i) => (
            <span key={i} className={`${s.stepDot} ${i <= step ? s.stepDotOn : ""}`} />
          ))}
        </div>
      </div>
      {isLast && (
        <button className={s.nextStageBtn} onClick={onComplete}>
          I understand → Go to Learn
        </button>
      )}
    </div>
  );
}

function C1Learn({ onComplete }: { onComplete: () => void }) {
  return (
    <div className={s.learnLayout}>
      <div className={s.learnContent}>
        <div className={s.learnDef}>
          <div className={s.defWord}>atom</div>
          <div className={s.defPhonetic}>/ˈatəm/</div>
          <div className={s.defText}>
            The <strong>smallest unit of matter</strong> that retains the chemical properties of an element. All matter — from air to steel to your own body — is made of atoms.
          </div>
        </div>
        <div className={s.learnFacts}>
          {[
            { icon: "⚛️", fact: "Atoms are incredibly tiny — a human hair is about 1 million atoms wide." },
            { icon: "🌌", fact: "An atom is mostly empty space. The nucleus is 100,000× smaller than the whole atom." },
            { icon: "🔗", fact: "Atoms bond together to form molecules, which make up all substances." },
          ].map(({ icon, fact }) => (
            <div key={fact} className={s.factRow}>
              <span className={s.factIcon}>{icon}</span>
              <span className={s.factText}>{fact}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={s.learnDiagram}>
        <AtomDiagram shells={[[3]]} size={150} />
        <div className={s.diagramCaption}>A simple atom with 1 shell and 3 electrons</div>
      </div>
      <button className={s.nextStageBtn} onClick={onComplete}>
        Now let me practice →
      </button>
    </div>
  );
}

function C1Practice({ onComplete }: { onComplete: () => void }) {
  const [q, setQ] = useState(0);
  const [done, setDone] = useState(false);

  const questions = [
    {
      question: "What is an atom?",
      options: [
        "The largest particle in the universe",
        "The smallest unit of matter that keeps chemical properties",
        "A type of molecule",
        "A charged particle",
      ],
      correct: 1,
    },
    {
      question: "An atom is mostly made of…",
      options: ["Electrons", "Protons", "Empty space", "Neutrons"],
      correct: 2,
    },
    {
      question: "Atoms bond together to form…",
      options: ["Elements", "Molecules", "Nuclei", "Shells"],
      correct: 1,
    },
  ];

  function nextQ() {
    if (q < questions.length - 1) setQ(q + 1);
    else setDone(true);
  }

  if (done) {
    return (
      <div className={s.practiceComplete}>
        <div className={s.completeIcon}>🎉</div>
        <div className={s.completeTitle}>Concept 1 Complete!</div>
        <div className={s.completeSub}>You understand what an atom is. Ready for the next concept?</div>
        <button className={s.nextStageBtn} onClick={onComplete}>Next concept →</button>
      </div>
    );
  }

  return (
    <div className={s.practiceLayout}>
      <div className={s.practiceProgress}>
        Question {q + 1} of {questions.length}
        <div className={s.practiceBar}><div className={s.practiceBarFill} style={{ width: `${((q) / questions.length) * 100}%` }} /></div>
      </div>
      <MCQ key={q} {...questions[q]} onCorrect={nextQ} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   CONCEPT 2 — PARTS OF AN ATOM
═══════════════════════════════════════════════════ */

function C2Explore({ onComplete }: { onComplete: () => void }) {
  const [active, setActive] = useState<"proton" | "neutron" | "electron" | null>(null);

  const parts = {
    proton: {
      label: "Proton",
      color: "#e84747",
      charge: "+1",
      location: "Nucleus",
      mass: "1 amu",
      fact: "The number of protons defines which element it is. Carbon always has 6 protons.",
    },
    neutron: {
      label: "Neutron",
      color: "#9b6dff",
      charge: "0",
      location: "Nucleus",
      mass: "1 amu",
      fact: "Neutrons have no charge. They help hold the nucleus together and determine the isotope.",
    },
    electron: {
      label: "Electron",
      color: "#4a90d9",
      charge: "−1",
      location: "Shells (orbit)",
      mass: "~0 amu",
      fact: "Electrons are 1836× lighter than protons. They determine how atoms bond with others.",
    },
  };

  const info = active ? parts[active] : null;

  return (
    <div className={s.exploreLayout}>
      <CoachBubble
        text={active
          ? `You selected: ${parts[active].label}. Read the info panel, then tap another part!`
          : "Tap on a particle below to explore it. What are protons, neutrons, and electrons?"}
      />
      <div className={s.partsExplorer}>
        <div className={s.partsAtomWrap}>
          <AtomDiagram
            shells={[[3]]}
            size={160}
            highlightNucleus={active === "proton" || active === "neutron"}
            highlightShell={active === "electron" ? 0 : undefined}
          />
        </div>
        <div className={s.partsButtons}>
          {(["proton","neutron","electron"] as const).map((p) => (
            <button
              key={p}
              className={`${s.partBtn} ${active === p ? s.partBtnOn : ""}`}
              style={{ "--part-color": parts[p].color } as React.CSSProperties}
              onClick={() => setActive(active === p ? null : p)}
            >
              <span className={s.partBtnDot} style={{ background: parts[p].color }} />
              {parts[p].label}
            </button>
          ))}
        </div>
      </div>
      {info && (
        <div className={s.partInfoCard} style={{ borderTopColor: info.color }}>
          <div className={s.partInfoTitle} style={{ color: info.color }}>{info.label}</div>
          <div className={s.partInfoGrid}>
            <div className={s.partInfoItem}><span className={s.partInfoLbl}>Charge</span><span className={s.partInfoVal}>{info.charge}</span></div>
            <div className={s.partInfoItem}><span className={s.partInfoLbl}>Location</span><span className={s.partInfoVal}>{info.location}</span></div>
            <div className={s.partInfoItem}><span className={s.partInfoLbl}>Mass</span><span className={s.partInfoVal}>{info.mass}</span></div>
          </div>
          <div className={s.partInfoFact}>💡 {info.fact}</div>
        </div>
      )}
      {active === "electron" && (
        <button className={s.nextStageBtn} onClick={onComplete}>I've explored all parts → Learn</button>
      )}
    </div>
  );
}

function C2Learn({ onComplete }: { onComplete: () => void }) {
  return (
    <div className={s.learnLayout}>
      <div className={s.learnContent}>
        <div className={s.learnTable}>
          <div className={s.tableHead}>
            <span>Particle</span><span>Charge</span><span>Mass</span><span>Location</span>
          </div>
          {[
            { name: "Proton",   symbol: "p⁺", charge: "+1", mass: "1 amu",  loc: "Nucleus",  color: "#e84747" },
            { name: "Neutron",  symbol: "n⁰", charge: "0",  mass: "1 amu",  loc: "Nucleus",  color: "#9b6dff" },
            { name: "Electron", symbol: "e⁻", charge: "−1", mass: "~0 amu", loc: "Shell",    color: "#4a90d9" },
          ].map(({ name, symbol, charge, mass, loc, color }) => (
            <div key={name} className={s.tableRow}>
              <span className={s.tableParticle}>
                <span className={s.tableSymbol} style={{ color }}>{symbol}</span> {name}
              </span>
              <span className={s.tableCharge} style={{ color }}>{charge}</span>
              <span>{mass}</span>
              <span className={s.tableLoc}>{loc}</span>
            </div>
          ))}
        </div>
        <div className={s.learnNote}>
          ⚖️ In a neutral atom, the number of <strong>protons = electrons</strong>. The charges cancel out.
        </div>
      </div>
      <div className={s.learnDiagram}>
        <AtomDiagram shells={[[2], [1]]} size={150} />
        <div className={s.diagramCaption}>Lithium: 3 protons, 3 electrons — 2 shells</div>
      </div>
      <button className={s.nextStageBtn} onClick={onComplete}>Practice this →</button>
    </div>
  );
}

function C2Practice({ onComplete }: { onComplete: () => void }) {
  const [q, setQ] = useState(0);
  const [done, setDone] = useState(false);

  const questions = [
    {
      question: "Which particle has a positive charge?",
      options: ["Electron", "Neutron", "Proton", "Shell"],
      correct: 2,
    },
    {
      question: "Where are protons and neutrons found?",
      options: ["In the shells", "In the nucleus", "Orbiting the atom", "Outside the atom"],
      correct: 1,
    },
    {
      question: "In a neutral atom, what is always true?",
      options: [
        "Protons > electrons",
        "Neutrons = protons",
        "Protons = electrons",
        "Electrons = neutrons",
      ],
      correct: 2,
    },
    {
      question: "Which particle has almost no mass?",
      options: ["Proton", "Neutron", "Nucleus", "Electron"],
      correct: 3,
    },
  ];

  function nextQ() {
    if (q < questions.length - 1) setQ(q + 1);
    else setDone(true);
  }

  if (done) {
    return (
      <div className={s.practiceComplete}>
        <div className={s.completeIcon}>⭐</div>
        <div className={s.completeTitle}>Concept 2 Complete!</div>
        <div className={s.completeSub}>You know the three parts of an atom and their charges. One more concept to go!</div>
        <button className={s.nextStageBtn} onClick={onComplete}>Next concept →</button>
      </div>
    );
  }

  return (
    <div className={s.practiceLayout}>
      <div className={s.practiceProgress}>
        Question {q + 1} of {questions.length}
        <div className={s.practiceBar}><div className={s.practiceBarFill} style={{ width: `${(q / questions.length) * 100}%` }} /></div>
      </div>
      <MCQ key={q} {...questions[q]} onCorrect={nextQ} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   CONCEPT 3 — MASS NUMBER & ATOMIC NUMBER
═══════════════════════════════════════════════════ */

function C3Explore({ onComplete }: { onComplete: () => void }) {
  const [protons, setProtons] = useState(6);
  const [neutrons, setNeutrons] = useState(6);
  const electrons = protons; // neutral atom

  const massNumber = protons + neutrons;

  // Build shells for display (simplified: 2 in first, rest in second)
  const shell1 = Math.min(electrons, 2);
  const shell2 = Math.max(0, electrons - 2);
  const shellsArr: number[][] = shell1 > 0 ? [[shell1]] : [];
  if (shell2 > 0) shellsArr.push([shell2]);

  const elements: Record<number, string> = {
    1:"Hydrogen", 2:"Helium", 3:"Lithium", 4:"Beryllium",
    5:"Boron", 6:"Carbon", 7:"Nitrogen", 8:"Oxygen",
    9:"Fluorine", 10:"Neon",
  };
  const symbols: Record<number, string> = {
    1:"H", 2:"He", 3:"Li", 4:"Be", 5:"B", 6:"C", 7:"N", 8:"O", 9:"F", 10:"Ne",
  };

  return (
    <div className={s.exploreLayout}>
      <CoachBubble text="Drag the sliders to change protons and neutrons. Watch what happens to the element name and mass number!" />
      <div className={s.c3Explorer}>
        <div className={s.c3AtomCard}>
          <div className={s.c3Symbol}>{symbols[protons] ?? "?"}</div>
          <div className={s.c3Name}>{elements[protons] ?? "Unknown"}</div>
          <div className={s.c3Notation}>
            <span className={s.c3MassNum}>{massNumber}</span>
            <span className={s.c3ElSym}>{symbols[protons] ?? "?"}</span>
            <span className={s.c3AtomNum}>{protons}</span>
          </div>
        </div>
        <div className={s.c3AtomViz}>
          <AtomDiagram shells={shellsArr.length ? shellsArr : [[1]]} size={130} />
        </div>
      </div>
      <div className={s.c3Sliders}>
        <div className={s.sliderRow}>
          <span className={s.sliderLabel} style={{ color: "#e84747" }}>Protons (Z)</span>
          <input
            type="range" min={1} max={10} value={protons}
            className={s.slider}
            onChange={(e) => setProtons(Number(e.target.value))}
          />
          <span className={s.sliderVal} style={{ color: "#e84747" }}>{protons}</span>
        </div>
        <div className={s.sliderRow}>
          <span className={s.sliderLabel} style={{ color: "#9b6dff" }}>Neutrons (N)</span>
          <input
            type="range" min={0} max={12} value={neutrons}
            className={s.slider}
            onChange={(e) => setNeutrons(Number(e.target.value))}
          />
          <span className={s.sliderVal} style={{ color: "#9b6dff" }}>{neutrons}</span>
        </div>
      </div>
      <div className={s.c3Summary}>
        <div className={s.c3SumItem} style={{ borderTopColor: "#e84747" }}>
          <span className={s.c3SumLbl}>Atomic Number (Z)</span>
          <span className={s.c3SumVal} style={{ color: "#e84747" }}>{protons}</span>
          <span className={s.c3SumSub}>= protons</span>
        </div>
        <div className={s.c3SumItem} style={{ borderTopColor: "#3DBE5A" }}>
          <span className={s.c3SumLbl}>Mass Number (A)</span>
          <span className={s.c3SumVal} style={{ color: "#3DBE5A" }}>{massNumber}</span>
          <span className={s.c3SumSub}>= protons + neutrons</span>
        </div>
        <div className={s.c3SumItem} style={{ borderTopColor: "#4a90d9" }}>
          <span className={s.c3SumLbl}>Electrons (e⁻)</span>
          <span className={s.c3SumVal} style={{ color: "#4a90d9" }}>{electrons}</span>
          <span className={s.c3SumSub}>= protons (neutral)</span>
        </div>
      </div>
      <button className={s.nextStageBtn} onClick={onComplete}>I get it → Learn more</button>
    </div>
  );
}

function C3Learn({ onComplete }: { onComplete: () => void }) {
  return (
    <div className={s.learnLayout}>
      <div className={s.learnContent}>
        <div className={s.formulaCards}>
          <div className={s.formulaCard} style={{ borderTopColor: "#e84747" }}>
            <div className={s.formulaTitle} style={{ color: "#e84747" }}>Atomic Number (Z)</div>
            <div className={s.formulaEq}>Z = number of protons</div>
            <div className={s.formulaNote}>Defines the element. Every carbon atom has Z = 6.</div>
          </div>
          <div className={s.formulaCard} style={{ borderTopColor: "#3DBE5A" }}>
            <div className={s.formulaTitle} style={{ color: "#3DBE5A" }}>Mass Number (A)</div>
            <div className={s.formulaEq}>A = protons + neutrons</div>
            <div className={s.formulaNote}>Isotopes of the same element have the same Z but different A.</div>
          </div>
        </div>
        <div className={s.learnNote}>
          🧪 <strong>Carbon-12 vs Carbon-14:</strong> Both have Z = 6 (6 protons). But C-12 has 6 neutrons (A=12) and C-14 has 8 neutrons (A=14). Same element, different isotopes.
        </div>
      </div>
      <div className={s.learnDiagram}>
        <div className={s.periodicCard}>
          <div className={s.periodicZ}>6</div>
          <div className={s.periodicSym}>C</div>
          <div className={s.periodicName}>Carbon</div>
          <div className={s.periodicA}>12.011</div>
        </div>
        <div className={s.diagramCaption}>Carbon on the periodic table</div>
      </div>
      <button className={s.nextStageBtn} onClick={onComplete}>Final practice →</button>
    </div>
  );
}

function C3Practice({ onComplete }: { onComplete: () => void }) {
  const [q, setQ] = useState(0);
  const [done, setDone] = useState(false);

  const questions = [
    {
      question: "An atom has 8 protons and 8 neutrons. What is its mass number?",
      options: ["8", "16", "0", "64"],
      correct: 1,
    },
    {
      question: "What does the atomic number (Z) tell you?",
      options: [
        "Number of neutrons",
        "Total mass of the atom",
        "Number of protons",
        "Number of electrons + neutrons",
      ],
      correct: 2,
    },
    {
      question: "Carbon-12 and Carbon-14 are isotopes. What do they share?",
      options: [
        "Same number of neutrons",
        "Same mass number",
        "Same number of protons",
        "Same atomic mass",
      ],
      correct: 2,
    },
    {
      question: "An atom has atomic number 11 and mass number 23. How many neutrons does it have?",
      options: ["11", "23", "12", "34"],
      correct: 2,
    },
  ];

  function nextQ() {
    if (q < questions.length - 1) setQ(q + 1);
    else setDone(true);
  }

  if (done) {
    return (
      <div className={s.practiceComplete}>
        <div className={s.completeIcon}>🏆</div>
        <div className={s.completeTitle}>Topic Complete!</div>
        <div className={s.completeSub}>You&apos;ve mastered Atomic Structure — all 3 concepts. Outstanding work!</div>
        <button className={s.nextStageBtn} onClick={onComplete}>View Summary →</button>
      </div>
    );
  }

  return (
    <div className={s.practiceLayout}>
      <div className={s.practiceProgress}>
        Question {q + 1} of {questions.length}
        <div className={s.practiceBar}><div className={s.practiceBarFill} style={{ width: `${(q / questions.length) * 100}%` }} /></div>
      </div>
      <MCQ key={q} {...questions[q]} onCorrect={nextQ} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   SUMMARY SCREEN
═══════════════════════════════════════════════════ */
function Summary() {
  return (
    <div className={s.summaryScreen}>
      <div className={s.summaryIcon}>🏆</div>
      <h2 className={s.summaryTitle}>Atomic Structure — Complete!</h2>
      <p className={s.summarySub}>You have covered all 3 core concepts in this topic.</p>
      <div className={s.summaryCards}>
        {[
          { n: 1, title: "What is an Atom?", key: "The smallest unit of matter that keeps its chemical properties." },
          { n: 2, title: "Parts of an Atom", key: "Protons (+), Neutrons (0), Electrons (−) — nucleus + shells." },
          { n: 3, title: "Mass & Atomic Number", key: "Z = protons · A = protons + neutrons · Isotopes share Z." },
        ].map(({ n, title, key }) => (
          <div key={n} className={s.summaryCard}>
            <div className={s.summaryCardN}>{n}</div>
            <div>
              <div className={s.summaryCardTitle}>{title}</div>
              <div className={s.summaryCardKey}>{key}</div>
            </div>
          </div>
        ))}
      </div>
      <div className={s.summaryNext}>
        <span>Coming next in Chemistry:</span>
        <strong> Chemical Bonding →</strong>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════ */

const CONCEPTS = [
  { id: 1, title: "What is an Atom?",          color: "#3DBE5A" },
  { id: 2, title: "Parts of an Atom",          color: "#7b4fcb" },
  { id: 3, title: "Mass Number & Atomic Number", color: "#F5A623" },
];
const STAGES = ["Explore", "Learn", "Practice"] as const;

export default function AtomicStructure() {
  const [concept, setConcept] = useState(0);  // 0-2, or 3 = summary
  const [stage, setStage] = useState(0);       // 0 Explore, 1 Learn, 2 Practice

  const totalProgress = concept >= CONCEPTS.length
    ? 100
    : Math.round(((concept * 3 + stage) / (CONCEPTS.length * 3)) * 100);

  function nextStage() {
    if (stage < 2) {
      setStage(stage + 1);
    } else {
      // move to next concept
      setConcept(concept + 1);
      setStage(0);
    }
  }

  function jumpConcept(i: number) {
    setConcept(i);
    setStage(0);
  }

  const isSummary = concept >= CONCEPTS.length;
  const curColor = isSummary ? "#3DBE5A" : CONCEPTS[concept].color;

  return (
    <div className={s.root}>

      {/* ── SIDEBAR ── */}
      <aside className={s.sidebar}>
        <div className={s.sidebarLogo}>
          <span className={s.lG}>E</span><span className={s.lX}>✕</span><span className={s.lO}>L</span>
        </div>
        {[
          { icon: "⊞", label: "Dashboard" },
          { icon: "🔭", label: "Explore" },
          { icon: "📖", label: "Learn", active: true },
          { icon: "✏️", label: "Practice" },
          { icon: "📊", label: "Progress" },
          { icon: "🏅", label: "Badges" },
          { icon: "👤", label: "Profile" },
        ].map(({ icon, label, active }) => (
          <button key={label} className={`${s.navItem} ${active ? s.navItemActive : ""}`}>
            <span className={s.navIcon}>{icon}</span>
            <span className={s.navLabel}>{label}</span>
          </button>
        ))}
      </aside>

      {/* ── MAIN ── */}
      <main className={s.main}>

        {/* ── TOPIC HEADER ── */}
        <header className={s.topicHeader}>
          <div className={s.topicMeta}>
            <div className={s.topicBreadcrumb}>Chemistry &rsaquo; Atomic Structure</div>
            <h1 className={s.topicTitle}>Atomic Structure</h1>
            <div className={s.topicProgress}>
              <div className={s.topicProgressBar}>
                <div className={s.topicProgressFill} style={{ width: `${totalProgress}%`, background: curColor }} />
              </div>
              <span className={s.topicProgressPct} style={{ color: curColor }}>{totalProgress}%</span>
            </div>
          </div>

          {/* Concept tabs */}
          <div className={s.conceptTabs}>
            {CONCEPTS.map((c, i) => {
              const isDone = i < concept || isSummary;
              const isOn = i === concept && !isSummary;
              return (
                <button
                  key={c.id}
                  className={`${s.conceptTab} ${isOn ? s.conceptTabOn : ""} ${isDone ? s.conceptTabDone : ""}`}
                  style={isOn ? { borderBottomColor: c.color, color: c.color } : {}}
                  onClick={() => jumpConcept(i)}
                >
                  <span className={s.conceptTabNum} style={isDone ? { background: "#3DBE5A", color: "#fff" } : isOn ? { background: c.color, color: "#fff" } : {}}>
                    {isDone ? "✓" : c.id}
                  </span>
                  {c.title}
                </button>
              );
            })}
          </div>
        </header>

        {/* ── STAGE NAV (inside a concept) ── */}
        {!isSummary && (
          <div className={s.stageNav}>
            {STAGES.map((st, i) => {
              const isDone = i < stage;
              const isOn = i === stage;
              return (
                <div key={st} className={s.stageNavItem}>
                  <div
                    className={`${s.stageNavDot} ${isOn ? s.stageNavDotOn : ""} ${isDone ? s.stageNavDotDone : ""}`}
                    style={isOn ? { background: curColor, borderColor: curColor } : {}}
                  >
                    {isDone ? "✓" : i + 1}
                  </div>
                  <span className={`${s.stageNavLabel} ${isOn ? s.stageNavLabelOn : ""}`} style={isOn ? { color: curColor } : {}}>
                    {st}
                  </span>
                  {i < STAGES.length - 1 && <div className={`${s.stageNavLine} ${isDone ? s.stageNavLineDone : ""}`} />}
                </div>
              );
            })}
          </div>
        )}

        {/* ── STAGE HEADER BAND ── */}
        {!isSummary && (
          <div className={s.stageBand} style={{ background: curColor }}>
            <span className={s.stageBandNum}>{stage + 1}</span>
            <div>
              <div className={s.stageBandTitle}>{STAGES[stage].toUpperCase()}</div>
              <div className={s.stageBandSub}>
                {stage === 0 && "Interact and discover"}
                {stage === 1 && "Understand the concept"}
                {stage === 2 && "Test your understanding"}
              </div>
            </div>
            <div className={s.stageBandTopic}>{CONCEPTS[concept].title}</div>
          </div>
        )}

        {/* ── CONTENT AREA ── */}
        <div className={s.contentArea}>
          {isSummary && <Summary />}

          {/* Concept 1 */}
          {!isSummary && concept === 0 && stage === 0 && <C1Explore onComplete={nextStage} />}
          {!isSummary && concept === 0 && stage === 1 && <C1Learn onComplete={nextStage} />}
          {!isSummary && concept === 0 && stage === 2 && <C1Practice onComplete={nextStage} />}

          {/* Concept 2 */}
          {!isSummary && concept === 1 && stage === 0 && <C2Explore onComplete={nextStage} />}
          {!isSummary && concept === 1 && stage === 1 && <C2Learn onComplete={nextStage} />}
          {!isSummary && concept === 1 && stage === 2 && <C2Practice onComplete={nextStage} />}

          {/* Concept 3 */}
          {!isSummary && concept === 2 && stage === 0 && <C3Explore onComplete={nextStage} />}
          {!isSummary && concept === 2 && stage === 1 && <C3Learn onComplete={nextStage} />}
          {!isSummary && concept === 2 && stage === 2 && <C3Practice onComplete={nextStage} />}
        </div>

        {/* ── COACH BAR ── */}
        <footer className={s.coachBar}>
          <div className={s.coachLeft}>
            <MascotFace size={38} />
            <span className={s.coachName}>Coach EXL</span>
          </div>
          <div className={s.coachMessage}>
            {stage === 0 && "Explore first — tap, interact, discover. You learn best by doing! 🔭"}
            {stage === 1 && "Now read carefully. Understanding the concept is everything. 📖"}
            {stage === 2 && "Test time! Think carefully before you answer. You've got this! ✏️"}
          </div>
          <div className={s.coachStats}>
            <div className={s.stat}><span>🔥</span><div><div className={s.statL}>Streak</div><div className={s.statV}>7 days</div></div></div>
            <div className={s.stat}><span>⭐</span><div><div className={s.statL}>Points</div><div className={s.statV}>320</div></div></div>
            <div className={s.stat}><span>🛡️</span><div><div className={s.statL}>Level</div><div className={s.statV}>4</div></div></div>
          </div>
        </footer>
      </main>
    </div>
  );
}