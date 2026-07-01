#!/usr/bin/env node
/**
 * scripts/seed-mirror-lab.mjs
 *
 * Seeds (or re-seeds) mirror-lab into Supabase via the dev server.
 *
 * Usage:
 *   node scripts/seed-mirror-lab.mjs           # insert (fails if exists)
 *   node scripts/seed-mirror-lab.mjs --fresh   # delete then insert
 *
 * The dev server must be running (npm run dev) before running this.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const fresh = process.argv.includes("--fresh");

const gameData = JSON.parse(
  readFileSync(join(__dir, "../src/content/games/physics/mirror-lab.json"), "utf-8")
);

async function run() {
  console.log(`Seeding mirror-lab → ${BASE}/api/games`);

  if (fresh) {
    console.log("  Deleting existing record...");
    const del = await fetch(`${BASE}/api/games?slug=mirror-lab`, { method: "DELETE" });

    if (del.status === 404) {
      console.log("  (no existing record to delete, continuing)");
    } else if (!del.ok) {
      const body = await del.json().catch(() => ({}));
      // 405 = DELETE handler missing — user needs to update the API route
      if (del.status === 405) {
        console.error("❌  The /api/games route doesn't have a DELETE handler yet.");
        console.error("    Deploy the updated src/app/api/games/route.ts first,");
        console.error("    or delete the record manually in your Supabase dashboard.");
        console.error("    Then run this script again.");
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
    console.log("✅  Mirror Lab seeded!");
    console.log("    Game ID:       ", body.game?.id ?? "—");
    console.log("    Progression:   ", gameData.progressionMode);
    console.log("    Missions:      ", gameData.missions.length);
    return true;
  }

  const msg = body.error ?? JSON.stringify(body);
  if (msg.includes("duplicate") || msg.includes("unique")) {
    console.error("❌  Already exists. Run with --fresh to replace it:");
    console.error("    node scripts/seed-mirror-lab.mjs --fresh");
  } else {
    console.error("❌  Seeding failed:", msg);
  }
  return false;
}

// Don't call process.exit() inside the async callback — it causes
// "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" on Windows
// when the process tries to exit while a fetch handle is still active.
run().then((ok) => {
  if (!ok) process.exitCode = 1;
});
