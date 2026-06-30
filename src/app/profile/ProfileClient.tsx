"use client";

import { useState } from "react";
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

/**
 * app/profile/ProfileClient.tsx
 *
 * The actual profile UI — kept as a separate client component from
 * page.tsx (a Server Component) since this needs useTheme() for
 * SiteHeader, same split every other top-level page in this app
 * already uses (HomePage.tsx, WorldsClient.tsx).
 *
 * EDITING ADDED per direct feedback ("students should be able to add
 * school, class... user should be able to edit their profile"). Name,
 * school, and class are all editable now via one inline form (Edit
 * Profile button -> form -> Save/Cancel), POSTing to the same
 * /api/identity endpoint the one-time onboarding name prompt already
 * used (see that route's updated schema) — this is the one server-side
 * write path for a student's editable profile fields, not a second one
 * bolted on beside it. `student` state is updated optimistically from
 * the response on a successful save, so the page reflects the change
 * immediately without a full reload.
 */
export function ProfileClient({ student: initialStudent, attemptsBySubject, totalMissionsCompleted, games }: ProfileClientProps) {
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
            {editing ? (
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
                <Mascot pose="celebrate" widthPx={84} />
                <div className={styles.identityInfo}>
                  <div className={styles.displayName}>{student.display_name}</div>
                  {(student.school || student.class_name) && (
                    <div className={styles.schoolClassRow}>
                      {student.school && <span className={styles.schoolClassChip}>🏫 {student.school}</span>}
                      {student.class_name && <span className={styles.schoolClassChip}>🎓 {student.class_name}</span>}
                    </div>
                  )}
                  <div className={styles.deviceNote}>This profile lives on this device — no account or password needed.</div>
                </div>
                <button className={styles.editTrigger} onClick={startEditing} aria-label="Edit profile">
                  ✏️ Edit
                </button>
              </div>
            )}

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
