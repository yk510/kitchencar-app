-- ============================================================
-- クリダス モバイルオーダー 注文番号プレフィックス修正
-- 既存 vendor_stores の重複プレフィックスを解消し、
-- 今後は 1 店舗 1 文字を一意に使うための SQL
-- ============================================================

do $$
declare
  duplicate_count integer;
  store_count integer;
begin
  select count(*) into store_count from vendor_stores;

  if store_count > 26 then
    raise exception 'vendor_stores が % 件あるため、A-Z の 26 文字では割り当てできません', store_count;
  end if;

  with ranked as (
    select
      id,
      chr(64 + row_number() over (order by created_at asc, id asc)) as next_prefix
    from vendor_stores
  )
  update vendor_stores vs
  set order_number_prefix = ranked.next_prefix
  from ranked
  where vs.id = ranked.id
    and vs.order_number_prefix is distinct from ranked.next_prefix;

  select count(*)
    into duplicate_count
  from (
    select order_number_prefix
    from vendor_stores
    group by order_number_prefix
    having count(*) > 1
  ) duplicates;

  if duplicate_count > 0 then
    raise exception 'order_number_prefix の重複解消に失敗しました';
  end if;
end $$;

create unique index if not exists idx_vendor_stores_order_number_prefix
  on vendor_stores(order_number_prefix);
