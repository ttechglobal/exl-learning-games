"use client";

import type { AnalyticsEvent, AnalyticsEventName } from "@/types/event";
import { enqueueEvent } from "@/lib/offline/eventQueue";

/**
 * lib/analytics/track.ts
 *
 * Lightweight, first-party analytics — NOT a third-party SDK
 * (PostHog/Mixpanel/GA). Per direct decision: the platform explicitly
 * targets low-end Android in Nigeria with limited connectivity (see the
 * Game_Philosophy project doc's Technical Constraints) — every
 * third-party analytics SDK adds JS payload and a new network
 * dependency competing with gameplay for bandwidth at exactly the
 * moments connectivity is worst. First-party means:
 *   1. No added SDK weight.
 *   2. Events land in the SAME Supabase project as attempts/students,
 *      so "which topics do students actually struggle with" can be
 *      answered with one query instead of cross-referencing two
 *      systems — directly serving this platform's stated core strength
 *      (identifying high-frequency/difficult topics).
 *   3. Reuses the EXACT offline-resilience pattern already proven by
 *      lib/offline/attemptQueue.ts (see lib/offline/eventQueue.ts) —
 *      no event is lost to a dropped connection mid-session, same
 *      guarantee attempts already have.
 *
 * NOT a dead end if a third-party tool is wanted later: track() is the
 * one call site every engine/screen uses, so adding a second sink (a
 * PostHog/Mixpanel forward) later means changing this file, not
 * re-instrumenting every engine.
 *
 * Fire-and-forget by design — callers never await track() for UX
 * purposes; a slow or failed analytics write must never block or delay
 * gameplay. POST attempts first (fast path); on failure, queue via the
 * same IndexedDB-backed mechanism attemptQueue.ts already established.
 */
export function track(name: AnalyticsEventName, params: Omit<AnalyticsEvent, "name" | "occurredAt">): void {
  const event: AnalyticsEvent = {
    name,
    occurredAt: new Date().toISOString(),
    ...params
  };

  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event)
  })
    .then((res) => {
      if (!res.ok) throw new Error(`POST /api/events failed: ${res.status}`);
    })
    .catch(() => {
      // Offline or the request otherwise failed — queue it; the same
      // 'online' listener that flushes attemptQueue.ts also flushes this
      // queue (see lib/offline/eventQueue.ts's flushPendingEvents and
      // wherever that listener is registered, e.g. IdentityBootstrap.tsx
      // or app/layout.tsx).
      enqueueEvent(event).catch(() => {
        // Losing one analytics event to a simultaneous IndexedDB failure
        // is an acceptable, silent loss — analytics must never surface
        // an error to the player or block gameplay over this.
      });
    });
}
