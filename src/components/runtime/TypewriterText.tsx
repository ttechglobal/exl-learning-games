"use client";

import { useEffect, useRef, useState } from "react";

export interface TypewriterTextProps {
  text: string;
  /** Milliseconds per character. Kept fast (default 18ms — roughly the
   *  pace of a confident game narrator, not a slow dramatic reveal) since
   *  this sits in front of a Start Mission button a player wants to
   *  reach; a typewriter effect should feel like flavor, not a delay. */
  speedMs?: number;
}

/**
 * Simple character-by-character reveal — per direct feedback wanting the
 * Mission Briefing text to feel "game-like" rather than appearing all at
 * once as static paragraph text. Respects prefers-reduced-motion by
 * skipping straight to the full text (motion-sensitive players, and
 * anyone using a screen reader that would otherwise announce partial
 * strings repeatedly as they grow, both get the complete text
 * immediately).
 *
 * Re-runs from scratch whenever `text` itself changes (e.g. a different
 * mission's briefing) — keyed by the text content internally via the
 * effect's dependency array, not by a key prop the caller has to
 * remember to set.
 */
export function TypewriterText({ text, speedMs = 18 }: TypewriterTextProps) {
  const [shown, setShown] = useState("");
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (reducedMotionRef.current) {
      setShown(text);
      return;
    }
    setShown("");
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, speedMs);
    return () => clearInterval(interval);
  }, [text, speedMs]);

  return <>{shown}</>;
}
