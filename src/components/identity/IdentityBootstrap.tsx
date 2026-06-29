"use client";

import { useEffect, useState } from "react";
import { getLocalPlayerName, setLocalPlayerName, hasSeenPlayerNamePrompt, markPlayerNamePromptSeen } from "@/lib/content/localPlayerName";
import styles from "@/components/identity/IdentityBootstrap.module.css";

/**
 * components/identity/IdentityBootstrap.tsx
 *
 * RECONNECTED per direct decision: the server-side device-identity
 * system this component drives (eg_device_id cookie + a real per-device
 * student row — see lib/identity/deviceId.ts, lib/db/queries/
 * students.ts) was paused two rounds ago in favor of local-only high
 * scores, then explicitly turned back on now specifically to power a
 * per-device XP total / profile — `addXpToStudent` (lib/db/queries/
 * progress.ts) already existed, already worked correctly, and only
 * ever needed a real identity to attach to. See docs/BUILD_LOG.md for
 * the full decision record.
 *
 * MERGED, not duplicated: an earlier revision ran TWO separate "what
 * should we call you" prompts — this component (server identity) and a
 * since-removed PlayerNamePrompt.tsx (purely local, for high-score
 * display names — that local-only flow itself is gone now too, see
 * lib/content/personalBest.ts's header). Per the obvious UX problem with
 * that (two near-identical name dialogs popping up at different
 * moments), this is now the ONE prompt, and it writes the name to BOTH
 * places at once: lib/content/localPlayerName.ts (for instant local
 * display) AND the server via POST /api/identity (for the profile/XP
 * total and the cross-device leaderboard's display name). One name, one
 * prompt, two consumers.
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
 *      every visit, no UI. If this device already has a saved local
 *      name (from before this reconnection, or from a high-score save),
 *      that name is pushed to the server at this point too, so a
 *      device with local history doesn't show up as "Anonymous"
 *      server-side the first time identity reconnects.
 *   2. The ONE-TIME name prompt — shown on first-ever app open (per
 *      direct product decision), using lib/content/localPlayerName.ts's
 *      OWN seen-flag (hasSeenPlayerNamePrompt/markPlayerNamePromptSeen)
 *      rather than a separate flag, since this is now the only name
 *      prompt that exists.
 */
export function IdentityBootstrap() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const existingLocalName = getLocalPlayerName();

    const identityFetch = existingLocalName
      ? // Already have a local name (saved before this reconnection, or
        // via a high-score save) — push it to the server immediately so
        // this device's profile doesn't start as "Anonymous" the first
        // time identity reconnects, then continue the same as the GET
        // path below.
        fetch("/api/identity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: existingLocalName })
        })
      : fetch("/api/identity");

    identityFetch
      .then((res) => {
        if (!res.ok) throw new Error(`identity bootstrap failed: ${res.status}`);
        return res.json();
      })
      .then(() => {
        if (cancelled) return;
        if (!hasSeenPlayerNamePrompt()) setShowPrompt(true);
      })
      .catch(() => {
        // Identity bootstrap failing shouldn't block the rest of the app
        // from rendering — every downstream feature (leaderboards,
        // attempts, profile) already has its own honest empty/failure
        // state if studentId never resolves; this just means this
        // particular visit silently stays unidentified server-side
        // rather than surfacing an error banner over the whole app for
        // what's a non-critical background call. The LOCAL name (high
        // scores) is completely unaffected either way.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    setShowPrompt(false);
    markPlayerNamePromptSeen();
  }

  async function handleSubmit() {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      dismiss(); // Skipping the name is allowed — Anonymous is a fine default.
      return;
    }
    setLocalPlayerName(trimmed); // instant local effect — any future reader of getLocalPlayerName() picks this up immediately
    setSubmitting(true);
    try {
      await fetch("/api/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmed })
      });
    } catch {
      // Same non-blocking reasoning as the GET above — worst case this
      // device's server-side profile name lags behind the local one
      // until the next successful sync opportunity; not worth blocking
      // the rest of the app over. The local name (and therefore local
      // high scores) already saved successfully regardless.
    } finally {
      setSubmitting(false);
      dismiss();
    }
  }

  if (!showPrompt) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Choose your player name">
      <div className={styles.card}>
        <div className={styles.title}>What should we call you?</div>
        <div className={styles.subtitle}>This name shows up on leaderboards and your profile. You can skip this — no account needed.</div>
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
