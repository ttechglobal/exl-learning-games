"use client";

import { useEffect, useState } from "react";
import { hasSeenPlayerNamePrompt, markPlayerNamePromptSeen, setLocalPlayerName } from "@/lib/content/localPlayerName";
import styles from "@/components/identity/PlayerNamePrompt.module.css";

/**
 * components/identity/PlayerNamePrompt.tsx
 *
 * REPLACES IdentityBootstrap.tsx in the actual UI (that file/the
 * server-side device-cookie system it called into are NOT deleted —
 * see lib/content/localPlayerName.ts's header comment for why — but
 * this is what's actually mounted in app/layout.tsx now).
 *
 * Per corrected scope: no server round-trip, no cookie, no account. One
 * job — ask for a name once, on first-ever app open, purely so
 * HighScoreEntry.tsx's local high-score save can pre-fill it instead of
 * making the player retype their name every single time they set a
 * local high score on every game.
 *
 * Skipping is allowed and doesn't nag again (see
 * markPlayerNamePromptSeen) — a player who skips still gets a normal
 * empty name field the first time they actually save a high score, and
 * THAT save (in HighScoreEntry.tsx) also calls setLocalPlayerName, so
 * the name still ends up remembered from then on even if it was never
 * set via this prompt specifically.
 */
export function PlayerNamePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!hasSeenPlayerNamePrompt()) setShowPrompt(true);
  }, []);

  function dismiss() {
    setShowPrompt(false);
    markPlayerNamePromptSeen();
  }

  function handleSave() {
    const trimmed = name.trim();
    if (trimmed.length > 0) setLocalPlayerName(trimmed);
    dismiss();
  }

  if (!showPrompt) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Choose a name for high scores">
      <div className={styles.card}>
        <div className={styles.title}>What should we call you?</div>
        <div className={styles.subtitle}>
          This name will be used for your high scores on this device. You can skip this — no account needed.
        </div>
        <input
          className={styles.input}
          type="text"
          placeholder="Your name"
          value={name}
          maxLength={20}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
        />
        <div className={styles.actions}>
          <button className={styles.skipButton} onClick={dismiss}>
            Skip
          </button>
          <button className={styles.saveButton} onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
