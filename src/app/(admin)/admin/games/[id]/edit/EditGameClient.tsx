"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { GameRow } from "@/types/db";

const YEAR_GROUPS = ["JSS1","JSS2","JSS3","SS1","SS2","SS3","WAEC Year","JAMB Year"];
const EXAM_BOARDS = ["WAEC","JAMB","NECO","IGCSE","Cambridge"];
const SUBJECTS = ["mathematics","chemistry","physics","biology"];
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

function MultiSelect({ options, selected, onChange, placeholder }: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  };
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(o => (
        <button
          key={o}
          onClick={() => toggle(o)}
          type="button"
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

export default function EditGameClient({ game }: { game: GameRow }) {
  const router = useRouter();

  const [title, setTitle]           = useState(game.title);
  const [subject, setSubject]       = useState(game.subject);
  const [topicId, setTopicId]       = useState(game.topic_id);
  const [accentColour, setAccentColour] = useState(game.accent_colour ?? "");
  const [cardDesc, setCardDesc]     = useState(game.card_description ?? "");
  const [cardArtUrl, setCardArtUrl] = useState(game.card_art_url ?? "");
  const [preGradient, setPreGradient] = useState(game.pre_game_gradient ?? "");
  const [missionBriefing, setMissionBriefing] = useState(game.mission_briefing ?? "");
  const [yearGroups, setYearGroups] = useState<string[]>(game.year_groups ?? []);
  const [examBoards, setExamBoards] = useState<string[]>(game.exam_boards ?? []);
  const [term, setTerm]             = useState(game.curriculum_term ?? "");
  const [isActive, setIsActive]     = useState(game.is_active);
  const [snapshotCards, setSnapshotCards] = useState<{title:string;body:string}[]>(
    game.snapshot?.cards ?? []
  );

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string|null>(null);
  const [saved, setSaved]   = useState(false);

  const handleSave = async () => {
    setSaving(true); setError(null); setSaved(false);
    const res = await fetch(`/api/games/${game.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, subject, topic_id: topicId,
        accent_colour:    accentColour   || null,
        card_description: cardDesc       || null,
        card_art_url:     cardArtUrl     || null,
        pre_game_gradient: preGradient   || null,
        mission_briefing: missionBriefing || null,
        year_groups: yearGroups,
        exam_boards: examBoards,
        curriculum_term: term || null,
        is_active: isActive,
        snapshot: { cards: snapshotCards.filter(c => c.title || c.body) },
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error ?? "Save failed"); return; }
    setSaved(true);
  };

  const accent = game.accent_colour ?? "#7c3aed";

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "32px 24px 80px" }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.75rem", color: "#475569", marginBottom: 8 }}>
          <Link href="/admin/games" style={{ color: "#64748b", textDecoration: "none" }}>Games</Link>
          <span>/</span>
          <span>{game.title}</span>
          <span>/</span>
          <span>Edit</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#f1f5f9", margin: "0 0 4px", letterSpacing: "-0.01em" }}>{game.title}</h1>
            <div style={{ fontSize: "0.72rem", color: "#334155", fontFamily: "monospace" }}>{game.slug}</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href={`/admin/games/${game.id}/missions`}
              style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #1e2535", color: "#94a3b8", fontSize: "0.82rem", textDecoration: "none", fontWeight: 600 }}>
              Missions
            </Link>
            <a href={`/play/${game.slug}`} target="_blank"
              style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #1e2535", color: "#64748b", fontSize: "0.82rem", textDecoration: "none" }}>
              Preview ↗
            </a>
          </div>
        </div>
        <div style={{ height: 3, background: accent, borderRadius: 2, marginTop: 14 }}/>
      </div>

      {/* 1 — Identity */}
      <Section title="1 · Identity"/>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Title *"><input style={inp} value={title} onChange={e => setTitle(e.target.value)}/></Field>
        <Field label="Subject">
          <select style={sel} value={subject} onChange={e => setSubject(e.target.value)}>
            {SUBJECTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
          </select>
        </Field>
        <Field label="Topic ID" hint="e.g. change-of-subject, atomic-structure">
          <input style={inp} value={topicId} onChange={e => setTopicId(e.target.value)}/>
        </Field>
        <Field label="Active">
          <select style={sel} value={isActive ? "yes" : "no"} onChange={e => setIsActive(e.target.value === "yes")}>
            <option value="yes">Live — visible to students</option>
            <option value="no">Draft — hidden</option>
          </select>
        </Field>
      </div>

      {/* 2 — Class Tags */}
      <Section title="2 · Class & Exam Tags" sub="Controls which students see this game. Students can filter by year group, exam board, and term."/>
      <Field label="Year Groups" hint="Which school years is this game for?">
        <MultiSelect options={YEAR_GROUPS} selected={yearGroups} onChange={setYearGroups} placeholder="Select year groups"/>
      </Field>
      <Field label="Exam Boards" hint="Which exams does this game prepare students for?">
        <MultiSelect options={EXAM_BOARDS} selected={examBoards} onChange={setExamBoards} placeholder="Select exam boards"/>
      </Field>
      <Field label="Curriculum Term">
        <select style={sel} value={term} onChange={e => setTerm(e.target.value)}>
          <option value="">— Select term —</option>
          {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>

      {/* 3 — Theme */}
      <Section title="3 · Theme & Visuals"/>
      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 14, alignItems: "start" }}>
        <Field label="Accent">
          <input type="color" value={accentColour || "#7c3aed"} onChange={e => setAccentColour(e.target.value)}
            style={{ width: "100%", height: 36, borderRadius: 6, border: "1px solid #1e2535", cursor: "pointer", padding: 2, background: "none" }}/>
        </Field>
        <div>
          {preGradient && <div style={{ height: 36, borderRadius: 8, background: preGradient, marginBottom: 6 }}/>}
          <Field label="Pre-game Gradient" hint="CSS gradient for briefing screens">
            <input style={inp} value={preGradient} onChange={e => setPreGradient(e.target.value)}
              placeholder="linear-gradient(160deg, #071a09 0%, #0e2a10 100%)"/>
          </Field>
        </div>
      </div>
      <Field label="Card Art URL">
        <input style={inp} value={cardArtUrl} onChange={e => setCardArtUrl(e.target.value)} placeholder="/mascot/card-nova-explorer.svg"/>
        {cardArtUrl && <img src={cardArtUrl} alt="" style={{ height: 64, marginTop: 8, borderRadius: 6, border: "1px solid #0f1c2e" }} onError={e => (e.currentTarget.style.display="none")}/>}
      </Field>

      {/* 4 — Content Copy */}
      <Section title="4 · Content"/>
      <Field label="Card Description" hint="One sentence shown on the game shelf">
        <input style={inp} value={cardDesc} onChange={e => setCardDesc(e.target.value)} placeholder="Explore lost mathematical worlds…"/>
      </Field>
      <Field label="Mission Briefing" hint="Flavor paragraph shown before the game starts">
        <textarea style={{ ...inp, minHeight: 80, resize: "vertical", lineHeight: 1.55 }}
          value={missionBriefing} onChange={e => setMissionBriefing(e.target.value)}/>
      </Field>

      {/* 5 — Learn Cards */}
      <Section title="5 · Learn Cards" sub="Shown once before the student plays. Rich explanations — not just quick tips."/>
      {snapshotCards.map((card, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10, marginBottom: 10, background: "#0d1520", borderRadius: 8, padding: 14, border: "1px solid #0f1c2e" }}>
          <div>
            <div style={{ fontSize: "0.68rem", color: "#475569", marginBottom: 5, textTransform: "uppercase" }}>Card {i+1} Title</div>
            <input style={inp} value={card.title}
              onChange={e => { const a=[...snapshotCards]; a[i]={...a[i],title:e.target.value}; setSnapshotCards(a); }}/>
          </div>
          <div>
            <div style={{ fontSize: "0.68rem", color: "#475569", marginBottom: 5, textTransform: "uppercase" }}>Body</div>
            <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={card.body}
              onChange={e => { const a=[...snapshotCards]; a[i]={...a[i],body:e.target.value}; setSnapshotCards(a); }}/>
          </div>
        </div>
      ))}
      {snapshotCards.length < 6 && (
        <button onClick={() => setSnapshotCards([...snapshotCards, { title: "", body: "" }])}
          style={{ background: "none", border: "1px dashed #1e2535", borderRadius: 6, padding: "6px 14px", color: "#475569", fontSize: "0.78rem", cursor: "pointer" }}>
          + Add card
        </button>
      )}

      {/* Save */}
      <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 14 }}>
        {error && <div style={{ color: "#fca5a5", fontSize: "0.82rem", flex: 1 }}>{error}</div>}
        {saved && <div style={{ color: "#86efac", fontSize: "0.82rem", flex: 1 }}>✓ Saved</div>}
        <button onClick={handleSave} disabled={saving}
          style={{ padding: "11px 32px", borderRadius: 10, background: saving ? "#1e2535" : "#7c3aed", color: saving ? "#475569" : "#fff", fontWeight: 700, fontSize: "0.9rem", border: "none", cursor: saving ? "default" : "pointer" }}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
