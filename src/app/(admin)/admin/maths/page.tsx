// FILE: src/app/(admin)/admin/maths/page.tsx
import { supabaseServer } from "@/lib/db/supabase";
import Link from "next/link";
import styles from "../content/content.module.css";   // reuse same visual style

export const dynamic = "force-dynamic";

const STATUS_COLOUR: Record<string, string> = {
  "not-started":  "#3a4455",
  "build-intent": "#b45309",
  "in-progress":  "#7c3aed",
  "built":        "#0284c7",
  "approved":     "#059669",
};

const ACCENT = "#059669";   // maths green

interface Concept {
  name: string;
  status: string;
}

interface Topic {
  id: string;
  name: string;
  level: string;
  game_slug?: string;
  topic_id?: string;
  concepts: Concept[];
  created_at: string;
}

function topicProgress(concepts: Concept[]): number {
  if (!concepts.length) return 0;
  const weights: Record<string, number> = {
    "not-started": 0, "build-intent": 0.2, "in-progress": 0.5, "built": 0.8, "approved": 1,
  };
  return Math.round(
    concepts.reduce((s, c) => s + (weights[c.status] ?? 0), 0) / concepts.length * 100
  );
}

export default async function MathsPage() {
  const { data, error } = await supabaseServer()
    .from("maths_topic")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div style={{ padding: 40, color: "#f87171", fontFamily: "monospace", fontSize: "0.85rem" }}>
        <strong>Database error:</strong> {error.message}
        <br /><br />
        Run this migration first:
        <pre style={{ background: "#0d1520", padding: 16, borderRadius: 8, color: "#94a3b8" }}>{`
create table maths_topic (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  level         text,
  game_slug     text,
  topic_id      text,
  curricula     text[] default '{}',
  concepts      jsonb default '[]',
  misconceptions jsonb default '[]',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
        `.trim()}</pre>
      </div>
    );
  }

  const topics = (data ?? []) as Topic[];
  const totalConcepts = topics.reduce((s, t) => s + (t.concepts?.length ?? 0), 0);
  const builtConcepts = topics.reduce((s, t) =>
    s + (t.concepts ?? []).filter(c => c.status === "built" || c.status === "approved").length, 0);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>📐 Maths Content</h1>
          <p className={styles.sub}>
            {topics.length} topic{topics.length !== 1 ? "s" : ""} · {totalConcepts} concepts · {builtConcepts} built
            <span style={{ marginLeft: 12, color: "rgba(255,255,255,0.3)", fontSize: "0.75rem" }}>
              Stepwise Solver Engine · Ms. Chidera
            </span>
          </p>
        </div>
        <Link href="/admin/maths/new" className={styles.btnPrimary}>+ New Topic</Link>
      </div>

      {topics.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📐</div>
          <div className={styles.emptyTitle}>No maths topics yet</div>
          <div className={styles.emptySub}>
            Create a topic to get a concept map. Then develop each concept
            one by one — each generates Guided, Practice, and Challenge questions
            ready to upload to the Stepwise Solver Engine.
          </div>
          <Link href="/admin/maths/new" className={styles.btnPrimary}>+ New Topic</Link>
        </div>
      ) : (
        <div className={styles.topicGrid} style={{ marginTop: 24 }}>
          {topics.map(topic => {
            const concepts = topic.concepts ?? [];
            const pct = topicProgress(concepts);
            const builtCount = concepts.filter(c => c.status === "built" || c.status === "approved").length;
            return (
              <Link
                key={topic.id}
                href={`/admin/maths/${topic.id}`}
                className={styles.topicCard}
                style={{ "--accent": ACCENT } as React.CSSProperties}
              >
                <div className={styles.topicCardBar} style={{ background: ACCENT }} />
                <div className={styles.topicCardBody}>
                  <div className={styles.topicName}>{topic.name}</div>
                  <div className={styles.topicLevel}>{topic.level}</div>
                  {topic.game_slug && (
                    <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.25)", marginTop: 2, fontFamily: "monospace" }}>
                      {topic.game_slug}
                    </div>
                  )}
                  <div className={styles.topicStats}>
                    <span>{concepts.length} concepts</span>
                    <span className={styles.dot}>·</span>
                    <span style={{ color: builtCount > 0 ? "#059669" : "var(--text-3)" }}>{builtCount} built</span>
                  </div>
                  {concepts.length > 0 && (
                    <div className={styles.progressWrap}>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${pct}%`, background: ACCENT }} />
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
          <Link href="/admin/maths/new" className={styles.addCard}
            style={{ "--accent": ACCENT } as React.CSSProperties}>
            <div className={styles.addIcon}>+</div>
            <div className={styles.addLabel}>New maths topic</div>
          </Link>
        </div>
      )}
    </div>
  );
}