import type { ReactNode } from "react";
import { AdminNav } from "./AdminNav";
import { ThemeProvider } from "./ThemeProvider";
import styles from "./layout.module.css";
import "./admin-theme.css";

export const metadata = { title: "EXL Studio" };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <div className={styles.root}>
        <AdminNav />
        <main className={styles.main}>{children}</main>
      </div>
    </ThemeProvider>
  );
}