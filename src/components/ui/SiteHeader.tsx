"use client";

import Link from "next/link";
import styles from "@/components/ui/SiteHeader.module.css";

/**
 * components/ui/SiteHeader.tsx
 *
 * Extracted from HomePage.tsx's inline header so the minimal top bar
 * (logo, Games/Leaderboard/Profile nav, theme toggle, avatar) is a single
 * source of truth across every player-facing page, not a copy-pasted block
 * that drifts. Used by HomePage and WorldsClient; reuse here rather than
 * re-inlining if a third page needs the same chrome.
 *
 * Theme is intentionally owned by the PARENT page (passed in as props),
 * not by this component — there's no global theme context/provider yet
 * (see note in WorldsClient.tsx), so each page currently manages its own
 * `useState<"light" | "dark">`. If a third page needs this, that's the
 * signal to promote theme state into a real context instead of a third
 * local copy.
 */
export interface SiteHeaderProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  /** Which nav item is the current page; omit if none apply (e.g. a future page). */
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
          <Link href="/profile" className={active === "profile" ? styles.navActive : undefined}>
            👤 <span className={styles.navLabel}>Profile</span>
          </Link>
        </nav>

        <div className={styles.headerRight}>
          {typeof currentStudentXp === "number" && (
            <div className={styles.xpPill}>✦ {currentStudentXp.toLocaleString()} XP</div>
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