"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./engine.module.css";

interface Props {
  game: {
    id: string;
    title: string;
    slug: string;
    engineType: string;
    enginePending: boolean;
    engineSpec: Record<string, unknown> | null;
    subject: string;
    topicId: string;
    sharedConfig: Record<string, unknown>;
  };
}

function buildClaudePrompt(game: Props["game"]): string {
  const spec = game.engineSpec;
  const specText = spec ? JSON.stringify(spec, null, 2) : "[No spec stored — paste the Claude output here]";

  return `You are a senior React/TypeScript game engine developer working on EXL Games.

EXL Games is an educational game platform where the game mechanic IS the learning.
Each game has its own dedicated engine — a React component that renders the
interactive experience students use to learn a specific curriculum concept.

═══════════════════════════════════════════════
THE GAME YOU ARE BUILDING AN ENGINE FOR
═══════════════════════════════════════════════

Title:       ${game.title}
Slug:        ${game.slug}
Subject:     ${game.subject}
Topic:       ${game.topicId}
Engine type: ${game.engineType}

═══════════════════════════════════════════════
ENGINE SPEC (designed by Claude game designer)
═══════════════════════════════════════════════

${specText}

═══════════════════════════════════════════════
WHAT YOU NEED TO BUILD
═══════════════════════════════════════════════

Three files, in this exact structure:

src/engines/${game.engineType}/
  ${toPascalCase(game.engineType)}Engine.tsx       ← The React component
  ${game.engineType}.config.ts                      ← Zod schemas + types
  ${toPascalCase(game.engineType)}Engine.module.css ← Styles

Then register in src/engines/registry.ts:
  import { ${toPascalCase(game.engineType)}Engine } from "@/engines/${game.engineType}/${toPascalCase(game.engineType)}Engine";
  import { ${toPascalCase(game.engineType)}SharedConfigSchema } from "@/engines/${game.engineType}/${game.engineType}.config";

  // Add to registry object:
  "${game.engineType}": {
    engineType: "${game.engineType}",
    configSchema: ${toPascalCase(game.engineType)}SharedConfigSchema,
    Component: ${toPascalCase(game.engineType)}Engine,
  }

═══════════════════════════════════════════════
FILE 1 — ${game.engineType}.config.ts
═══════════════════════════════════════════════

Build the Zod config schema from the ENGINE SPEC above.

Required exports:
- ${toPascalCase(game.engineType)}SharedConfigSchema   — validates sharedConfig
- ${toPascalCase(game.engineType)}MissionPayloadSchema — validates mission payload
- ${toPascalCase(game.engineType)}SharedConfig         — inferred type
- ${toPascalCase(game.engineType)}MissionPayload       — inferred type

The sharedConfig schema must include:
- entry: { title: string, missionLabel: string }
- tiers: [{ tier: "easy"|"medium"|"hard", label: string, xpReward: number, hintAfterAttempts: number }]
- feedback, hints, review, scoring (match the spec)

The mission payload schema must match the PAYLOAD CONTRACT in the spec.

═══════════════════════════════════════════════
FILE 2 — ${toPascalCase(game.engineType)}Engine.tsx
═══════════════════════════════════════════════

Build the React component. It receives these props:
  mission:   MissionRow         — the current mission (includes payload)
  shared:    ${toPascalCase(game.engineType)}SharedConfig  — from sharedConfig
  onComplete: (outcome) => void — called when mission succeeds
  onBack:     () => void        — called when player navigates back

The component must:
1. Read mission.payload as ${toPascalCase(game.engineType)}MissionPayload
2. Implement the interaction described in the ENGINE SPEC above
3. Handle three stages (read from payload.stage):
   - "practice"  → system guides, shows next step, student confirms
   - "challenge" → student-led, hints available on request only
   - "master"    → student alone, hints on request, nothing auto-surfaces
4. Call onComplete({ success: true, score, wrongAttempts, hintsUsed, timeSpentSec }) on win
5. Show stepHints when appropriate for the stage
6. Show stepDistractors as wrong-answer options

Use CSS Modules for all styles (${toPascalCase(game.engineType)}Engine.module.css).
No inline styles except for dynamic values.

The existing engines are reference implementations:
  src/engines/formula-excavation/FormulaExcavationEngine.tsx
  src/engines/stepwise-equation-solver/StepwiseEquationSolverEngine.tsx
Look at these for patterns — onComplete shape, hint resolution, scoring, etc.

═══════════════════════════════════════════════
CURRENT SHAREDCONFIG (from uploaded game JSON)
═══════════════════════════════════════════════

${JSON.stringify(game.sharedConfig, null, 2)}

═══════════════════════════════════════════════
OUTPUT INSTRUCTIONS
═══════════════════════════════════════════════

Output the three files in full, in this order:
1. ${game.engineType}.config.ts
2. ${toPascalCase(game.engineType)}Engine.tsx
3. ${toPascalCase(game.engineType)}Engine.module.css (starter CSS — I'll refine the visuals)

Then output the registry.ts entry to add.

Do not truncate. Output each file completely.`;
}

