import { supabaseServer } from "@/lib/db/supabase";
import styles from "./students.module.css";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const { data: students, count } = await supabaseServer()
    .from("student")
    .select("id, display_name, xp_total, school, class_name, created_at", { count: "exact" })
    .order("xp_total", { ascending: false })
    .limit(100);

  const { data: recentAttempts } = await supabaseServer()
    .from("attempt")
    .select("student_id, success, completed_at")
    .gte("completed_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  type RecentAttempt = { student_id: string; success: boolean | null; completed_at: string };
  const attemptsByStudent = new Map<string, RecentAttempt[]>();
  for (const a of (recentAttempts ?? []) as RecentAttempt[]) {
    if (!attemptsByStudent.has(a.student_id)) attemptsByStudent.set(a.student_id, []);
    attemptsByStudent.get(a.student_id)!.push(a);
  }

  const schools = new Set((students ?? []).map((s: { school: string | null }) => s.school).filter(Boolean));

  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Students</h1>
          <p className={styles.sub}>{count ?? 0} registered students</p>
        </div>
      </div>

      {/* Summary pills */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Students</div>
          <div className={styles.statValue}>{count ?? 0}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Schools</div>
          <div className={styles.statValue}>{schools.size}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Active (7 days)</div>
          <div className={styles.statValue}>{attemptsByStudent.size}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total XP Awarded</div>
          <div className={styles.statValue}>
            {((students ?? []) as { xp_total: number }[]).reduce((s, r) => s + (r.xp_total ?? 0), 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Student table */}
      <div className={styles.tableWrap}>
        <div className={styles.tableHead}>
          <div>Rank</div>
          <div>Student</div>
          <div>School · Class</div>
          <div>XP</div>
          <div>7-day activity</div>
          <div>Joined</div>
        </div>

        {(students ?? []).map((s: {
          id: string;
          display_name: string;
          xp_total: number;
          school: string | null;
          class_name: string | null;
          created_at: string;
        }, i: number) => {
          const recentA = attemptsByStudent.get(s.id) ?? [];
          const recentSuccesses = recentA.filter(a => a.success).length;
          const isActive = recentA.length > 0;
          return (
            <div key={s.id} className={styles.tableRow}>
              <div className={styles.rank}>
                {i < 3 ? (
                  <span className={styles.rankBadge} style={{
                    background: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : "#b45309",
                    color: "#fff"
                  }}>
                    {i + 1}
                  </span>
                ) : (
                  <span className={styles.rankNum}>{i + 1}</span>
                )}
              </div>
              <div className={styles.studentInfo}>
                <div className={styles.studentName}>{s.display_name}</div>
                <div className={styles.studentId}>{s.id.slice(0, 8)}…</div>
              </div>
              <div className={styles.schoolInfo}>
                {s.school ? (
                  <>
                    <div className={styles.schoolName}>{s.school}</div>
                    {s.class_name && <div className={styles.className}>{s.class_name}</div>}
                  </>
                ) : (
                  <span className={styles.noData}>—</span>
                )}
              </div>
              <div className={styles.xp}>
                <span className={styles.xpValue}>{s.xp_total.toLocaleString()}</span>
                <span className={styles.xpLabel}>XP</span>
              </div>
              <div className={styles.activity}>
                {isActive ? (
                  <div className={styles.activityBars}>
                    {recentA.slice(-7).map((a, j) => (
                      <div key={j} className={styles.activityBar}
                        style={{ background: a.success ? "#22c55e" : "#334155" }}
                        title={a.completed_at.slice(0, 10)}
                      />
                    ))}
                    <span className={styles.activityCount}>{recentSuccesses}/{recentA.length}</span>
                  </div>
                ) : (
                  <span className={styles.noData}>No activity</span>
                )}
              </div>
              <div className={styles.joined}>
                {new Date(s.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
              </div>
            </div>
          );
        })}
      </div>

      {(!students || students.length === 0) && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>◎</div>
          <div className={styles.emptyTitle}>No students yet</div>
          <div className={styles.emptySub}>Students appear here once they start playing games.</div>
        </div>
      )}
    </div>
  );
}
