"use client";

import { useState } from "react";
import Link from "next/link";
import { DepthBackdrop } from "@/motion/DepthBackdrop";
import { SiteHeader } from "@/components/ui/SiteHeader";
import type { GameRow } from "@/types/db";
import styles from "@/app/(player)/worlds/WorldsClient.module.css";

/**
 * WorldsClient.tsx
 *
 * Full game catalog, grouped by subject — the page every subject chip and
 * "Browse all games" link on the homepage actually lands on. Previously
 * this was unstyled inline JSX carrying leftover neon-era hex colors
 * (#00e5ff etc. — predating even the warm-mascot era) with no header, no
 * branding, and no relationship to the homepage redesign. This rebuild:
 *
 *   - Uses the shared SiteHeader so navigating here from "/" feels
 *     continuous instead of landing in a different, older-looking app.
 *   - Replaces hardcoded hex with the real --eg-subject-* tokens (now
 *     theme-aware via motion/tokens.css), so dark mode and the navy brand
 *     both apply correctly here, not just on the homepage.
 *   - Upgrades bare title-only links into real cards matching the
 *     homepage's "Popular Games" card language (art surface + title +
 *     subject label), so a game card looks like the same kind of object
 *     wherever it appears in the app.
 *
 * THEME STATE NOTE: like HomePage.tsx, this owns its own local
 * `useState<"light"|"dark">` — there is still no global theme
 * provider/context anywhere in the app. Each player-facing page currently
 * starts in light mode independently and won't remember a choice made on
 * another page. That's an honest gap, not a deliberate design choice; the
 * real fix is a ThemeProvider (e.g. context + localStorage) shared via
 * layout.tsx once a third page needs this, rather than a third copy of
 * this same local state.
 */

export interface WorldsClientProps {
  bySubject: Record<string, GameRow[]>;
}

const SUBJECT_META: Record<string, { name: string; emoji: string; color: string; tint: string }> = {
  chemistry: { name: "Chemistry", emoji: "\u{1F9EA}", color: "var(--eg-subject-chemistry)", tint: "color-mix(in srgb, var(--eg-subject-chemistry) 14%, white)" },
  mathematics: { name: "Mathematics", emoji: "\u{1F4D0}", color: "var(--eg-subject-mathematics)", tint: "color-mix(in srgb, var(--eg-subject-mathematics) 14%, white)" },
  physics: { name: "Physics", emoji: "\u26A1", color: "var(--eg-subject-physics)", tint: "color-mix(in srgb, var(--eg-subject-physics) 14%, white)" },
  biology: { name: "Biology", emoji: "\u{1F9EC}", color: "var(--eg-subject-biology)", tint: "color-mix(in srgb, var(--eg-subject-biology) 14%, white)" }
};

function subjectMeta(key: string) {
  return (
    SUBJECT_META[key] ?? {
      name: key.charAt(0).toUpperCase() + key.slice(1),
      emoji: "\u{1F4D6}",
      color: "var(--eg-brand)",
      tint: "var(--eg-brand-tint)"
    }
  );
}

export function WorldsClient({ bySubject }: WorldsClientProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const subjects = Object.entries(bySubject);
  const primaryAccent = subjects.length > 0 ? subjectMeta(subjects[0][0]).color : "var(--eg-brand)";

  return (
    <div className={styles.page} data-theme={theme}>
      <SiteHeader theme={theme} onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))} active="games" />

      <div className={styles.titleRow}>
        <DepthBackdrop accentColor={primaryAccent} />
        <div className={styles.container}>
          <h1 className={styles.pageTitle}>All Worlds</h1>
          <p className={styles.pageSubtitle}>Every game, grouped by subject. Pick one and dive in.</p>
        </div>
      </div>

      <div className={styles.container}>
        {subjects.map(([subject, subjectGames]) => {
          const meta = subjectMeta(subject);
          return (
            <section key={subject} className={styles.subjectSection} id={subject}>
              <div className={styles.subjectHead}>
                <span className={styles.subjectIcon} style={{ background: meta.tint }}>
                  {meta.emoji}
                </span>
                <h2 className={styles.subjectName} style={{ color: meta.color }}>
                  {meta.name}
                </h2>
                <span className={styles.subjectCount}>
                  {subjectGames.length} game{subjectGames.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className={styles.gameGrid}>
                {subjectGames.map((game) => (
                  <Link
                    key={game.id}
                    href={`/play/${game.slug}`}
                    className={styles.gameCard}
                    style={{ "--c": meta.color, "--c-tint": meta.tint } as React.CSSProperties}
                  >
                    <div className={styles.gameCardArt}>
                      <span className={styles.gameCardEmoji}>{meta.emoji}</span>
                    </div>
                    <div className={styles.gameCardBody}>
                      <div className={styles.gameCardSubject}>{meta.name}</div>
                      <div className={styles.gameCardTitle}>{game.title}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}

        {subjects.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🗺️</div>
            <p>No games yet — seed the database to see them here.</p>
          </div>
        )}
      </div>
    </div>
  );
}