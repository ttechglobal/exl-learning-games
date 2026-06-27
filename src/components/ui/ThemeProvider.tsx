"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * components/ui/ThemeProvider.tsx
 *
 * Closes a gap flagged repeatedly across earlier work: HomePage.tsx and
 * WorldsClient.tsx each owned an independent `useState<"light"|"dark">`,
 * meaning a theme choice made on one page didn't carry to another. Every
 * comment introducing that local state said the real fix was a shared
 * ThemeProvider "once a third page needs this" — the play flow needing
 * navigation (and therefore a working theme toggle inside it) is that
 * third page, so this is that fix.
 *
 * Sets `data-theme` on <html> itself (not on a wrapper div), so the
 * existing `[data-theme="dark"]` CSS rules throughout motion/tokens.css
 * and every *.module.css file apply globally without those files needing
 * any change — they were already written to key off that attribute
 * wherever it lives in the ancestor tree.
 *
 * Persists to localStorage (second real usage of that pattern in this
 * codebase — see lib/content/conceptPrefs.ts for the first, and the same
 * SSR-safety reasoning: read lazily on mount, never assume `window`
 * exists during server render).
 */

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "exl:theme";

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Starts "light" on the server (and on first client render, before the
  // effect below runs) to avoid a hydration mismatch — then immediately
  // syncs to whatever was actually stored, same pattern as any
  // localStorage-backed React state has to follow.
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(readStoredTheme());
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Same reasoning as conceptPrefs.ts — losing the persisted
      // preference is a much smaller problem than crashing the app.
    }
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme() must be called inside a <ThemeProvider> — see app/layout.tsx");
  }
  return ctx;
}