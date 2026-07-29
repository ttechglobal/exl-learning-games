// FILE: src/app/(admin)/admin/content/page.tsx
import { supabaseServer } from "@/lib/db/supabase";
import Link from "next/link";
import styles from "./content.module.css";

export const dynamic = "force-dynamic";

const SUBJECT_META: Record<string, { colour: string; label: string; emoji: string }> = {
  chemistry:   { colour: "#0284c7", label: "Chemistry",   emoji: "⚗️"  },
  physics:     { colour: "#7c3aed", label: "Physics",     emoji: "⚡"  },
  mathematics: { colour: "#059669", label: "Mathematics", emoji: "📐" },
  biology:     { colour: "#b45309", label: "Biology",     emoji: "🧬" },
};

const STATUS_COLOUR: Record<string, string> = {
  "not-started":  "#3a4455",
  "build-intent": "#b45309",
  "in-progress":  "#7c3aed",
  "built":        "#0284c7",
  "approved":     "#059669",
};

interface Concept {
  name: string;
  stage: string;
  status: string;
}

interface Topic {
  id: string;
  subject: string;
  name: string;
  level: string;
  concepts: Concept[];
  created_at: string;
}

function topicProgress(concepts: Concept[]): number {
  if (!concepts.length) return 0;
  const weights: Record<string, number> = {
    "not-started": 0, "build-intent": 0.2, "in-progress": 0.5, "built": 0.8, "approved": 1,
  };
  const total = concepts.reduce((sum, c) => sum + (weights[c.status] ?? 0), 0);
  return Math.round((total / concepts.length) * 100);
}

export default async function ContentPage() {
  const { data, error } = await supabaseServer()
    .from("content_topic")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div style={{ padding: 40, color: "#f87171", fontFamily: "monospace", fontSize: "0.85rem" }}>
        <strong>Database error:</strong> {error.message}
        <br /><br />
        Make sure you have run the migration to create the <code>content_topic</code> table.
        <br /><br />
        <pre style={{ background: "#0d1520", padding: 16, borderRadius: 8, color: "#94a3b8" }}>{`
create table content_topic (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  name text not null,
  level text,
  curricula text[] default '{}',
  concepts jsonb default '[]',
  misconceptions jsonb default '[]',
  merged_objectives jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
        `.trim()}</pre>
      </div>
    );
  }

  const topics = (data ?? []) as Topic[];
  const bySubject: Record<string, Topic[]> = {};
  for (const t of topics) (bySubject[t.subject] ??= []).push(t);

  const totalConcepts = topics.reduce((s, t) => s + (t.concepts?.length ?? 0), 0);
  const builtConcepts = topics.reduce((s, t) =>
    s + (t.concepts ?? []).filter(c => c.status === "built" || c.status === "approved").length, 0);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Content Pipeline</h1>
          <p className={styles.sub}>
            {topics.length} topic{topics.length !== 1 ? "s" : ""} · {totalConcepts} concepts · {builtConcepts} built
          </p>
        </div>
        <Link href="/admin/content/new" className={styles.btnPrimary}>+ New Topic</Link>
      </div>

      {topics.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>◈</div>
          <div className={styles.emptyTitle}>No topics yet</div>
          <div className={styles.emptySub}>
            Start by creating a topic. You will get a prompt to paste into Claude,
            which returns the concept map as JSON to paste back here.
          </div>
          <Link href="/admin/content/new" className={styles.btnPrimary}>+ New Topic</Link>
        </div>
      ) : (
        Object.entries(bySubject).map(([subject, subjectTopics]) => {
          const meta = SUBJECT_META[subject] ?? { colour: "#64748b", label: subject, emoji: "📖" };
          return (
            <div key={subject} className={styles.subjectSection}>
              <div className={styles.subjectHeader}>
                <div className={styles.subjectDot} style={{ background: meta.colour }} />
                <span className={styles.subjectLabel}>{meta.emoji} {meta.label}</span>
                <span className={styles.subjectCount}>{subjectTopics.length} topic{subjectTopics.length !== 1 ? "s" : ""}</span>
              </div>
              <div className={styles.topicGrid}>
                {subjectTopics.map(topic => {
                  const concepts = topic.concepts ?? [];
                  const pct = topicProgress(concepts);
                  const builtCount = concepts.filter(c => c.status === "built" || c.status === "approved").length;
                  return (
                    <Link
                      key={topic.id}
                      href={`/admin/content/${topic.id}`}
                      className={styles.topicCard}
                      style={{ "--accent": meta.colour } as React.CSSProperties}
                    >
                      <div className={styles.topicCardBar} style={{ background: meta.colour }} />
                      <div className={styles.topicCardBody}>
                        <div className={styles.topicName}>{topic.name}</div>
                        <div className={styles.topicLevel}>{topic.level}</div>
                        <div className={styles.topicStats}>
                          <span>{concepts.length} concepts</span>
                          <span className={styles.dot}>·</span>
                          <span style={{ color: builtCount > 0 ? "#059669" : "var(--text-3)" }}>{builtCount} built</span>
                        </div>
                        {concepts.length > 0 && (
                          <div className={styles.progressWrap}>
                            <div className={styles.progressBar}>
                              <div className={styles.progressFill} style={{ width: `${pct}%`, background: meta.colour }} />
                            </div>
                            <span className={styles.progressPct}>{pct}%</span>
                          </div>
                        )}
                        {concepts.length > 0 && (
                          <div className={styles.conceptPips}>
                            {concepts.slice(0, 12).map((c, i) => (
                              <div key={i} className={styles.pip}
                                style={{ background: STATUS_COLOUR[c.status] ?? "#3a4455" }}
                                title={`${c.name} — ${c.status}`}
                              />
                            ))}
                            {concepts.length > 12 && <span className={styles.pipMore}>+{concepts.length - 12}</span>}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
                <Link href={`/admin/content/new?subject=${subject}`} className={styles.addCard}
                  style={{ "--accent": meta.colour } as React.CSSProperties}>
                  <div className={styles.addIcon}>+</div>
                  <div className={styles.addLabel}>New {meta.label} topic</div>
                </Link>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}