-- ============================================================
-- 主催者・募集管理機能 migration
-- ============================================================

create table if not exists user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'vendor',
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists vendor_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null,
  owner_name text,
  contact_email text,
  phone text,
  main_menu text,
  logo_image_url text,
  instagram_url text,
  x_url text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organizer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organizer_name text not null,
  contact_name text,
  contact_email text,
  phone text,
  logo_image_url text,
  instagram_url text,
  x_url text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists event_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organizer_profile_id uuid references auth.users(id) on delete set null,
  title text not null,
  event_date date not null,
  event_end_date date,
  venue_name text not null,
  venue_address text,
  municipality text,
  recruitment_count integer not null default 1,
  fee_type text not null default 'fixed',
  stall_fee integer,
  revenue_share_rate numeric(5,2),
  application_deadline date,
  load_in_start_time time,
  load_in_end_time time,
  sales_start_time time,
  sales_end_time time,
  load_out_start_time time,
  load_out_end_time time,
  provided_facilities text[] default '{}',
  photo_urls text[] default '{}',
  venue_features text,
  recruitment_purpose text,
  required_equipment text,
  notes text,
  status text not null default 'draft',
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists event_applications (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references event_offers(id) on delete cascade,
  organizer_user_id uuid not null references auth.users(id) on delete cascade,
  vendor_user_id uuid not null references auth.users(id) on delete cascade,
  vendor_profile_id uuid references auth.users(id) on delete set null,
  vendor_business_name text not null,
  vendor_contact_name text,
  vendor_contact_email text,
  vendor_phone text,
  initial_message text,
  status text not null default 'pending',
  contact_released_at timestamptz,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (offer_id, vendor_user_id)
);

alter table event_applications
add column if not exists status text not null default 'pending',
add column if not exists contact_released_at timestamptz;

create table if not exists application_messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references event_applications(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null,
  message text not null,
  read_by_vendor_at timestamptz,
  read_by_organizer_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists vendor_daily_memos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memo_date date not null,
  memo_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, memo_date)
);

create table if not exists vendor_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start_date date not null,
  week_end_date date not null,
  report_title text not null,
  weekly_summary text not null,
  ai_feedback text not null,
  source_note_count integer not null default 0,
  source_sales integer not null default 0,
  helpful_feedback boolean,
  helpful_marked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start_date, week_end_date)
);

create index if not exists idx_event_offers_user_id on event_offers(user_id);
create index if not exists idx_event_offers_event_date on event_offers(event_date);
create index if not exists idx_event_offers_status on event_offers(status);
create index if not exists idx_event_applications_offer_id on event_applications(offer_id);
create index if not exists idx_event_applications_vendor_user_id on event_applications(vendor_user_id);
create index if not exists idx_event_applications_organizer_user_id on event_applications(organizer_user_id);
create index if not exists idx_application_messages_application_id on application_messages(application_id);
create index if not exists idx_vendor_daily_memos_user_id on vendor_daily_memos(user_id);
create index if not exists idx_vendor_daily_memos_memo_date on vendor_daily_memos(memo_date);
create index if not exists idx_vendor_weekly_reports_user_id on vendor_weekly_reports(user_id);
create index if not exists idx_vendor_weekly_reports_week_start_date on vendor_weekly_reports(week_start_date);

drop trigger if exists trg_organizer_profiles_updated_at on organizer_profiles;
create trigger trg_organizer_profiles_updated_at
before update on organizer_profiles
for each row execute function set_updated_at();

drop trigger if exists trg_vendor_profiles_updated_at on vendor_profiles;
create trigger trg_vendor_profiles_updated_at
before update on vendor_profiles
for each row execute function set_updated_at();

drop trigger if exists trg_user_profiles_updated_at on user_profiles;
create trigger trg_user_profiles_updated_at
before update on user_profiles
for each row execute function set_updated_at();

drop trigger if exists trg_event_offers_updated_at on event_offers;
create trigger trg_event_offers_updated_at
before update on event_offers
for each row execute function set_updated_at();

drop trigger if exists trg_event_applications_updated_at on event_applications;
create trigger trg_event_applications_updated_at
before update on event_applications
for each row execute function set_updated_at();

drop trigger if exists trg_vendor_daily_memos_updated_at on vendor_daily_memos;
create trigger trg_vendor_daily_memos_updated_at
before update on vendor_daily_memos
for each row execute function set_updated_at();

