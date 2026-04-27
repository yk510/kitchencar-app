-- ============================================================
-- クリダス モバイルオーダー基盤テーブル
-- 既存データを落とさずに追加するための SQL
-- Supabase SQL Editor にそのまま貼り付けて実行してください
-- ============================================================

-- ------------------------------------------------------------
-- ヘルパー関数：updated_at を自動更新するトリガー
-- 既に存在する場合はそのまま使う
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 1. vendor_stores（モバイルオーダー店舗設定）
-- ------------------------------------------------------------
create table if not exists vendor_stores (
  id                        uuid primary key default gen_random_uuid(),
  vendor_user_id            uuid not null,
  store_name                text not null,
  slug                      text not null unique,
  order_number_prefix       text not null,
  description               text,
  hero_image_url            text,
  is_mobile_order_enabled   boolean not null default false,
  is_accepting_orders       boolean not null default true,
  line_official_account_id  text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint chk_vendor_stores_order_number_prefix
    check (order_number_prefix ~ '^[A-Z]$')
);

create index if not exists idx_vendor_stores_vendor_user_id on vendor_stores(vendor_user_id);

-- ------------------------------------------------------------
-- 2. store_order_pages（固定公開注文ページ）
-- ------------------------------------------------------------
create table if not exists store_order_pages (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references vendor_stores(id) on delete cascade,
  page_title    text not null,
  public_token  text not null unique,
  status        text not null default 'published',
  is_primary    boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint chk_store_order_pages_status
    check (status in ('draft', 'published', 'archived'))
);

create index if not exists idx_store_order_pages_store_id on store_order_pages(store_id);

-- ------------------------------------------------------------
-- 3. store_order_schedules（注文受付営業枠）
-- ------------------------------------------------------------
create table if not exists store_order_schedules (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references vendor_stores(id) on delete cascade,
  order_page_id  uuid not null references store_order_pages(id) on delete cascade,
  business_date  date not null,
  opens_at       timestamptz not null,
  closes_at      timestamptz not null,
  status         text not null default 'scheduled',
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint chk_store_order_schedules_time_range check (opens_at < closes_at),
  constraint chk_store_order_schedules_status
    check (status in ('scheduled', 'open', 'closed', 'cancelled')),
  unique(order_page_id, business_date, opens_at)
);

create index if not exists idx_store_order_schedules_store_id on store_order_schedules(store_id);
create index if not exists idx_store_order_schedules_business_date on store_order_schedules(business_date);
create index if not exists idx_store_order_schedules_opens_at on store_order_schedules(opens_at);
create index if not exists idx_store_order_schedules_closes_at on store_order_schedules(closes_at);

-- ------------------------------------------------------------
-- 4. mobile_order_products（公開注文商品）
-- ------------------------------------------------------------
create table if not exists mobile_order_products (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references vendor_stores(id) on delete cascade,
  name          text not null,
  description   text,
  price         integer not null,
  image_url     text,
  sort_order    integer not null default 0,
  tracks_inventory boolean not null default false,
  inventory_quantity integer,
  low_stock_threshold integer not null default 3,
  is_published  boolean not null default true,
  is_sold_out   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint chk_mobile_order_products_inventory_quantity
    check (inventory_quantity is null or inventory_quantity >= 0),
  constraint chk_mobile_order_products_low_stock_threshold
    check (low_stock_threshold >= 0)
);

create index if not exists idx_mobile_order_products_store_id on mobile_order_products(store_id);
create index if not exists idx_mobile_order_products_sort_order on mobile_order_products(store_id, sort_order);

-- ------------------------------------------------------------
-- 5. store_order_schedule_inventories（営業枠ごとの初期在庫）
-- ------------------------------------------------------------
create table if not exists store_order_schedule_inventories (
  id                uuid primary key default gen_random_uuid(),
  schedule_id       uuid not null references store_order_schedules(id) on delete cascade,
  product_id        uuid not null references mobile_order_products(id) on delete cascade,
  initial_quantity  integer not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint chk_store_order_schedule_inventories_initial_quantity
    check (initial_quantity >= 0),
  unique(schedule_id, product_id)
);

create index if not exists idx_store_order_schedule_inventories_schedule_id on store_order_schedule_inventories(schedule_id);
create index if not exists idx_store_order_schedule_inventories_product_id on store_order_schedule_inventories(product_id);

