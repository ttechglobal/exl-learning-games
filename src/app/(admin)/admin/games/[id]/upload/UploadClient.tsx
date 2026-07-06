"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./upload.module.css";

// ── types ─────────────────────────────────────────────────────────────────────

type UploadMode = "create" | "patch";

interface ParsedGame {
  slug: string;
  title: string;
  subject: string;
  engineType?: string;
  missions?: Array<{ missionKey: string; title: string; difficulty: string; xpReward: number; payload: Record<string, unknown> }>;
  accent_colour?: string;
  card_description?: string;
  pre_game_gradient?: string;
}

interface ValidationResult {
  ok: boolean;
  mode: UploadMode;
  game?: ParsedGame;
  existingSlug?: string;
  errors: string[];
  warnings: string[];
  missionCount: number;
}

const DIFF_COLOUR: Record<string, string> = { EASY: "#22c55e", MEDIUM: "#f59e0b", HARD: "#ef4444" };
const SUBJECT_META: Record<string, { colour: string; emoji: string }> = {
  mathematics: { colour: "#3ecf8e", emoji: "📐" },
  chemistry:   { colour: "#00d4ff", emoji: "⚗️" },
  physics:     { colour: "#4488ff", emoji: "⚡" },
  biology:     { colour: "#7ecf3e", emoji: "🧬" },
};

function validate(raw: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let parsed: Record<string, unknown>;

  try { parsed = JSON.parse(raw); }
  catch (e) { return { ok: false, mode: "create", errors: [`Invalid JSON: ${(e as Error).message}`], warnings: [], missionCount: 0 }; }

  // Detect patch vs create
  const hasMissionsOnly = !parsed.title && !parsed.engineType && Array.isArray(parsed.missions);
  const hasSlug = Boolean(parsed.slug);
  const mode: UploadMode = hasMissionsOnly && hasSlug ? "patch" : "create";

  if (!parsed.slug) errors.push("Missing: slug");

  const missions = Array.isArray(parsed.missions) ? parsed.missions as Record<string, unknown>[] : [];

  if (mode === "create") {
    if (!parsed.title)      errors.push("Missing: title");
    if (!parsed.engineType) errors.push("Missing: engineType");
    if (!parsed.subject)    errors.push("Missing: subject");
    if (!parsed.topicId)    errors.push("Missing: topicId");
    if (!parsed.sharedConfig && !parsed.shared_config) warnings.push("No sharedConfig — engine defaults will be used");
    if (missions.length === 0) warnings.push("No missions — you can add them later via a patch upload");
  }

  if (mode === "patch" && missions.length === 0) {
    errors.push("Patch mode detected but no missions found. Include a missions[] array with new content.");
  }

  missions.forEach((m, i) => {
    if (!m.missionKey) errors.push(`Mission ${i + 1}: missing missionKey`);
    if (!m.title)      errors.push(`Mission ${i + 1}: missing title`);
    if (!m.difficulty) errors.push(`Mission ${i + 1}: missing difficulty`);
    if (!m.payload)    errors.push(`Mission ${i + 1}: missing payload`);
  });

  return {
    ok: errors.length === 0,
    mode,
    game: parsed as unknown as ParsedGame,
    errors,
    warnings,
    missionCount: missions.length,
  };
}

// ── component ─────────────────────────────────────────────────────────────────

