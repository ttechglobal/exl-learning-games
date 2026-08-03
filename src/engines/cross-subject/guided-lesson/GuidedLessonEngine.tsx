// FILE: src/engines/cross-subject/guided-lesson/GuidedLessonEngine.tsx
"use client";

/**
 * GuidedLessonEngine — v4
 *
 * Desktop layout matches the prototype:
 *   - Single centred column, max-width ~860px
 *   - Topic heading sits ABOVE the interaction card (not in a side panel)
 *   - Interaction card full-width, rounded, accent border
 *   - Coach bubble below the card, clean reading column
 *   - Interaction hides on QUESTION / SUCCESS steps
 *
 * Mobile: same column, full width, slightly tighter padding.
 */

import React, { useState, lazy, Suspense } from "react";
import type { EngineRuntimeProps } from "@/engines/engine-types";
import { MCQEngine } from "@/engines/cross-subject/mcq/MCQEngine";

const INTERACTION_COMPONENTS: Record<
  string,
  React.ComponentType<{ config: Record<string, unknown>; colour?: string; onGoalReached?: () => void }>
> = {
  HeatSlider:           lazy(() => import("@/components/interactions/HeatSlider")),
  MatterSorter:         lazy(() => import("@/components/interactions/MatterSorter")),
  InfiniteZoomExplorer: lazy(() => import("@/components/interactions/InfiniteZoomExplorer")),
  AtomReveal:           lazy(() => import("@/components/interactions/AtomReveal")),
};

const F = "var(--eg-font-body, \'Space Grotesk\', sans-serif)";

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuickCheckOption { text: string; correct: boolean; explanation?: string; }
interface FlowStep {
  type: "COACH" | "INTERACT" | "QUESTION" | "SUCCESS";
  text?: string; isKeyMoment?: boolean; cardIndex?: number; objectives?: string[];
  component?: string; config?: Record<string, unknown>;
  question?: string; options?: QuickCheckOption[];
  correctExplanation?: string; wrongExplanation?: string;
}
interface MissionPayload { type: string; lessonFlow?: FlowStep[]; objectives?: string[]; conceptName?: string; }
interface SharedConfig { coach?: string; accentColour?: string; subject?: string; topicName?: string; conceptIndex?: number; realWorldAnchor?: string; }
interface GuidedLessonConfig { shared: SharedConfig; mission: { payload: MissionPayload; title?: string }; }
interface GuidedLessonOutcome { completed: boolean; stepsCompleted: number; quickCheckScore?: number; quickCheckTotal?: number; autoAdvance?: boolean; }

function shuffle<T>(arr: T[]): T[] { return [...arr].sort(() => Math.random() - 0.5); }
function showIx(step?: FlowStep) { return step?.type === "COACH" || step?.type === "INTERACT"; }

// ── QuickCheckCard ────────────────────────────────────────────────────────────

