-- ============================================================
-- キッチンカー売上分析アプリ DB スキーマ
-- Supabase SQL Editor にそのまま貼り付けて実行してください
-- ============================================================

-- 既存テーブルをクリーン（再実行時のため）
drop table if exists sales_forecasts    cascade;
drop table if exists weather_forecasts  cascade;
drop table if exists operation_plan_days cascade;
drop table if exists operation_plans    cascade;
drop table if exists vendor_weekly_reports cascade;
drop table if exists vendor_daily_memos cascade;
drop table if exists stall_logs         cascade;
drop table if exists cost_history       cascade;
drop table if exists product_sales      cascade;
drop table if exists product_master     cascade;
drop table if exists weather_logs       cascade;
drop table if exists transactions       cascade;
drop table if exists events             cascade;
drop table if exists locations          cascade;

-- ------------------------------------------------------------
-- 1. locations（出店場所マスタ）
-- ------------------------------------------------------------
create table locations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  address      text not null,
  latitude     numeric(10, 7),
  longitude    numeric(10, 7),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(name, address)
);

-- ------------------------------------------------------------
-- 2. events（イベントマスタ）
-- ------------------------------------------------------------
create table events (
  id           uuid primary key default gen_random_uuid(),
  event_name   text not null,
  event_date   date not null,
  location_id  uuid references locations(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique(event_name, event_date, location_id)
);

-- ------------------------------------------------------------
-- 3. transactions（取引記録 / Airレジ取引No単位）
-- ------------------------------------------------------------
create table transactions (
  id             uuid primary key default gen_random_uuid(),
  txn_no         text not null unique,          -- AirレジのユニークID
  txn_date       date not null,                 -- 取引日
  txn_time       time not null,                 -- 取引時間
  day_of_week    smallint not null,             -- 0=月 1=火 ... 6=日
  hour_of_day    smallint not null,             -- 0〜23
  location_id    uuid references locations(id) on delete set null,
  event_id       uuid references events(id) on delete set null,
  total_amount   integer not null default 0,    -- 税込合計（円）
  tax_amount     integer not null default 0,    -- 消費税額（円）
  discount_total integer not null default 0,    -- 割引合計（円）
  payment_method text,                          -- 主な支払方法
  is_return      boolean not null default false,-- 返品・取消フラグ
  raw_txn_kind   text,                          -- 元の取引種別（生値保存）
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_transactions_txn_date    on transactions(txn_date);
create index idx_transactions_location_id on transactions(location_id);
create index idx_transactions_event_id    on transactions(event_id);
create index idx_transactions_dow         on transactions(day_of_week);
create index idx_transactions_hour        on transactions(hour_of_day);

-- ------------------------------------------------------------
-- 4. product_master（商品原価マスタ）
-- ------------------------------------------------------------
create table product_master (
  id              uuid primary key default gen_random_uuid(),
  product_name    text not null unique,          -- 商品名（Airレジの表記そのまま）
  cost_amount     integer,                       -- 原価額（円）NULL = 未登録
  cost_rate       numeric(5, 2),                 -- 原価率（%）NULL = 未登録
  cost_updated_at timestamptz,                   -- 最終原価更新日時
  created_at      timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. cost_history（原価変更履歴）
-- ------------------------------------------------------------
create table cost_history (
  id           uuid primary key default gen_random_uuid(),
  product_name text not null,
  cost_amount  integer,
  cost_rate    numeric(5, 2),
  changed_at   timestamptz not null default now()
);

create index idx_cost_history_product on cost_history(product_name);

-- ------------------------------------------------------------
-- 6. product_sales（商品別売上明細 / 取引内の1商品1行）
-- ------------------------------------------------------------
create table product_sales (
  id           uuid primary key default gen_random_uuid(),
  txn_no       text not null,                   -- transactions.txn_no への参照
  txn_date     date not null,
  product_name text not null,
  unit_price   integer not null default 0,      -- 商品単価（円）
  quantity     integer not null default 1,      -- 販売数
  subtotal     integer not null default 0,      -- 商品合計金額（円）
  location_id  uuid references locations(id) on delete set null,
  event_id     uuid references events(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(txn_no, product_name)                  -- 同一取引内の商品重複防止
);

create index idx_product_sales_txn_date     on product_sales(txn_date);
create index idx_product_sales_product_name on product_sales(product_name);
create index idx_product_sales_location_id  on product_sales(location_id);

-- ------------------------------------------------------------
-- 7. stall_logs（出店ログ）
-- ------------------------------------------------------------
create table stall_logs (
  id           uuid primary key default gen_random_uuid(),
  log_date     date not null unique,
  location_id  uuid not null references locations(id) on delete cascade,
  event_id     uuid references events(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_stall_logs_location_id on stall_logs(location_id);
create index idx_stall_logs_event_id    on stall_logs(event_id);

-- ------------------------------------------------------------
-- 8. weather_logs（天候記録）
-- ------------------------------------------------------------
create table weather_logs (
  id              uuid primary key default gen_random_uuid(),
  log_date        date not null,
  location_id     uuid references locations(id) on delete cascade,
  weather_type    text not null,                -- 晴れ / 曇り / 雨 / 雪
  weather_code    integer,                      -- Open-Meteo WMOコード
  temperature_max numeric(4, 1),               -- 最高気温（℃）
  temperature_min numeric(4, 1),               -- 最低気温（℃）
  created_at      timestamptz not null default now(),
  unique(log_date, location_id)                 -- 同日・同場所は1件
);

-- ------------------------------------------------------------
-- 9. operation_plans（営業予定ヘッダ）
-- ------------------------------------------------------------
create table operation_plans (
  id                 uuid primary key default gen_random_uuid(),
  plan_month         date not null,
  title              text,
  source_image_name  text,
  status             text not null default 'draft',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_operation_plans_plan_month on operation_plans(plan_month);

-- ------------------------------------------------------------
-- 10. operation_plan_days（営業予定日別）
-- ------------------------------------------------------------
create table operation_plan_days (
  id                    uuid primary key default gen_random_uuid(),
  plan_id               uuid not null references operation_plans(id) on delete cascade,
  plan_date             date not null,
  operation_type        text not null default 'open',
  holiday_flag          text,
  location_id           uuid references locations(id) on delete set null,
  location_name         text,
  municipality          text,
  event_name            text,
  business_start_time   time,
  business_end_time     time,
  ai_source_text        text,
  ai_confidence         numeric(4, 3),
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique(plan_id, plan_date)
);

create index idx_operation_plan_days_plan_id on operation_plan_days(plan_id);
create index idx_operation_plan_days_plan_date on operation_plan_days(plan_date);

-- ------------------------------------------------------------
-- 11. weather_forecasts（営業予定向け天気予報）
-- ------------------------------------------------------------
create table weather_forecasts (
  id                uuid primary key default gen_random_uuid(),
  plan_day_id       uuid not null references operation_plan_days(id) on delete cascade,
  forecast_date     date not null,
  location_id       uuid references locations(id) on delete set null,
  latitude          numeric(10, 7),
  longitude         numeric(10, 7),
  weather_type      text,
  weather_code      integer,
  temperature_max   numeric(4, 1),
  temperature_min   numeric(4, 1),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(plan_day_id, forecast_date)
);

create index idx_weather_forecasts_plan_day_id on weather_forecasts(plan_day_id);

-- ------------------------------------------------------------
-- 12. sales_forecasts（日別売上予測）
-- ------------------------------------------------------------
create table sales_forecasts (
  id                        uuid primary key default gen_random_uuid(),
  plan_day_id               uuid not null references operation_plan_days(id) on delete cascade,
  forecast_date             date not null,
  predicted_sales           integer not null default 0,
  predicted_txn_count       integer not null default 0,
  predicted_avg_ticket      integer not null default 0,
  predicted_gross_profit    integer not null default 0,
  confidence_score          numeric(4, 3),
  forecast_basis            text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique(plan_day_id, forecast_date)
);

create index idx_sales_forecasts_plan_day_id on sales_forecasts(plan_day_id);

-- ------------------------------------------------------------
-- 13. vendor_daily_memos（ベンダー営業メモ）
-- ------------------------------------------------------------
create table vendor_daily_memos (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null,
  memo_date           date not null,
  memo_text           text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique(user_id, memo_date)
);

create index idx_vendor_daily_memos_user_id on vendor_daily_memos(user_id);
create index idx_vendor_daily_memos_memo_date on vendor_daily_memos(memo_date);

-- ------------------------------------------------------------
-- 14. vendor_weekly_reports（AI週報）
-- ------------------------------------------------------------
create table vendor_weekly_reports (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null,
  week_start_date     date not null,
  week_end_date       date not null,
  report_title        text not null,
  weekly_summary      text not null,
  ai_feedback         text not null,
  source_note_count   integer not null default 0,
  source_sales        integer not null default 0,
  helpful_feedback    boolean,
  helpful_marked_at   timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique(user_id, week_start_date, week_end_date)
);

create index idx_vendor_weekly_reports_user_id on vendor_weekly_reports(user_id);
create index idx_vendor_weekly_reports_week_start_date on vendor_weekly_reports(week_start_date);

-- ------------------------------------------------------------
-- ヘルパー関数：updated_at を自動更新するトリガー
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_transactions_updated_at
  before update on transactions
  for each row execute function set_updated_at();

create trigger trg_product_sales_updated_at
  before update on product_sales
  for each row execute function set_updated_at();

create trigger trg_locations_updated_at
  before update on locations
  for each row execute function set_updated_at();

create trigger trg_stall_logs_updated_at
  before update on stall_logs
  for each row execute function set_updated_at();

create trigger trg_operation_plans_updated_at
  before update on operation_plans
  for each row execute function set_updated_at();

create trigger trg_operation_plan_days_updated_at
  before update on operation_plan_days
  for each row execute function set_updated_at();

create trigger trg_weather_forecasts_updated_at
  before update on weather_forecasts
  for each row execute function set_updated_at();

create trigger trg_sales_forecasts_updated_at
  before update on sales_forecasts
  for each row execute function set_updated_at();

create trigger trg_vendor_daily_memos_updated_at
  before update on vendor_daily_memos
  for each row execute function set_updated_at();

create trigger trg_vendor_weekly_reports_updated_at
  before update on vendor_weekly_reports
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Row Level Security（RLS）: MVP は全公開（認証なし）
-- 将来の認証追加に備えてRLSは有効化だけしておく
-- ------------------------------------------------------------
alter table locations      enable row level security;
alter table events         enable row level security;
alter table transactions   enable row level security;
alter table product_master enable row level security;
alter table cost_history   enable row level security;
alter table product_sales  enable row level security;
alter table stall_logs     enable row level security;
alter table weather_logs   enable row level security;
alter table operation_plans enable row level security;
alter table operation_plan_days enable row level security;
alter table weather_forecasts enable row level security;
alter table sales_forecasts enable row level security;
alter table vendor_daily_memos enable row level security;
alter table vendor_weekly_reports enable row level security;

-- MVP用: 全操作を anon ロールに許可
create policy "public_all" on locations      for all to anon using (true) with check (true);
create policy "public_all" on events         for all to anon using (true) with check (true);
create policy "public_all" on transactions   for all to anon using (true) with check (true);
create policy "public_all" on product_master for all to anon using (true) with check (true);
create policy "public_all" on cost_history   for all to anon using (true) with check (true);
create policy "public_all" on product_sales  for all to anon using (true) with check (true);
create policy "public_all" on stall_logs     for all to anon using (true) with check (true);
create policy "public_all" on weather_logs   for all to anon using (true) with check (true);
create policy "public_all" on operation_plans for all to anon using (true) with check (true);
create policy "public_all" on operation_plan_days for all to anon using (true) with check (true);
create policy "public_all" on weather_forecasts for all to anon using (true) with check (true);
create policy "public_all" on sales_forecasts for all to anon using (true) with check (true);
create policy "public_all" on vendor_daily_memos for all to anon using (true) with check (true);
create policy "public_all" on vendor_weekly_reports for all to anon using (true) with check (true);

-- ------------------------------------------------------------
-- 動作確認用：テーブル一覧を表示
-- ------------------------------------------------------------
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
