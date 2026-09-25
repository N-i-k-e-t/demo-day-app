-- ============================================================
-- Supabase Schema for Startup Demo — Live Pitch System
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Interaction Feed — records ALL interactions/events
create table if not exists interaction_feed (
  id bigint generated always as identity primary key,
  event_type text not null,
  actor_id text,
  actor_name text,
  actor_email text,
  startup_id text,
  startup_name text,
  response_type text,
  detail text,
  metadata jsonb default '{}'::jsonb,
  device_info text,
  ip_hint text,
  created_at timestamptz not null default now()
);

-- 2. Investor Registrations (production sessions)
create table if not exists demo_investors (
  id bigint generated always as identity primary key,
  investor_key text not null unique,
  full_name text not null,
  email text not null,
  session_token text,
  last_active timestamptz,
  joined_at timestamptz not null default now()
);


-- 3. Investor Responses (immutable, one per investor per startup)
create table if not exists demo_responses (
  id bigint generated always as identity primary key,
  investor_key text not null,
  startup_id text not null,
  startup_name text,
  response_type text not null check(response_type in ('INTERESTED','EXPLORE','NOT_INTERESTED')),
  recorded_at timestamptz not null default now(),
  idempotency_key text not null unique
);

-- 4. Admin Actions Log
create table if not exists demo_admin_actions (
  id bigint generated always as identity primary key,
  action_type text not null,
  detail text,
  state_snapshot jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 5. Event State (single row, upserted)
create table if not exists demo_event_state (
  id int primary key default 1 check (id = 1),
  event_status text not null default 'READY',
  current_pitch int not null default 1,
  state_version bigint not null default 1,
  total_responses int not null default 0,
  stage_status text not null default 'STANDBY',
  published_data jsonb default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Initialize the single event state row
insert into demo_event_state (id) values (1) on conflict (id) do nothing;

-- Indexes for fast queries
create index if not exists idx_feed_created on interaction_feed(created_at desc);
create index if not exists idx_feed_type on interaction_feed(event_type);
create index if not exists idx_feed_actor on interaction_feed(actor_id);
create index if not exists idx_responses_investor on demo_responses(investor_key);
create index if not exists idx_responses_startup on demo_responses(startup_id);

-- Enable Row Level Security (RLS) - allow anon insert/read for demo
alter table interaction_feed enable row level security;
alter table demo_investors enable row level security;
alter table demo_responses enable row level security;
alter table demo_admin_actions enable row level security;
alter table demo_event_state enable row level security;

-- Policies: allow anon key full access for demo
create policy "Allow all on interaction_feed" on interaction_feed for all using (true) with check (true);
create policy "Allow all on demo_investors" on demo_investors for all using (true) with check (true);
create policy "Allow all on demo_responses" on demo_responses for all using (true) with check (true);
create policy "Allow all on demo_admin_actions" on demo_admin_actions for all using (true) with check (true);
create policy "Allow all on demo_event_state" on demo_event_state for all using (true) with check (true);
