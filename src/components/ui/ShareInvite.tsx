"use client";

import { useState, useCallback } from "react";
import styles from "@/components/ui/ShareInvite.module.css";

export interface ShareInviteProps {
  url?: string;
  title?: string;
  text?: string;
  label?: string;
  variant?: "pill" | "banner";
}

/**
 * components/ui/ShareInvite.tsx
 *
 * Reusable share/invite affordance — used on the homepage's leaderboard
 * section and the full /leaderboard page. Two mechanics:
 *
 *   1. Web Share API (navigator.share) — available on modern Android/iOS
 *      Chrome/Safari, which is exactly the student device profile this
 *      platform targets. Triggers the native OS share sheet, which
 *      includes WhatsApp, SMS, etc. — no copy-paste required. On
 *      Nigeria's typical Android + WhatsApp usage pattern this is the
 *      most likely vector for actually spreading a link.
 *
 *   2. Clipboard fallback — for browsers/desktop where navigator.share
 *      isn't available. Shows a ✓ confirmation for 2 seconds after copy.
 *
 * No external SDK — navigator.share and navigator.clipboard are both
 * standard Web APIs with broad support on modern Android.
 */
export function ShareInvite({
  url,
  title = "EXL Learning Games",
  text = "I'm studying with this learning game — come try it and see where you rank!",
  label = "Invite Friends",
  variant = "pill"
}: ShareInviteProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");

  const handleShare = useCallback(async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title, text, url: shareUrl });
        return;
      } catch {
        // User cancelled or API unavailable — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Quiet fail — clipboard requires HTTPS + user gesture
    }
  }, [shareUrl, title, text]);

  return (
    <button
      className={`${styles.shareBtn} ${variant === "banner" ? styles.shareBtnBanner : styles.shareBtnPill}`}
      onClick={handleShare}
      aria-label={label}
    >
      <span className={styles.shareIcon}>{copied ? "✓" : "🔗"}</span>
      <span>{copied ? "Link copied!" : label}</span>
    </button>
  );
}