function toPascalCase(slug: string): string {
  return slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}

export function EngineSpecClient({ game }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const claudePrompt = buildClaudePrompt(game);
  const specJson = game.engineSpec ? JSON.stringify(game.engineSpec, null, 2) : null;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.breadcrumb}>
          <Link href="/admin/games" className={styles.breadcrumbLink}>Games</Link>
          <span className={styles.breadcrumbSep}>/</span>
          <Link href={`/admin/games/${game.id}/edit`} className={styles.breadcrumbLink}>{game.title}</Link>
          <span className={styles.breadcrumbSep}>/</span>
          <span>Engine</span>
        </div>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.heading}>Engine Builder</h1>
            <p className={styles.sub}>
              {game.enginePending
                ? <>Engine <code className={styles.code}>{game.engineType}</code> needs to be built and registered before this game is playable.</>
                : <>Engine <code className={styles.code}>{game.engineType}</code> is registered and active.</>
              }
            </p>
          </div>
          <div className={styles.statusBadge} data-pending={game.enginePending}>
            {game.enginePending ? "⚠ Engine Pending" : "✓ Engine Active"}
          </div>
        </div>
      </div>

      {game.enginePending && (
        <div className={styles.steps}>
          <div className={styles.stepsTitle}>How to build this engine</div>
          <div className={styles.stepList}>
            {[
              { n: "1", title: "Copy the Claude prompt below", sub: "Paste it into a new Claude chat (or Claude Code)" },
              { n: "2", title: "Claude writes three files",     sub: `${game.engineType}.config.ts · ${toPascalCase(game.engineType)}Engine.tsx · ${toPascalCase(game.engineType)}Engine.module.css` },
              { n: "3", title: "Drop files into your project",  sub: `src/engines/${game.engineType}/` },
              { n: "4", title: "Add registry entry",            sub: "Claude outputs this too — one import + one object entry in registry.ts" },
              { n: "5", title: "Restart the dev server",        sub: "The game becomes playable immediately" },
            ].map(s => (
              <div key={s.n} className={styles.stepItem}>
                <div className={styles.stepNum}>{s.n}</div>
                <div>
                  <div className={styles.stepTitle}>{s.title}</div>
                  <div className={styles.stepSub}>{s.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Claude prompt — the main action */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <div className={styles.sectionTitle}>Claude Build Prompt</div>
            <div className={styles.sectionSub}>
              Copy this into a new Claude conversation. Claude will output all three files and the registry entry.
            </div>
          </div>
          <button
            onClick={() => copy("prompt", claudePrompt)}
            className={styles.copyBtn}
            data-copied={copied === "prompt"}
          >
            {copied === "prompt" ? "✓ Copied" : "Copy Prompt"}
          </button>
        </div>
        <pre className={styles.promptPreview}>{claudePrompt.slice(0, 600)}…</pre>
      </div>

      {/* Raw spec */}
      {specJson && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <div className={styles.sectionTitle}>Engine Spec (raw)</div>
              <div className={styles.sectionSub}>The spec Claude designed — stored with this game.</div>
            </div>
            <button
              onClick={() => copy("spec", specJson)}
              className={styles.copyBtn}
              data-copied={copied === "spec"}
            >
              {copied === "spec" ? "✓ Copied" : "Copy JSON"}
            </button>
          </div>
          <pre className={styles.code_block}>{specJson}</pre>
        </div>
      )}

      {!specJson && (
        <div className={styles.noSpec}>
          <div className={styles.noSpecIcon}>📋</div>
          <div className={styles.noSpecTitle}>No spec stored</div>
          <div className={styles.noSpecSub}>
            Re-upload the game JSON with an <code>__engineSpec</code> field, or paste the Claude output into the prompt above manually.
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className={styles.links}>
        <Link href={`/admin/games/${game.id}/missions`} className={styles.link}>View Missions →</Link>
        <Link href={`/admin/games/${game.id}/edit`}     className={styles.link}>Edit Game →</Link>
        <Link href="/admin/games/upload"                className={styles.link}>Upload Missions →</Link>
      </div>
    </div>
  );
}