"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTheme } from "./ThemeProvider";
import styles from "./AdminNav.module.css";

const NAV = [
  { href: "/admin",              icon: "▦",  label: "Dashboard" },
  { href: "/admin/content",      icon: "◈",  label: "Content"   },
  { href: "/admin/maths",        icon: "📐", label: "Maths"     },
  { href: "/admin/games/upload", icon: "↑",  label: "Upload"    },
];

export function AdminNav() {
  const path = usePathname();
  const { theme, toggle } = useTheme();
  return (
    <nav className={styles.nav}>
      <div className={styles.brand}>
        <div className={styles.brandMark}>E<span className={styles.brandAccent}>X</span>L</div>
        <div className={styles.brandSub}>Studio</div>
        <div className={styles.brandStatus}>
          <div className={styles.statusDot} />
          <span className={styles.statusText}>Live</span>
        </div>
      </div>

      <div className={styles.links}>
        <div className={styles.sectionLabel}>Menu</div>
        {NAV.map(({ href, icon, label }) => {
          const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
          return (
            <Link key={href} href={href} className={`${styles.link} ${active ? styles.active : ""}`}>
              <span className={styles.linkIcon}>{icon}</span>
              <span className={styles.linkLabel}>{label}</span>
              {active && <div className={styles.activePip} />}
            </Link>
          );
        })}
      </div>

      <div className={styles.bottom}>
        <button onClick={toggle} className={styles.themeBtn}>
          <span className={styles.linkIcon}>{theme === "light" ? "🌙" : "☀️"}</span>
          <span className={styles.backText}>{theme === "light" ? "Dark mode" : "Light mode"}</span>
        </button>
        <Link href="/" className={styles.backLink}>
          <span className={styles.linkIcon}>←</span>
          <span className={styles.backText}>Exit Studio</span>
        </Link>
      </div>
    </nav>
  );
}