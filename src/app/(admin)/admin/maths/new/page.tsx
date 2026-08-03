"use client";
// FILE: src/app/(admin)/admin/maths/new/page.tsx

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../content/new/new-topic.module.css";   // reuse styles

const LEVELS = [
  "Year 7","Year 8","Year 9","JSS1","JSS2","JSS3",
  "Year 10","Year 11","SS1","SS2","SS3",
  "GCSE Year 9","GCSE Year 10","GCSE Year 11","A-Level Year 1","A-Level Year 2",
];
const CURRICULA = ["WAEC","JAMB","NECO","IGCSE","GCSE","Common Core","AP"];

function buildConceptMapPrompt(
  topicName: string,
  level: string,
  curricula: string[],
  gameSlug: string,
  curriculumContent: string,
): string {
  return `You are a senior mathematics curriculum expert for EXL Learning World.

EXL serves secondary school students across Nigerian (WAEC, JAMB, NECO),
British (IGCSE, GCSE), and American (Common Core, AP) curricula.

The interactive engine for all maths content is the Stepwise Solver Engine.
Students pick the correct operation at each step, then fill in the arithmetic.
Ms. Chidera is the maths coach — warm, precise, speaks in short algebraic sentences.

TOPIC: ${topicName}
LEVEL: ${level}
CURRICULA: ${curricula.join(", ")}
GAME SLUG: ${gameSlug || "[to be assigned]"}

${curriculumContent ? `CURRICULUM CONTENT:\n${curriculumContent}\n` : ""}
---

Produce a complete concept map for this topic.
Respond ONLY with valid JSON. No preamble. No markdown fences.

{
  "topicName": "${topicName}",
  "level": "${level}",
  "curricula": ${JSON.stringify(curricula)},
  "gameSlug": "${gameSlug || ""}",
  "topicId": "${topicName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}",
  "concepts": [
    {
      "name": "short concept name — e.g. One-step equations (addition)",
      "simplestTrueStatement": "one sentence — the concept at its irreducible true form",
      "whyItMatters": "one sentence — what this enables next or why it is useful",
      "stage": "Guided Learning",
      "misconception": "the single most dangerous wrong belief a student holds about this concept",
      "realWorldAnchor": "one specific real-world example a teenager in Nigeria or the UK would know immediately",
      "typicalQuestion": "one example question that this concept covers — written exactly as it would appear to a student",
      "operationsNeeded": ["add", "subtract"],
      "difficultyNotes": "one sentence — what makes this concept hard for students"
    }
  ],
  "misconceptions": [
    {
      "belief": "exactly what the student believes",
      "whyTheyBelieve": "the cognitive reason this forms — not 'students often think'",
      "correction": "the precise correct understanding",
      "stage": "Guided Learning"
    }
  ],
  "mergedObjectives": {
    "foundational": ["The student can ..."],
    "intermediate": ["The student can ..."],
    "advanced": ["The student can ..."]
  }
}

Rules:
- Sequence concepts in learning order — what must be understood before the next makes sense
- stage must be one of: "Guided Learning", "Practice", "Challenge", "Mastery"
- Guided Learning concepts: those needing Ms. Chidera to walk through every step
- Practice concepts: those where the student can attempt independently with nudges
- operationsNeeded: use only these strings: add, subtract, multiply, divide, sqrt, square, rewrite, substitute, solve
- typicalQuestion: write it exactly as it appears to the student — no placeholders
- Keep it complete — every concept the student needs for this topic, in order
- Output JSON only. Nothing else.`;
}

