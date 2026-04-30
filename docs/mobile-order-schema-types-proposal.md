# モバイルオーダー `schema.sql` / `src/types/database.ts` 変更案

## 1. 方針

この変更案は、次の前提で作っています。

- DBは `1ベンダー=複数店舗対応`
- MVPの画面運用は実質 `1ベンダー=1店舗`
- QRコードは `店舗固定`
- 注文受付可否は `営業スケジュール` で制御
- 注文番号は `英字1文字 + 数字4桁` 形式

## 2. `schema.sql` 変更案

既存の `schema.sql` に対しては、まずモバイルオーダー用のブロックを追加する想定です。

### 追加テーブル

1. `vendor_stores`
2. `store_order_pages`
3. `store_order_schedules`
4. `mobile_order_products`
5. `mobile_order_option_groups`
6. `mobile_order_option_choices`
7. `mobile_order_product_option_groups`
8. `mobile_orders`
9. `mobile_order_items`
10. `mobile_order_item_option_choices`
11. `mobile_order_notifications`
12. `mobile_order_audit_logs`

### `schema.sql` に追記するSQLたたき台

```sql
-- ------------------------------------------------------------
-- mobile order: stores
-- ------------------------------------------------------------
create table vendor_stores (
  id                        uuid primary key default gen_random_uuid(),
  vendor_user_id            uuid not null,
  store_name                text not null,
  slug                      text not null unique,
  order_number_prefix       text not null,
  description               text,
  hero_image_url            text,
  is_mobile_order_enabled   boolean not null default false,
  is_accepting_orders       boolean not null default true,
  line_official_account_id  text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint chk_vendor_stores_order_number_prefix
    check (order_number_prefix ~ '^[A-Z]$')
);

create index idx_vendor_stores_vendor_user_id on vendor_stores(vendor_user_id);

-- ------------------------------------------------------------
-- mobile order: public order pages
-- ------------------------------------------------------------
create table store_order_pages (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references vendor_stores(id) on delete cascade,
  page_title    text not null,
  public_token  text not null unique,
  status        text not null default 'published',
  is_primary    boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint chk_store_order_pages_status
    check (status in ('draft', 'published', 'archived'))
);

create index idx_store_order_pages_store_id on store_order_pages(store_id);

-- ------------------------------------------------------------
-- mobile order: schedules
-- ------------------------------------------------------------
create table store_order_schedules (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references vendor_stores(id) on delete cascade,
  order_page_id  uuid not null references store_order_pages(id) on delete cascade,
  business_date  date not null,
  opens_at       timestamptz not null,
  closes_at      timestamptz not null,
  status         text not null default 'scheduled',
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint chk_store_order_schedules_time_range
    check (opens_at < closes_at),
  constraint chk_store_order_schedules_status
    check (status in ('scheduled', 'open', 'closed', 'cancelled')),
  unique(order_page_id, business_date, opens_at)
);

create index idx_store_order_schedules_store_id on store_order_schedules(store_id);
create index idx_store_order_schedules_business_date on store_order_schedules(business_date);
create index idx_store_order_schedules_opens_at on store_order_schedules(opens_at);
create index idx_store_order_schedules_closes_at on store_order_schedules(closes_at);

-- ------------------------------------------------------------
-- mobile order: products
-- ------------------------------------------------------------
create table mobile_order_products (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references vendor_stores(id) on delete cascade,
  name          text not null,
  description   text,
  price         integer not null,
  image_url     text,
  sort_order    integer not null default 0,
  is_published  boolean not null default true,
  is_sold_out   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_mobile_order_products_store_id on mobile_order_products(store_id);
create index idx_mobile_order_products_sort_order on mobile_order_products(store_id, sort_order);

-- ------------------------------------------------------------
-- mobile order: option groups
-- ------------------------------------------------------------
create table mobile_order_option_groups (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references vendor_stores(id) on delete cascade,
  name            text not null,
  is_required     boolean not null default false,
  selection_type  text not null,
  min_select      integer,
  max_select      integer,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint chk_mobile_order_option_groups_selection_type
    check (selection_type in ('single', 'multiple'))
);

create table mobile_order_option_choices (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references mobile_order_option_groups(id) on delete cascade,
  name          text not null,
  price_delta   integer not null default 0,
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table mobile_order_product_option_groups (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references mobile_order_products(id) on delete cascade,
  option_group_id  uuid not null references mobile_order_option_groups(id) on delete cascade,
  sort_order       integer not null default 0,
  unique(product_id, option_group_id)
);

-- ------------------------------------------------------------
-- mobile order: orders
-- ------------------------------------------------------------
create table mobile_orders (
  id                          uuid primary key default gen_random_uuid(),
  store_id                    uuid not null references vendor_stores(id) on delete restrict,
  order_page_id               uuid not null references store_order_pages(id) on delete restrict,
  schedule_id                 uuid not null references store_order_schedules(id) on delete restrict,
  order_number                text not null unique,
  customer_line_user_id       text,
  customer_line_display_name  text,
  pickup_nickname             text not null,
  status                      text not null default 'placed',
  payment_status              text not null default 'pending',
  payment_provider            text not null default 'credit_card',
  payment_reference           text,
  subtotal_amount             integer not null default 0,
  tax_amount                  integer not null default 0,
  total_amount                integer not null default 0,
  ordered_at                  timestamptz not null default now(),
  ready_notified_at           timestamptz,
  picked_up_at                timestamptz,
  cancelled_at                timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint chk_mobile_orders_status
    check (status in ('placed', 'preparing', 'ready', 'picked_up', 'cancelled')),
  constraint chk_mobile_orders_payment_status
    check (payment_status in ('pending', 'authorized', 'paid', 'failed', 'refunded')),
  constraint chk_mobile_orders_order_number
    check (order_number ~ '^[A-Z][0-9]{4}$')
);

create index idx_mobile_orders_store_id on mobile_orders(store_id);
create index idx_mobile_orders_schedule_id on mobile_orders(schedule_id);
create index idx_mobile_orders_ordered_at on mobile_orders(ordered_at desc);
create index idx_mobile_orders_status on mobile_orders(store_id, status);

create table mobile_order_items (
  id                           uuid primary key default gen_random_uuid(),
  order_id                     uuid not null references mobile_orders(id) on delete cascade,
  product_id                   uuid not null references mobile_order_products(id) on delete restrict,
  product_name_snapshot        text not null,
  unit_price_snapshot          integer not null,
  quantity                     integer not null default 1,
  line_total_amount            integer not null default 0,
  created_at                   timestamptz not null default now()
);

create table mobile_order_item_option_choices (
  id                           uuid primary key default gen_random_uuid(),
  order_item_id                uuid not null references mobile_order_items(id) on delete cascade,
  option_group_name_snapshot   text not null,
  option_choice_name_snapshot  text not null,
  price_delta_snapshot         integer not null default 0,
  created_at                   timestamptz not null default now()
);

create table mobile_order_notifications (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references mobile_orders(id) on delete cascade,
  notification_type text not null,
  delivery_status   text not null default 'pending',
  line_message_id   text,
  sent_at           timestamptz,
  failed_at         timestamptz,
  error_message     text,
  created_at        timestamptz not null default now(),
  constraint chk_mobile_order_notifications_type
    check (notification_type in ('order_completed', 'order_ready'))
);

create table mobile_order_audit_logs (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references mobile_orders(id) on delete cascade,
  actor_user_id uuid,
  action_type   text not null,
  before_status text,
  after_status  text,
  payload       jsonb,
  created_at    timestamptz not null default now()
);

create trigger trg_vendor_stores_updated_at
  before update on vendor_stores
  for each row execute function set_updated_at();

create trigger trg_store_order_pages_updated_at
  before update on store_order_pages
  for each row execute function set_updated_at();

create trigger trg_store_order_schedules_updated_at
  before update on store_order_schedules
  for each row execute function set_updated_at();

create trigger trg_mobile_order_products_updated_at
  before update on mobile_order_products
  for each row execute function set_updated_at();

create trigger trg_mobile_order_option_groups_updated_at
  before update on mobile_order_option_groups
  for each row execute function set_updated_at();

create trigger trg_mobile_order_option_choices_updated_at
  before update on mobile_order_option_choices
  for each row execute function set_updated_at();

create trigger trg_mobile_orders_updated_at
  before update on mobile_orders
  for each row execute function set_updated_at();
```

