import "@/motion/tokens.css";
import styles from "./layout.module.css";
import { AdminNav } from "./AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.root}>
      <AdminNav />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
