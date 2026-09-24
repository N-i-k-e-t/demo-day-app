-- Production data model for Startup Demo / Live Pitch Investor Engagement System
create table if not exists events (
  id uuid primary key,
  name text not null,
  status text not null default 'READY',
  current_pitch int not null default 1,
  state_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists investors (
  id uuid primary key,
  event_id uuid not null references events(id),
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  unique(event_id, email)
);

create table if not exists investor_sessions (
  id uuid primary key,
  investor_id uuid not null references investors(id),
  event_id uuid not null references events(id),
  session_token_hash text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists pitches (
  id uuid primary key,
  event_id uuid not null references events(id),
  pitch_number int not null,
  company_name text not null,
  startup_slide_image text,
  logo_asset text,
  duration_seconds int,
  created_at timestamptz not null default now(),
  unique(event_id, pitch_number)
);

create table if not exists responses (
  id uuid primary key,
  event_id uuid not null references events(id),
  investor_id uuid not null references investors(id),
  pitch_id uuid not null references pitches(id),
  response_type text not null check(response_type in ('INTERESTED','EXPLORE','NOT_INTERESTED')),
  idempotency_key text not null,
  server_timestamp timestamptz not null default now(),
  unique(event_id, investor_id, pitch_id),
  unique(idempotency_key)
);

create table if not exists response_events (
  id uuid primary key,
  event_id uuid not null references events(id),
  investor_id uuid references investors(id),
  pitch_id uuid references pitches(id),
  response_type text,
  idempotency_key text,
  accepted boolean not null,
  rejection_reason text,
  server_timestamp timestamptz not null default now()
);

create table if not exists stage_metric_versions (
  id uuid primary key,
  event_id uuid not null references events(id),
  pitch_id uuid not null references pitches(id),
  version int not null,
  interested_pct numeric not null,
  explore_pct numeric not null,
  not_interested_pct numeric not null,
  published_by uuid,
  published_at timestamptz not null default now(),
  unique(event_id, pitch_id, version)
);

create table if not exists admin_actions (
  id uuid primary key,
  event_id uuid not null references events(id),
  admin_id uuid,
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  state_version bigint,
  created_at timestamptz not null default now()
);

create index if not exists responses_event_pitch_idx on responses(event_id, pitch_id);
create index if not exists response_events_event_idx on response_events(event_id, server_timestamp desc);