-- ------------------------------------------------------------
-- 6. mobile_order_inventory_adjustments（営業中の在庫調整履歴）
-- ------------------------------------------------------------
create table if not exists mobile_order_inventory_adjustments (
  id                    uuid primary key default gen_random_uuid(),
  schedule_inventory_id uuid not null references store_order_schedule_inventories(id) on delete cascade,
  schedule_id           uuid not null references store_order_schedules(id) on delete cascade,
  product_id            uuid not null references mobile_order_products(id) on delete cascade,
  adjustment_quantity   integer not null,
  reason                text,
  created_by            uuid,
  created_at            timestamptz not null default now(),
  constraint chk_mobile_order_inventory_adjustments_non_zero
    check (adjustment_quantity <> 0)
);

create index if not exists idx_mobile_order_inventory_adjustments_schedule_id on mobile_order_inventory_adjustments(schedule_id);
create index if not exists idx_mobile_order_inventory_adjustments_product_id on mobile_order_inventory_adjustments(product_id);
create index if not exists idx_mobile_order_inventory_adjustments_schedule_inventory_id on mobile_order_inventory_adjustments(schedule_inventory_id);

-- ------------------------------------------------------------
-- 7. mobile_order_option_groups（商品オプショングループ）
-- ------------------------------------------------------------
create table if not exists mobile_order_option_groups (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references vendor_stores(id) on delete cascade,
  name            text not null,
  is_required     boolean not null default false,
  selection_type  text not null,
  min_select      integer,
  max_select      integer,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint chk_mobile_order_option_groups_selection_type
    check (selection_type in ('single', 'multiple'))
);

