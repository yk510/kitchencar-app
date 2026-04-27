-- ============================================================
-- クリダス モバイルオーダー 店舗コード4桁 + 当日4桁連番 への移行
-- 既存 vendor_stores / mobile_orders を新仕様へ揃える
-- ============================================================

alter table vendor_stores
  add column if not exists store_code text;

alter table mobile_orders
  add column if not exists order_daily_sequence integer;

with ranked_stores as (
  select
    id,
    lpad(row_number() over (order by created_at asc, id asc)::text, 4, '0') as next_store_code
  from vendor_stores
)
update vendor_stores vs
set store_code = ranked_stores.next_store_code
from ranked_stores
where vs.id = ranked_stores.id
  and (vs.store_code is null or vs.store_code !~ '^[0-9]{4}$');

with ranked_orders as (
  select
    mo.id,
    vs.store_code,
    sos.business_date,
    row_number() over (
      partition by mo.store_id, sos.business_date
      order by mo.ordered_at asc, mo.created_at asc, mo.id asc
    ) as next_daily_sequence
  from mobile_orders mo
  join vendor_stores vs on vs.id = mo.store_id
  join store_order_schedules sos on sos.id = mo.schedule_id
)
update mobile_orders mo
set
  order_daily_sequence = ranked_orders.next_daily_sequence,
  order_number = ranked_orders.store_code || '-' || lpad(ranked_orders.next_daily_sequence::text, 4, '0')
from ranked_orders
where mo.id = ranked_orders.id;

alter table vendor_stores
  alter column store_code set not null;

alter table mobile_orders
  alter column order_daily_sequence set not null;

drop index if exists idx_vendor_stores_order_number_prefix;
create unique index if not exists idx_vendor_stores_store_code
  on vendor_stores(store_code);

alter table vendor_stores
  drop constraint if exists chk_vendor_stores_order_number_prefix;

alter table vendor_stores
  drop constraint if exists chk_vendor_stores_store_code;

alter table vendor_stores
  add constraint chk_vendor_stores_store_code
  check (store_code ~ '^[0-9]{4}$');

alter table mobile_orders
  drop constraint if exists chk_mobile_orders_order_number;

alter table mobile_orders
  add constraint chk_mobile_orders_order_number
  check (order_number ~ '^[0-9]{4}-[0-9]{4}$');

alter table mobile_orders
  drop constraint if exists chk_mobile_orders_order_daily_sequence;

alter table mobile_orders
  add constraint chk_mobile_orders_order_daily_sequence
  check (order_daily_sequence >= 1 and order_daily_sequence <= 9999);

alter table mobile_orders
  drop constraint if exists mobile_orders_schedule_id_order_daily_sequence_key;

alter table mobile_orders
  add constraint mobile_orders_schedule_id_order_daily_sequence_key
  unique (schedule_id, order_daily_sequence);
