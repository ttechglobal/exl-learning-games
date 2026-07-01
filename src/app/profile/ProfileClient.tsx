"use client";

import { useState } from "react";
import { useTheme } from "@/components/ui/ThemeProvider";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { DepthBackdrop } from "@/motion/DepthBackdrop";
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
  /** Real per-period XP (see lib/db/queries/leaderboard.ts's
   *  getStudentRank). Both default to 0 rather than being undefined,
   *  since "0 XP this week" is a real, displayable state. */
  xpThisWeek: number;
  xpThisMonth: number;
}

interface EditFormState {
  displayName: string;
  school: string;
  className: string;
}

function studentToFormState(student: StudentRow): EditFormState {
  return {
    displayName: student.display_name,
    school: student.school ?? "",
    className: student.class_name ?? ""
  };
}

/** Lightweight, COSMETIC level system derived purely from xp_total —
 *  there is no `level` column anywhere in the schema, and this isn't
 *  meant to become a stored/authoritative value. 100 XP per level is an
 *  arbitrary, easy-to-reason-about curve chosen only to give the profile
 *  a game-y "Level N, X/100 XP to next level" readout per direct
 *  feedback ("make it...fitting for a game app") — tune the divisor here
 *  if the pacing ever needs to change; nothing else depends on it. */
function levelFromXp(xpTotal: number): { level: number; intoLevel: number; xpPerLevel: number } {
  const xpPerLevel = 100;
  const level = Math.floor(xpTotal / xpPerLevel) + 1;
  const intoLevel = xpTotal % xpPerLevel;
  return { level, intoLevel, xpPerLevel };
}

/**
 * app/profile/ProfileClient.tsx
 *
 * REDESIGNED again per direct feedback that the previous pass still
 * didn't read as "fitting for a game app" and that players might not
 * realize school/class are even fillable fields:
 *
 *   - Added a derived Level + XP-to-next-level progress bar (see
 *     levelFromXp above) — the single biggest "game app" signal this
 *     page was missing; a raw lifetime XP number alone doesn't read as
 *     a game stat the way a level/progress-bar pairing does.
 *   - School/Class are NO LONGER conditionally hidden when empty. Both
 *     always render as a chip; an unset one renders as a dashed,
 *     muted "+ Add school" / "+ Add class" chip that's directly
 *     clickable into the edit form — solves "the user may not know
 *     they need to fill it in" by making the gap itself the prompt,
 *     rather than a static label they might not read.
 *   - Edit moved from a small corner button to a real labeled pill
 *     ("Edit Profile") sitting with the chips, since editing is no
 *     longer a single rare action (filling in school/class for the
 *     first time is just as likely as a later name change).
 */
