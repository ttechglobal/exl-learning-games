"use client";

import { useEffect, useState } from "react";
import {
  hasSeenPlayerNamePrompt,
  isPlayerNamePromptRequested,
  markPlayerNamePromptSeen,
  setLocalPlayerName
} from "@/lib/content/localPlayerName";
import styles from "@/components/identity/PlayerNamePrompt.module.css";

/**
 * components/identity/PlayerNamePrompt.tsx
 *
 * TRIGGER CHANGE: this prompt no longer fires on first app open.
 * It now appears after the player completes their first game, which is
 * a far better moment — they've experienced something, have a reason to
 * care about their name (leaderboard / personal best), and aren't being
 * interrupted before they've even seen what the app does.
 *
 * How the trigger works:
 *   1. GameRuntime calls requestPlayerNamePrompt() (lib/content/localPlayerName.ts)
 *      on the first mission_completed event.
 *   2. That function sets a localStorage flag AND dispatches a custom
 *      "exl:namePromptRequested" event on window.
 *   3. This component listens for that event and sets showPrompt=true.
 *   4. On dismiss (Save or Skip), markPlayerNamePromptSeen() clears the
 *      flag and sets the "already seen" key so it never shows again.
 *
 * Mounted in app/layout.tsx (renders nothing until triggered — zero cost
 * to keep it in the tree at all times).
 */
export function PlayerNamePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    // Check immediately in case the flag was set before this component mounted
    // (e.g. user navigates away and back to the reflection screen).
    if (!hasSeenPlayerNamePrompt() && isPlayerNamePromptRequested()) {
      setShowPrompt(true);
    }

    // Listen for the custom event dispatched by requestPlayerNamePrompt()
    // so the prompt appears in real time on the reflection screen after
    // the first game completes — no page reload needed.
    function handleRequest() {
      if (!hasSeenPlayerNamePrompt()) setShowPrompt(true);
    }

    window.addEventListener("exl:namePromptRequested", handleRequest);
    return () => window.removeEventListener("exl:namePromptRequested", handleRequest);
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
        <div className={styles.title}>Nice work, Detective! 🎉</div>
        <div className={styles.subtitle}>
          What should we call you? Your name will appear on high scores on this device. You can skip this anytime.
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
            Save name
          </button>
        </div>
      </div>
    </div>
  );
}