"use client";

import Link from "next/link";
import type { GameRow } from "@/types/db";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { useTheme } from "@/components/ui/ThemeProvider";
import styles from "@/app/HomePage.module.css";

interface LeaderboardEntry {
  studentId: string;
  displayName?: string | null;
  xpTotal: number;
  rank: number;
}

interface HomePageProps {
  gamesBySubject: Record<string, GameRow[]>;
  currentStudentXp?: number;
  /** Provided by page.tsx but not used in this version of the homepage */
  featuredGames?: GameRow[];
  leaderboard?: LeaderboardEntry[];
  previousChampion?: LeaderboardEntry | null;
}

const WORLDS = [
  { key:"chemistry",   name:"Chemistry World",   headline:"Build atoms. Break bonds.",         tagline:"See what matter is made of.",           icon:"⚗️", glyph:"⚗", rgb:"123,79,203",  color:"var(--eg-subject-chemistry)",   gradient:"linear-gradient(145deg,#1a0840,#2d1260 60%,#0e0420)" },
  { key:"mathematics", name:"Mathematics World", headline:"Solve equations.",                  tagline:"Own the numbers. Build the proofs.",     icon:"📐", glyph:"∑", rgb:"47,155,214",   color:"var(--eg-subject-mathematics)", gradient:"linear-gradient(145deg,#031828,#062848 60%,#020e18)" },
  { key:"physics",     name:"Physics World",     headline:"Apply forces. Trace light.",        tagline:"Move through space — for real.",         icon:"⚡", glyph:"⚡",rgb:"255,111,145",  color:"var(--eg-subject-physics)",     gradient:"linear-gradient(145deg,#200818,#380820 60%,#120410)" },
  { key:"biology",     name:"Biology World",     headline:"Study cells. Map life.",            tagline:"Decode the most complex system ever.",   icon:"🧬", glyph:"⬡", rgb:"76,175,110",   color:"var(--eg-subject-biology)",     gradient:"linear-gradient(145deg,#021408,#082814 60%,#010a04)" },
];

const FLOATERS = [
  { top:"14%", left:"2%",  size:52, delay:0,   subject:"chemistry"   },
  { top:"10%", right:"4%", size:44, delay:0.4, subject:"mathematics" },
  { top:"60%", left:"1%",  size:38, delay:0.8, subject:"physics"     },
  { top:"72%", right:"2%", size:48, delay:0.2, subject:"biology"     },
];

const FLOATER_RGB: Record<string,string>   = { chemistry:"123,79,203", mathematics:"47,155,214", physics:"255,111,145", biology:"76,175,110" };
const FLOATER_GLYPH: Record<string,string> = { chemistry:"⚗", mathematics:"∑", physics:"⚡", biology:"⬡" };

const STEPS = [
  { icon:"🎯", title:"Enter a World",        body:"Choose a subject — Chemistry, Maths, Physics, Biology. Each maps directly to the curriculum you're studying." },
  { icon:"🔬", title:"Interact with concepts", body:"Build atoms. Drag particles. Solve equations on a live canvas. The interaction IS the lesson — not a description of it." },
  { icon:"📈", title:"Build mastery",         body:"EXL tracks every topic you've understood. Real progress — not streaks, not points, just knowledge." },
];