function QuickCheckCard({ step, qNum, qTotal, colour, onAnswered }: {
  step: FlowStep; qNum: number; qTotal: number; colour: string; onAnswered: (c: boolean) => void;
}) {
  const [opts] = useState(() => shuffle((step.options ?? []).map(o => ({ ...o }))));
  const [sel, setSel] = useState<number | null>(null);
  const done = sel !== null;
  const L = ["A","B","C","D"];

  return (
    <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden", fontFamily: F }}>
      <div style={{ background: "rgba(255,255,255,0.025)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}>Question {qNum} of {qTotal}</span>
        <span style={{ background: "rgba(252,211,77,0.1)", border: "1px solid rgba(252,211,77,0.22)", borderRadius: 20, padding: "2px 10px", fontSize: "0.58rem", fontWeight: 800, color: "#fcd34d" }}>Recall</span>
      </div>
      <div style={{ padding: "16px" }}>
        <div style={{ fontSize: "1rem", fontWeight: 600, color: "#fff", lineHeight: 1.55, marginBottom: 14 }}>{step.question}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {opts.map((o, i) => {
            const isSel = i === sel;
            let bg = "rgba(255,255,255,0.03)", br = "rgba(255,255,255,0.09)", col = "rgba(255,255,255,0.75)", lBg = "rgba(255,255,255,0.05)", lC = "rgba(255,255,255,0.28)";
            if (done) {
              if (isSel && o.correct)  { bg="rgba(52,211,153,0.09)"; br="rgba(52,211,153,0.38)"; col="#fff"; lBg="rgba(52,211,153,0.22)"; lC="#34d399"; }
              else if (isSel)          { bg="rgba(239,68,68,0.08)";  br="rgba(239,68,68,0.32)";  col="rgba(255,255,255,0.5)"; lBg="rgba(239,68,68,0.2)"; lC="#ef4444"; }
              else if (o.correct)      { bg="rgba(52,211,153,0.05)"; br="rgba(52,211,153,0.22)"; col="rgba(255,255,255,0.65)"; lBg="rgba(52,211,153,0.14)"; lC="#34d399"; }
            }
            return (
              <div key={i} onClick={() => { if (!done) { setSel(i); onAnswered(o.correct); }}} style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", borderRadius:11, border:`1px solid ${br}`, background:bg, cursor:done?"default":"pointer", transition:"all .14s", fontSize:"0.9rem", color:col, fontWeight:500 }}>
                <div style={{ width:26, height:26, borderRadius:8, flexShrink:0, background:lBg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.68rem", fontWeight:800, color:lC }}>{L[i]}</div>
                {o.text}
              </div>
            );
          })}
        </div>
        {done && sel !== null && (
          <div style={{ marginTop:12, padding:"12px 14px", borderRadius:11, display:"flex", gap:10, alignItems:"flex-start", background:opts[sel].correct?"rgba(52,211,153,0.07)":"rgba(239,68,68,0.07)", border:opts[sel].correct?"1px solid rgba(52,211,153,0.22)":"1px solid rgba(239,68,68,0.18)", color:opts[sel].correct?"#a7f3d0":"#fca5a5", fontSize:"0.85rem", lineHeight:1.6, fontWeight:500, fontFamily:F }}>
            <span>{opts[sel].correct ? "✓" : "✗"}</span>
            <span>{opts[sel].correct ? (step.correctExplanation ?? "Correct.") : (step.wrongExplanation ?? opts[sel].explanation ?? "Not quite — the correct answer is highlighted above.")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Engine ───────────────────────────────────────────────────────────────

export function GuidedLessonEngine({ config, onComplete, menu }: EngineRuntimeProps<GuidedLessonConfig, GuidedLessonOutcome> & { menu?: React.ReactNode }) {
  const shared   = (config.shared ?? {}) as SharedConfig;
  const payload  = (config.mission?.payload ?? {}) as MissionPayload;

  if (payload.type === "mcq") {
    return <MCQEngine config={config as unknown as import("@/engines/cross-subject/mcq/MCQEngine").MCQConfig} onComplete={onComplete as unknown as (o: import("@/engines/cross-subject/mcq/MCQEngine").MCQOutcome) => void} menu={menu} />;
  }

  const flow       = payload.lessonFlow ?? [];
  const objectives = payload.objectives ?? [];
  const coach      = shared.coach ?? "Dr. Adaobi";
  const colour     = shared.accentColour ?? "#00c2ff";
  const topicName  = payload.conceptName ?? shared.topicName ?? config.mission?.title ?? "Lesson";
  const subject    = shared.subject ? shared.subject.charAt(0).toUpperCase() + shared.subject.slice(1) : "";
  const conceptIdx = shared.conceptIndex;
  const anchor     = shared.realWorldAnchor;

  const [cur, setCur]           = useState(0);
  const [answered, setAnswered] = useState<Record<number, boolean>>({});
  const [qcScore, setScore]     = useState(0);

  const step   = flow[cur];
  const isLast = cur === flow.length - 1;

  const ixStep     = flow.find(s => s.type === "INTERACT");
  const ixKey      = ixStep?.component ?? null;
  const ixConfig   = ixStep?.config ?? {};

  const qcTotal    = flow.filter(s => s.type === "QUESTION").length;
  const qNumFor    = (i: number) => flow.slice(0, i + 1).filter(s => s.type === "QUESTION").length;
  const canNext    = step?.type !== "QUESTION" || answered[cur];

  const IxComponent = ixKey ? INTERACTION_COMPONENTS[ixKey] : null;
  const ixVisible   = showIx(step);

  function next() {
    if (!canNext) return;
    if (isLast) onComplete({ completed: true, stepsCompleted: flow.length, quickCheckScore: qcScore, quickCheckTotal: qcTotal, autoAdvance: true });
    else setCur(c => c + 1);
  }
  function back() { if (cur > 0) setCur(c => c - 1); }

  return (
    <>
      <style>{`
        @keyframes exl-blink { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.7)} }
        .exl-root { min-height:100vh; background:#08101e; display:flex; flex-direction:column; }
        /* Top nav bar */
        .exl-nav { display:flex; align-items:center; height:52px; border-bottom:1px solid rgba(255,255,255,0.05); flex-shrink:0; padding:0; }
        .exl-nav .exl-page-col { display:flex; align-items:center; gap:12px; height:100%; }
        /* Main scroll area */
        .exl-scroll { flex:1; overflow-y:auto; padding:0; }
        /* Content column — centred, max 860px */
        .exl-col { padding-top:28px; display:flex; flex-direction:column; gap:20px; }
        /* Bottom nav */
        .exl-bottom { border-top:1px solid rgba(255,255,255,0.06); padding:14px 0; display:flex; background:rgba(8,16,30,0.97); backdrop-filter:blur(12px); flex-shrink:0; }
        .exl-bottom-inner { display:flex; gap:10px; }
        /* Responsive tweaks */
        @media (min-width:700px)  { .exl-col { padding-top:36px; } }
        @media (min-width:1100px) { .exl-col { padding-top:44px; } }
      `}</style>

      <div className="exl-root">

        {/* ── Top nav ── */}
        <div className="exl-nav">
          <div className="exl-page-col" style={{ display:"flex", alignItems:"center", height:"100%" }}>
          {menu && <div style={{ flexShrink:0 }}>{menu}</div>}
          <div style={{ flex:1 }} />
          {/* Progress dots */}
          <div style={{ display:"flex", gap:4, alignItems:"center" }}>
            {flow.map((s,i) => (
              <div key={i} style={{
                height:4, borderRadius:2,
                width: i===cur ? 20 : 5,
                background: i===cur ? (s.type==="QUESTION" ? "#fcd34d" : colour) : i<cur ? (s.type==="QUESTION" ? "rgba(252,211,77,0.35)" : `${colour}45`) : "rgba(255,255,255,0.08)",
                transition:"all .25s",
              }}/>
            ))}
            <span style={{ marginLeft:6, fontSize:"0.6rem", color:"rgba(255,255,255,0.28)", fontWeight:700, fontFamily:F }}>{cur+1}/{flow.length}</span>
          </div>
          </div>{/* end exl-page-col */}
        </div>

        {/* Progress bar */}
        <div style={{ height:2, background:"rgba(255,255,255,0.05)", flexShrink:0 }}>
          <div style={{ height:"100%", width:`${((cur+1)/flow.length)*100}%`, background:`linear-gradient(90deg, ${colour}60, ${colour})`, transition:"width .35s ease" }}/>
        </div>

        {/* ── Main scroll ── */}
        <div className="exl-scroll">
          <div className="exl-col exl-page-col">

            {/* Concept heading — shown on COACH and INTERACT steps */}
            {(step?.type === "COACH" || step?.type === "INTERACT") && (
              <div>
                {(subject || conceptIdx != null) && (
                  <div style={{ fontSize:"0.62rem", fontWeight:800, letterSpacing:"0.12em", textTransform:"uppercase", color:`${colour}80`, fontFamily:F, marginBottom:6 }}>
                    {conceptIdx != null ? `Concept ${conceptIdx}  ·  ` : ""}{subject}
                  </div>
                )}
                <div style={{ fontFamily:F, fontSize:"1.65rem", fontWeight:900, color:"#fff", lineHeight:1.1, letterSpacing:"-0.02em", marginBottom: anchor ? 8 : 0 }}>{topicName}</div>
                {anchor && (
                  <div style={{ fontSize:"0.82rem", color:"rgba(255,255,255,0.45)", fontFamily:F, marginTop:4 }}>
                    Real-world anchor: <strong style={{ color:"rgba(255,255,255,0.75)", fontWeight:700 }}>{anchor}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Quick check heading */}
            {step?.type === "QUESTION" && qNumFor(cur) === 1 && (
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:"1.3rem" }}>✏️</span>
                <div>
                  <div style={{ fontSize:"0.6rem", fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(255,255,255,0.28)", fontFamily:F }}>Quick check</div>
                  <div style={{ fontSize:"1.1rem", fontWeight:900, color:"#fff", fontFamily:F }}>Test what you just learned</div>
                </div>
              </div>
            )}

            {/* Interaction card — hides on QUESTION and SUCCESS */}
            {IxComponent && (
              <div style={{
                borderRadius:16, overflow:"hidden",
                border:`1px solid ${colour}28`,
                background:"rgba(0,6,18,0.7)",
                transition:"max-height .4s ease, opacity .3s",
                maxHeight: ixVisible ? 700 : 0,
                opacity: ixVisible ? 1 : 0,
                pointerEvents: ixVisible ? "auto" : "none",
              }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 14px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:"0.6rem", fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:colour, fontFamily:F }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:colour, animation:"exl-blink 2s ease-in-out infinite" }}/>
                    Interactive
                  </div>
                  <div style={{ fontSize:"0.6rem", color:"rgba(255,255,255,0.22)", fontFamily:F }}>Try it</div>
                </div>
                <Suspense fallback={<div style={{ padding:32, textAlign:"center", color:"rgba(255,255,255,0.2)", fontFamily:F }}>Loading…</div>}>
                  <IxComponent config={ixConfig} colour={colour} onGoalReached={() => {}} />
                </Suspense>
              </div>
            )}

            {/* COACH bubble */}
            {step?.type === "COACH" && (
              <div style={{ display:"flex", gap:14, alignItems:"flex-start" }}>
                <div style={{ width:44, height:44, borderRadius:"50%", flexShrink:0, background:`${colour}1a`, border:`2px solid ${colour}50`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🧑‍🔬</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:"0.95rem", fontWeight:800, color:"#fff", fontFamily:F, lineHeight:1.2 }}>{coach}</div>
                  <div style={{ fontSize:"0.6rem", fontWeight:700, color:colour, letterSpacing:"0.09em", textTransform:"uppercase", fontFamily:F, marginBottom:8 }}>
                    {step.isKeyMoment ? "Remember this" : "Your guide"}
                  </div>
                  <div style={{
                    background: step.isKeyMoment ? `${colour}10` : "rgba(255,255,255,0.04)",
                    border: step.isKeyMoment ? `1px solid ${colour}35` : "1px solid rgba(255,255,255,0.07)",
                    borderLeft: step.isKeyMoment ? `3px solid ${colour}` : undefined,
                    borderRadius:"2px 16px 16px 16px", padding:"16px 18px",
                  }}>
                    {step.isKeyMoment && <div style={{ fontSize:"0.6rem", fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:colour, fontFamily:F, marginBottom:9 }}>⚡ Key concept</div>}
                    <p style={{ fontSize:"1rem", lineHeight:1.72, margin:0, color:step.isKeyMoment?"#fff":"rgba(255,255,255,0.87)", fontWeight:step.isKeyMoment?500:400, fontFamily:F }}
                       dangerouslySetInnerHTML={{ __html: (step.text ?? "").replace(/^[A-Za-z .]+:\s*/, "") }} />
                  </div>
                </div>
              </div>
            )}

            {/* INTERACT hint */}
            {step?.type === "INTERACT" && (
              <div style={{ fontSize:"0.88rem", color:"rgba(255,255,255,0.35)", textAlign:"center", fontFamily:F }}>
                Explore the interaction above, then tap Next when ready.
              </div>
            )}

            {/* QUESTION */}
            {step?.type === "QUESTION" && (
              <QuickCheckCard step={step} qNum={qNumFor(cur)} qTotal={qcTotal} colour={colour}
                onAnswered={correct => { if (!answered[cur]) { setAnswered(m => ({...m,[cur]:true})); if(correct) setScore(s=>s+1); }}}
              />
            )}

            {/* SUCCESS */}
            {step?.type === "SUCCESS" && (
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                <div style={{ background:`linear-gradient(135deg, ${colour}12, ${colour}04)`, border:`1.5px solid ${colour}25`, borderRadius:18, padding:"20px 22px", display:"flex", gap:16, alignItems:"flex-start" }}>
                  <div style={{ fontSize:"2rem", flexShrink:0 }}>🎉</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:"0.6rem", fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:colour, marginBottom:6, fontFamily:F }}>Lesson complete</div>
                    <div style={{ fontSize:"0.95rem", color:"rgba(255,255,255,0.85)", lineHeight:1.65, fontWeight:500, fontFamily:F }}>
                      {(step.text ?? "").replace(/^[A-Za-z .]+:\s*/, "") || "You covered the concept and tested yourself on it."}
                    </div>
                    {qcTotal > 0 && (
                      <div style={{ marginTop:10 }}>
                        <span style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(252,211,77,0.1)", border:"1px solid rgba(252,211,77,0.22)", borderRadius:20, padding:"4px 13px", fontSize:"0.8rem", fontWeight:700, color:"#fcd34d", fontFamily:F }}>
                          ✏️ Quick check: {qcScore} / {qcTotal}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                {(step.objectives ?? objectives).filter(Boolean).length > 0 && (
                  <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:16, padding:"16px 18px" }}>
                    <div style={{ fontSize:"0.6rem", fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(255,255,255,0.28)", marginBottom:12, fontFamily:F }}>What you just learned</div>
                    {(step.objectives ?? objectives).filter(Boolean).map((obj: string, i: number, arr: string[]) => (
                      <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:i<arr.length-1?10:0 }}>
                        <div style={{ width:20, height:20, borderRadius:6, flexShrink:0, background:"rgba(52,211,153,0.12)", border:"1.5px solid rgba(52,211,153,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.58rem", fontWeight:900, color:"#34d399", marginTop:1 }}>✓</div>
                        <div style={{ fontSize:"0.9rem", color:"rgba(255,255,255,0.75)", lineHeight:1.55, fontFamily:F }}>{obj}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* ── Bottom nav ── */}
        <div className="exl-bottom">
          <div className="exl-bottom-inner exl-page-col">
            {cur > 0 && step?.type !== "SUCCESS" && (
              <button onClick={back} style={{ padding:"13px 18px", borderRadius:12, border:"1px solid rgba(255,255,255,0.09)", background:"transparent", color:"rgba(255,255,255,0.5)", fontSize:"0.88rem", fontWeight:600, cursor:"pointer", fontFamily:F }}>← Back</button>
            )}
            <button onClick={next} disabled={!canNext} style={{ flex:1, padding:"14px", borderRadius:12, border:"none", background:step?.type==="SUCCESS"?"linear-gradient(135deg,#d97706,#b45309)":colour, color:"#fff", fontSize:"0.92rem", fontWeight:700, cursor:canNext?"pointer":"default", opacity:canNext?1:0.38, fontFamily:F, letterSpacing:"0.02em", boxShadow:canNext?`0 4px 0 color-mix(in srgb,${colour} 45%,black),0 6px 20px ${colour}22`:"none", transition:"opacity .2s" }}>
              {step?.type === "SUCCESS" ? "✓ Finish lesson" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}