export default function NewMathsTopicPage() {
  const router = useRouter();

  const [topicName, setTopicName]       = useState("");
  const [level, setLevel]               = useState("SS1");
  const [curricula, setCurricula]       = useState<string[]>(["WAEC", "JAMB", "IGCSE"]);
  const [gameSlug, setGameSlug]         = useState("");
  const [curriculumContent, setCurriculumContent] = useState("");
  const [step, setStep]                 = useState<"setup" | "paste">("setup");
  const [copied, setCopied]             = useState(false);
  const [jsonInput, setJsonInput]       = useState("");
  const [jsonError, setJsonError]       = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);

  const canGenerate = topicName.trim().length > 2;
  const prompt = buildConceptMapPrompt(topicName, level, curricula, gameSlug, curriculumContent);

  const toggleCurriculum = (c: string) =>
    setCurricula(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

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
      setJsonError("Invalid JSON — check you pasted Claude's complete response.");
      return;
    }

    if (!parsed.concepts || !Array.isArray(parsed.concepts)) {
      setJsonError('JSON must have a "concepts" array.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/maths-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:           (parsed.topicName as string) || topicName,
          level:          (parsed.level as string) || level,
          game_slug:      (parsed.gameSlug as string) || gameSlug,
          topic_id:       (parsed.topicId as string) || topicName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          curricula:      (parsed.curricula as string[]) || curricula,
          concepts:       (parsed.concepts as Array<Record<string, unknown>>).map(c => ({
            name:                  c.name,
            stage:                 c.stage,
            status:                "build-intent",
            simplestTrueStatement: c.simplestTrueStatement,
            misconception:         c.misconception,
            realWorldAnchor:       c.realWorldAnchor,
            typicalQuestion:       c.typicalQuestion,
            operationsNeeded:      c.operationsNeeded,
            difficultyNotes:       c.difficultyNotes,
          })),
          misconceptions: parsed.misconceptions ?? [],
          mergedObjectives: parsed.mergedObjectives ?? {},
        }),
      });

      const json = await res.json();
      if (!res.ok) { setJsonError(json.error ?? "Failed to save topic"); setSaving(false); return; }
      router.push(`/admin/maths/${json.topic.id}`);
    } catch (e) {
      setJsonError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <a href="/admin/maths" className={styles.breadcrumbLink}>📐 Maths</a>
        <span className={styles.sep}>/</span>
        <span>New Topic</span>
      </div>

      <div className={styles.heading}>
        <h1>New Maths Topic</h1>
        <p>Fill in the details, copy the prompt into Claude, then paste the concept map JSON back here.</p>
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
        {/* ── Left: form ── */}
        <div className={styles.formPanel}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Topic details</div>

            <label className={styles.field}>
              <span className={styles.label}>Topic name *</span>
              <input className={styles.input} value={topicName}
                onChange={e => setTopicName(e.target.value)}
                placeholder="e.g. Change of Subject of Formulae" />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Game slug</span>
              <input className={styles.input} value={gameSlug}
                onChange={e => setGameSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                placeholder="e.g. change-of-subject"
                style={{ fontFamily: "monospace" }} />
              <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                Used as the URL slug for the game. Lowercase, hyphens only.
              </span>
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
                    style={curricula.includes(c) ? { borderColor: "#059669", color: "#059669", background: "#05966912" } : {}}
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
              Paste syllabus objectives, past paper topics, or textbook headings.
              Leave empty and Claude uses its own knowledge.
            </p>
            <textarea className={styles.textarea} value={curriculumContent}
              onChange={e => setCurriculumContent(e.target.value)}
              placeholder="e.g. WAEC objectives for this topic, IGCSE chapter headings…"
              rows={8} />
          </div>
        </div>

        {/* ── Right: prompt + paste ── */}
        <div className={styles.promptPanel}>
          <div className={styles.promptCard}>
            <div className={styles.promptCardHeader}>
              <div>
                <div className={styles.promptStep} style={{ color: "#059669" }}>Step 2</div>
                <div className={styles.promptTitle}>Copy this prompt → paste into Claude</div>
                <div className={styles.promptDesc}>
                  {canGenerate
                    ? `Generates the concept map for "${topicName}" — concepts, misconceptions, objectives.`
                    : "Fill in the topic name to generate a targeted prompt."}
                </div>
              </div>
              <button className={styles.copyBtn}
                style={copied ? { borderColor: "#059669", color: "#059669" } : {}}
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