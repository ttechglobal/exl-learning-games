"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const SUBJECTS = ["mathematics", "chemistry", "physics", "biology"];
const YEAR_GROUPS = ["JSS1","JSS2","JSS3","SS1","SS2","SS3","WAEC Year","JAMB Year"];
const EXAM_BOARDS = ["WAEC","JAMB","NECO","IGCSE","Cambridge"];
const TERMS = ["First Term","Second Term","Third Term"];

const inp: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "#0a1018", border: "1px solid #1e2535",
  borderRadius: 8, padding: "9px 12px",
  color: "#e2e8f0", fontSize: "0.85rem",
  outline: "none", fontFamily: "inherit",
};

const sel: React.CSSProperties = { ...inp, cursor: "pointer" };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
        {label}
      </div>
      {children}
      {hint && <div style={{ fontSize: "0.7rem", color: "#334155", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function Section({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ borderBottom: "1px solid #0f1c2e", paddingBottom: 10, marginBottom: 20, marginTop: 28 }}>
      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#e2e8f0" }}>{title}</div>
      {sub && <div style={{ fontSize: "0.72rem", color: "#475569", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function MultiSelect({ options, selected, onChange }: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  };
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(o => (
        <button
          key={o}
          type="button"
          onClick={() => toggle(o)}
          style={{
            padding: "4px 12px", borderRadius: 20,
            border: `1.5px solid ${selected.includes(o) ? "#7c3aed" : "#1e2535"}`,
            background: selected.includes(o) ? "rgba(124,58,237,0.15)" : "transparent",
            color: selected.includes(o) ? "#a78bfa" : "#475569",
            fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
          }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export default function NewGamePage() {
  const router = useRouter();

  const [title, setTitle]           = useState("");
  const [slug, setSlug]             = useState("");
  const [subject, setSubject]       = useState("mathematics");
  const [topicId, setTopicId]       = useState("");
  const [engineType, setEngineType] = useState("mcq");
  const [accentColour, setAccentColour] = useState("");
  const [cardDesc, setCardDesc]     = useState("");
  const [cardArtUrl, setCardArtUrl] = useState("");
  const [preGradient, setPreGradient] = useState("");
  const [missionBriefing, setMissionBriefing] = useState("");
  const [yearGroups, setYearGroups] = useState<string[]>([]);
  const [examBoards, setExamBoards] = useState<string[]>([]);
  const [term, setTerm]             = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  // Auto-generate slug from title
  const handleTitleChange = (v: string) => {
    setTitle(v);
    if (!slug || slug === title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")) {
      setSlug(v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || !slug.trim() || !topicId.trim()) {
      setError("Title, slug, and topic ID are required.");
      return;
    }
    setSaving(true);
    setError(null);

    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        slug,
        subject,
        topicId,
        engineType,
        progressionMode: "linear",
        missions: [],
        sharedConfig: {},
        snapshot: { cards: [] },
        accent_colour:     accentColour     || null,
        card_description:  cardDesc         || null,
        card_art_url:      cardArtUrl       || null,
        pre_game_gradient: preGradient      || null,
        mission_briefing:  missionBriefing  || null,
        year_groups:       yearGroups,
        exam_boards:       examBoards,
        curriculum_term:   term             || null,
      }),
    });

    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error ?? "Failed to create game"); return; }
    router.push(`/admin/games/${json.game.id}/edit`);
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "36px 32px 80px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <Link href="/admin/games" style={{ color: "#475569", textDecoration: "none", fontSize: "0.8rem" }}>
          ← Games
        </Link>
        <span style={{ color: "#1e2535" }}>/</span>
        <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>New Game</span>
      </div>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#f1f5f9", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
          Create New Game
        </h1>
        <p style={{ fontSize: "0.8rem", color: "#475569", margin: 0 }}>
          Set up the game shell — you can add missions after saving.
        </p>
      </div>

      <div style={{ background: "#0d1520", border: "1px solid #0f1c2e", borderRadius: 12, padding: "24px 26px" }}>
        <Section title="Identity" sub="Core fields that identify this game" />

        <Field label="Title" hint="Shown to students on the game card">
          <input style={inp} value={title} onChange={e => handleTitleChange(e.target.value)} placeholder="e.g. Algebra Blitz" />
        </Field>

        <Field label="Slug" hint="URL-safe identifier — auto-generated from title">
          <input style={inp} value={slug} onChange={e => setSlug(e.target.value)} placeholder="e.g. algebra-blitz" />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Subject">
            <select style={sel} value={subject} onChange={e => setSubject(e.target.value)}>
              {SUBJECTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </Field>
          <Field label="Engine Type">
            <select style={sel} value={engineType} onChange={e => setEngineType(e.target.value)}>
              {["mcq","drag-drop","fill-in","match","sequence","change-of-subject"].map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Topic ID" hint="e.g. algebra-linear-equations">
          <input style={inp} value={topicId} onChange={e => setTopicId(e.target.value)} placeholder="topic-slug" />
        </Field>

        <Section title="Curriculum" sub="Year groups, exam boards, and term" />

        <Field label="Year Groups">
          <MultiSelect options={YEAR_GROUPS} selected={yearGroups} onChange={setYearGroups} />
        </Field>
        <Field label="Exam Boards">
          <MultiSelect options={EXAM_BOARDS} selected={examBoards} onChange={setExamBoards} />
        </Field>
        <Field label="Term">
          <select style={sel} value={term} onChange={e => setTerm(e.target.value)}>
            <option value="">— none —</option>
            {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>

        <Section title="Appearance" sub="Optional visual customisation" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Accent Colour" hint="Hex code e.g. #3ecf8e">
            <input style={inp} value={accentColour} onChange={e => setAccentColour(e.target.value)} placeholder="#3ecf8e" />
          </Field>
          <Field label="Card Art URL" hint="Image shown on the game card">
            <input style={inp} value={cardArtUrl} onChange={e => setCardArtUrl(e.target.value)} placeholder="https://..." />
          </Field>
        </div>

        <Field label="Card Description" hint="Short tagline shown on the game card">
          <input style={inp} value={cardDesc} onChange={e => setCardDesc(e.target.value)} placeholder="Master linear equations step by step" />
        </Field>

        <Field label="Pre-Game Gradient" hint="CSS gradient for the loading screen">
          <input style={inp} value={preGradient} onChange={e => setPreGradient(e.target.value)} placeholder="linear-gradient(135deg, #0f0c29, #302b63)" />
        </Field>

        <Field label="Mission Briefing" hint="Narrative shown before the game starts">
          <textarea
            style={{ ...inp, minHeight: 80, resize: "vertical" }}
            value={missionBriefing}
            onChange={e => setMissionBriefing(e.target.value)}
            placeholder="Your mission, should you choose to accept it..."
          />
        </Field>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: "0.8rem", color: "#f87171" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <Link href="/admin/games" style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #1e2535", color: "#64748b", fontSize: "0.82rem", fontWeight: 600, textDecoration: "none" }}>
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            style={{ padding: "9px 22px", borderRadius: 8, background: "#7c3aed", border: "none", color: "#fff", fontSize: "0.82rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Creating…" : "Create Game →"}
          </button>
        </div>
      </div>
    </div>
  );
}