export function HomePage({ gamesBySubject, currentStudentXp }: HomePageProps) {
  const { theme, toggleTheme } = useTheme();
  const totalGames = Object.values(gamesBySubject).reduce((s,g) => s + g.length, 0);

  return (
    <div className={styles.page} data-theme={theme}>

      {/* Grid texture */}
      <div className={styles.gridTexture} aria-hidden="true" />

      {/* Floating subject atoms */}
      <div className={styles.floaters} aria-hidden="true">
        {FLOATERS.map((f, i) => (
          <div
            key={i}
            className={styles.floater}
            style={{
              top: f.top,
              left: "left" in f ? (f as {left:string}).left : undefined,
              right: "right" in f ? (f as {right:string}).right : undefined,
              width: f.size, height: f.size,
              animationDelay: `${f.delay}s`,
              "--frgb": FLOATER_RGB[f.subject],
            } as React.CSSProperties}
          >
            <span className={styles.floaterGlyph}>{FLOATER_GLYPH[f.subject]}</span>
          </div>
        ))}
      </div>

      <SiteHeader theme={theme} onToggleTheme={toggleTheme} active="games" currentStudentXp={currentStudentXp} />

      {/* ── HERO BANNER — centred, no mascots ────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowDot} />
            EXL Learning World
          </div>

          <h1 className={styles.heroTitle}>
            <span className={styles.titleLine1}>Let the</span>
            <span className={styles.titleTray}>
              <span className={styles.titleTrayWord}>Learning</span>
            </span>
            <span className={styles.titleLine3}>Begin.</span>
          </h1>

          <p className={styles.heroSub}>
            Chemistry. Mathematics. Physics. Biology.
            Four interactive worlds that build real understanding —
            not passive reading or multiple-choice quizzes.
          </p>

          <div className={styles.heroCtas}>
            <Link href="/worlds" className={styles.ctaMain}>Enter a World →</Link>
            <span className={styles.ctaNote}>{totalGames} experience{totalGames !== 1 ? "s" : ""} live</span>
          </div>

          {/* Subject colour pills */}
          <div className={styles.subjectPills}>
            {WORLDS.map(w => (
              <span
                key={w.key}
                className={styles.subjectPill}
                style={{ "--prgb": w.rgb } as React.CSSProperties}
              >
                {w.icon} {w.key.charAt(0).toUpperCase() + w.key.slice(1)}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── WORLD TRAY ───────────────────────────────────────────────────── */}
      <section className={styles.traySection}>
        <div className={styles.container}>
          <div className={styles.trayHeader}>
            <span className={styles.trayLabel}>🌍 Choose your world</span>
            <Link href="/worlds" className={styles.seeAll}>See all →</Link>
          </div>

          <div className={styles.worldTray}>
            {WORLDS.map((w, i) => {
              const games = gamesBySubject[w.key] ?? [];
              return (
                <Link
                  key={w.key}
                  href="/worlds"
                  className={styles.worldCard}
                  style={{ "--wrgb": w.rgb, "--wc": w.color, animationDelay: `${i * 0.08}s` } as React.CSSProperties}
                >
                  <div className={styles.wcArt} style={{ background: w.gradient }}>
                    <span className={styles.wcArtGlyph} aria-hidden="true">{w.glyph}</span>
                    <div className={styles.wcArtBadge}>{w.icon} {w.name}</div>
                  </div>
                  <div className={styles.wcBody}>
                    <div className={styles.wcHeadline}>{w.headline}</div>
                    <div className={styles.wcTagline}>{w.tagline}</div>
                    <div className={styles.wcFoot}>
                      {games.length > 0
                        ? <span className={styles.wcLive}>● {games.length} live</span>
                        : <span className={styles.wcSoon}>Soon</span>}
                    </div>
                  </div>
                  <div className={styles.wcCta}>Explore →</div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className={styles.how}>
        <div className={styles.container}>
          <div className={styles.howEyebrow}>How it works</div>
          <h2 className={styles.howTitle}>Not a quiz. Not a video. Something different.</h2>
          <div className={styles.howGrid}>
            {STEPS.map((s, i) => (
              <div key={i} className={styles.howStep}>
                <div className={styles.howStepIcon}>{s.icon}</div>
                <div className={styles.howStepNum}>0{i + 1}</div>
                <div className={styles.howStepTitle}>{s.title}</div>
                <p className={styles.howStepBody}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATEMENT ────────────────────────────────────────────────────── */}
      <section className={styles.statement}>
        <div className={styles.container}>
          <div className={styles.statementInner}>
            <div className={styles.statementMark} aria-hidden="true">"</div>
            <blockquote className={styles.statementQ}>
              Students learn by doing,<br />not by reading.
            </blockquote>
            <p className={styles.statementBody}>
              EXL is the interactive layer between a student and a concept.
              Understanding is built through action, not observation.
            </p>
            <Link href="/worlds" className={styles.ctaMain}>Start exploring →</Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <div className={styles.footerBrand}>
            <div className={styles.footerMark}>E</div>
            <span className={styles.footerName}>EXL Learning World</span>
          </div>
          <span className={styles.footerMotto}>Interact → Understand → Practise → Construct → Master</span>
        </div>
      </footer>
    </div>
  );
}
