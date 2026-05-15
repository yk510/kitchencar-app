-- ============================================================
-- クリダス モバイルオーダー 商品表示設定カラム追加
-- 既存の mobile-order-foundation.sql を流した環境向け
-- ============================================================

alter table mobile_order_products
  add column if not exists display_category text not null default 'other',
  add column if not exists is_recommended boolean not null default false;

alter table mobile_order_products
  drop constraint if exists chk_mobile_order_products_display_category;

alter table mobile_order_products
  add constraint chk_mobile_order_products_display_category
  check (display_category in ('main', 'side', 'drink', 'other'));
