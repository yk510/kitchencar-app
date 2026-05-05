-- ============================================================
-- CSV取り込み高速化: AirレジCSV取り込みRPC
-- Supabase SQL Editor にそのまま貼り付けて実行してください
-- ============================================================

create or replace function public.import_airregi_csv_payload(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  transaction_rows jsonb := coalesce(payload->'transactions', '[]'::jsonb);
  error_rows jsonb := coalesce(payload->'errors', '[]'::jsonb);
  inserted_count integer := 0;
  updated_count integer := 0;
  skipped_count integer := jsonb_array_length(error_rows);
  new_products jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise exception 'ログインが必要です';
  end if;

  create temporary table if not exists tmp_csv_import_transactions (
    user_id uuid not null,
    txn_no text not null,
    txn_date date not null,
    txn_time time not null,
    day_of_week integer not null,
    hour_of_day integer not null,
    raw_txn_kind text,
    is_return boolean not null,
    total_amount integer not null,
    tax_amount integer not null,
    discount_total integer not null,
    payment_method text,
    items_json jsonb not null
  ) on commit drop;

  create temporary table if not exists tmp_csv_import_product_sales (
    user_id uuid not null,
    txn_no text not null,
    txn_date date not null,
    product_name text not null,
    unit_price integer not null,
    quantity integer not null,
    subtotal integer not null
  ) on commit drop;

  create temporary table if not exists tmp_csv_import_new_products (
    product_name text not null primary key
  ) on commit drop;

  truncate table tmp_csv_import_transactions;
  truncate table tmp_csv_import_product_sales;
  truncate table tmp_csv_import_new_products;

  insert into tmp_csv_import_transactions (
    user_id,
    txn_no,
    txn_date,
    txn_time,
    day_of_week,
    hour_of_day,
    raw_txn_kind,
    is_return,
    total_amount,
    tax_amount,
    discount_total,
    payment_method,
    items_json
  )
  select
    current_user_id,
    row.txn_no,
    row.txn_date,
    row.txn_time,
    row.day_of_week,
    row.hour_of_day,
    row.raw_txn_kind,
    row.is_return,
    row.total_amount,
    row.tax_amount,
    row.discount_total,
    row.payment_method,
    coalesce(row.items, '[]'::jsonb)
  from jsonb_to_recordset(transaction_rows) as row (
    txn_no text,
    txn_date date,
    txn_time time,
    day_of_week integer,
    hour_of_day integer,
    raw_txn_kind text,
    is_return boolean,
    total_amount integer,
    tax_amount integer,
    discount_total integer,
    payment_method text,
    items jsonb
  );

  insert into tmp_csv_import_product_sales (
    user_id,
    txn_no,
    txn_date,
    product_name,
    unit_price,
    quantity,
    subtotal
  )
  select
    current_user_id,
    txn.txn_no,
    txn.txn_date,
    item.product_name,
    item.unit_price,
    item.quantity,
    item.subtotal
  from tmp_csv_import_transactions txn
  cross join lateral jsonb_to_recordset(txn.items_json) as item (
    product_name text,
    unit_price integer,
    quantity integer,
    subtotal integer
  );

  select count(*)
  into inserted_count
  from tmp_csv_import_transactions txn
  left join transactions existing
    on existing.user_id = txn.user_id
   and existing.txn_no = txn.txn_no
  where existing.id is null;

  updated_count := greatest((select count(*) from tmp_csv_import_transactions) - inserted_count, 0);

  insert into transactions (
    user_id,
    txn_no,
    txn_date,
    txn_time,
    day_of_week,
    hour_of_day,
    raw_txn_kind,
    is_return,
    total_amount,
    tax_amount,
    discount_total,
    payment_method
  )
  select
    user_id,
    txn_no,
    txn_date,
    txn_time,
    day_of_week,
    hour_of_day,
    raw_txn_kind,
    is_return,
    total_amount,
    tax_amount,
    discount_total,
    payment_method
  from tmp_csv_import_transactions
  on conflict (user_id, txn_no) do update
  set
    txn_date = excluded.txn_date,
    txn_time = excluded.txn_time,
    day_of_week = excluded.day_of_week,
    hour_of_day = excluded.hour_of_day,
    raw_txn_kind = excluded.raw_txn_kind,
    is_return = excluded.is_return,
    total_amount = excluded.total_amount,
    tax_amount = excluded.tax_amount,
    discount_total = excluded.discount_total,
    payment_method = excluded.payment_method,
    updated_at = now();

  insert into product_sales (
    user_id,
    txn_no,
    txn_date,
    product_name,
    unit_price,
    quantity,
    subtotal
  )
  select
    user_id,
    txn_no,
    txn_date,
    product_name,
    unit_price,
    quantity,
    subtotal
  from tmp_csv_import_product_sales
  on conflict (user_id, txn_no, product_name) do update
  set
    txn_date = excluded.txn_date,
    unit_price = excluded.unit_price,
    quantity = excluded.quantity,
    subtotal = excluded.subtotal,
    updated_at = now();

  insert into tmp_csv_import_new_products (product_name)
  select distinct sales.product_name
  from tmp_csv_import_product_sales sales
  left join product_master master
    on master.user_id = sales.user_id
   and master.product_name = sales.product_name
  where master.id is null
  on conflict (product_name) do nothing;

  insert into product_master (user_id, product_name)
  select current_user_id, product_name
  from tmp_csv_import_new_products
  on conflict (user_id, product_name) do nothing;

  select coalesce(jsonb_agg(product_name order by product_name), '[]'::jsonb)
  into new_products
  from tmp_csv_import_new_products;

  return jsonb_build_object(
    'inserted', inserted_count,
    'updated', updated_count,
    'skipped', skipped_count,
    'newProducts', coalesce(new_products, '[]'::jsonb),
    'errors', error_rows
  );
end;
$$;

grant execute on function public.import_airregi_csv_payload(jsonb) to authenticated;