-- ------------------------------------------------------------
-- 8. mobile_order_option_choices（オプション選択肢）
-- ------------------------------------------------------------
create table if not exists mobile_order_option_choices (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references mobile_order_option_groups(id) on delete cascade,
  name          text not null,
  price_delta   integer not null default 0,
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 9. mobile_order_product_option_groups（商品・オプション紐付け）
-- ------------------------------------------------------------
create table if not exists mobile_order_product_option_groups (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references mobile_order_products(id) on delete cascade,
  option_group_id  uuid not null references mobile_order_option_groups(id) on delete cascade,
  sort_order       integer not null default 0,
  unique(product_id, option_group_id)
);

-- ------------------------------------------------------------
-- 10. mobile_orders（モバイルオーダー注文ヘッダ）
-- ------------------------------------------------------------
create table if not exists mobile_orders (
  id                          uuid primary key default gen_random_uuid(),
  store_id                    uuid not null references vendor_stores(id) on delete restrict,
  order_page_id               uuid not null references store_order_pages(id) on delete restrict,
  schedule_id                 uuid not null references store_order_schedules(id) on delete restrict,
  order_number                text not null unique,
  customer_line_user_id       text,
  customer_line_display_name  text,
  pickup_nickname             text not null,
  status                      text not null default 'placed',
  payment_status              text not null default 'pending',
  payment_provider            text not null default 'credit_card',
  payment_reference           text,
  subtotal_amount             integer not null default 0,
  tax_amount                  integer not null default 0,
  total_amount                integer not null default 0,
  ordered_at                  timestamptz not null default now(),
  ready_notified_at           timestamptz,
  picked_up_at                timestamptz,
  cancelled_at                timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint chk_mobile_orders_status
    check (status in ('placed', 'preparing', 'ready', 'picked_up', 'cancelled')),
  constraint chk_mobile_orders_payment_status
    check (payment_status in ('pending', 'authorized', 'paid', 'failed', 'refunded')),
  constraint chk_mobile_orders_order_number
    check (order_number ~ '^[A-Z][0-9]{4}$')
);

create index if not exists idx_mobile_orders_store_id on mobile_orders(store_id);
create index if not exists idx_mobile_orders_schedule_id on mobile_orders(schedule_id);
create index if not exists idx_mobile_orders_ordered_at on mobile_orders(ordered_at desc);
create index if not exists idx_mobile_orders_status on mobile_orders(store_id, status);

-- ------------------------------------------------------------
-- 11. mobile_order_items（注文商品明細）
-- ------------------------------------------------------------
create table if not exists mobile_order_items (
  id                           uuid primary key default gen_random_uuid(),
  order_id                     uuid not null references mobile_orders(id) on delete cascade,
  product_id                   uuid not null references mobile_order_products(id) on delete restrict,
  product_name_snapshot        text not null,
  unit_price_snapshot          integer not null,
  quantity                     integer not null default 1,
  line_total_amount            integer not null default 0,
  created_at                   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 12. mobile_order_item_option_choices（注文時オプション明細）
-- ------------------------------------------------------------
create table if not exists mobile_order_item_option_choices (
  id                           uuid primary key default gen_random_uuid(),
  order_item_id                uuid not null references mobile_order_items(id) on delete cascade,
  option_group_name_snapshot   text not null,
  option_choice_name_snapshot  text not null,
  price_delta_snapshot         integer not null default 0,
  created_at                   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 13. mobile_order_notifications（通知送信履歴）
-- ------------------------------------------------------------
create table if not exists mobile_order_notifications (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references mobile_orders(id) on delete cascade,
  notification_type text not null,
  delivery_status   text not null default 'pending',
  line_message_id   text,
  sent_at           timestamptz,
  failed_at         timestamptz,
  error_message     text,
  created_at        timestamptz not null default now(),
  constraint chk_mobile_order_notifications_type
    check (notification_type in ('order_completed', 'order_ready'))
);

-- ------------------------------------------------------------
-- 14. mobile_order_audit_logs（注文監査ログ）
-- ------------------------------------------------------------
create table if not exists mobile_order_audit_logs (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references mobile_orders(id) on delete cascade,
  actor_user_id uuid,
  action_type   text not null,
  before_status text,
  after_status  text,
  payload       jsonb,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- updated_at triggers
-- ------------------------------------------------------------
drop trigger if exists trg_vendor_stores_updated_at on vendor_stores;
create trigger trg_vendor_stores_updated_at
  before update on vendor_stores
  for each row execute function set_updated_at();

drop trigger if exists trg_store_order_pages_updated_at on store_order_pages;
create trigger trg_store_order_pages_updated_at
  before update on store_order_pages
  for each row execute function set_updated_at();

drop trigger if exists trg_store_order_schedules_updated_at on store_order_schedules;
create trigger trg_store_order_schedules_updated_at
  before update on store_order_schedules
  for each row execute function set_updated_at();

drop trigger if exists trg_mobile_order_products_updated_at on mobile_order_products;
create trigger trg_mobile_order_products_updated_at
  before update on mobile_order_products
  for each row execute function set_updated_at();

drop trigger if exists trg_store_order_schedule_inventories_updated_at on store_order_schedule_inventories;
create trigger trg_store_order_schedule_inventories_updated_at
  before update on store_order_schedule_inventories
  for each row execute function set_updated_at();

drop trigger if exists trg_mobile_order_option_groups_updated_at on mobile_order_option_groups;
create trigger trg_mobile_order_option_groups_updated_at
  before update on mobile_order_option_groups
  for each row execute function set_updated_at();

drop trigger if exists trg_mobile_order_option_choices_updated_at on mobile_order_option_choices;
create trigger trg_mobile_order_option_choices_updated_at
  before update on mobile_order_option_choices
  for each row execute function set_updated_at();

drop trigger if exists trg_mobile_orders_updated_at on mobile_orders;
create trigger trg_mobile_orders_updated_at
  before update on mobile_orders
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- RLS enable
-- ------------------------------------------------------------
alter table vendor_stores enable row level security;
alter table store_order_pages enable row level security;
alter table store_order_schedules enable row level security;
alter table mobile_order_products enable row level security;
alter table store_order_schedule_inventories enable row level security;
alter table mobile_order_inventory_adjustments enable row level security;
alter table mobile_order_option_groups enable row level security;
alter table mobile_order_option_choices enable row level security;
alter table mobile_order_product_option_groups enable row level security;
alter table mobile_orders enable row level security;
alter table mobile_order_items enable row level security;
alter table mobile_order_item_option_choices enable row level security;
alter table mobile_order_notifications enable row level security;
alter table mobile_order_audit_logs enable row level security;

-- ------------------------------------------------------------
-- MVP policy
-- 公開ページ用に anon 読み書きを残しつつ、
-- 管理画面用に authenticated の own-row policy を追加
-- ------------------------------------------------------------
do $$ begin
  create policy "public_all" on vendor_stores for all to anon using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_own_rows" on vendor_stores
  for all to authenticated
  using (auth.uid() = vendor_user_id)
  with check (auth.uid() = vendor_user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "public_all" on store_order_pages for all to anon using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_store_access" on store_order_pages
  for all to authenticated
  using (
    exists (
      select 1 from vendor_stores vs
      where vs.id = store_id and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from vendor_stores vs
      where vs.id = store_id and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "public_all" on store_order_schedules for all to anon using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_store_access" on store_order_schedules
  for all to authenticated
  using (
    exists (
      select 1 from vendor_stores vs
      where vs.id = store_id and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from vendor_stores vs
      where vs.id = store_id and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "public_all" on mobile_order_products for all to anon using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_store_access" on mobile_order_products
  for all to authenticated
  using (
    exists (
      select 1 from vendor_stores vs
      where vs.id = store_id and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from vendor_stores vs
      where vs.id = store_id and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "public_all" on store_order_schedule_inventories for all to anon using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_schedule_inventory_access" on store_order_schedule_inventories
  for all to authenticated
  using (
    exists (
      select 1
      from store_order_schedules sos
      join vendor_stores vs on vs.id = sos.store_id
      where sos.id = schedule_id
        and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from store_order_schedules sos
      join vendor_stores vs on vs.id = sos.store_id
      where sos.id = schedule_id
        and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "public_all" on mobile_order_inventory_adjustments for all to anon using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_inventory_adjustment_access" on mobile_order_inventory_adjustments
  for all to authenticated
  using (
    exists (
      select 1
      from store_order_schedules sos
      join vendor_stores vs on vs.id = sos.store_id
      where sos.id = schedule_id
        and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from store_order_schedules sos
      join vendor_stores vs on vs.id = sos.store_id
      where sos.id = schedule_id
        and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "public_all" on mobile_order_option_groups for all to anon using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_store_access" on mobile_order_option_groups
  for all to authenticated
  using (
    exists (
      select 1 from vendor_stores vs
      where vs.id = store_id and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from vendor_stores vs
      where vs.id = store_id and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "public_all" on mobile_order_option_choices for all to anon using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_option_group_access" on mobile_order_option_choices
  for all to authenticated
  using (
    exists (
      select 1
      from mobile_order_option_groups oog
      join vendor_stores vs on vs.id = oog.store_id
      where oog.id = group_id
        and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from mobile_order_option_groups oog
      join vendor_stores vs on vs.id = oog.store_id
      where oog.id = group_id
        and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "public_all" on mobile_order_product_option_groups for all to anon using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_product_option_link_access" on mobile_order_product_option_groups
  for all to authenticated
  using (
    exists (
      select 1
      from mobile_order_products p
      join vendor_stores vs on vs.id = p.store_id
      where p.id = product_id
        and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from mobile_order_products p
      join vendor_stores vs on vs.id = p.store_id
      where p.id = product_id
        and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "public_all" on mobile_orders for all to anon using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_mobile_order_access" on mobile_orders
  for all to authenticated
  using (
    exists (
      select 1 from vendor_stores vs
      where vs.id = store_id and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from vendor_stores vs
      where vs.id = store_id and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "public_all" on mobile_order_items for all to anon using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_order_item_access" on mobile_order_items
  for all to authenticated
  using (
    exists (
      select 1
      from mobile_orders mo
      join vendor_stores vs on vs.id = mo.store_id
      where mo.id = order_id
        and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from mobile_orders mo
      join vendor_stores vs on vs.id = mo.store_id
      where mo.id = order_id
        and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "public_all" on mobile_order_item_option_choices for all to anon using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_order_item_option_access" on mobile_order_item_option_choices
  for all to authenticated
  using (
    exists (
      select 1
      from mobile_order_items oi
      join mobile_orders mo on mo.id = oi.order_id
      join vendor_stores vs on vs.id = mo.store_id
      where oi.id = order_item_id
        and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from mobile_order_items oi
      join mobile_orders mo on mo.id = oi.order_id
      join vendor_stores vs on vs.id = mo.store_id
      where oi.id = order_item_id
        and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "public_all" on mobile_order_notifications for all to anon using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_notification_access" on mobile_order_notifications
  for all to authenticated
  using (
    exists (
      select 1
      from mobile_orders mo
      join vendor_stores vs on vs.id = mo.store_id
      where mo.id = order_id
        and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from mobile_orders mo
      join vendor_stores vs on vs.id = mo.store_id
      where mo.id = order_id
        and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "public_all" on mobile_order_audit_logs for all to anon using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_audit_log_access" on mobile_order_audit_logs
  for all to authenticated
  using (
    exists (
      select 1
      from mobile_orders mo
      join vendor_stores vs on vs.id = mo.store_id
      where mo.id = order_id
        and vs.vendor_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from mobile_orders mo
      join vendor_stores vs on vs.id = mo.store_id
      where mo.id = order_id
        and vs.vendor_user_id = auth.uid()
    )
  );
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- 動作確認用：追加テーブル一覧
-- ------------------------------------------------------------
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'vendor_stores',
    'store_order_pages',
    'store_order_schedules',
    'mobile_order_products',
    'store_order_schedule_inventories',
    'mobile_order_inventory_adjustments',
    'mobile_order_option_groups',
    'mobile_order_option_choices',
    'mobile_order_product_option_groups',
    'mobile_orders',
    'mobile_order_items',
    'mobile_order_item_option_choices',
    'mobile_order_notifications',
    'mobile_order_audit_logs'
  )
order by table_name;
