-- Webアプリ前提 レシート印刷 MVP 用 SQL たたき台
-- 最終更新: 2026-05-19
--
-- 方針:
-- - レシート印刷設定は vendor_stores に持つ
-- - MVP では Epson ePOS Print を第一候補とする
-- - お客様向け最小印字内容は「店舗名」「注文番号」
-- - 移行初期は store_order_pages.notes fallback と共存できるようにする

begin;

-- ------------------------------------------------------------
-- vendor_stores: receipt printing settings
-- ------------------------------------------------------------
alter table public.vendor_stores
  add column if not exists is_receipt_print_enabled boolean not null default false;

alter table public.vendor_stores
  add column if not exists receipt_printer_provider text;

alter table public.vendor_stores
  add column if not exists receipt_printer_endpoint text;

alter table public.vendor_stores
  add column if not exists receipt_printer_label text;

alter table public.vendor_stores
  add column if not exists receipt_print_mode text not null default 'manual_dashboard';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'chk_vendor_stores_receipt_printer_provider'
  ) then
    alter table public.vendor_stores
      drop constraint chk_vendor_stores_receipt_printer_provider;
  end if;

  alter table public.vendor_stores
    add constraint chk_vendor_stores_receipt_printer_provider
    check (
      receipt_printer_provider is null
      or receipt_printer_provider in ('epson_epos')
    );
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'chk_vendor_stores_receipt_print_mode'
  ) then
    alter table public.vendor_stores
      drop constraint chk_vendor_stores_receipt_print_mode;
  end if;

  alter table public.vendor_stores
    add constraint chk_vendor_stores_receipt_print_mode
    check (
      receipt_print_mode in ('manual_dashboard', 'manual_dashboard_and_reprint', 'auto_after_payment')
    );
end $$;

create index if not exists idx_vendor_stores_receipt_print_enabled
  on public.vendor_stores(is_receipt_print_enabled);

-- ------------------------------------------------------------
-- schema cache reload
-- ------------------------------------------------------------
notify pgrst, 'reload schema';

commit;
