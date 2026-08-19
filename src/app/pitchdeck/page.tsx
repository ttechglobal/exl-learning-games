"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./pitchdeck.module.css";

const TOTAL = 8;

export default function PitchDeckPage() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const i = refs.current.indexOf(e.target as HTMLElement);
            if (i !== -1) setActive(i);
          }
        });
      },
      { threshold: 0.55 }
    );
    refs.current.forEach((s) => s && io.observe(s));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight")
        refs.current[Math.min(active + 1, TOTAL - 1)]?.scrollIntoView({ behavior: "smooth" });
      if (e.key === "ArrowUp" || e.key === "ArrowLeft")
        refs.current[Math.max(active - 1, 0)]?.scrollIntoView({ behavior: "smooth" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  const go = (i: number) => refs.current[i]?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className={styles.root}>
      {/* Logo */}
      <div className={styles.logo}>
        <span className={styles.lE}>E</span><span className={styles.lX}>X</span><span className={styles.lL}>L</span>
      </div>

      {/* Dot nav */}
      <nav className={styles.dots}>
        {Array.from({ length: TOTAL }, (_, i) => (
          <button key={i} className={`${styles.dot} ${i === active ? styles.dotOn : ""}`} onClick={() => go(i)} aria-label={`Slide ${i + 1}`} />
        ))}
      </nav>

      {/* Counter */}
      <div className={styles.counter}>{active + 1} / {TOTAL}</div>

      {/* ── S1: HOOK ── */}
      <section className={`${styles.s} ${styles.s1}`} ref={(el) => { refs.current[0] = el; }}>
        <Starfield />
        <div className={styles.s1Inner}>
          <div className={styles.s1Num}>01</div>
          <h1 className={styles.s1Headline}>
            We&apos;re building a new way to learn:<br />
            <span className={styles.accent}>by interacting with what you&apos;re trying to understand.</span>
          </h1>
          <div className={styles.s1Product}>EXL Learning World</div>
          <p className={styles.s1Sub}>
            Interactive learning for concepts that are hard to understand<br />
            through text, equations, and static diagrams.
          </p>
          <div className={styles.pills}>
            {["Math", "Physics", "Chemistry", "Biology"].map((p) => (
              <span key={p} className={styles.pill}>{p}</span>
            ))}
          </div>
          <button className={styles.cta} onClick={() => go(1)}>See the story →</button>
        </div>
      </section>

      {/* ── S2: PROBLEM ── */}
      <section className={`${styles.s} ${styles.s2}`} ref={(el) => { refs.current[1] = el; }}>
        <div className={styles.centered}>
          <div className={styles.slideNum}>02</div>
          <h2 className={styles.headline}>
            Students are asked to understand<br />
            things they <span className={styles.accent}>can&apos;t interact with.</span>
          </h2>
          <div className={styles.triplet}>
            <div className={styles.tripletItem}>
              <div className={styles.tripletLabel}>A formula</div>
              <div className={styles.tripletVal}>tells you what happens.</div>
            </div>
            <div className={styles.tripletItem}>
              <div className={styles.tripletLabel}>A diagram</div>
              <div className={styles.tripletVal}>shows you what it looks like.</div>
            </div>
            <div className={styles.tripletItem}>
              <div className={styles.tripletLabel}>A textbook</div>
              <div className={styles.tripletVal}>explains why.</div>
            </div>
          </div>
          <div className={styles.divider} />
          <p className={styles.supportLine}>But the student still can&apos;t experiment with the idea themselves.</p>
          <p className={styles.strongLine}>Information is everywhere. Understanding isn&apos;t.</p>
        </div>
      </section>

      {/* ── S3: INSIGHT ── */}
      <section className={`${styles.s} ${styles.s3}`} ref={(el) => { refs.current[2] = el; }}>
        <div className={styles.centered}>
          <div className={styles.slideNum}>03</div>
          <h2 className={styles.headline}>
            Understanding happens differently<br />
            when you can <span className={styles.accent}>interact with the concept itself.</span>
          </h2>
          <div className={styles.vsBlock}>
            <div className={styles.vsCol}>
              <div className={styles.vsLabel}>Instead of</div>
              <div className={styles.vsFlow}>
                {["Read", "Memorise", "Test"].map((s, i, a) => (
                  <React.Fragment key={s}>
                    <div className={styles.vsStep}>{s}</div>
                    {i < a.length - 1 && <div className={styles.vsArrow}>↓</div>}
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div className={styles.vsVs}>→</div>
            <div className={`${styles.vsCol} ${styles.vsColRight}`}>
              <div className={`${styles.vsLabel} ${styles.vsLabelGreen}`}>EXL enables</div>
              <div className={styles.vsFlow}>
                {["Explore", "Experiment", "Understand", "Apply"].map((s, i, a) => (
                  <React.Fragment key={s}>
                    <div className={`${styles.vsStep} ${styles.vsStepGreen}`}>{s}</div>
                    {i < a.length - 1 && <div className={`${styles.vsArrow} ${styles.vsArrowGreen}`}>↓</div>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
          <p className={styles.supportLine}>
            The learner doesn&apos;t just receive the explanation.
            <br />
            They discover the relationship.
          </p>
        </div>
      </section>

      {/* ── S4: PRODUCT ── */}
      <section className={`${styles.s} ${styles.s4}`} ref={(el) => { refs.current[3] = el; }}>
        <div className={styles.centered}>
          <div className={styles.slideNum}>04</div>
          <h2 className={styles.headline}>
            EXL turns abstract concepts into<br />
            <span className={styles.accent}>interactive experiences.</span>
          </h2>
          <div className={styles.fourGrid}>
            {[
              { icon: "👁️", verb: "See it.",        desc: "Watch it happen." },
              { icon: "🖐️", verb: "Interact with it.", desc: "Change it, move it, build it." },
              { icon: "🧠", verb: "Understand it.",  desc: "Discover why it happens." },
              { icon: "🔨", verb: "Apply it.",        desc: "Use the understanding to solve something new." },
            ].map(({ icon, verb, desc }) => (
              <div key={verb} className={styles.fourCard}>
                <div className={styles.fourIcon}>{icon}</div>
                <div className={styles.fourVerb}>{verb}</div>
                <div className={styles.fourDesc}>{desc}</div>
              </div>
            ))}
          </div>
          <div className={styles.diffLine}>
            We don&apos;t gamify learning. We make the <em>learning itself</em> interactive.
          </div>
        </div>
      </section>

      {/* ── S5: SHOW ── */}
      <section className={`${styles.s} ${styles.s5}`} ref={(el) => { refs.current[4] = el; }}>
        <div className={styles.centered}>
          <div className={styles.slideNum}>05</div>
          <h2 className={`${styles.headline} ${styles.headlineSmall}`}>
            What if learning chemistry looked like this?
          </h2>
          <div className={styles.demoBox}>
            <div className={styles.demoRow}>
              <AtomCard symbol="Na" num={11} label="Sodium" color="#F5A623" />
              <div className={styles.demoTransfer}>
                <div className={styles.electronDot}>e⁻</div>
                <div className={styles.transferArrow}>→→→</div>
              </div>
              <AtomCard symbol="Cl" num={17} label="Chlorine" color="#9b6dff" />
            </div>
            <div className={styles.demoArrowDown}>↓</div>
            <div className={styles.demoRow}>
              <AtomCard symbol="Na⁺" num={11} label="Lost 1 electron" color="#F5A623" ion />
              <div className={styles.ionAttract}>⚡ ionic bond</div>
              <AtomCard symbol="Cl⁻" num={17} label="Gained 1 electron" color="#9b6dff" ion />
            </div>
          </div>
          <p className={styles.demoCaption}>
            Don&apos;t memorize the bond. <span className={styles.accent}>Experience why it forms.</span>
          </p>
        </div>
      </section>

      {/* ── S6: TRACTION ── */}
      <section className={`${styles.s} ${styles.s6}`} ref={(el) => { refs.current[5] = el; }}>
        <div className={styles.centered}>
          <div className={styles.slideNum}>06</div>
          <h2 className={styles.headline}>
            We&apos;re not starting with an idea.<br />
            <span className={styles.accent}>We&apos;re extending something students already use.</span>
          </h2>
          <div className={styles.tractionFlow}>
            <div className={styles.tractionBlock}>
              <div className={styles.tractionTag}>Today</div>
              <div className={styles.tractionName}>EXL Exam Prep</div>
              <div className={styles.tractionDesc}>Already deployed in a CBT environment. Students use it now.</div>
            </div>
            <div className={styles.tractionArrow}>↓</div>
            <div className={`${styles.tractionBlock} ${styles.tractionBlockGreen}`}>
              <div className={`${styles.tractionTag} ${styles.tractionTagGreen}`}>Next</div>
              <div className={styles.tractionName}>EXL Learning World</div>
              <div className={styles.tractionDesc}>
                From measuring what students know<br />→ to helping them understand it.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── S7: SCALE ── */}
      <section className={`${styles.s} ${styles.s7}`} ref={(el) => { refs.current[6] = el; }}>
        <div className={styles.centered}>
          <div className={styles.slideNum}>07</div>
          <h2 className={styles.headline}>
            K–12 is where we start.<br />
            <span className={styles.accent}>Interactive learning is where we&apos;re going.</span>
          </h2>
          <div className={styles.scaleFlow}>
            {[
              { time: "Today",       title: "K–12",                  items: ["Math", "Physics", "Chemistry", "Biology"] },
              { time: "Next",        title: "Universities",           items: ["Engineering", "Sciences", "Medicine", "Business"] },
              { time: "Then",        title: "Professional learning",  items: ["Sales", "Engineering", "Operations", "Training"] },
            ].map(({ time, title, items }, i, a) => (
              <React.Fragment key={title}>
                <div className={`${styles.scaleBlock} ${i === 0 ? styles.scaleBlockActive : ""}`}>
                  <div className={styles.scaleTime}>{time}</div>
                  <div className={styles.scaleTitle}>{title}</div>
                  <div className={styles.scaleItems}>{items.join(" · ")}</div>
                </div>
                {i < a.length - 1 && <div className={styles.scaleArrow}>↓</div>}
              </React.Fragment>
            ))}
          </div>
          <p className={styles.supportLine}>
            Different subjects. Same fundamental problem:<br />
            people learn better when they can experience what they are learning.
          </p>
        </div>
      </section>

      {/* ── S8: VISION ── */}
      <section className={`${styles.s} ${styles.s8}`} ref={(el) => { refs.current[7] = el; }}>
        <Starfield />
        <div className={styles.s8Inner}>
          <div className={styles.slideNum}>08</div>
          <h2 className={styles.visionHeadline}>
            We&apos;re building the interactive<br />
            <span className={styles.accent}>learning layer</span><br />
            for the world&apos;s knowledge.
          </h2>
          <div className={styles.visionExamples}>
            <div className={styles.visionEx}><span className={styles.visionDot} />A student interacts with a physics simulation.</div>
            <div className={styles.visionEx}><span className={styles.visionDot} />An engineering student interacts with a machine.</div>
            <div className={styles.visionEx}><span className={styles.visionDot} />A salesperson practises a real customer conversation.</div>
            <div className={styles.visionEx}><span className={styles.visionDot} />A professional learns by operating inside a realistic environment.</div>
          </div>
          <p className={styles.visionSub}>The subject changes. The learning experience doesn&apos;t.</p>
          <div className={styles.visionLogo}>
            <span className={styles.lE}>E</span><span className={styles.lX}>X</span><span className={styles.lL}>L</span>
            <span className={styles.visionLogoRest}> Learning World</span>
          </div>
          <p className={styles.visionTagline}>
            Don&apos;t just tell people how something works.<br />
            <strong>Let them interact with it.</strong>
          </p>
        </div>
      </section>
    </div>
  );
}

/* ── Atom card component ── */
function AtomCard({ symbol, num, label, color, ion }: {
  symbol: string; num: number; label: string; color: string; ion?: boolean;
}) {
  return (
    <div className={styles.atomCard} style={{ borderColor: color + "55" }}>
      <div className={styles.atomNum} style={{ color: color + "99" }}>{num}</div>
      <div className={styles.atomSym} style={{ color }}>{symbol}</div>
      <div className={styles.atomLabel}>{label}</div>
      {ion && <div className={styles.atomIonTag} style={{ background: color + "22", color }}>ion</div>}
    </div>
  );
}

/* ── Starfield ── */
function Starfield() {
  const stars = [
    [120,80],[340,140],[860,60],[1200,100],[1380,200],
    [60,300],[1430,500],[700,800],[200,700],[1100,750],
    [500,400],[900,350],[1300,600],[80,550],[950,150],
  ];
  return (
    <svg className={styles.starsBg} viewBox="0 0 1440 900" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      {stars.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.5 : 1} fill="#fff" opacity={0.2 + (i % 5) * 0.08} />
      ))}
    </svg>
  );
}
