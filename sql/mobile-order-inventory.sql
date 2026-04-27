-- ============================================================
-- クリダス モバイルオーダー 在庫管理カラム追加
-- 既に mobile-order-foundation.sql を流した環境向け
-- ============================================================

alter table mobile_order_products
  add column if not exists tracks_inventory boolean not null default false,
  add column if not exists inventory_quantity integer,
  add column if not exists low_stock_threshold integer not null default 3;

alter table mobile_order_products
  drop constraint if exists chk_mobile_order_products_inventory_quantity;

alter table mobile_order_products
  add constraint chk_mobile_order_products_inventory_quantity
  check (inventory_quantity is null or inventory_quantity >= 0);

alter table mobile_order_products
  drop constraint if exists chk_mobile_order_products_low_stock_threshold;

alter table mobile_order_products
  add constraint chk_mobile_order_products_low_stock_threshold
  check (low_stock_threshold >= 0);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

drop trigger if exists trg_store_order_schedule_inventories_updated_at on store_order_schedule_inventories;
create trigger trg_store_order_schedule_inventories_updated_at
  before update on store_order_schedule_inventories
  for each row execute function set_updated_at();

alter table store_order_schedule_inventories enable row level security;
alter table mobile_order_inventory_adjustments enable row level security;

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