### RLS方針メモ

- `vendor_stores` などベンダー管理対象テーブルは `authenticated` + `user_id` ベースで制御
- `store_order_pages` の公開取得は `anon` でも読めるようにする
- `mobile_orders` 作成は公開注文API経由に寄せ、直接 `anon` 書き込みは避ける方が安全

## 3. `src/types/database.ts` 変更案

### `Database['public']['Tables']` へ追加

```ts
      vendor_stores: {
        Row: VendorStore
        Insert: Omit<VendorStore, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<VendorStore, 'id' | 'created_at'>>
      }
      store_order_pages: {
        Row: StoreOrderPage
        Insert: Omit<StoreOrderPage, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<StoreOrderPage, 'id' | 'created_at'>>
      }
      store_order_schedules: {
        Row: StoreOrderSchedule
        Insert: Omit<StoreOrderSchedule, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<StoreOrderSchedule, 'id' | 'created_at'>>
      }
      mobile_order_products: {
        Row: MobileOrderProduct
        Insert: Omit<MobileOrderProduct, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MobileOrderProduct, 'id' | 'created_at'>>
      }
      mobile_order_option_groups: {
        Row: MobileOrderOptionGroup
        Insert: Omit<MobileOrderOptionGroup, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MobileOrderOptionGroup, 'id' | 'created_at'>>
      }
      mobile_order_option_choices: {
        Row: MobileOrderOptionChoice
        Insert: Omit<MobileOrderOptionChoice, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MobileOrderOptionChoice, 'id' | 'created_at'>>
      }
      mobile_order_product_option_groups: {
        Row: MobileOrderProductOptionGroup
        Insert: Omit<MobileOrderProductOptionGroup, 'id'>
        Update: Partial<Omit<MobileOrderProductOptionGroup, 'id'>>
      }
      mobile_orders: {
        Row: MobileOrder
        Insert: Omit<MobileOrder, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MobileOrder, 'id' | 'created_at'>>
      }
      mobile_order_items: {
        Row: MobileOrderItem
        Insert: Omit<MobileOrderItem, 'id' | 'created_at'>
        Update: never
      }
      mobile_order_item_option_choices: {
        Row: MobileOrderItemOptionChoice
        Insert: Omit<MobileOrderItemOptionChoice, 'id' | 'created_at'>
        Update: never
      }
      mobile_order_notifications: {
        Row: MobileOrderNotification
        Insert: Omit<MobileOrderNotification, 'id' | 'created_at'>
        Update: Partial<Omit<MobileOrderNotification, 'id' | 'created_at'>>
      }
      mobile_order_audit_logs: {
        Row: MobileOrderAuditLog
        Insert: Omit<MobileOrderAuditLog, 'id' | 'created_at'>
        Update: never
      }
```