export default function UploadClient({ existingGames }: { existingGames: Array<{ id: string; slug: string; title: string }> }) {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback((value: string) => {
    setRaw(value);
    setUploadError(null);
    setUploadResult(null);
    if (value.trim().length < 5) { setValidation(null); return; }
    setValidation(validate(value));
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { const t = ev.target?.result as string; setRaw(t); handleChange(t); };
    reader.readAsText(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { const t = ev.target?.result as string; setRaw(t); handleChange(t); };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!validation?.ok || !validation.game) return;
    setUploading(true); setUploadError(null); setUploadResult(null);

    try {
      if (validation.mode === "patch") {
        // Find game by slug
        const existing = existingGames.find(g => g.slug === validation.game!.slug);
        if (!existing) {
          setUploadError(`No game found with slug "${validation.game.slug}". Use a full game JSON to create it first.`);
          setUploading(false); return;
        }
        const res = await fetch(`/api/games/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: raw,
        });
        const json = await res.json();
        if (!res.ok) { setUploadError(json.error); setUploading(false); return; }
        setUploadResult(`✓ Added ${json.missionsAdded} mission${json.missionsAdded !== 1 ? "s" : ""} to "${existing.title}".${json.missionsSkipped > 0 ? ` ${json.missionsSkipped} already existed — skipped.` : ""}`);
        setTimeout(() => router.push(`/admin/games/${existing.id}/missions`), 1500);
      } else {
        const res = await fetch("/api/games", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: raw,
        });
        const json = await res.json();
        if (!res.ok) { setUploadError(json.error); setUploading(false); return; }
        router.push(`/admin/games/${json.game.id}/missions`);
      }
    } catch (e) {
      setUploadError((e as Error).message);
      setUploading(false);
    }
  };

  const g = validation?.game;
  const subjectMeta = g?.subject ? (SUBJECT_META[g.subject] ?? { colour: "#64748b", emoji: "📖" }) : null;
  const accent = g?.accent_colour ?? subjectMeta?.colour ?? "#64748b";
  const byDiff = g?.missions?.reduce((acc: Record<string, number>, m) => {
    acc[m.difficulty] = (acc[m.difficulty] ?? 0) + 1; return acc;
  }, {}) ?? {};

  const isPatch = validation?.mode === "patch";
  const existingForPatch = isPatch ? existingGames.find(eg => eg.slug === g?.slug) : null;

  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <div>
          <div className={styles.breadcrumb}>
            <a href="/admin/games" className={styles.breadcrumbLink}>Games</a>
            <span className={styles.breadcrumbSep}>/</span>
            <span>Upload</span>
          </div>
          <h1 className={styles.heading}>Upload Game JSON</h1>
          <p className={styles.sub}>
            Drop a full game JSON to <strong>create a new game</strong>, or a missions-only JSON to <strong>add content to an existing game</strong>.
          </p>
        </div>
      </div>

      {/* Mode tip */}
      <div className={styles.modeTips}>
        <div className={styles.modeTip}>
          <div className={styles.modeTipIcon}>+</div>
          <div>
            <div className={styles.modeTipTitle}>Create game</div>
            <div className={styles.modeTipSub}>Full JSON with <code>slug</code>, <code>title</code>, <code>engineType</code>, <code>subject</code>, <code>missions[]</code></div>
          </div>
        </div>
        <div className={styles.modeTipDivider}/>
        <div className={styles.modeTip}>
          <div className={styles.modeTipIcon}>↑</div>
          <div>
            <div className={styles.modeTipTitle}>Add missions to existing game</div>
            <div className={styles.modeTipSub}>Patch JSON with just <code>slug</code> + <code>missions[]</code> — no other fields needed</div>
          </div>
        </div>
      </div>

      <div className={styles.workspace}>

        {/* Editor */}
        <div className={styles.editorPanel}>
          <div className={styles.editorHeader}>
            <div className={styles.editorModeTag}>
              {!validation ? (
                <span className={styles.modeTagNeutral}>Waiting for JSON…</span>
              ) : isPatch ? (
                <span className={styles.modeTagPatch}>📦 Patch mode — adding to existing game</span>
              ) : (
                <span className={styles.modeTagCreate}>✦ Create mode — new game</span>
              )}
            </div>
            <label className={styles.fileBtn}>
              Browse file
              <input ref={fileRef} type="file" accept=".json" onChange={handleFileInput} style={{ display: "none" }}/>
            </label>
          </div>

          <div
            className={`${styles.dropZone} ${dragging ? styles.dragging : ""} ${validation?.ok ? styles.valid : validation && !validation.ok ? styles.error : ""}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            {!raw && (
              <div className={styles.dropPrompt}>
                <div className={styles.dropIcon}>{ "{  }" }</div>
                <div className={styles.dropTitle}>Drop JSON file or paste below</div>
              </div>
            )}
            <textarea
              className={styles.editor}
              value={raw}
              onChange={e => handleChange(e.target.value)}
              placeholder={`// NEW GAME:\n{\n  "slug": "nova-explorer",\n  "title": "Nova the Explorer",\n  "engineType": "formula-excavation",\n  "subject": "mathematics",\n  "topicId": "change-of-subject",\n  "sharedConfig": {},\n  "snapshot": { "cards": [] },\n  "missions": [...]\n}\n\n// OR PATCH (add missions to existing game):\n{\n  "slug": "nova-explorer",\n  "missions": [...]\n}`}
              spellCheck={false}
            />
          </div>

          {/* Validation */}
          {validation && (
            <div className={styles.validationBox}>
              {validation.errors.map((e, i) => (
                <div key={i} className={styles.valError}><span>✕</span> {e}</div>
              ))}
              {validation.warnings.map((w, i) => (
                <div key={i} className={styles.valWarn}><span>⚠</span> {w}</div>
              ))}
              {validation.ok && validation.errors.length === 0 && (
                <div className={styles.valOk}><span>✓</span> Valid JSON — ready to upload</div>
              )}
            </div>
          )}
        </div>

        {/* Preview + action */}
        <div className={styles.previewPanel}>
          {g ? (
            <div className={styles.previewCard}>
              {/* Mode header */}
              <div className={styles.previewMode} style={{ background: isPatch ? "rgba(59,130,246,0.12)" : "rgba(124,58,237,0.12)", borderColor: isPatch ? "#1e40af" : "#5b21b6" }}>
                {isPatch ? (
                  existingForPatch ? (
                    <div>
                      <div className={styles.previewModeTitle}>Adding to: {existingForPatch.title}</div>
                      <div className={styles.previewModeSub}>{validation?.missionCount} new mission{validation?.missionCount !== 1 ? "s" : ""} will be added. Duplicates skipped.</div>
                    </div>
                  ) : (
                    <div className={styles.previewModeSub} style={{ color: "#fca5a5" }}>
                      No game found with slug "{g.slug}". Create it first.
                    </div>
                  )
                ) : (
                  <div>
                    <div className={styles.previewModeTitle}>New game: {g.title || "Untitled"}</div>
                    <div className={styles.previewModeSub}>{g.subject} · {validation?.missionCount} missions</div>
                  </div>
                )}
              </div>

              {!isPatch && (
                <>
                  <div className={styles.previewCardBar} style={{ background: accent }}/>
                  <div className={styles.previewInner}>
                    <div className={styles.previewTop}>
                      <div>
                        <div className={styles.previewTitle}>{g.title}</div>
                        <div className={styles.previewSlug}>{g.slug}</div>
                      </div>
                      {g.card_art_url && (
                        <img src={g.card_art_url} alt="" className={styles.previewArt}
                          onError={e => (e.currentTarget.style.display = "none")}/>
                      )}
                    </div>
                    {g.card_description && <p className={styles.previewDesc}>{g.card_description}</p>}
                    {g.pre_game_gradient && (
                      <div className={styles.gradientBar} style={{ background: g.pre_game_gradient }}>
                        <span className={styles.gradientLabel}>Pre-game gradient</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Mission list */}
              {validation && validation.missionCount > 0 && (
                <div className={styles.missionPreview}>
                  <div className={styles.missionPreviewHeader}>
                    <span>{validation.missionCount} Mission{validation.missionCount !== 1 ? "s" : ""}</span>
                    <div className={styles.diffPills}>
                      {Object.entries(byDiff).map(([d, c]) => (
                        <span key={d} className={styles.diffPill} style={{ color: DIFF_COLOUR[d] ?? "#64748b" }}>
                          {c} {d[0]}
                        </span>
                      ))}
                    </div>
                  </div>
                  {g.missions?.slice(0, 10).map((m, i) => (
                    <div key={i} className={styles.missionRow}>
                      <div className={styles.missionN}>{i + 1}</div>
                      <div className={styles.missionT}>{m.title}</div>
                      <div className={styles.missionD} style={{ color: DIFF_COLOUR[m.difficulty] ?? "#64748b" }}>
                        {m.difficulty[0]}
                      </div>
                    </div>
                  ))}
                  {validation.missionCount > 10 && (
                    <div className={styles.missionMore}>+{validation.missionCount - 10} more</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.previewEmpty}>
              <div className={styles.previewEmptyIcon}>◈</div>
              <div className={styles.previewEmptyText}>Preview appears here once you paste valid JSON</div>
            </div>
          )}

          {uploadError && <div className={styles.uploadError}>{uploadError}</div>}
          {uploadResult && <div className={styles.uploadSuccess}>{uploadResult}</div>}

          <button
            className={`${styles.uploadBtn} ${validation?.ok ? styles.uploadBtnActive : ""}`}
            onClick={handleUpload}
            disabled={!validation?.ok || uploading}
          >
            {uploading ? "Uploading…" :
              !validation?.ok ? "Fix errors to upload" :
              isPatch ? `↑ Add ${validation.missionCount} Mission${validation.missionCount !== 1 ? "s" : ""}` :
              `↑ Create Game + ${validation.missionCount} Mission${validation.missionCount !== 1 ? "s" : ""}`
            }
          </button>

          {validation?.ok && (
            <p className={styles.uploadNote}>
              {isPatch
                ? "Existing missions with matching keys will be skipped. New missions are added to the end of the sequence."
                : "Game and all missions are created immediately. You can edit anything after upload."
              }
            </p>
          )}
        </div>
      </div>

      {/* Prompt templates */}
      <div className={styles.promptSection}>
        <div className={styles.promptTitle}>Prompt Templates</div>
        <div className={styles.promptSub}>Copy these prompts — first to ChatGPT to generate content, then paste the result to Claude to build the full game.</div>
        <div className={styles.promptGrid}>
          <PromptCard
            label="Step 1 — ChatGPT"
            title="Generate Game Content"
            colour="#10b981"
            prompt={`You are a curriculum designer for an educational game platform called EXL Games. I need you to design a complete game for [SUBJECT] students on the topic of [TOPIC].

Generate the following:

1. GAME IDENTITY
- Title (creative, memorable — think "Nova the Explorer" or "Mirror Lab")
- One-sentence description for the game shelf
- World concept (what's the fictional setting? e.g. "jungle temple ruins", "detective office", "particle reactor")
- Accent colour (hex) that fits the world
- Mission briefing (2-3 sentence flavor paragraph Nova-style)

2. QUICK CONCEPT CARDS (4 cards, each with a title + 2-3 sentence body)
These should cover the core concepts a student needs before playing.

3. MISSIONS (aim for 12-15 missions, progressing from EASY → MEDIUM → HARD)
For each mission provide:
- missionKey (slug format, e.g. "w1-001")
- title (e.g. "World 1 · Formula 1 — The First Ruin")
- difficulty: EASY / MEDIUM / HARD
- xpReward: 20 (EASY) / 40 (MEDIUM) / 75 (HARD)
- learningGoal (one sentence)
- The specific content for the payload (formula, question, or problem)
- 3 hint levels (vague → specific → near-answer)

Format the output as a clean JSON object I can use directly.`}
          />
          <PromptCard
            label="Step 2 — Claude"
            title="Build the Full Game"
            colour="#7c3aed"
            prompt={`I have game content from ChatGPT. Build me the complete EXL game JSON for this content.

ENGINE: formula-excavation (for change-of-subject) OR [specify engine]
SUBJECT: [mathematics / chemistry / physics / biology]

Here is the content:
[PASTE CHATGPT OUTPUT HERE]

Build the complete game JSON with:
1. Full game record (slug, title, engineType, subject, topicId, progressionMode: "trackMap")
2. sharedConfig with the formula-excavation tiers (easy/medium/hard)
3. snapshot.cards from the quick concept cards
4. All missions with properly structured payload.excavationSteps
5. Theme fields: accent_colour, pre_game_gradient, game_gradient, card_description, mission_briefing
6. A hand-coded card SVG (280×200) matching the world concept
7. A flat SVG background illustration for the game world

Output the complete JSON ready to paste into /admin/games/upload.`}
          />
          <PromptCard
            label="Patch — Claude"
            title="Add More Missions"
            colour="#f59e0b"
            prompt={`Add [N] more missions to the game with slug "[GAME_SLUG]".

These should extend from the existing content, increasing in difficulty.
The new missions should cover: [DESCRIBE TOPICS OR CONCEPTS]

Output a PATCH JSON in this exact format:
{
  "slug": "[GAME_SLUG]",
  "missions": [
    ... new missions only, with correct missionKeys, sequenceIndexes continuing from where the game left off
  ]
}

Do NOT include the full game record — only slug + missions[]. I will upload this as a patch to add the missions to the existing game.`}
          />
        </div>
      </div>
    </div>
  );
}

function PromptCard({ label, title, colour, prompt }: { label: string; title: string; colour: string; prompt: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className={styles.promptCard}>
      <div className={styles.promptCardBar} style={{ background: colour }}/>
      <div className={styles.promptCardInner}>
        <div className={styles.promptCardHeader}>
          <span className={styles.promptLabel} style={{ color: colour }}>{label}</span>
          <button onClick={copy} className={styles.copyBtn} style={{ borderColor: copied ? colour : undefined, color: copied ? colour : undefined }}>
            {copied ? "✓ Copied" : "Copy prompt"}
          </button>
        </div>
        <div className={styles.promptCardTitle}>{title}</div>
        <pre className={styles.promptPreview}>{prompt.slice(0, 180)}…</pre>
      </div>
    </div>
  );
}
