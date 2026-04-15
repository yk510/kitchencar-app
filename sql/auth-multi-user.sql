-- ============================================================
-- Supabase Auth + ユーザー別データ分離 migration
-- 既存データが空、または開発用で入れ直せる前提で使う想定です
-- ============================================================

-- 1. user_id カラム追加
alter table locations add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table events add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table transactions add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table product_master add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table cost_history add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table product_sales add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table stall_logs add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table weather_logs add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table operation_plans add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table operation_plan_days add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table weather_forecasts add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table sales_forecasts add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_locations_user_id on locations(user_id);
create index if not exists idx_events_user_id on events(user_id);
create index if not exists idx_transactions_user_id on transactions(user_id);
create index if not exists idx_product_master_user_id on product_master(user_id);
create index if not exists idx_cost_history_user_id on cost_history(user_id);
create index if not exists idx_product_sales_user_id on product_sales(user_id);
create index if not exists idx_stall_logs_user_id on stall_logs(user_id);
create index if not exists idx_weather_logs_user_id on weather_logs(user_id);
create index if not exists idx_operation_plans_user_id on operation_plans(user_id);
create index if not exists idx_operation_plan_days_user_id on operation_plan_days(user_id);
create index if not exists idx_weather_forecasts_user_id on weather_forecasts(user_id);
create index if not exists idx_sales_forecasts_user_id on sales_forecasts(user_id);

-- 2. 旧ユニーク制約を解除
alter table locations drop constraint if exists locations_name_address_key;
alter table events drop constraint if exists events_event_name_event_date_location_id_key;
alter table transactions drop constraint if exists transactions_txn_no_key;
alter table product_master drop constraint if exists product_master_product_name_key;
alter table product_sales drop constraint if exists product_sales_txn_no_product_name_key;
alter table stall_logs drop constraint if exists stall_logs_log_date_key;
alter table weather_logs drop constraint if exists weather_logs_log_date_location_id_key;
alter table weather_forecasts drop constraint if exists weather_forecasts_plan_day_id_forecast_date_key;
alter table sales_forecasts drop constraint if exists sales_forecasts_plan_day_id_forecast_date_key;

-- 3. user_id を含むユニークインデックス
create unique index if not exists locations_user_id_name_address_key
on locations(user_id, name, address);

create unique index if not exists events_user_id_event_name_event_date_location_id_key
on events(user_id, event_name, event_date, location_id);

create unique index if not exists transactions_user_id_txn_no_key
on transactions(user_id, txn_no);

create unique index if not exists product_master_user_id_product_name_key
on product_master(user_id, product_name);

create unique index if not exists product_sales_user_id_txn_no_product_name_key
on product_sales(user_id, txn_no, product_name);

create unique index if not exists stall_logs_user_id_log_date_key
on stall_logs(user_id, log_date);

create unique index if not exists weather_logs_user_id_log_date_location_id_key
on weather_logs(user_id, log_date, location_id);

create unique index if not exists weather_forecasts_user_id_plan_day_id_forecast_date_key
on weather_forecasts(user_id, plan_day_id, forecast_date);

create unique index if not exists sales_forecasts_user_id_plan_day_id_forecast_date_key
on sales_forecasts(user_id, plan_day_id, forecast_date);

-- 4. 旧 anon 公開ポリシーを削除
drop policy if exists "public_all" on locations;
drop policy if exists "public_all" on events;
drop policy if exists "public_all" on transactions;
drop policy if exists "public_all" on product_master;
drop policy if exists "public_all" on cost_history;
drop policy if exists "public_all" on product_sales;
drop policy if exists "public_all" on stall_logs;
drop policy if exists "public_all" on weather_logs;
drop policy if exists "public_all" on operation_plans;
drop policy if exists "public_all" on operation_plan_days;
drop policy if exists "public_all" on weather_forecasts;
drop policy if exists "public_all" on sales_forecasts;

-- 5. ログイン済みユーザーだけが自分の行を扱えるポリシー
create policy "authenticated_own_rows" on locations
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "authenticated_own_rows" on events
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "authenticated_own_rows" on transactions
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "authenticated_own_rows" on product_master
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "authenticated_own_rows" on cost_history
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "authenticated_own_rows" on product_sales
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "authenticated_own_rows" on stall_logs
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "authenticated_own_rows" on weather_logs
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "authenticated_own_rows" on operation_plans
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "authenticated_own_rows" on operation_plan_days
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "authenticated_own_rows" on weather_forecasts
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "authenticated_own_rows" on sales_forecasts
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
