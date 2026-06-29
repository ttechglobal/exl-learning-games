"use client";

import { useEffect, useState } from "react";
import styles from "@/components/identity/IdentityBootstrap.module.css";

/**
 * components/identity/IdentityBootstrap.tsx
 *
 * Mounted once near the root (see app/layout.tsx, same lifecycle as
 * ThemeProvider) so identity resolves as early as possible on every
 * page, not lazily whenever something first happens to need studentId.
 *
 * TWO SEPARATE THINGS, deliberately not conflated:
 *   1. Calling GET /api/identity on mount — this is what actually mints
 *      the eg_device_id cookie + creates the student row on a brand new
 *      visitor's FIRST page load (a plain Server Component render can't
 *      set cookies itself; see lib/identity/deviceId.ts's header
 *      comment for why this round-trip exists at all). Happens silently,
 *      every visit, no UI.
 *   2. The ONE-TIME name prompt — per direct product decision, shown on
 *      first-ever app open, not deferred to first leaderboard
 *      qualification (HighScoreEntry.tsx's existing local-personal-best
 *      flow is untouched and still asks for a name there too, for the
 *      LOCAL list specifically — these are two different name prompts
 *      for two different purposes, not a duplicate).
 *
 * "First-ever app open" is tracked via a small localStorage flag
 * (`eg_identity_onboarded`) SEPARATE from the eg_device_id cookie itself
 * — the cookie identifies the device to the server; this flag is purely
 * "have we already shown this exact browser the prompt," so a returning
 * visitor on the same device within the same cookie lifetime never sees
 * it twice, even across a server-side student-row recreation edge case.
 */
const ONBOARDED_FLAG_KEY = "eg:identity-onboarded";

export function IdentityBootstrap() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/identity")
      .then((res) => {
        if (!res.ok) throw new Error(`identity bootstrap failed: ${res.status}`);
        return res.json();
      })
      .then(() => {
        if (cancelled) return;
        let alreadyOnboarded = false;
        try {
          alreadyOnboarded = window.localStorage.getItem(ONBOARDED_FLAG_KEY) === "1";
        } catch {
          // If localStorage is unavailable, fail toward NOT nagging a
          // returning visitor every load — same reasoning as
          // conceptPrefs.ts elsewhere in this app: losing the flag is a
          // smaller problem than crashing or being annoying.
          alreadyOnboarded = true;
        }
        if (!alreadyOnboarded) setShowPrompt(true);
      })
      .catch(() => {
        // Identity bootstrap failing shouldn't block the rest of the app
        // from rendering — every downstream feature (leaderboards,
        // attempts) already has its own honest empty/failure state if
        // studentId never resolves; this just means this particular
        // visit silently stays unidentified rather than surfacing an
        // error banner over the whole app for what's a non-critical
        // background call.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    setShowPrompt(false);
    try {
      window.localStorage.setItem(ONBOARDED_FLAG_KEY, "1");
    } catch {
      // Same reasoning as above — losing this flag just means the
      // prompt might reappear once more later, not a crash.
    }
  }

  async function handleSubmit() {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      dismiss(); // Skipping the name is allowed — Anonymous is a fine default.
      return;
    }
    setSubmitting(true);
    try {
      await fetch("/api/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmed })
      });
    } catch {
      // Same non-blocking reasoning as the GET above — worst case this
      // device just keeps its default "Anonymous" name server-side; not
      // worth blocking the rest of the app over.
    } finally {
      setSubmitting(false);
      dismiss();
    }
  }

  if (!showPrompt) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Choose a leaderboard name">
      <div className={styles.card}>
        <div className={styles.title}>What should we call you?</div>
        <div className={styles.subtitle}>This name shows up on leaderboards. You can skip this — no account needed.</div>
        <input
          className={styles.input}
          type="text"
          placeholder="Your name"
          value={name}
          maxLength={20}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !submitting) handleSubmit();
          }}
        />
        <div className={styles.actions}>
          <button className={styles.skipButton} onClick={dismiss} disabled={submitting}>
            Skip
          </button>
          <button className={styles.saveButton} onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
