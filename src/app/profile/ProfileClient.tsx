"use client";

import { useState } from "react";
import { useTheme } from "@/components/ui/ThemeProvider";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { DepthBackdrop } from "@/motion/DepthBackdrop";
import { Mascot } from "@/motion/Mascot";
import { subjectMeta } from "@/lib/content/subjects";
import { RANKS, getRank, getNextRank, getRankProgress, getXpToNextRank } from "@/lib/content/ranks";
import type { GameRow, StudentRow } from "@/types/db";
import styles from "@/app/profile/ProfileClient.module.css";

export interface ProfileClientProps {
  student: StudentRow | null;
  attemptsBySubject: Record<string, number>;
  totalMissionsCompleted: number;
  games: GameRow[];
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
    className: student.class_name ?? "",
  };
}

export function ProfileClient({
  student: initialStudent,
  attemptsBySubject,
  totalMissionsCompleted,
  games,
  xpThisWeek,
  xpThisMonth,
}: ProfileClientProps) {
  const { theme, toggleTheme } = useTheme();
  const [student, setStudent] = useState(initialStudent);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditFormState>(() =>
    student ? studentToFormState(student) : { displayName: "", school: "", className: "" }
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const subjectsAvailable = new Set(games.map((g) => g.subject)).size;
  const subjectsExplored  = Object.keys(attemptsBySubject).length;

  function startEditing() {
    if (!student) return;
    setForm(studentToFormState(student));
    setSaveError(null);
    setEditing(true);
  }
  function cancelEditing() { setEditing(false); setSaveError(null); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!student) return;
    const trimmedName = form.displayName.trim();
    if (!trimmedName) { setSaveError("Name can't be empty."); return; }
    setSaving(true); setSaveError(null);
    try {
      const res = await fetch("/api/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmedName, school: form.school, className: form.className }),
      });
      if (!res.ok) throw new Error("Couldn't save your profile. Please try again.");
      const data = await res.json();
      setStudent(data.student as StudentRow);
      setEditing(false);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const xp       = student?.xp_total ?? 0;
  const rank     = getRank(xp);
  const nextRank = getNextRank(xp);
  const xpPct    = getRankProgress(xp);
  const xpToNext = getXpToNextRank(xp);

  // Index of current rank in the RANKS array
  const rankIndex = RANKS.findIndex((r) => r.label === rank.label);

  return (
    <div className={styles.page} data-theme={theme}>
      <SiteHeader theme={theme} onToggleTheme={toggleTheme} active="profile" currentStudentXp={student?.xp_total} />

      <div className={styles.titleRow}>
        <DepthBackdrop accentColor={rank.color} />
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
              <label className={styles.fieldLabel} htmlFor="profile-name">Name</label>
              <input id="profile-name" className={styles.fieldInput} value={form.displayName} maxLength={20}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} placeholder="Your name" />
              <label className={styles.fieldLabel} htmlFor="profile-school">School</label>
              <input id="profile-school" className={styles.fieldInput} value={form.school} maxLength={80}
                onChange={(e) => setForm((f) => ({ ...f, school: e.target.value }))} placeholder="e.g. Bright Future Secondary School" />
              <label className={styles.fieldLabel} htmlFor="profile-class">Class</label>
              <input id="profile-class" className={styles.fieldInput} value={form.className} maxLength={40}
                onChange={(e) => setForm((f) => ({ ...f, className: e.target.value }))} placeholder="e.g. SS2" />
              {saveError && <div className={styles.fieldError}>{saveError}</div>}
              <div className={styles.editActions}>
                <button type="button" className={styles.cancelButton} onClick={cancelEditing} disabled={saving}>Cancel</button>
                <button type="submit" className={styles.saveButton} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              </div>
            </form>
          ) : (
            /* ── IDENTITY CARD ── */
            <div className={styles.identityCard}>
              <Mascot pose="celebrate" widthPx={80} className={styles.identityMascot} />
              <div className={styles.identityInfo}>
                <div className={styles.identityTopRow}>
                  <div className={styles.displayName}>{student.display_name}</div>
                  {/* Rank badge using shared rank colour */}
                  <div
                    className={styles.rankBadgePill}
                    style={{ background: rank.bgGradient, boxShadow: `0 2px 12px ${rank.color}55` }}
                  >
                    <span className={styles.rankBadgeIcon}>{rank.icon}</span>
                    <span className={styles.rankBadgeLabel}>{rank.label}</span>
                  </div>
                </div>

                {/* XP progress bar toward next rank */}
                <div className={styles.xpProgress}>
                  <div className={styles.xpBarTrack}>
                    <div
                      className={styles.xpBarFill}
                      style={{ width: `${xpPct}%`, background: rank.color }}
                    />
                  </div>
                  <div className={styles.xpBarCaption}>
                    {nextRank
                      ? <>{xp.toLocaleString()} XP · <strong>{xpToNext}</strong> to {nextRank.icon} {nextRank.label}</>
                      : <>{xp.toLocaleString()} XP · Max rank reached! {rank.icon}</>
                    }
                  </div>
                </div>

                <div className={styles.schoolClassRow}>
                  {student.school
                    ? <button className={styles.filledChip} onClick={startEditing}>🏫 {student.school}</button>
                    : <button className={styles.emptyChip} onClick={startEditing}>+ Add school</button>
                  }
                  {student.class_name
                    ? <button className={styles.filledChip} onClick={startEditing}>🎓 {student.class_name}</button>
                    : <button className={styles.emptyChip} onClick={startEditing}>+ Add class</button>
                  }
                </div>
              </div>
              <button className={styles.editTrigger} onClick={startEditing}>✏️ Edit</button>
            </div>
          )}
        </div>
      </div>

      {student && (
        <div className={`${styles.container} ${styles.mainSection}`}>

          {/* ── RANK LADDER ── */}
          <div className={styles.sectionLabel}>Rank Ladder</div>
          <div className={styles.rankLadder}>
            {RANKS.map((r, i) => {
              const isEarned  = xp >= r.min;
              const isCurrent = r.label === rank.label;
              const isNext    = nextRank?.label === r.label;
              return (
                <div
                  key={r.label}
                  className={[
                    styles.rankTier,
                    isEarned  ? styles.rankTierEarned  : "",
                    isCurrent ? styles.rankTierCurrent : "",
                    isNext    ? styles.rankTierNext    : "",
                  ].join(" ")}
                  style={isCurrent || isEarned
                    ? { "--rank-color": r.color, "--rank-bg": r.bgGradient } as React.CSSProperties
                    : undefined
                  }
                >
                  <div className={styles.rankTierLeft}>
                    <div
                      className={styles.rankTierIcon}
                      style={isEarned ? { background: r.bgGradient, boxShadow: `0 0 12px ${r.color}66` } : undefined}
                    >
                      {isEarned ? r.icon : <span className={styles.rankTierLock}>🔒</span>}
                    </div>
                    <div className={styles.rankTierInfo}>
                      <div className={styles.rankTierLabel} style={isEarned ? { color: r.color } : undefined}>
                        {r.label}
                        {isCurrent && <span className={styles.rankCurrentTag}>YOU ARE HERE</span>}
                      </div>
                      <div className={styles.rankTierXp}>{r.min === 0 ? "Starting rank" : `${r.min.toLocaleString()} XP`}</div>
                    </div>
                  </div>
                  {/* Progress pip for current rank */}
                  {isCurrent && nextRank && (
                    <div className={styles.rankTierPip}>
                      <div className={styles.rankTierPipTrack}>
                        <div className={styles.rankTierPipFill} style={{ width: `${xpPct}%`, background: r.color }} />
                      </div>
                      <span className={styles.rankTierPipLabel}>{Math.round(xpPct)}%</span>
                    </div>
                  )}
                  {/* Connector line between tiers */}
                  {i < RANKS.length - 1 && (
                    <div className={[styles.rankConnector, isEarned ? styles.rankConnectorEarned : ""].join(" ")} />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── XP SNAPSHOT ── */}
          <div className={styles.sectionLabel} style={{ marginTop: 28 }}>Your XP</div>
          <div className={styles.xpRow}>
            <div className={styles.xpCard}>
              <div className={styles.xpValue}>{xpThisWeek.toLocaleString()}</div>
              <div className={styles.xpLabel}>This Week</div>
            </div>
            <div className={styles.xpCard}>
              <div className={styles.xpValue}>{xpThisMonth.toLocaleString()}</div>
              <div className={styles.xpLabel}>This Month</div>
            </div>
            <div className={styles.xpCard} style={{ background: rank.bgGradient }}>
              <div className={styles.xpValue} style={{ color: "#fff" }}>{student.xp_total.toLocaleString()}</div>
              <div className={styles.xpLabel} style={{ color: "rgba(255,255,255,.8)" }}>All Time</div>
            </div>
          </div>

          {/* ── STATS ── */}
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{totalMissionsCompleted.toLocaleString()}</div>
              <div className={styles.statLabel}>Missions Completed</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{subjectsExplored}/{subjectsAvailable || subjectsExplored}</div>
              <div className={styles.statLabel}>Subjects Explored</div>
            </div>
          </div>

          {/* ── BY SUBJECT ── */}
          {Object.keys(attemptsBySubject).length > 0 && (
            <div className={styles.subjectSection}>
              <div className={styles.sectionLabel}>By Subject</div>
              <div className={styles.subjectList}>
                {Object.entries(attemptsBySubject)
                  .sort(([, a], [, b]) => b - a)
                  .map(([subject, count]) => {
                    const meta = subjectMeta(subject);
                    return (
                      <div
                        key={subject}
                        className={styles.subjectRow}
                        style={{ "--subject-color": meta.color } as React.CSSProperties}
                      >
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
                <a href="/worlds" className={styles.emptyLink}>Worlds</a> to get started.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}