export function ProfileClient({
  student: initialStudent,
  attemptsBySubject,
  totalMissionsCompleted,
  games,
  xpThisWeek,
  xpThisMonth
}: ProfileClientProps) {
  const { theme, toggleTheme } = useTheme();
  const [student, setStudent] = useState(initialStudent);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditFormState>(() => (student ? studentToFormState(student) : { displayName: "", school: "", className: "" }));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const subjectsAvailable = new Set(games.map((g) => g.subject)).size;
  const subjectsExplored = Object.keys(attemptsBySubject).length;

  function startEditing() {
    if (!student) return;
    setForm(studentToFormState(student));
    setSaveError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setSaveError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!student) return;
    const trimmedName = form.displayName.trim();
    if (trimmedName.length === 0) {
      setSaveError("Name can't be empty.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: trimmedName,
          school: form.school,
          className: form.className
        })
      });
      if (!response.ok) throw new Error("Couldn't save your profile. Please try again.");
      const data = await response.json();
      setStudent(data.student as StudentRow);
      setEditing(false);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const { level, intoLevel, xpPerLevel } = student ? levelFromXp(student.xp_total) : { level: 1, intoLevel: 0, xpPerLevel: 100 };
  const levelProgressPct = Math.round((intoLevel / xpPerLevel) * 100);

  return (
    <div className={styles.page} data-theme={theme}>
      <SiteHeader theme={theme} onToggleTheme={toggleTheme} active="profile" currentStudentXp={student?.xp_total} />

      <div className={styles.titleRow}>
        <DepthBackdrop accentColor="var(--eg-brand)" />
        <div className={styles.container}>
          {!student ? (
            <div className={styles.emptyState}>
              <Mascot pose="idle" widthPx={96} />
              <div className={styles.emptyTitle}>Setting up your profile…</div>
              <div className={styles.emptyText}>
                This usually takes just a moment on your first visit. Try refreshing the page in a few seconds.
              </div>
            </div>
          ) : editing ? (
            <form className={styles.editCard} onSubmit={handleSave}>
              <div className={styles.editTitle}>Edit Profile</div>

              <label className={styles.fieldLabel} htmlFor="profile-name">
                Name
              </label>
              <input
                id="profile-name"
                className={styles.fieldInput}
                value={form.displayName}
                maxLength={20}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                placeholder="Your name"
              />

              <label className={styles.fieldLabel} htmlFor="profile-school">
                School
              </label>
              <input
                id="profile-school"
                className={styles.fieldInput}
                value={form.school}
                maxLength={80}
                onChange={(e) => setForm((f) => ({ ...f, school: e.target.value }))}
                placeholder="e.g. Bright Future Secondary School"
              />

              <label className={styles.fieldLabel} htmlFor="profile-class">
                Class
              </label>
              <input
                id="profile-class"
                className={styles.fieldInput}
                value={form.className}
                maxLength={40}
                onChange={(e) => setForm((f) => ({ ...f, className: e.target.value }))}
                placeholder="e.g. SS2"
              />

              {saveError && <div className={styles.fieldError}>{saveError}</div>}

              <div className={styles.editActions}>
                <button type="button" className={styles.cancelButton} onClick={cancelEditing} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className={styles.saveButton} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          ) : (
            <div className={styles.identityCard}>
              <Mascot pose="celebrate" widthPx={84} className={styles.identityMascot} />
              <div className={styles.identityInfo}>
                <div className={styles.identityTopRow}>
                  <div className={styles.displayName}>{student.display_name}</div>
                  <div className={styles.levelBadge}>Lvl {level}</div>
                </div>

                <div className={styles.levelTrack}>
                  <div className={styles.levelFill} style={{ width: `${levelProgressPct}%` }} />
                </div>
                <div className={styles.levelCaption}>
                  {intoLevel}/{xpPerLevel} XP to Level {level + 1}
                </div>

                <div className={styles.schoolClassRow}>
                  {student.school ? (
                    <button className={styles.filledChip} onClick={startEditing}>
                      🏫 {student.school}
                    </button>
                  ) : (
                    <button className={styles.emptyChip} onClick={startEditing}>
                      + Add school
                    </button>
                  )}
                  {student.class_name ? (
                    <button className={styles.filledChip} onClick={startEditing}>
                      🎓 {student.class_name}
                    </button>
                  ) : (
                    <button className={styles.emptyChip} onClick={startEditing}>
                      + Add class
                    </button>
                  )}
                </div>
              </div>
              <button className={styles.editTrigger} onClick={startEditing}>
                ✏️ Edit Profile
              </button>
            </div>
          )}
        </div>
      </div>

      {student && (
        <div className={`${styles.container} ${styles.mainSection}`}>
          <div className={styles.sectionLabel}>Your XP</div>
          <div className={styles.xpRow}>
            <div className={styles.xpCard}>
              <div className={styles.xpValue}>{xpThisWeek.toLocaleString()}</div>
              <div className={styles.xpLabel}>This Week</div>
            </div>
            <div className={styles.xpCard}>
              <div className={styles.xpValue}>{xpThisMonth.toLocaleString()}</div>
              <div className={styles.xpLabel}>This Month</div>
            </div>
            <div className={`${styles.xpCard} ${styles.xpCardAllTime}`}>
              <div className={styles.xpValue}>{student.xp_total.toLocaleString()}</div>
              <div className={styles.xpLabel}>All Time</div>
            </div>
          </div>

          <div className={styles.statsRow}>
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
                        <span className={styles.subjectIconWrap}>
                          <span className={styles.subjectEmoji}>{meta.emoji}</span>
                        </span>
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
        </div>
      )}
    </div>
  );
}
