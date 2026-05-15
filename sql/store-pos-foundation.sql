-- 店舗POS MVP 用の既存モバイルオーダー拡張 SQL たたき台
-- 最終更新: 2026-05-13
--
-- 方針:
-- - 新しい注文基盤は作らず mobile_orders を拡張する
-- - vendor_stores に POS 設定を追加する
-- - 既存モバイルオーダー注文は order_source = mobile_order として扱う
-- - notes fallback に保存していた POS 設定は、正式列へ backfill する
-- - store_pos_* の payment_provider は互換保持しつつ、order_source / payment_method を正式化する

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
-- store_order_pages.notes fallback から vendor_stores へ backfill
-- ------------------------------------------------------------
with page_notes as (
  select
    sop.store_id,
    regexp_match(
      sop.notes,
      '\[kuridas:store-pos-settings\]\s*(\{[\s\S]*?\})\s*\[/kuridas:store-pos-settings\]'
    ) as metadata_match
  from public.store_order_pages sop
  where sop.notes like '%[kuridas:store-pos-settings]%'
),
parsed_metadata as (
  select
    store_id,
    (metadata_match[1])::jsonb as metadata
  from page_notes
  where metadata_match is not null
),
normalized_metadata as (
  select
    store_id,
    coalesce((metadata ->> 'is_store_pos_enabled')::boolean, true) as is_store_pos_enabled,
    nullif(trim(metadata ->> 'store_pos_terminal_name'), '') as store_pos_terminal_name,
    coalesce(
      (
        select array_agg(value order by ordinality)
        from jsonb_array_elements_text(
          case
            when jsonb_typeof(metadata -> 'store_pos_enabled_payment_methods') = 'array'
              then metadata -> 'store_pos_enabled_payment_methods'
            else '[]'::jsonb
          end
        ) with ordinality as methods(value, ordinality)
        where value in ('cash', 'paypay', 'other')
      ),
      array['cash', 'paypay', 'other']::text[]
    ) as store_pos_enabled_payment_methods
  from parsed_metadata
)
update public.vendor_stores vs
set
  is_store_pos_enabled = normalized_metadata.is_store_pos_enabled,
  store_pos_terminal_name = coalesce(normalized_metadata.store_pos_terminal_name, vs.store_pos_terminal_name),
  store_pos_enabled_payment_methods = normalized_metadata.store_pos_enabled_payment_methods
from normalized_metadata
where normalized_metadata.store_id = vs.id;

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
  order_source = case
    when payment_provider in ('store_pos_cash', 'store_pos_paypay', 'store_pos_other') then 'store_pos'
    else coalesce(nullif(order_source, ''), 'mobile_order')
  end,
  payment_method = case
    when payment_provider = 'store_pos_cash' then 'cash'
    when payment_provider = 'store_pos_paypay' then 'paypay'
    when payment_provider = 'store_pos_other' then 'other'
    else coalesce(payment_method, 'card_online')
  end,
  paid_at = case
    when paid_at is not null then paid_at
    when payment_status = 'paid' then updated_at
    else null
  end
where
  order_source is null
  or order_source = ''
  or payment_method is null
  or (
    payment_provider in ('store_pos_cash', 'store_pos_paypay', 'store_pos_other')
    and order_source is distinct from 'store_pos'
  )
  or (
    payment_provider = 'store_pos_cash'
    and payment_method is distinct from 'cash'
  )
  or (
    payment_provider = 'store_pos_paypay'
    and payment_method is distinct from 'paypay'
  )
  or (
    payment_provider = 'store_pos_other'
    and payment_method is distinct from 'other'
  )
  or (
    payment_status = 'paid'
    and paid_at is null
  );

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

create index if not exists idx_mobile_orders_accepted_by_user_id
  on public.mobile_orders(accepted_by_user_id);

-- ------------------------------------------------------------
-- schema cache reload
-- ------------------------------------------------------------
notify pgrst, 'reload schema';

commit;
