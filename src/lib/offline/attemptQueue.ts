"use client";

import type { AttemptResult } from "@/types/result";
import { activeExportAdapter } from "@/lib/export";

/**
 * Buffers AttemptResults in IndexedDB when the network is unavailable, and
 * flushes them to whichever ExportAdapter is currently active once
 * connectivity returns. Engines and GameRuntime never need to know whether
 * the device is online — they always call reportAttempt(); this module is
 * what guarantees nothing gets lost in between.
 *
 * NOTE: this file is marked "use client" since IndexedDB is browser-only.
 * activeExportAdapter ultimately calls server-side Supabase code via API
 * routes in the real flow (GameRuntime posts to /api/attempts), not directly
 * from the browser — see components/runtime/GameRuntime.tsx.
 */

const DB_NAME = "examprep-games-offline";
const STORE_NAME = "pending-attempts";
// Bumped from 1 to 2 alongside lib/offline/eventQueue.ts's addition of a
// second store ("pending-events") in the same database — both modules
// must request the SAME version number for the same DB_NAME, or
// whichever opens first with a stale version blocks the other's
// onupgradeneeded from ever running. See eventQueue.ts's header for why
// analytics events get their own store rather than reusing this one.
const DB_VERSION = 2;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
      // "pending-events" (eventQueue.ts's store) — created here too, not
      // just there, for the same reason eventQueue.ts also creates
      // "pending-attempts": IndexedDB only runs onupgradeneeded for
      // whichever module's open() call happens to win the race on a
      // given page load, so each module must be able to fully set up
      // the schema on its own regardless of which one runs first.
      if (!db.objectStoreNames.contains("pending-events")) {
        db.createObjectStore("pending-events", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueAttempt(result: AttemptResult): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(result);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllPending(): Promise<{ id: number; result: AttemptResult }[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const raw = request.result as (AttemptResult & { id: number })[];
      resolve(raw.map((r) => ({ id: r.id, result: r })));
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

/** Call on reconnect (e.g. window 'online' event) to flush anything queued while offline. */
export async function flushPendingAttempts(): Promise<void> {
  const pending = await getAllPending();
  for (const { id, result } of pending) {
    try {
      await activeExportAdapter.reportAttempt(result);
      await removePending(id);
    } catch {
      // Leave it queued; will retry on the next flush trigger. Stop processing
      // further items this pass to avoid hammering a still-down connection.
      break;
    }
  }
}
