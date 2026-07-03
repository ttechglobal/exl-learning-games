#!/usr/bin/env node
import { readFileSync } from "fs";
import { join } from "path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const fresh = process.argv.includes("--fresh");
const SLUG = "nova-explorer";

// Always use process.cwd() — NOT import.meta.url.
// import.meta.url resolves unreliably on Windows.
const gameData = JSON.parse(
  readFileSync(
    join(process.cwd(), "src/content/games/mathematics/nova-explorer.json"),
    "utf-8"
  )
);

async function run() {
  console.log(`Seeding ${SLUG} → ${BASE}/api/games`);

  if (fresh) {
    console.log("  Deleting existing record...");
    const del = await fetch(`${BASE}/api/games?slug=${SLUG}`, { method: "DELETE" });
    if (del.status === 404 || del.status === 500) {
      console.log("  (no existing record — skipping delete)");
    } else if (del.ok) {
      const body = await del.json().catch(() => ({}));
      console.log("  Deleted:", body.deleted ?? "ok");
    } else {
      console.warn(`  Delete returned ${del.status}`);
    }
  }

  console.log("  Inserting...");
  const res = await fetch(`${BASE}/api/games`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(gameData),
  });

  const rawText = await res.text();
  console.log(`  Response status: ${res.status}`);

  let body = {};
  try { body = JSON.parse(rawText); } catch (_) {}

  if (res.ok) {
    console.log("✅  Seeded!");
    console.log("    Game ID:  ", body.game?.id ?? "—");
    console.log("    Missions: ", gameData.missions.length);
    console.log("    Play at:   http://localhost:3000/play/nova-explorer");
    return true;
  }

  const msg = body.error ?? rawText;
  if (msg.includes("duplicate") || msg.includes("unique")) {
    console.error("❌  Already exists. Run with --fresh to replace it.");
  } else {
    console.error("❌  Seeding failed:", msg);
  }
  return false;
}

run().then((ok) => {
  if (!ok) process.exitCode = 1;
});
