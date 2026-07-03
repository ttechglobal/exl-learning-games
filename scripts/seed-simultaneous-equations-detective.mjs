#!/usr/bin/env node
/**
 * scripts/seed-simultaneous-equations-detective.mjs
 *
 * Seeds (or re-seeds) simultaneous-equations-detective into Supabase via the dev server.
 *
 * Usage (run from the project root):
 *   node scripts/seed-simultaneous-equations-detective.mjs           # insert
 *   node scripts/seed-simultaneous-equations-detective.mjs --fresh   # delete then insert
 *
 * The dev server must be running (npm run dev) before running this.
 */
import { readFileSync } from "fs";
import { join } from "path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const fresh = process.argv.includes("--fresh");
const SLUG = "simultaneous-equations-detective";

// Use process.cwd() so this works reliably on Windows regardless of
// how import.meta.url resolves — always run from the project root.
const gameData = JSON.parse(
  readFileSync(
    join(process.cwd(), "src/content/games/mathematics/simultaneous-equations-detective.json"),
    "utf-8"
  )
);

async function run() {
  console.log(`Seeding ${SLUG} → ${BASE}/api/games`);

  if (fresh) {
    console.log("  Deleting existing record...");
    const del = await fetch(`${BASE}/api/games?slug=${SLUG}`, { method: "DELETE" });

    if (del.status === 404) {
      console.log("  (no existing record to delete, continuing)");
    } else if (!del.ok) {
      const body = await del.json().catch(() => ({}));
      if (del.status === 405) {
        console.error("❌  The /api/games route doesn't have a DELETE handler yet.");
        console.error("    Deploy the updated src/app/api/games/route.ts first.");
        return false;
      }
      console.warn(`  Delete returned ${del.status}:`, body.error ?? "(unknown)");
    } else {
      const body = await del.json().catch(() => ({}));
      console.log("  Deleted:", body.deleted ?? "ok");
    }
  }

  const res = await fetch(`${BASE}/api/games`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(gameData),
  });

  const body = await res.json().catch(() => ({}));

  if (res.ok) {
    console.log("✅  Simultaneous Equations: Math Detective seeded!");
    console.log("    Game ID:    ", body.game?.id ?? "—");
    console.log("    Missions:   ", gameData.missions.length);
    console.log("    Play at:     http://localhost:3000/play/simultaneous-equations-detective");
    return true;
  }

  const msg = body.error ?? JSON.stringify(body);
  if (msg.includes("duplicate") || msg.includes("unique")) {
    console.error("❌  Already exists. Run with --fresh to replace it:");
    console.error(`    node scripts/seed-simultaneous-equations-detective.mjs --fresh`);
  } else {
    console.error("❌  Seeding failed:", msg);
  }
  return false;
}

run().then((ok) => {
  if (!ok) process.exitCode = 1;
});
