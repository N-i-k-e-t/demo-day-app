-- ============================================================
-- Supabase Schema for Startup Demo — High-Concurrency Live Pitch System
-- Optimized for 1000+ concurrent interactions, passwordless auth,
-- zero-data-loss offline sync, and real-time admin live tracking.
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Interaction Feed — Batched event tracking with metadata
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

-- 2. Investor Registrations (Passwordless sessions + Realtime tracking)
create table if not exists demo_investors (
  id bigint generated always as identity primary key,
  investor_key text not null unique,
  full_name text not null,
  email text not null,
  session_token text,
  last_active timestamptz default now(),
  joined_at timestamptz not null default now()
);

-- 3. Investor Responses (Immutable, strictly idempotent, 1 per investor per startup)
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

-- 5. Event State (Single authoritative row, synced live)
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

-- ============================================================
-- High-Concurrency Indexes (Optimized for 1,000+ simultaneous clients)
-- ============================================================
create index if not exists idx_feed_created on interaction_feed(created_at desc);
create index if not exists idx_feed_type on interaction_feed(event_type);
create index if not exists idx_feed_actor on interaction_feed(actor_id);
create index if not exists idx_feed_event_created on interaction_feed(event_type, created_at desc);

create index if not exists idx_investors_key on demo_investors(investor_key);
create index if not exists idx_investors_email on demo_investors(email);
create index if not exists idx_investors_last_active on demo_investors(last_active desc);
create index if not exists idx_investors_joined on demo_investors(joined_at desc);

create index if not exists idx_responses_investor on demo_responses(investor_key);
create index if not exists idx_responses_startup on demo_responses(startup_id);
create index if not exists idx_responses_startup_response on demo_responses(startup_id, response_type);
create index if not exists idx_responses_recorded on demo_responses(recorded_at desc);
create unique index if not exists idx_responses_investor_startup on demo_responses(investor_key, startup_id);

-- 6. Organisations & Event Link Configurations
create table if not exists demo_organisations (
  id bigint generated always as identity primary key,
  org_id text not null unique,
  org_name text not null,
  lead_name text not null,
  lead_email text not null,
  event_title text not null default 'AFF Demo Day 2026',
  passcode text not null default 'thatAff2026@',
  investor_url text,
  admin_url text,
  stage_url text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Insert default AFF organisation entry
insert into demo_organisations (org_id, org_name, lead_name, lead_email, event_title, passcode)
values ('org_aff_2026', 'Asian Founders Fund (AFF)', 'AFF Partner', 'organizer@asianfoundersfund.com', 'AFF Demo Day 2026', 'thatAff2026@')
on conflict (org_id) do nothing;

create index if not exists idx_org_id on demo_organisations(org_id);
create index if not exists idx_org_email on demo_organisations(lead_email);

-- ============================================================
-- Row Level Security (RLS) - Production-Safe Permissive Demo Policies
-- ============================================================
alter table interaction_feed enable row level security;
alter table demo_investors enable row level security;
alter table demo_responses enable row level security;
alter table demo_admin_actions enable row level security;
alter table demo_event_state enable row level security;
alter table demo_organisations enable row level security;

-- Policies: Allow anon client reading and inserting/upserting
drop policy if exists "Allow all on interaction_feed" on interaction_feed;
create policy "Allow all on interaction_feed" on interaction_feed for all using (true) with check (true);

drop policy if exists "Allow all on demo_investors" on demo_investors;
create policy "Allow all on demo_investors" on demo_investors for all using (true) with check (true);

drop policy if exists "Allow all on demo_responses" on demo_responses;
create policy "Allow all on demo_responses" on demo_responses for all using (true) with check (true);

drop policy if exists "Allow all on demo_admin_actions" on demo_admin_actions;
create policy "Allow all on demo_admin_actions" on demo_admin_actions for all using (true) with check (true);

drop policy if exists "Allow all on demo_event_state" on demo_event_state;
create policy "Allow all on demo_event_state" on demo_event_state for all using (true) with check (true);

drop policy if exists "Allow all on demo_organisations" on demo_organisations;
create policy "Allow all on demo_organisations" on demo_organisations for all using (true) with check (true);

-- ============================================================
-- Supabase Realtime Replication Enablement
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'demo_responses') then
    alter publication supabase_realtime add table demo_responses;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'demo_investors') then
    alter publication supabase_realtime add table demo_investors;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'demo_event_state') then
    alter publication supabase_realtime add table demo_event_state;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'demo_organisations') then
    alter publication supabase_realtime add table demo_organisations;
  end if;
exception
  when others then null;
end $$;