drop trigger if exists trg_vendor_weekly_reports_updated_at on vendor_weekly_reports;
create trigger trg_vendor_weekly_reports_updated_at
before update on vendor_weekly_reports
for each row execute function set_updated_at();

alter table user_profiles enable row level security;
alter table vendor_profiles enable row level security;
alter table organizer_profiles enable row level security;
alter table event_offers enable row level security;
alter table event_applications enable row level security;
alter table application_messages enable row level security;
alter table vendor_daily_memos enable row level security;
alter table vendor_weekly_reports enable row level security;

create or replace function get_organizer_public_profile(target_user_id uuid)
returns table (
  organizer_name text,
  contact_name text,
  logo_image_url text,
  instagram_url text,
  x_url text,
  description text
)
language sql
security definer
set search_path = public
as $$
  select
    organizer_name,
    contact_name,
    logo_image_url,
    instagram_url,
    x_url,
    description
  from organizer_profiles
  where user_id = target_user_id
$$;

grant execute on function get_organizer_public_profile(uuid) to authenticated;

create or replace function get_vendor_public_profile(target_user_id uuid)
returns table (
  business_name text,
  owner_name text,
  contact_email text,
  phone text,
  main_menu text,
  logo_image_url text,
  instagram_url text,
  x_url text,
  description text
)
language sql
security definer
set search_path = public
as $$
  select
    business_name,
    owner_name,
    contact_email,
    phone,
    main_menu,
    logo_image_url,
    instagram_url,
    x_url,
    description
  from vendor_profiles
  where user_id = target_user_id
$$;

grant execute on function get_vendor_public_profile(uuid) to authenticated;

drop policy if exists "authenticated_own_rows" on user_profiles;
create policy "authenticated_own_rows" on user_profiles
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "authenticated_own_rows" on vendor_profiles;
create policy "authenticated_own_rows" on vendor_profiles
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "authenticated_own_rows" on organizer_profiles;
create policy "authenticated_own_rows" on organizer_profiles
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "authenticated_own_rows" on event_offers;
create policy "authenticated_own_rows" on event_offers
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "vendors_can_view_public_offers" on event_offers;
create policy "vendors_can_view_public_offers" on event_offers
for select to authenticated
using (is_public = true and status = 'open');

drop policy if exists "application_access" on event_applications;
create policy "application_access" on event_applications
for select to authenticated
using (auth.uid() = vendor_user_id or auth.uid() = organizer_user_id);

drop policy if exists "vendor_can_create_application" on event_applications;
create policy "vendor_can_create_application" on event_applications
for insert to authenticated
with check (auth.uid() = vendor_user_id);

drop policy if exists "participants_can_update_application" on event_applications;
create policy "participants_can_update_application" on event_applications
for update to authenticated
using (auth.uid() = vendor_user_id or auth.uid() = organizer_user_id)
with check (auth.uid() = vendor_user_id or auth.uid() = organizer_user_id);

drop policy if exists "message_access" on application_messages;
create policy "message_access" on application_messages
for select to authenticated
using (
  exists (
    select 1
    from event_applications ea
    where ea.id = application_id
      and (ea.vendor_user_id = auth.uid() or ea.organizer_user_id = auth.uid())
  )
);

drop policy if exists "message_insert_by_participants" on application_messages;
create policy "message_insert_by_participants" on application_messages
for insert to authenticated
with check (
  exists (
    select 1
    from event_applications ea
    where ea.id = application_id
      and (ea.vendor_user_id = auth.uid() or ea.organizer_user_id = auth.uid())
  )
  and auth.uid() = sender_user_id
);

drop policy if exists "message_update_by_participants" on application_messages;
create policy "message_update_by_participants" on application_messages
for update to authenticated
using (
  exists (
    select 1
    from event_applications ea
    where ea.id = application_id
      and (ea.vendor_user_id = auth.uid() or ea.organizer_user_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from event_applications ea
    where ea.id = application_id
      and (ea.vendor_user_id = auth.uid() or ea.organizer_user_id = auth.uid())
  )
);

drop policy if exists "authenticated_own_rows" on vendor_daily_memos;
create policy "authenticated_own_rows" on vendor_daily_memos
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "authenticated_own_rows" on vendor_weekly_reports;
create policy "authenticated_own_rows" on vendor_weekly_reports
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
