"use client";

import type { AnalyticsEvent } from "@/types/event";

/**
 * lib/offline/eventQueue.ts
 *
 * Buffers AnalyticsEvents in IndexedDB when the network is unavailable,
 * and flushes them to /api/events once connectivity returns — the exact
 * same shape as lib/offline/attemptQueue.ts, deliberately, rather than a
 * new mechanism. See lib/analytics/track.ts's header for why analytics
 * gets first-party events + this proven queue instead of a third-party
 * SDK (low-end Android / limited connectivity is the deciding factor
 * either way, so the resilience requirement is identical to attempts).
 *
 * Separate object store / separate module from attemptQueue.ts rather
 * than merged into one queue, since events are much higher-volume than
 * attempts (every wrong drag, not just one row per completed mission)
 * and the two have different urgency: a lost attempt affects XP/mastery
 * correctness, a lost event is just a gap in a chart. Keeping them
 * separate means a burst of queued events can never delay an attempt
 * flush, or vice versa.
 */

const DB_NAME = "examprep-games-offline";
const STORE_NAME = "pending-events";
const DB_VERSION = 2; // bumped from attemptQueue.ts's version 1 to add this store

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      // "pending-attempts" (attemptQueue.ts's store) is created by ITS
      // own onupgradeneeded when that module's openDb runs first — both
      // modules check contains() before creating, so whichever opens
      // the DB first this session safely creates only what's missing,
      // regardless of call order.
      if (!db.objectStoreNames.contains("pending-attempts")) {
        db.createObjectStore("pending-attempts", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueEvent(event: AnalyticsEvent): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(event);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllPending(): Promise<{ id: number; event: AnalyticsEvent }[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const raw = request.result as (AnalyticsEvent & { id: number })[];
      resolve(raw.map((r) => ({ id: r.id, event: r })));
    };
    request.onerror = () => reject(request.error);
  });
}

async function removePending(id: number): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Call on reconnect (e.g. window 'online' event) to flush anything
 *  queued while offline — same trigger point lib/analytics/track.ts
 *  wires up as attemptQueue.ts's flushPendingAttempts. */
export async function flushPendingEvents(): Promise<void> {
  const pending = await getAllPending();
  for (const { id, event } of pending) {
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event)
      });
      if (!response.ok) throw new Error(`POST /api/events failed: ${response.status}`);
      await removePending(id);
    } catch {
      // Leave it queued; will retry on the next flush trigger. Stop
      // processing further items this pass to avoid hammering a still-
      // down connection — same reasoning as attemptQueue.ts's flush.
      break;
    }
  }
}
