"use client";

import { useTheme } from "@/components/ui/ThemeProvider";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { Mascot } from "@/motion/Mascot";
import { subjectMeta } from "@/lib/content/subjects";
import type { GameRow, StudentRow } from "@/types/db";
import styles from "@/app/profile/ProfileClient.module.css";

export interface ProfileClientProps {
  student: StudentRow | null;
  /** subject key -> count of successfully completed missions, derived
   *  server-side in page.tsx from listAttemptsForStudent() joined
   *  against each attempt's game.subject. */
  attemptsBySubject: Record<string, number>;
  totalMissionsCompleted: number;
  games: GameRow[];
}

/**
 * app/profile/ProfileClient.tsx
 *
 * The actual profile UI — kept as a separate client component from
 * page.tsx (a Server Component) since this needs useTheme() for
 * SiteHeader, same split every other top-level page in this app
 * already uses (HomePage.tsx, WorldsClient.tsx).
 *
 * Deliberately simple for a first version: identity (name + device-only
 * framing), total XP, missions completed, and a per-subject breakdown.
 * No editing UI here yet (changing your name still happens via
 * IdentityBootstrap's one-time prompt or a future settings surface) —
 * this is a profile to LOOK AT, not yet to edit from.
 */
export function ProfileClient({ student, attemptsBySubject, totalMissionsCompleted, games }: ProfileClientProps) {
  const { theme, toggleTheme } = useTheme();

  const subjectsAvailable = new Set(games.map((g) => g.subject)).size;
  const subjectsExplored = Object.keys(attemptsBySubject).length;

  return (
    <div className={styles.page} data-theme={theme}>
      <SiteHeader theme={theme} onToggleTheme={toggleTheme} active="profile" currentStudentXp={student?.xp_total} />

      <div className={styles.container}>
        {!student ? (
          <div className={styles.emptyState}>
            <Mascot pose="idle" widthPx={96} />
            <div className={styles.emptyTitle}>Setting up your profile…</div>
            <div className={styles.emptyText}>
              This usually takes just a moment on your first visit. Try refreshing the page in a few seconds.
            </div>
          </div>
        ) : (
          <>
            <div className={styles.identityCard}>
              <Mascot pose="celebrate" widthPx={84} />
              <div className={styles.identityInfo}>
                <div className={styles.displayName}>{student.display_name}</div>
                <div className={styles.deviceNote}>This profile lives on this device — no account or password needed.</div>
              </div>
            </div>

            <div className={styles.statsRow}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{student.xp_total.toLocaleString()}</div>
                <div className={styles.statLabel}>Total XP</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{totalMissionsCompleted.toLocaleString()}</div>
                <div className={styles.statLabel}>Missions Completed</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>
                  {subjectsExplored}/{subjectsAvailable || subjectsExplored}
                </div>
                <div className={styles.statLabel}>Subjects Explored</div>
              </div>
            </div>

            {Object.keys(attemptsBySubject).length > 0 && (
              <div className={styles.subjectSection}>
                <div className={styles.sectionLabel}>By Subject</div>
                <div className={styles.subjectList}>
                  {Object.entries(attemptsBySubject)
                    .sort(([, a], [, b]) => b - a)
                    .map(([subject, count]) => {
                      const meta = subjectMeta(subject);
                      return (
                        <div key={subject} className={styles.subjectRow} style={{ "--subject-color": meta.color } as React.CSSProperties}>
                          <span className={styles.subjectEmoji}>{meta.emoji}</span>
                          <span className={styles.subjectName}>{meta.name}</span>
                          <span className={styles.subjectCount}>{count} completed</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {totalMissionsCompleted === 0 && (
              <div className={styles.emptyState}>
                <div className={styles.emptyText}>
                  No missions completed yet — head over to{" "}
                  <a href="/worlds" className={styles.emptyLink}>
                    Worlds
                  </a>{" "}
                  to get started.
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
