/**
 * scripts/seed.ts
 *
 * Loads JSON files under src/content/games/<subject>/ and POSTs them to
 * /api/games, so seed data goes through the same Zod validation as the
 * admin panel would use — no separate "trusted seed data" path that could
 * drift from what's actually enforced at write-time.
 *
 * Only seeds games in SEED_SLUGS by default — Build The Atom's content file
 * exists and is valid, but isn't currently being promoted as a featured
 * game (its visual design has been through several iterations and isn't
 * the current best foot forward), so it's deliberately excluded here
 * rather than seeded just because the file exists. Add "build-the-atom" to
 * SEED_SLUGS, or pass --all, when that changes.
 *
 * Run with: npx tsx scripts/seed.ts (requires the dev server running locally,
 * since this hits the Next.js API route rather than writing to Supabase directly)
 */
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const CONTENT_DIR = join(process.cwd(), "src", "content", "games");
const API_BASE = process.env.SEED_API_BASE ?? "http://localhost:3000";
const SEED_ALL = process.argv.includes("--all");
const SEED_SLUGS = ["atom-forge", "element-hunter"];

async function main() {
  const subjects = readdirSync(CONTENT_DIR, { withFileTypes: true }).filter((e) => e.isDirectory());

  for (const subjectDir of subjects) {
    const subjectPath = join(CONTENT_DIR, subjectDir.name);
    const files = readdirSync(subjectPath).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      const raw = readFileSync(join(subjectPath, file), "utf-8");
      const payload = JSON.parse(raw);

      if (!SEED_ALL && !SEED_SLUGS.includes(payload.slug)) {
        console.log(`Skipping ${subjectDir.name}/${file} (slug "${payload.slug}" not in SEED_SLUGS — pass --all to seed everything)`);
        continue;
      }

      console.log(`Seeding ${subjectDir.name}/${file}...`);
      const response = await fetch(`${API_BASE}/api/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: raw
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`  FAILED (${response.status}): ${body}`);
        continue;
      }
      console.log(`  OK`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
