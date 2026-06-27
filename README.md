# ExamPrep Learning Games Engine

Games layer for ExamPrep (WAEC/JAMB exam prep platform). Standalone Next.js
repo, Supabase for the database. See `examprep-games-architecture-v2.md`
(in the project's docs) for the full design rationale — this README is just
setup steps.

## Stack

- Next.js 14 (App Router), TypeScript
- Supabase (Postgres + JS client — no ORM)
- Zod for config validation
- Plain CSS Modules for component styling (no Tailwind/UI framework)
- HTML5/CSS/SVG for gameplay rendering — no canvas/WebGL engine

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create a Supabase project** at https://supabase.com, then copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Project Settings → API
   - `SUPABASE_SERVICE_ROLE_KEY` — same page, the service role secret (server-only, never commit this)

3. **Run the migration** against your Supabase project:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   This applies `supabase/migrations/0001_init.sql` — creates the `game`, `mission`, `student`, `attempt`, and `topic_progress` tables.

4. **Create a placeholder student row** (no auth wired up yet — see architecture doc open items). In the Supabase SQL editor:
   ```sql
   insert into student (id, display_name) values
   ('00000000-0000-0000-0000-000000000000', 'Test Student');
   ```
   This matches `PLACEHOLDER_STUDENT_ID` in `src/app/(player)/play/[gameSlug]/page.tsx`.

5. **Run the dev server**
   ```bash
   npm run dev
   ```

6. **Seed Build The Atom** (in a second terminal, with the dev server running):
   ```bash
   npx tsx scripts/seed.ts
   ```

7. Visit `http://localhost:3000/worlds` to see the world map, or jump straight to `http://localhost:3000/play/build-the-atom`.

## Where things live

- `src/engines/` — gameplay mechanics, one folder per *interaction shape* (not per game)
- `src/content/games/<subject>/` — game content as JSON, organized by subject
- `src/motion/` — shared visual/motion/touch/sound system; engines should pull from here before writing bespoke animation
- `src/lib/difficulty/` — sequencing policy (separate from engines on purpose)
- `src/lib/export/` — the integration seam for cross-app sync later

See the architecture doc for the full reasoning behind each of these.
