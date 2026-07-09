/**
 * mathRender.ts
 * Pure functions for converting MathToken arrays → HTML strings.
 * No React — these are injected via dangerouslySetInnerHTML so the
 * equation can double as a drag-drop target without React re-rendering
 * the entire equation on every pointer-move event.
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
  // term
  if (tk.b) {
    return `<span class="cos-block cos-block-row" style="font-size:${sz}px">${tk.t}</span>`;
  }
  return `<span class="cos-term" style="font-size:${sz}px">${tk.t}</span>`;
}

/** Render an MCQ answer button's inner HTML — supports "a/b" fractions and "√x" roots */
export function answerHTML(txt: string): string {
  if (/^[^/\s]+\/[^/\s]+$/.test(txt)) {
    const [n, d] = txt.split("/");
    return `<span class="cos-frac" style="font-size:16px"><span class="cos-num">${n.trim()}</span><span class="cos-den">${d.trim()}</span></span>`;
  }
  if (txt.startsWith("√")) {
    return `<span class="cos-sqrt" style="font-size:18px"><span class="cos-rad">√</span><span class="cos-ri" style="font-size:17px">${txt.slice(1)}</span></span>`;
  }
  return txt;
}
