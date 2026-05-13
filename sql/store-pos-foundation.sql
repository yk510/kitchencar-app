-- 店舗POS MVP 用の既存モバイルオーダー拡張 SQL たたき台
-- 最終更新: 2026-05-13
--
-- 方針:
-- - 新しい注文基盤は作らず mobile_orders を拡張する
-- - vendor_stores に POS 設定を追加する
-- - 既存モバイルオーダー注文は order_source = mobile_order として扱う

begin;

-- ------------------------------------------------------------
-- vendor_stores: POS 設定
-- ------------------------------------------------------------
alter table public.vendor_stores
  add column if not exists is_store_pos_enabled boolean not null default false;

alter table public.vendor_stores
  add column if not exists store_pos_terminal_name text;

alter table public.vendor_stores
  add column if not exists store_pos_enabled_payment_methods text[] not null
    default array['cash', 'paypay']::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_vendor_stores_store_pos_enabled_payment_methods'
  ) then
    alter table public.vendor_stores
      add constraint chk_vendor_stores_store_pos_enabled_payment_methods
      check (
        store_pos_enabled_payment_methods <@ array['cash', 'paypay', 'other']::text[]
      );
  end if;
end $$;

-- ------------------------------------------------------------
-- mobile_orders: POS / source / payment 拡張
-- ------------------------------------------------------------
alter table public.mobile_orders
  add column if not exists order_source text not null default 'mobile_order';

alter table public.mobile_orders
  add column if not exists payment_method text;

alter table public.mobile_orders
  add column if not exists paid_at timestamptz;

alter table public.mobile_orders
  add column if not exists accepted_by_user_id uuid;

alter table public.mobile_orders
  add column if not exists pos_device_label text;

update public.mobile_orders
set
  order_source = coalesce(nullif(order_source, ''), 'mobile_order'),
  payment_method = coalesce(payment_method, 'card_online')
where order_source is distinct from 'mobile_order'
   or payment_method is null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'chk_mobile_orders_order_source'
  ) then
    alter table public.mobile_orders
      drop constraint chk_mobile_orders_order_source;
  end if;

  alter table public.mobile_orders
    add constraint chk_mobile_orders_order_source
    check (order_source in ('mobile_order', 'store_pos'));
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'chk_mobile_orders_payment_method'
  ) then
    alter table public.mobile_orders
      drop constraint chk_mobile_orders_payment_method;
  end if;

  alter table public.mobile_orders
    add constraint chk_mobile_orders_payment_method
    check (
      payment_method is null
      or payment_method in ('card_online', 'cash', 'paypay', 'other')
    );
end $$;

create index if not exists idx_mobile_orders_order_source
  on public.mobile_orders(order_source);

create index if not exists idx_mobile_orders_payment_method
  on public.mobile_orders(payment_method);

create index if not exists idx_mobile_orders_paid_at
  on public.mobile_orders(paid_at desc);

-- ------------------------------------------------------------
-- schema cache reload
-- ------------------------------------------------------------
notify pgrst, 'reload schema';

commit;
