-- Alliance Codex / Phase 2
-- Source, provenance, import and staging governance.

create table public.source_registry (
  source_key text primary key,
  name text not null,
  source_type text not null,
  url text,
  authority public.authority_level not null,
  scope text[] not null default '{}'::text[],
  languages public.locale_code[] not null default '{}'::public.locale_code[],
  freshness_policy text,
  last_checked_at timestamptz,
  last_successful_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_registry_key_not_blank check (length(trim(source_key)) > 0),
  constraint source_registry_name_not_blank check (length(trim(name)) > 0)
);

create table public.source_snapshots (
  snapshot_id uuid primary key default gen_random_uuid(),
  source_key text not null references public.source_registry(source_key),
  snapshot_kind text not null,
  locator text not null,
  content_digest char(64),
  captured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint source_snapshot_digest_sha256 check (
    content_digest is null or content_digest ~ '^[A-Fa-f0-9]{64}$'
  )
);

create index source_snapshots_source_captured_idx
  on public.source_snapshots (source_key, captured_at desc);

create table public.evidence_records (
  evidence_key text primary key,
  source_key text not null references public.source_registry(source_key),
  source_snapshot_id uuid references public.source_snapshots(snapshot_id),
  locator text not null,
  retrieved_at timestamptz not null,
  content_digest char(64),
  captured_excerpt text,
  raw_retention text not null default 'excerpt_only',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint evidence_digest_sha256 check (
    content_digest is null or content_digest ~ '^[A-Fa-f0-9]{64}$'
  ),
  constraint evidence_retention_allowed check (
    raw_retention in ('none', 'excerpt_only', 'private_review')
  )
);

create index evidence_records_source_retrieved_idx
  on public.evidence_records (source_key, retrieved_at desc);

create table public.unknowns (
  unknown_key text primary key,
  domain text not null,
  status text not null,
  need text not null,
  known text,
  last_checked_at timestamptz,
  notes text,
  constraint unknown_key_not_blank check (length(trim(unknown_key)) > 0)
);

create table public.conflicts (
  conflict_key text primary key,
  domain text not null,
  severity text not null,
  status text not null,
  notes text,
  resolution text,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint conflict_status_allowed check (status in ('open', 'resolved', 'accepted_uncertainty', 'deferred'))
);

create table public.import_runs (
  run_id uuid primary key default gen_random_uuid(),
  source_key text not null references public.source_registry(source_key),
  input_locator text not null,
  input_digest char(64),
  extractor_key text not null,
  extractor_version text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status public.import_status not null default 'queued',
  records_read integer not null default 0 check (records_read >= 0),
  records_accepted integer not null default 0 check (records_accepted >= 0),
  records_rejected integer not null default 0 check (records_rejected >= 0),
  report jsonb not null default '{}'::jsonb,
  constraint import_run_digest_sha256 check (
    input_digest is null or input_digest ~ '^[A-Fa-f0-9]{64}$'
  ),
  constraint import_run_completion_order check (
    completed_at is null or completed_at >= started_at
  )
);

create index import_runs_source_started_idx
  on public.import_runs (source_key, started_at desc);

create unique index import_runs_source_digest_extractor_uidx
  on public.import_runs (source_key, input_digest, extractor_key, extractor_version)
  where input_digest is not null;

create table public.staging_records (
  staging_record_id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.import_runs(run_id) on delete cascade,
  staging_key text not null,
  domain text not null,
  raw_payload jsonb not null,
  record_hash char(64),
  state public.staging_state not null default 'received',
  validation_issues jsonb not null default '[]'::jsonb,
  source_locator text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staging_key_not_blank check (length(trim(staging_key)) > 0),
  constraint staging_record_hash_sha256 check (
    record_hash is null or record_hash ~ '^[A-Fa-f0-9]{64}$'
  ),
  unique (run_id, staging_key)
);

create index staging_records_state_domain_idx
  on public.staging_records (state, domain, created_at desc);
