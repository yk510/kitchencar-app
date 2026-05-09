begin;

create extension if not exists pgcrypto;

create table if not exists public.audio_capture_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'recording' check (status in ('recording', 'paused', 'completed', 'failed')),
  device_label text,
  microphone_label text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audio_capture_chunks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.audio_capture_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_sec integer not null default 0,
  storage_bucket text,
  storage_path text,
  audio_file_url text,
  upload_status text not null default 'pending' check (upload_status in ('pending', 'uploaded', 'failed')),
  transcription_status text not null default 'pending' check (transcription_status in ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audio_transcripts (
  id uuid primary key default gen_random_uuid(),
  chunk_id uuid not null references public.audio_capture_chunks(id) on delete cascade,
  session_id uuid not null references public.audio_capture_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  spoken_at timestamptz not null,
  speaker_type text not null default 'staff' check (speaker_type in ('staff', 'unknown')),
  transcript_text text not null,
  confidence numeric(5,4),
  created_at timestamptz not null default now()
);

create table if not exists public.audio_order_events (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references public.audio_transcripts(id) on delete cascade,
  session_id uuid not null references public.audio_capture_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.product_master(id) on delete set null,
  product_name_raw text not null,
  normalized_product_name text,
  quantity integer not null default 1,
  confidence numeric(5,4),
  event_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.product_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.product_master(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_alias)
);

create index if not exists idx_audio_capture_sessions_user_id
  on public.audio_capture_sessions(user_id);

create index if not exists idx_audio_capture_chunks_session_id
  on public.audio_capture_chunks(session_id);

create index if not exists idx_audio_capture_chunks_user_id
  on public.audio_capture_chunks(user_id);

create index if not exists idx_audio_transcripts_session_id
  on public.audio_transcripts(session_id);

create index if not exists idx_audio_transcripts_user_spoken_at
  on public.audio_transcripts(user_id, spoken_at desc);

create index if not exists idx_audio_order_events_user_event_at
  on public.audio_order_events(user_id, event_at desc);

create index if not exists idx_audio_order_events_product_id
  on public.audio_order_events(product_id);

create index if not exists idx_product_aliases_user_product_id
  on public.product_aliases(user_id, product_id);

alter table public.audio_capture_sessions enable row level security;
alter table public.audio_capture_chunks enable row level security;
alter table public.audio_transcripts enable row level security;
alter table public.audio_order_events enable row level security;
alter table public.product_aliases enable row level security;

drop policy if exists "authenticated_own_rows" on public.audio_capture_sessions;
drop policy if exists "authenticated_own_rows" on public.audio_capture_chunks;
drop policy if exists "authenticated_own_rows" on public.audio_transcripts;
drop policy if exists "authenticated_own_rows" on public.audio_order_events;
drop policy if exists "authenticated_own_rows" on public.product_aliases;

create policy "authenticated_own_rows" on public.audio_capture_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "authenticated_own_rows" on public.audio_capture_chunks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "authenticated_own_rows" on public.audio_transcripts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "authenticated_own_rows" on public.audio_order_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "authenticated_own_rows" on public.product_aliases
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

commit;
