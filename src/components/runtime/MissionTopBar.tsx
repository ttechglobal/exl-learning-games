import styles from "@/components/runtime/MissionTopBar.module.css";

export interface MissionTopBarProps {
  gameTitle: string;
  subject: string;
  accentColor?: string;
}

/**
 * Shared header for the pre-play sequence (Entry / Difficulty / Objectives).
 * Per direct feedback: the game's name and subject should appear ONCE,
 * clearly, at the top of the flow — not repeated inside whatever card
 * happens to render below it (EntryScreen's old `.kicker` did a tiny
 * uppercase version of this, and the card below it ALSO showed the
 * mission title, which read as the same information twice). This is now
 * the one place title+subject live; EntryScreen no longer renders its own
 * version of either.
 *
 * Intentionally just title + subject — no mascot, no card chrome — so it
 * reads as a page header, not another content block competing with
 * whatever screen renders underneath it.
 */
export function MissionTopBar({ gameTitle, subject, accentColor }: MissionTopBarProps) {
  return (
    <div className={styles.bar} style={accentColor ? ({ "--accent-color": accentColor } as React.CSSProperties) : undefined}>
      <div className={styles.title}>{gameTitle}</div>
      <div className={styles.subject}>{subject}</div>
    </div>
  );
}
