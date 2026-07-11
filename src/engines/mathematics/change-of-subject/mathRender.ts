/**
 * mathRender.ts
 * Pure functions for converting MathToken arrays → HTML strings.
 * No React — injected via dangerouslySetInnerHTML so the equation
 * can double as a drag-drop target without triggering re-renders.
 */

import type { MathToken } from "./changeOfSubject.config";

export function renderTokens(tokens: MathToken[], sizePx = 27): string {
  return (tokens ?? []).map((tk) => tokenHTML(tk, sizePx)).join("");
}

export function tokenHTML(tk: MathToken, sz: number): string {
  if (tk.type === "frac") {
    const cls = tk.b ? "cos-block" : "cos-frac";
    return `<span class="${cls}" style="font-size:${sz}px"><span class="cos-num">${tk.n}</span><span class="cos-den">${tk.d}</span></span>`;
  }
  if (tk.type === "sqrt") {
    const inner = Array.isArray(tk.inner)
      ? renderTokens(tk.inner as MathToken[], sz * 0.72)
      : String(tk.inner);
    const col = tk.b ? "color:var(--cos-coral)" : "";
    return `<span class="cos-sqrt" style="font-size:${sz}px;${col}"><span class="cos-rad">√</span><span class="cos-ri">${inner}</span></span>`;
  }
  if (tk.type === "op") {
    return `<span class="cos-term cos-op" style="font-size:${sz}px">${tk.t}</span>`;
  }
  if (tk.b) {
    return `<span class="cos-block cos-block-row" style="font-size:${sz}px">${tk.t}</span>`;
  }
  return `<span class="cos-term" style="font-size:${sz}px">${tk.t}</span>`;
}

/**
 * Render an MCQ answer string as proper math HTML.
 * Handles fractions (a/b), parenthesised fractions ((a−b)/c),
 * square roots (√x), superscripts (x²), and plain text.
 * Size is smaller than the equation display — these are answer buttons.
 */
export function answerHTML(txt: string): string {
  const s = txt.trim();

  // ── (numerator)/denominator  e.g. "(v−u)/a", "(s−½at²)/t" ──────────────
  const parenFrac = s.match(/^\((.+)\)\/(.+)$/);
  if (parenFrac) {
    return frac(parenFrac[1], parenFrac[2], 15);
  }

  // ── numerator/denominator  e.g. "A/π", "T²/4π²", "P/2 − w" ─────────────
  // Only split on "/" when neither side contains a "/"
  const slashIdx = s.indexOf("/");
  if (slashIdx > 0 && slashIdx < s.length - 1) {
    const beforeSlash = s.slice(0, slashIdx);
    const afterSlash  = s.slice(slashIdx + 1);
    // Don't split if there's another "/" (e.g. already a fraction inside)
    if (!beforeSlash.includes("/") && !afterSlash.includes("/")) {
      return frac(beforeSlash.trim(), afterSlash.trim(), 15);
    }
  }

  // ── √(expr)  or  √expr ───────────────────────────────────────────────────
  if (s.startsWith("√")) {
    const inner = s.slice(1).replace(/^\((.+)\)$/, "$1"); // strip outer parens
    return sqrt(inner, 17);
  }

  // ── plain text — apply superscript for ² ³ and styling ──────────────────
  return `<span style="font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:700">${escapeSup(s)}</span>`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function frac(n: string, d: string, sz: number): string {
  return `<span class="cos-frac" style="font-size:${sz}px"><span class="cos-num">${escapeSup(n)}</span><span class="cos-den">${escapeSup(d)}</span></span>`;
}

function sqrt(inner: string, sz: number): string {
  return `<span class="cos-sqrt" style="font-size:${sz}px"><span class="cos-rad">√</span><span class="cos-ri" style="font-size:${sz - 1}px">${escapeSup(inner)}</span></span>`;
}

/** Replace ² ³ with proper <sup> tags */
function escapeSup(s: string): string {
  return s
    .replace(/²/g, "<sup>2</sup>")
    .replace(/³/g, "<sup>3</sup>")
    .replace(/⁴/g, "<sup>4</sup>");
}