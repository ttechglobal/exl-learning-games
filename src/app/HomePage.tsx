"use client";

/**
 * HomePage.tsx — EXL Learning World
 * Redesigned around the "Learning Worlds" identity.
 */

import Link from "next/link";
import type { GameRow } from "@/types/db";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { useTheme } from "@/components/ui/ThemeProvider";
import styles from "@/app/HomePage.module.css";

interface HomePageProps {
  gamesBySubject: Record<string, GameRow[]>;
  currentStudentXp?: number;
}

const WORLDS = [
  { key: "chemistry",   name: "Chemistry World",   tagline: "Build atoms. Break bonds. See matter behave.",        icon: "⚗️",  glyph: "⚗",  color: "var(--eg-subject-chemistry)",   tint: "rgba(123,79,203,0.09)",   border: "rgba(123,79,203,0.22)"  },
  { key: "mathematics", name: "Mathematics World", tagline: "Solve equations. Own the numbers.",                   icon: "📐",  glyph: "∑",  color: "var(--eg-subject-mathematics)", tint: "rgba(47,155,214,0.09)",   border: "rgba(47,155,214,0.22)"  },
  { key: "physics",     name: "Physics World",     tagline: "Apply forces. Trace light. Move through space.",      icon: "⚡",  glyph: "⚡", color: "var(--eg-subject-physics)",     tint: "rgba(255,111,145,0.09)",  border: "rgba(255,111,145,0.22)" },
  { key: "biology",     name: "Biology World",     tagline: "Study cells. Map ecosystems. Decode life.",           icon: "🧬",  glyph: "⬡",  color: "var(--eg-subject-biology)",     tint: "rgba(76,175,110,0.09)",   border: "rgba(76,175,110,0.22)"  },
];

export function HomePage({ gamesBySubject, currentStudentXp }: HomePageProps) {
  const { theme, toggleTheme } = useTheme();
  const totalGames = Object.values(gamesBySubject).reduce((s, g) => s + g.length, 0);

  return (
    <div className={styles.page} data-theme={theme}>

      {/* Ambient blobs */}
      <div className={styles.ambient} aria-hidden="true">
        <div className={styles.blob} style={{ width: 640, height: 640, top: "-22%", left: "-12%", background: "radial-gradient(circle, rgba(123,79,203,0.13) 0%, transparent 70%)" }} />
        <div className={styles.blob} style={{ width: 520, height: 520, top: "38%",  right: "-10%", background: "radial-gradient(circle, rgba(47,155,214,0.10) 0%, transparent 70%)" }} />
        <div className={styles.blob} style={{ width: 420, height: 420, bottom: "4%", left: "18%",  background: "radial-gradient(circle, rgba(76,175,110,0.09) 0%, transparent 70%)" }} />
      </div>

      <SiteHeader theme={theme} onToggleTheme={toggleTheme} active="games" currentStudentXp={currentStudentXp} />

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowDot} />
            EXL Learning World
          </div>
          <h1 className={`${styles.heroTitle} ${styles.fd}`}>
            Every subject is<br />
            <span className={styles.accent}>a world to explore.</span>
          </h1>
          <p className={styles.heroSub}>
            Interact with atoms. Solve equations. Run experiments.
            School concepts you can touch, manipulate, and master —
            not just read about.
          </p>
          <div className={styles.heroCtas}>
            <Link href="/worlds" className={`${styles.ctaMain} ${styles.fd}`}>Enter a World</Link>
            <Link href="/worlds" className={styles.ctaSub}>{totalGames} experiences available →</Link>
          </div>

          {/* World portal cards */}
          <div className={styles.portals}>
            {WORLDS.map((w, i) => {
              const games = gamesBySubject[w.key] ?? [];
              return (
                <Link key={w.key} href="/worlds" className={styles.portal}
                  style={{ "--wc": w.color, "--wt": w.tint, "--wb": w.border, animationDelay: `${i * 0.07}s` } as React.CSSProperties}
                >
                  <span className={styles.portalGlyph}>{w.glyph}</span>
                  <span className={styles.portalName}>{w.icon} {w.name}</span>
                  <span className={styles.portalCount}>{games.length > 0 ? `${games.length} exp.` : "Soon"}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className={styles.how}>
        <div className={styles.container}>
          <div className={styles.sectionLabel}>How it works</div>
          <div className={styles.howGrid}>
            {[
              { icon: "🎯", n: "01", title: "Enter a World", body: "Choose a subject. Each world maps to the real curriculum — Chemistry, Maths, Physics, Biology." },
              { icon: "🔬", n: "02", title: "Interact with concepts", body: "Build atoms. Solve equations on a live canvas. The interaction IS the lesson — not a description of it." },
              { icon: "📈", n: "03", title: "Build mastery", body: "EXL tracks exactly which topics you've mastered. Your progress follows you across every session." },
            ].map(s => (
              <div key={s.n} className={styles.howStep}>
                <div className={styles.howIcon}>{s.icon}</div>
                <div className={styles.howN}>{s.n}</div>
                <div className={styles.howTitle}>{s.title}</div>
                <p className={styles.howBody}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── THE WORLDS ── */}
      <section className={styles.worldsSec}>
        <div className={styles.container}>
          <div className={styles.sectionLabel}>The worlds</div>
          <h2 className={`${styles.secTitle} ${styles.fd}`}>Where do you want to go?</h2>
          <div className={styles.worldsGrid}>
            {WORLDS.map((w) => {
              const games = gamesBySubject[w.key] ?? [];
              return (
                <Link key={w.key} href="/worlds" className={styles.worldCard}
                  style={{ "--wc": w.color, "--wt": w.tint, "--wb": w.border } as React.CSSProperties}
                >
                  <div className={styles.wcBg} aria-hidden="true">{w.glyph}</div>
                  <div className={styles.wcBody}>
                    <div className={styles.wcIcon}>{w.icon}</div>
                    <div className={`${styles.wcName} ${styles.fd}`}>{w.name}</div>
                    <div className={styles.wcTag}>{w.tagline}</div>
                    <div className={styles.wcFoot}>
                      {games.length > 0
                        ? <><span className={styles.liveDot}>●</span> {games.length} experience{games.length !== 1 ? "s" : ""} live</>
                        : <span className={styles.soonBadge}>Coming soon</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── STATEMENT ── */}
      <section className={styles.statement}>
        <div className={styles.container}>
          <div className={styles.statementInner}>
            <div className={styles.statementEyebrow}>Our philosophy</div>
            <blockquote className={`${styles.statementQ} ${styles.fd}`}>
              "Students learn by doing,<br />not by reading."
            </blockquote>
            <p className={styles.statementBody}>
              EXL is the interactive layer for learning — the environment between
              a student and a concept where genuine understanding is built through
              action, not observation.
            </p>
            <Link href="/worlds" className={`${styles.ctaMain} ${styles.fd}`}>Start exploring →</Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <div className={styles.footerBrand}>
            <div className={`${styles.footerMark} ${styles.fd}`}>E</div>
            <span className={styles.fd}>EXL Learning World</span>
          </div>
          <span className={styles.footerMotto}>Interact → Understand → Practise → Construct → Master</span>
        </div>
      </footer>
    </div>
  );
}