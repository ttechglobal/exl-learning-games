"use client";

import Link from "next/link";
import styles from "@/components/ui/SiteHeader.module.css";

/**
 * components/ui/SiteHeader.tsx
 *
 * Extracted from HomePage.tsx's inline header so the minimal top bar
 * is a single source of truth across every player-facing page, not a
 * copy-pasted block that drifts. Used by HomePage and WorldsClient;
 * reuse here rather than re-inlining if a third page needs the same
 * chrome.
 *
 * MOBILE FIX: nav previously had a "Profile" link (icon + label) AND a
 * separate avatar button, both pointing at /profile, both rendering the
 * same 👤 glyph once labels hide on narrow screens — two visually
 * identical icons doing the same job, eating space that mattered. The
 * standalone avatar button is the more conventional "go to my profile"
 * affordance (most apps use the avatar, not a nav-list entry, for this),
 * so nav is now just Games + Leaderboard; the avatar button alone covers
 * Profile. Everything else got more breathing room on mobile as a
 * direct result of removing that duplicate, not just smaller padding.
 *
 * Theme is intentionally owned by the PARENT page (passed in as props),
 * not by this component — see ThemeProvider.tsx for the shared context
 * every page now pulls from.
 */
export interface SiteHeaderProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  /** Which nav item is the current page; omit if none apply. "profile"
   *  still accepted for backward compatibility with existing callers,
   *  but has no visible effect now that Profile isn't a nav link — the
   *  avatar button doesn't currently render an active state. */
  active?: "games" | "leaderboard" | "profile";
  /** Current student's XP total for the header pill; omit while logged out. */
  currentStudentXp?: number;
}

export function SiteHeader({ theme, onToggleTheme, active, currentStudentXp }: SiteHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={`${styles.container} ${styles.headerRow}`}>
        <Link href="/" className={styles.logo}>
          <div className={`${styles.logoMark} ${styles.fd}`}>E</div>
          <div className={`${styles.logoText} ${styles.fd}`}>EXL</div>
        </Link>

        <nav className={styles.lobbyNav}>
          <Link href="/worlds" className={active === "games" ? styles.navActive : undefined}>
            🎮 <span className={styles.navLabel}>Games</span>
          </Link>
          <a href="/#leaderboard" className={active === "leaderboard" ? styles.navActive : undefined}>
            🏆 <span className={styles.navLabel}>Leaderboard</span>
          </a>
        </nav>

        <div className={styles.headerRight}>
          {typeof currentStudentXp === "number" && (
            <div className={styles.xpPill}>
              ✦ {currentStudentXp.toLocaleString()}
              <span className={styles.xpSuffix}> XP</span>
            </div>
          )}
          <button className={styles.themeToggle} onClick={onToggleTheme} aria-label="Toggle dark mode">
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <Link href="/profile" className={styles.avatarBtn} aria-label="Your profile">
            👤
          </Link>
        </div>
      </div>
    </header>
  );
}