"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import styles from "./AdminNav.module.css";

const NAV = [
  { href: "/admin",              icon: "▦",  label: "Dashboard"  },
  { href: "/admin/games",        icon: "🎮", label: "Games"      },
  { href: "/admin/games/upload", icon: "↑",  label: "Upload"     },
  { href: "/admin/missions",     icon: "◈",  label: "Missions"   },
  { href: "/admin/students",     icon: "◎",  label: "Students"   },
];

export function AdminNav() {
  const path = usePathname();

  return (
    <nav className={styles.nav}>
      {/* Wordmark */}
      <div className={styles.brand}>
        <div className={styles.brandMark}>EXL</div>
        <div className={styles.brandSub}>Admin</div>
      </div>

      {/* Nav links */}
      <div className={styles.links}>
        {NAV.map(item => {
          const active = item.href === "/admin"
            ? path === "/admin"
            : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.link} ${active ? styles.active : ""}`}
            >
              <span className={styles.linkIcon}>{item.icon}</span>
              <span className={styles.linkLabel}>{item.label}</span>
              {active && <div className={styles.activePip}/>}
            </Link>
          );
        })}
      </div>

      {/* Bottom actions */}
      <div className={styles.bottom}>
        <Link href="/" className={styles.backLink}>
          <span>←</span>
          <span>Back to App</span>
        </Link>
      </div>
    </nav>
  );
}
