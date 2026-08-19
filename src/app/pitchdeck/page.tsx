"use client";

import React, { useEffect, useRef, useState } from "react";
import s from "./pitchdeck.module.css";

const TOTAL = 8;

export default function PitchDeck() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          const i = refs.current.indexOf(e.target as HTMLElement);
          if (i !== -1) setActive(i);
        }
      }),
      { threshold: 0.5 }
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight")
        refs.current[Math.min(active + 1, TOTAL - 1)]?.scrollIntoView({ behavior: "smooth" });
      if (e.key === "ArrowUp" || e.key === "ArrowLeft")
        refs.current[Math.max(active - 1, 0)]?.scrollIntoView({ behavior: "smooth" });
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [active]);

  const go = (i: number) => refs.current[i]?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className={s.root}>

      {/* ── Fixed chrome ── */}
      <div className={s.chrome}>
        <div className={s.logo}>
          <span className={s.lG}>E</span><span className={s.lW}>✕</span><span className={s.lO}>L</span>
          <span className={s.lRest}> Learning World</span>
        </div>
        <div className={s.journey}>
          {["Hook","Problem","Insight","Product","Demo","Traction","Scale","Vision"].map((label, i) => (
            <button key={i} className={`${s.jStep} ${i === active ? s.jStepOn : ""} ${i < active ? s.jStepDone : ""}`} onClick={() => go(i)}>
              <span className={s.jDot}>{i < active ? "✓" : i + 1}</span>
              <span className={s.jLabel}>{label}</span>
            </button>
          ))}
        </div>
        <div className={s.slideTag}>{active + 1} / {TOTAL}</div>
      </div>

      {/* ────────────────────────────────────────
          S1 — HOOK
      ──────────────────────────────────────── */}
      <section className={`${s.slide} ${s.s1}`} ref={(el) => { refs.current[0] = el; }}>
        <AtomBg />
        <div className={s.s1Wrap}>
          {/* Left: text */}
          <div className={s.s1Left}>
            <div className={s.chipGreen}>01 — The Hook</div>
            <h1 className={s.s1H1}>
              A new way<br />to learn.
            </h1>
            <p className={s.s1Tagline}>
              By interacting with what<br />you&apos;re trying to understand.
            </p>
            <p className={s.s1Body}>
              Interactive learning for concepts that are hard to understand through text, equations, and static diagrams.
            </p>
            <div className={s.subjectPills}>
              {[["🧪","Chemistry"],["⚛️","Physics"],["📐","Maths"],["🌿","Biology"]].map(([icon, label]) => (
                <div key={label} className={s.subPill}>
                  <span>{icon}</span><span>{label}</span>
                </div>
              ))}
            </div>
            <button className={s.btn} onClick={() => go(1)}>See the story →</button>
          </div>
          {/* Right: product card */}
          <div className={s.s1Right}>
            <div className={s.productCard}>
              <div className={s.productCardHeader}>
                <div className={s.productCardLogo}>
                  <span className={s.lG}>E</span><span className={s.lW}>✕</span><span className={s.lO}>L</span>
                </div>
                <div className={s.productCardTag}>Learning World</div>
              </div>
              <div className={s.journeySteps}>
                {[
                  { n:"1", label:"EXPLORE",   sub:"Interact & discover", color:"#3DBE5A" },
                  { n:"2", label:"LEARN",      sub:"Understand the concept", color:"#7b4fcb" },
                  { n:"3", label:"PRACTICE",   sub:"Solve & quiz", color:"#F5A623" },
                  { n:"4", label:"MASTER",     sub:"Earn badges & level up", color:"#3DBE5A" },
                ].map(({ n, label, sub, color }, i, a) => (
                  <React.Fragment key={label}>
                    <div className={s.jCard} style={{ borderTopColor: color }}>
                      <div className={s.jCardNum} style={{ color }}>{n}</div>
                      <div className={s.jCardLabel} style={{ color }}>{label}</div>
                      <div className={s.jCardSub}>{sub}</div>
                    </div>
                    {i < a.length - 1 && <div className={s.jCardArrow} style={{ color }}>→</div>}
                  </React.Fragment>
                ))}
              </div>
              <div className={s.coachBar}>
                <MascotIcon />
                <div className={s.coachMsg}>Great job! You&apos;re learning like a scientist! 🚀</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────
          S2 — PROBLEM
      ──────────────────────────────────────── */}
      <section className={`${s.slide} ${s.s2}`} ref={(el) => { refs.current[1] = el; }}>
        <div className={s.splitSlide}>
          <div className={s.splitLeft}>
            <div className={s.chipOrange}>02 — The Problem</div>
            <h2 className={s.splitH}>
              Students are asked to understand things they can&apos;t interact with.
            </h2>
            <p className={s.splitBody}>
              But the student still can&apos;t experiment with the idea themselves.
            </p>
            <div className={s.strongBox}>
              Information is everywhere.<br />
              <span className={s.green}>Understanding isn&apos;t.</span>
            </div>
          </div>
          <div className={s.splitRight}>
            {[
              { label: "A formula", val: "tells you what happens.", icon: "📐", eg: "Na + Cl → NaCl" },
              { label: "A diagram", val: "shows you what it looks like.", icon: "🖼️", eg: "— static image —" },
              { label: "A textbook", val: "explains why.", icon: "📖", eg: "\"Sodium loses an electron...\"" },
            ].map(({ label, val, icon, eg }) => (
              <div key={label} className={s.problemCard}>
                <div className={s.problemIcon}>{icon}</div>
                <div>
                  <div className={s.problemLabel}>{label}</div>
                  <div className={s.problemVal}>{val}</div>
                  <div className={s.problemEg}>{eg}</div>
                </div>
                <div className={s.problemX}>✗</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────
          S3 — INSIGHT
      ──────────────────────────────────────── */}
      <section className={`${s.slide} ${s.s3}`} ref={(el) => { refs.current[2] = el; }}>
        <div className={s.insightWrap}>
          <div className={s.chipPurple}>03 — The Insight</div>
          <h2 className={s.insightH}>
            Understanding happens differently when you can<br />
            <span className={s.green}>interact with the concept itself.</span>
          </h2>
          <div className={s.vsRow}>
            {/* Before */}
            <div className={s.vsPanel}>
              <div className={s.vsPanelHead}>Without EXL</div>
              <div className={s.vsFlow}>
                {["Read","Memorise","Test","Forget"].map((step, i, a) => (
                  <React.Fragment key={step}>
                    <div className={s.vsChip}>{step}</div>
                    {i < a.length - 1 && <div className={s.vsDown}>↓</div>}
                  </React.Fragment>
                ))}
              </div>
            </div>
            {/* Arrow */}
            <div className={s.vsBigArrow}>→</div>
            {/* After */}
            <div className={`${s.vsPanel} ${s.vsPanelGreen}`}>
              <div className={`${s.vsPanelHead} ${s.vsPanelHeadGreen}`}>With EXL</div>
              <div className={s.vsFlow}>
                {["Explore","Experiment","Understand","Apply"].map((step, i, a) => (
                  <React.Fragment key={step}>
                    <div className={`${s.vsChip} ${s.vsChipGreen}`}>{step}</div>
                    {i < a.length - 1 && <div className={`${s.vsDown} ${s.vsDownGreen}`}>↓</div>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
          <p className={s.insightSub}>
            The learner doesn&apos;t just receive the explanation. They <em>discover</em> the relationship.
          </p>
        </div>
      </section>

      {/* ────────────────────────────────────────
          S4 — PRODUCT
      ──────────────────────────────────────── */}
      <section className={`${s.slide} ${s.s4}`} ref={(el) => { refs.current[3] = el; }}>
        <div className={s.productSlide}>
          <div className={s.chipGreen}>04 — The Product</div>
          <h2 className={s.productH}>
            EXL turns abstract concepts into<br />
            <span className={s.green}>interactive experiences.</span>
          </h2>
          <div className={s.quadGrid}>
            {[
              { color:"#3DBE5A", icon:"👁️", verb:"See it.",          desc:"Watch the concept come alive — not a diagram, a living interaction." },
              { color:"#7b4fcb", icon:"🖐️", verb:"Interact with it.", desc:"Change variables, move parts, trigger reactions. Be in the learning." },
              { color:"#F5A623", icon:"🧠", verb:"Understand it.",    desc:"Grasp the why — because you experienced it, not because you read it." },
              { color:"#3a9fd4", icon:"🔨", verb:"Apply it.",          desc:"Use your understanding to solve problems you have never seen before." },
            ].map(({ color, icon, verb, desc }) => (
              <div key={verb} className={s.quadCard} style={{ borderTopColor: color }}>
                <div className={s.quadIcon}>{icon}</div>
                <div className={s.quadVerb} style={{ color }}>{verb}</div>
                <div className={s.quadDesc}>{desc}</div>
              </div>
            ))}
          </div>
          <div className={s.diffBanner}>
            We don&apos;t gamify learning. We make the <strong>learning itself</strong> interactive.
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────
          S5 — DEMO
      ──────────────────────────────────────── */}
      <section className={`${s.slide} ${s.s5}`} ref={(el) => { refs.current[4] = el; }}>
        <div className={s.demoSlide}>
          <div className={s.chipOrange}>05 — Show, Don&apos;t Tell</div>
          <h2 className={s.demoH}>
            What if learning chemistry<br />looked like <span className={s.green}>this?</span>
          </h2>
          <div className={s.demoLayout}>
            {/* Left: traditional */}
            <div className={s.demoTraditional}>
              <div className={s.demoTradHead}>Traditional</div>
              <div className={s.formula}>Na + Cl → NaCl</div>
              <p className={s.demoTradText}>
                Sodium loses an electron to chlorine, forming an ionic bond. The resulting compound is sodium chloride — table salt.
              </p>
              <div className={s.demoTradTag}>📖 Read. Memorise. Hope it sticks.</div>
            </div>
            {/* Arrow */}
            <div className={s.demoVs}>
              <div className={s.demoVsLine} />
              <div className={s.demoVsLabel}>EXL</div>
              <div className={s.demoVsLine} />
            </div>
            {/* Right: EXL */}
            <div className={s.demoExl}>
              <div className={s.demoExlHead}>EXL Learning World</div>
              <div className={s.atomFlow}>
                <AtomViz symbol="Na" protons={11} color="#F5A623" electrons={1} label="Sodium" />
                <div className={s.electronTransfer}>
                  <div className={s.eDot}>e⁻</div>
                  <div className={s.eArrow}>⟶</div>
                </div>
                <AtomViz symbol="Cl" protons={17} color="#7b4fcb" electrons={7} label="Chlorine" />
              </div>
              <div className={s.bondResult}>
                <span className={s.ionChip} style={{ borderColor:"#F5A623", color:"#F5A623" }}>Na⁺</span>
                <span className={s.bondLabel}>⚡ ionic bond</span>
                <span className={s.ionChip} style={{ borderColor:"#7b4fcb", color:"#7b4fcb" }}>Cl⁻</span>
              </div>
              <div className={s.demoExlTag}>✓ See it happen. Understand why.</div>
            </div>
          </div>
          <div className={s.demoCaption}>
            Don&apos;t memorize the bond. <span className={s.green}>Experience why it forms.</span>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────
          S6 — TRACTION
      ──────────────────────────────────────── */}
      <section className={`${s.slide} ${s.s6}`} ref={(el) => { refs.current[5] = el; }}>
        <div className={s.splitSlide}>
          <div className={s.splitLeft}>
            <div className={s.chipGreen}>06 — Traction</div>
            <h2 className={s.splitH}>
              We&apos;re not starting<br />with an idea.
            </h2>
            <p className={s.splitBody}>
              We&apos;re extending something students already use.
            </p>
            <div className={s.evolutionFlow}>
              <div className={s.evoBlock}>
                <div className={s.evoTag}>Today</div>
                <div className={s.evoTitle}>EXL Exam Prep</div>
                <div className={s.evoDesc}>Deployed in a CBT environment. Students use it now.</div>
              </div>
              <div className={s.evoArrow}>↓</div>
              <div className={`${s.evoBlock} ${s.evoBlockGreen}`}>
                <div className={`${s.evoTag} ${s.evoTagGreen}`}>Next</div>
                <div className={s.evoTitle}>EXL Learning World</div>
                <div className={s.evoDesc}>From measuring what students know → to helping them understand it.</div>
              </div>
            </div>
          </div>
          <div className={s.splitRight}>
            <div className={s.tractionCard}>
              <div className={s.tractionCardHeader}>Assessment → Understanding</div>
              {[
                { icon:"✅", label:"Live deployment", desc:"EXL Exam Prep is live in a CBT environment" },
                { icon:"👩‍🎓", label:"Real students", desc:"Students already using our technology today" },
                { icon:"🏗️", label:"Building now", desc:"The interactive learning layer is next" },
              ].map(({ icon, label, desc }) => (
                <div key={label} className={s.tractionRow}>
                  <div className={s.tractionRowIcon}>{icon}</div>
                  <div>
                    <div className={s.tractionRowLabel}>{label}</div>
                    <div className={s.tractionRowDesc}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────
          S7 — SCALE
      ──────────────────────────────────────── */}
      <section className={`${s.slide} ${s.s7}`} ref={(el) => { refs.current[6] = el; }}>
        <div className={s.scaleSlide}>
          <div className={s.chipPurple}>07 — The Scale</div>
          <h2 className={s.scaleH}>
            K–12 is where we start.<br />
            <span className={s.green}>Interactive learning is where we&apos;re going.</span>
          </h2>
          <div className={s.scaleGrid}>
            {[
              { phase:"Today",  title:"K–12",                  color:"#3DBE5A", subjects:["Mathematics","Physics","Chemistry","Biology"],       w:"60%" },
              { phase:"Next",   title:"Universities",           color:"#7b4fcb", subjects:["Engineering","Sciences","Medicine","Business"],      w:"78%" },
              { phase:"Then",   title:"Professional Learning",  color:"#F5A623", subjects:["Sales","Operations","Corporate Training"],          w:"100%" },
            ].map(({ phase, title, color, subjects, w }) => (
              <div key={title} className={s.scaleRow}>
                <div className={s.scalePhase} style={{ color }}>{phase}</div>
                <div className={s.scaleBarWrap} style={{ width: w }}>
                  <div className={s.scaleBar} style={{ background: color + "18", borderColor: color + "44" }}>
                    <div className={s.scaleBarTitle} style={{ color }}>{title}</div>
                    <div className={s.scaleBarSubjects}>
                      {subjects.map(sub => (
                        <span key={sub} className={s.scaleChip} style={{ color, borderColor: color + "44", background: color + "12" }}>{sub}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className={s.scaleSub}>
            Different subjects. Same fundamental problem: people learn better when they can experience what they are learning.
          </p>
        </div>
      </section>

      {/* ────────────────────────────────────────
          S8 — VISION
      ──────────────────────────────────────── */}
      <section className={`${s.slide} ${s.s8}`} ref={(el) => { refs.current[7] = el; }}>
        <AtomBg dim />
        <div className={s.visionWrap}>
          <div className={s.chipGreenDark}>08 — The Vision</div>
          <h2 className={s.visionH}>
            We&apos;re building the interactive<br />
            <span className={s.visionAccent}>learning layer</span><br />
            for the world&apos;s knowledge.
          </h2>
          <div className={s.visionCards}>
            {[
              { icon:"🎓", who:"A student",       does:"interacts with a physics simulation and understands force for the first time." },
              { icon:"⚙️", who:"An engineer",      does:"practises with a machine model before touching real equipment." },
              { icon:"🤝", who:"A salesperson",    does:"rehearses a customer conversation inside a realistic scenario." },
              { icon:"🏥", who:"A professional",   does:"learns by operating inside a realistic environment, not reading a manual." },
            ].map(({ icon, who, does }) => (
              <div key={who} className={s.visionCard}>
                <div className={s.visionCardIcon}>{icon}</div>
                <div><strong className={s.visionWho}>{who}</strong> {does}</div>
              </div>
            ))}
          </div>
          <div className={s.visionDivider} />
          <p className={s.visionSub}>The subject changes. The learning experience doesn&apos;t.</p>
          <div className={s.visionLogo}>
            <span className={s.lG}>E</span><span className={s.lW}>✕</span><span className={s.lO}>L</span>
            <span className={s.visionLogoRest}> Learning World</span>
          </div>
          <p className={s.visionTagline}>
            Don&apos;t just tell people how something works.<br />
            <strong>Let them interact with it.</strong>
          </p>
        </div>
      </section>

    </div>
  );
}

/* ── Mini atom visualisation ── */
function AtomViz({ symbol, protons, color, electrons, label }: {
  symbol: string; protons: number; color: string; electrons: number; label: string;
}) {
  const size = 80;
  const cx = size / 2, cy = size / 2;
  const r = size * 0.36;
  const nr = size * 0.14;
  const ePositions = Array.from({ length: Math.min(electrons, 8) }).map((_, i) => {
    const angle = (i / Math.min(electrons, 8)) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
  return (
    <div className={s.atomViz}>
      <div className={s.atomVizNum} style={{ color: color + "88" }}>{protons}</div>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.42} fill="none" stroke={color + "30"} strokeWidth="1.5" />
        <defs>
          <radialGradient id={`ng${symbol}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#d45c6a" />
            <stop offset="100%" stopColor="#9a2535" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={nr} fill={`url(#ng${symbol})`} />
        {ePositions.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={size * 0.06} fill={color} opacity={0.9} />
        ))}
      </svg>
      <div className={s.atomVizSym} style={{ color }}>{symbol}</div>
      <div className={s.atomVizLabel}>{label}</div>
    </div>
  );
}

/* ── Mascot icon ── */
function MascotIcon() {
  return (
    <svg width="32" height="38" viewBox="0 0 90 120" fill="none">
      <rect x="20" y="55" width="50" height="55" rx="6" fill="white" stroke="#dde3f0" strokeWidth="1" />
      <rect x="33" y="68" width="24" height="30" rx="3" fill="#3DBE5A" />
      <text x="45" y="87" textAnchor="middle" fontSize="7" fontWeight="900" fill="white" fontFamily="Arial">EXL</text>
      <ellipse cx="45" cy="38" rx="20" ry="22" fill="#6B3F1F" />
      <ellipse cx="45" cy="42" rx="14" ry="14" fill="#C4814A" />
      <circle cx="39" cy="39" r="3.5" fill="white" /><circle cx="51" cy="39" r="3.5" fill="white" />
      <circle cx="40" cy="39.5" r="2" fill="#1a1a1a" /><circle cx="52" cy="39.5" r="2" fill="#1a1a1a" />
      <path d="M38 46 Q45 51 52 46" stroke="#7a3a1a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <ellipse cx="45" cy="24" rx="18" ry="7" fill="#1a1a1a" />
    </svg>
  );
}

/* ── Background atom illustration ── */
function AtomBg({ dim }: { dim?: boolean }) {
  const op = dim ? 0.04 : 0.07;
  return (
    <svg className={s.atomBg} viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="300" cy="300" rx="260" ry="100" fill="none" stroke="#3DBE5A" strokeWidth="2" opacity={op} transform="rotate(0 300 300)" />
      <ellipse cx="300" cy="300" rx="260" ry="100" fill="none" stroke="#3DBE5A" strokeWidth="2" opacity={op} transform="rotate(60 300 300)" />
      <ellipse cx="300" cy="300" rx="260" ry="100" fill="none" stroke="#3DBE5A" strokeWidth="2" opacity={op} transform="rotate(120 300 300)" />
      <circle cx="300" cy="300" r="28" fill="#3DBE5A" opacity={op * 0.8} />
      <circle cx="560" cy="300" r="8" fill="#3DBE5A" opacity={op} />
      <circle cx="170" cy="127" r="8" fill="#7b4fcb" opacity={op} />
      <circle cx="170" cy="473" r="8" fill="#F5A623" opacity={op} />
    </svg>
  );
}
