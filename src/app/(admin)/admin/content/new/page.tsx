// FILE: src/app/(admin)/admin/content/new/page.tsx
"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./new-topic.module.css";

const SUBJECTS = ["chemistry", "physics", "mathematics", "biology"] as const;
type Subject = typeof SUBJECTS[number];

const SUBJECT_META: Record<Subject, { label: string; emoji: string; colour: string; style: string }> = {
  chemistry:   { label: "Chemistry",   emoji: "⚗️",  colour: "#0284c7", style: "Guided Learning = interactive concept explanation. Guided Practice = method walkthrough for calculations. Practice = independent question solving." },
  physics:     { label: "Physics",     emoji: "⚡",  colour: "#7c3aed", style: "Guided Learning = interactive concept with variable manipulation. Guided Practice = physics calculation method. Practice = independent problem solving." },
  mathematics: { label: "Mathematics", emoji: "📐", colour: "#059669", style: "No Guided Practice. Guided Learning = worked examples stepwise. Practice = independent solving via Math Canvas." },
  biology:     { label: "Biology",     emoji: "🧬", colour: "#b45309", style: "Style TBD." },
};

const LEVELS = ["JSS1","JSS2","JSS3","SS1","SS2","SS3","GCSE Year 9","GCSE Year 10","GCSE Year 11","A-Level Year 1"];
const CURRICULA = ["WAEC","JAMB","NECO","IGCSE","GCSE","AP"];

function buildContentMapPrompt(subject: string, topicName: string, level: string, curricula: string[], curriculumContent: string): string {
  const meta = SUBJECT_META[subject as Subject];
  return `You are a senior curriculum expert and learning designer for EXL Learning World.

SUBJECT: ${subject.charAt(0).toUpperCase() + subject.slice(1)}
TOPIC: ${topicName}
LEVEL: ${level}
CURRICULA: ${curricula.join(", ")}
SUBJECT STYLE: ${meta?.style ?? ""}

CURRICULUM CONTENT:
${curriculumContent || "[Use your knowledge of the curricula listed above]"}

---

Produce a complete content map. Respond ONLY with valid JSON. No preamble, no markdown fences.

{
  "topicName": "${topicName}",
  "subject": "${subject}",
  "level": "${level}",
  "curricula": ${JSON.stringify(curricula)},
  "concepts": [
    {
      "name": "short concept name",
      "simplestTrueStatement": "one sentence — the concept at its smallest true form",
      "whyItMatters": "one sentence connecting to real life or what it enables next",
      "stage": "Guided Learning",
      "buildIntent": {
        "whatStudentDoes": "what the student physically does — verb first, specific",
        "whatSystemShows": "what the system shows happening as a result",
        "coachOpeningLine": "coach first words — narrative not academic, answers why am I here",
        "successLooks": "one sentence — how you know the student understood"
      },
      "misconception": "the single most dangerous wrong belief students hold about this concept",
      "realWorldAnchor": "one specific real-world example a Nigerian or UK teenager would recognise"
    }
  ],
  "misconceptions": [
    {
      "belief": "exactly what the student believes",
      "whyTheyBelieve": "the cognitive reason this forms",
      "correction": "the precise correct understanding",
      "stage": "Guided Learning",
      "howInteractionConfrontsIt": "what the student does or sees that makes this wrong belief collapse"
    }
  ],
  "mergedObjectives": {
    "foundational": ["The student can ..."],
    "intermediate": ["The student can ..."],
    "advanced": ["The student can ..."]
  }
}

Rules:
- Sequence concepts in learning order
- stage must be one of: "Guided Learning", "Guided Practice", "Practice", "Challenge", "Mastery"
- ${subject === "mathematics" ? "Mathematics: no Guided Practice. Use Guided Learning for worked examples." : "Use Guided Practice only where there are calculation question types needing method walkthrough."}
- buildIntent must be specific enough to build from
- coachOpeningLine must be narrative first — never start with an academic phrase
- Output the JSON object and nothing else`;
}

function NewTopicForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultSubject = searchParams.get("subject") as Subject | null;

  const [subject, setSubject]         = useState<Subject>(defaultSubject ?? "chemistry");
  const [topicName, setTopicName]     = useState("");
  const [level, setLevel]             = useState("SS1");
  const [curricula, setCurricula]     = useState<string[]>(["WAEC", "JAMB", "IGCSE"]);
  const [curriculumContent, setCurriculumContent] = useState("");
  const [copied, setCopied]           = useState(false);
  const [jsonInput, setJsonInput]     = useState("");
  const [jsonError, setJsonError]     = useState<string | null>(null);
  const [saving, setSaving]           = useState(false);
  const [step, setStep]               = useState<"setup" | "paste">("setup");

  const toggleCurriculum = (c: string) =>
    setCurricula(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const prompt = buildContentMapPrompt(subject, topicName, level, curricula, curriculumContent);
  const canGenerate = topicName.trim().length > 2;

  const copyPrompt = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setStep("paste");
  };

  const handleSave = async () => {
    if (!jsonInput.trim()) { setJsonError("Paste the JSON from Claude first."); return; }
    setJsonError(null);

    let parsed: Record<string, unknown>;
    try {
      const clean = jsonInput.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
      parsed = JSON.parse(clean);
    } catch {
      setJsonError("Invalid JSON — check that you pasted Claude's complete response.");
      return;
    }

    if (!parsed.concepts || !Array.isArray(parsed.concepts)) {
      setJsonError('JSON must have a "concepts" array.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/content-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          name: (parsed.topicName as string) || topicName,
          level: (parsed.level as string) || level,
          curricula: (parsed.curricula as string[]) || curricula,
          concepts: (parsed.concepts as Array<Record<string, unknown>>).map(c => ({
            name: c.name,
            stage: c.stage,
            status: "build-intent",
            buildIntent: c.buildIntent,
            simplestTrueStatement: c.simplestTrueStatement,
            misconception: c.misconception,
            realWorldAnchor: c.realWorldAnchor,
          })),
          misconceptions: parsed.misconceptions ?? [],
          mergedObjectives: parsed.mergedObjectives ?? {},
        }),
      });

      const json = await res.json();
      if (!res.ok) { setJsonError(json.error ?? "Failed to save topic"); setSaving(false); return; }
      router.push(`/admin/content/${json.topic.id}`);
    } catch (e) {
      setJsonError((e as Error).message);
      setSaving(false);
    }
  };

  const meta = SUBJECT_META[subject];

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <a href="/admin/content" className={styles.breadcrumbLink}>Content</a>
        <span className={styles.sep}>/</span>
        <span>New Topic</span>
      </div>

      <div className={styles.heading}>
        <h1>New Topic</h1>
        <p>Fill in the details, copy the prompt, paste it into Claude, then paste the JSON back here.</p>
      </div>

      <div className={styles.steps}>
        {["Fill details", "Copy prompt → Claude", "Paste JSON back"].map((s, i) => (
          <div key={i} className={styles.step} data-active={
            (i === 0 && step === "setup") || (i >= 1 && step === "paste") ? "true" : "false"
          }>
            <div className={styles.stepNum}>{i + 1}</div>
            <div className={styles.stepLabel}>{s}</div>
            {i < 2 && <div className={styles.stepArrow}>→</div>}
          </div>
        ))}
      </div>

      <div className={styles.layout}>
        <div className={styles.formPanel}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Topic details</div>
            <div className={styles.subjectGrid}>
              {SUBJECTS.map(s => (
                <button key={s} type="button" className={styles.subjectBtn}
                  data-active={subject === s}
                  style={subject === s ? { borderColor: SUBJECT_META[s].colour, background: `${SUBJECT_META[s].colour}14` } : {}}
                  onClick={() => setSubject(s)}>
                  <span>{SUBJECT_META[s].emoji}</span>
                  <span>{SUBJECT_META[s].label}</span>
                </button>
              ))}
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Topic name *</span>
              <input className={styles.input} value={topicName} onChange={e => setTopicName(e.target.value)}
                placeholder="e.g. States of Matter and Changes of State" />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Level</span>
              <select className={styles.select} value={level} onChange={e => setLevel(e.target.value)}>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>

            <div className={styles.field}>
              <span className={styles.label}>Curricula</span>
              <div className={styles.chipRow}>
                {CURRICULA.map(c => (
                  <button key={c} type="button" className={styles.chip}
                    data-active={curricula.includes(c)}
                    style={curricula.includes(c) ? { borderColor: meta.colour, color: meta.colour, background: `${meta.colour}12` } : {}}
                    onClick={() => toggleCurriculum(c)}>{c}</button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              Curriculum content <span className={styles.optional}>optional</span>
            </div>
            <p className={styles.hint}>
              Paste syllabus content from WAEC, IGCSE, or JAMB. Leave empty and Claude uses its own knowledge.
            </p>
            <textarea className={styles.textarea} value={curriculumContent}
              onChange={e => setCurriculumContent(e.target.value)}
              placeholder="Paste curriculum content here — syllabus objectives, past paper topics, textbook chapter headings…"
              rows={8} />
          </div>
        </div>

        <div className={styles.promptPanel}>
          <div className={styles.promptCard}>
            <div className={styles.promptCardHeader}>
              <div>
                <div className={styles.promptStep} style={{ color: meta.colour }}>Step 2</div>
                <div className={styles.promptTitle}>Copy this prompt → paste into Claude</div>
                <div className={styles.promptDesc}>
                  {canGenerate
                    ? `Generates the concept map for "${topicName}" with build intents and misconceptions.`
                    : "Fill in the topic name to generate a targeted prompt."}
                </div>
              </div>
              <button className={styles.copyBtn}
                style={copied ? { borderColor: meta.colour, color: meta.colour } : {}}
                onClick={copyPrompt} disabled={!canGenerate}>
                {copied ? "✓ Copied" : "Copy prompt"}
              </button>
            </div>
            <pre className={styles.promptPreview}>
              {canGenerate ? prompt.slice(0, 320) + "…" : "Fill in the topic name above."}
            </pre>
          </div>

          {step === "paste" && (
            <div className={styles.pasteCard}>
              <div className={styles.pasteHeader}>
                <div className={styles.promptStep} style={{ color: "#059669" }}>Step 3</div>
                <div className={styles.promptTitle}>Paste Claude's response here</div>
                <div className={styles.promptDesc}>
                  Paste Claude's complete JSON response. Surrounding text is stripped automatically.
                </div>
              </div>
              <textarea className={styles.jsonArea} value={jsonInput}
                onChange={e => { setJsonInput(e.target.value); setJsonError(null); }}
                placeholder="Paste Claude's JSON response here…" rows={12} />
              {jsonError && <div className={styles.error}>{jsonError}</div>}
              <button className={styles.saveBtn} onClick={handleSave}
                disabled={saving || !jsonInput.trim()}>
                {saving ? "Saving…" : "Save topic →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NewTopicPage() {
  return <Suspense><NewTopicForm /></Suspense>;
}