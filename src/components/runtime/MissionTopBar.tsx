// FILE: src/components/runtime/MissionTopBar.tsx
import styles from "@/components/runtime/MissionTopBar.module.css";

export interface MissionTopBarProps {
  gameTitle: string;
  subject: string;
  accentColor?: string;
}

const SUBJECT_META: Record<string, { icon: string; label: string; colour: string }> = {
  chemistry:   { icon: "⚗️",  label: "Chemistry",   colour: "#00d4ff" },
  physics:     { icon: "⚡",  label: "Physics",     colour: "#4488ff" },
  mathematics: { icon: "📐", label: "Mathematics", colour: "#c9a227" },
  biology:     { icon: "🧬", label: "Biology",     colour: "#7ecf3e" },
};

export function MissionTopBar({ gameTitle, subject, accentColor }: MissionTopBarProps) {
  const meta = SUBJECT_META[subject] ?? { icon: "🔬", label: subject, colour: accentColor ?? "#7b4fcb" };
  const colour = accentColor ?? meta.colour;

  return (
    <div
      className={styles.bar}
      style={{ "--accent-color": colour } as React.CSSProperties}
    >
      <div className={styles.subjectPill}>
        <span className={styles.subjectIcon}>{meta.icon}</span>
        <span className={styles.subjectLabel}>{meta.label}</span>
      </div>
      <div className={styles.title}>{gameTitle}</div>
    </div>
  );
}