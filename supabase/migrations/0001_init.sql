-- 0001_init.sql
-- Initial schema for the ExamPrep Learning Games Engine.
-- This replaces the Prisma schema from the architecture doc's Section 4 —
-- same shapes, same column names, expressed as raw SQL for Supabase's
-- migration tooling instead of Prisma's DSL. No ORM client generates
-- types from this; src/types/db.ts hand-mirrors these shapes for now.

create extension if not exists "pgcrypto";

create type difficulty as enum ('EASY', 'MEDIUM', 'HARD');

create table game (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  engine_type   text not null,             -- e.g. 'particle-assembly', 'multi-stage'
  subject       text not null,             -- 'chemistry', 'biology', etc. — mirrors content/games/<subject>/
  topic_id      text not null,             -- main platform curriculum ID (string, no FK — no shared DB)
  subtopic_id   text,
  shared_config jsonb not null default '{}'::jsonb,  -- engine-specific payload not tied to one mission
  snapshot      jsonb not null default '{}'::jsonb,  -- Concept Snapshot content { lines, readTimeSec }
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table mission (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid not null references game(id) on delete cascade,
  mission_key     text not null,            -- engine-local id, e.g. 'carbon-14' (matches content JSON)
  title           text not null,
  difficulty      difficulty not null,
  sequence_index  integer not null,         -- default play order; fixedOrderPolicy reads this directly
  xp_reward       integer not null,
  topic_id        text not null,
  subtopic_id     text,
  payload         jsonb not null default '{}'::jsonb,  -- engine-specific target/content for THIS mission
  is_active       boolean not null default true,

  unique (game_id, mission_key)
);
create index mission_game_sequence_idx on mission (game_id, sequence_index);

create table student (
  id            uuid primary key default gen_random_uuid(),
  external_id   text unique,               -- main platform's student ID, once integration lands
  display_name  text not null,
  xp_total      integer not null default 0,
  created_at    timestamptz not null default now()
);

create table attempt (
  id                       uuid primary key default gen_random_uuid(),
  student_id               uuid not null references student(id) on delete cascade,
  game_id                  uuid not null references game(id) on delete cascade,
  mission_id               uuid references mission(id) on delete set null,
  topic_id                 text not null,
  subtopic_id              text,
  success                  boolean,        -- null when mechanic uses continuous score instead
  score                    real,           -- 0-1 normalized; null for pure pass/fail mechanics
  time_spent_sec           integer,
  attempts_before_success  integer,        -- engine-reported retry count; a free struggle/difficulty signal
  xp_awarded               integer not null default 0,
  raw_outcome              jsonb not null default '{}'::jsonb,  -- engine's untouched output, for debugging
  completed_at             timestamptz not null default now()
);
create index attempt_student_topic_idx on attempt (student_id, topic_id);
create index attempt_game_idx on attempt (game_id);

create table topic_progress (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references student(id) on delete cascade,
  topic_id        text not null,
  subtopic_id     text,
  mastery_score   real not null default 0,   -- 0-1, weighted-average per lib/scoring/masteryFormula.ts
  attempts_count  integer not null default 0,
  is_mastered     boolean not null default false,
  updated_at      timestamptz not null default now(),

  unique (student_id, topic_id, subtopic_id)
);

-- updated_at maintenance (Prisma did this automatically via @updatedAt; Supabase needs an explicit trigger)
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger game_set_updated_at before update on game
  for each row execute function set_updated_at();

create trigger topic_progress_set_updated_at before update on topic_progress
  for each row execute function set_updated_at();

-- Row Level Security: enabled but permissive for now since auth (Section "open items")
-- is still undecided. Tighten these policies once student/admin auth is wired up.
alter table game enable row level security;
alter table mission enable row level security;
alter table student enable row level security;
alter table attempt enable row level security;
alter table topic_progress enable row level security;

create policy "games are publicly readable" on game for select using (true);
create policy "missions are publicly readable" on mission for select using (true);
-- No public write policies yet — writes happen via the service role key in API routes only,
-- which bypasses RLS. Add scoped policies here once student/admin auth lands.