### 追加するエンティティ型

```ts
export interface VendorStore {
  id: string
  vendor_user_id: string
  store_name: string
  slug: string
  order_number_prefix: string
  description: string | null
  hero_image_url: string | null
  is_mobile_order_enabled: boolean
  is_accepting_orders: boolean
  line_official_account_id: string | null
  created_at: string
  updated_at: string
}

export interface StoreOrderPage {
  id: string
  store_id: string
  page_title: string
  public_token: string
  status: 'draft' | 'published' | 'archived'
  is_primary: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface StoreOrderSchedule {
  id: string
  store_id: string
  order_page_id: string
  business_date: string
  opens_at: string
  closes_at: string
  status: 'scheduled' | 'open' | 'closed' | 'cancelled'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface MobileOrderProduct {
  id: string
  store_id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  sort_order: number
  is_published: boolean
  is_sold_out: boolean
  created_at: string
  updated_at: string
}

export interface MobileOrderOptionGroup {
  id: string
  store_id: string
  name: string
  is_required: boolean
  selection_type: 'single' | 'multiple'
  min_select: number | null
  max_select: number | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface MobileOrderOptionChoice {
  id: string
  group_id: string
  name: string
  price_delta: number
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MobileOrderProductOptionGroup {
  id: string
  product_id: string
  option_group_id: string
  sort_order: number
}

export interface MobileOrder {
  id: string
  store_id: string
  order_page_id: string
  schedule_id: string
  order_number: string
  customer_line_user_id: string | null
  customer_line_display_name: string | null
  pickup_nickname: string
  status: 'placed' | 'preparing' | 'ready' | 'picked_up' | 'cancelled'
  payment_status: 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded'
  payment_provider: string
  payment_reference: string | null
  subtotal_amount: number
  tax_amount: number
  total_amount: number
  ordered_at: string
  ready_notified_at: string | null
  picked_up_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export interface MobileOrderItem {
  id: string
  order_id: string
  product_id: string
  product_name_snapshot: string
  unit_price_snapshot: number
  quantity: number
  line_total_amount: number
  created_at: string
}

export interface MobileOrderItemOptionChoice {
  id: string
  order_item_id: string
  option_group_name_snapshot: string
  option_choice_name_snapshot: string
  price_delta_snapshot: number
  created_at: string
}

export interface MobileOrderNotification {
  id: string
  order_id: string
  notification_type: 'order_completed' | 'order_ready'
  delivery_status: string
  line_message_id: string | null
  sent_at: string | null
  failed_at: string | null
  error_message: string | null
  created_at: string
}

export interface MobileOrderAuditLog {
  id: string
  order_id: string
  actor_user_id: string | null
  action_type: string
  before_status: string | null
  after_status: string | null
  payload: Json | null
  created_at: string
}
```

## 4. 実装メモ

### 型定義の追加位置

- `Database['public']['Tables']` には既存テーブル定義の続きとして追加
- エンティティ型は `ApplicationMessage` より前後のまとまりに追加

### 既存パターンに合わせる点

- `Insert` は `id` と自動列を除外
- `Update` は `Partial<Omit<...>>`
- スナップショット系明細は原則 `Update: never`

### あとで追加したい型

- ベンダーダッシュボード用の集約型
- 公開注文ページ取得用のネスト付き型
- 注文作成APIの payload / response 型
