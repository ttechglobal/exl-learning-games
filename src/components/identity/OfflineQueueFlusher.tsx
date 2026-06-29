"use client";

import { useEffect } from "react";
import { flushPendingAttempts } from "@/lib/offline/attemptQueue";
import { flushPendingEvents } from "@/lib/offline/eventQueue";

/**
 * components/identity/OfflineQueueFlusher.tsx
 *
 * FIXES A CONFIRMED PRE-EXISTING GAP: lib/offline/attemptQueue.ts's
 * flushPendingAttempts() was fully implemented but never actually
 * called from anywhere in the app — confirmed by searching the whole
 * codebase for it. A device that went offline mid-session, queued an
 * attempt, and came back online would keep that attempt sitting in
 * IndexedDB forever, only flushing if something else happened to call
 * the function (nothing did). Adding lib/offline/eventQueue.ts (this
 * round's analytics queue, same pattern) made the gap worth closing for
 * both queues at once rather than leaving the new one unwired too.
 *
 * Mounted once near the root (see app/layout.tsx, same lifecycle as
 * IdentityBootstrap/ThemeProvider) renders nothing — purely a side-effect
 * component that listens for the browser's 'online' event and flushes
 * both queues when it fires. Also attempts a flush on mount, covering
 * the case where the device was offline when a previous session queued
 * something but is online again by the time this mounts (no 'online'
 * event would fire in that case, since connectivity didn't change
 * during THIS page's lifetime).
 *
 * Both flush calls are independent and allowed to fail silently — a
 * flush attempt that fails (still offline, or a transient error) simply
 * leaves items queued for the next trigger, same as before.
 */
export function OfflineQueueFlusher() {
  useEffect(() => {
    function flushBoth() {
      flushPendingAttempts().catch(() => {
        // Still offline, or a transient failure — leave queued, retry next trigger.
      });
      flushPendingEvents().catch(() => {
        // Same reasoning — analytics is lower-stakes than attempts but follows the same pattern.
      });
    }

    flushBoth();
    window.addEventListener("online", flushBoth);
    return () => window.removeEventListener("online", flushBoth);
  }, []);

  return null;
}
