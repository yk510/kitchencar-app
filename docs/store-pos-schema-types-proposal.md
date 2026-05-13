# 店舗POS `schema.sql` / 型定義 変更案

最終更新: 2026-05-13

## 1. 方針

店舗POSは、既存のモバイルオーダーと **別注文基盤を作らず**、`mobile_orders` を中心に拡張する。

この方針を採る理由:

- 注文管理ダッシュボードを共通化しやすい
- 商品 / オプション / 在庫減算ロジックを再利用しやすい
- 分析に POS 売上を合流しやすい
- モバイルオーダーと POS の両方を `order_source` で判別できる

---

## 2. 変更方針の要点

### 2-1. `mobile_orders` を拡張する

追加したい主な項目:

- `order_source`
  - `mobile_order`
  - `store_pos`
- `payment_method`
  - `card_online`
  - `cash`
  - `paypay`
  - `other`
- `paid_at`
- `accepted_by_user_id`
- `pos_device_label`

考え方:

- `payment_provider` は、Stripe などの **決済処理経路** を表す
- `payment_method` は、店頭での **受領方法 / 表示用の支払方法** を表す

つまり、

- モバイルオーダー
  - `order_source = mobile_order`
  - `payment_provider = stripe_checkout`
  - `payment_method = card_online`
- 店舗POS現金
  - `order_source = store_pos`
  - `payment_provider = manual`
  - `payment_method = cash`
- 店舗POS PayPay
  - `order_source = store_pos`
  - `payment_provider = manual`
  - `payment_method = paypay`

という使い分けを想定する。

### 2-2. 支払受領は `payment_status` で表現する

既存の `payment_status` はそのまま活かす。

候補:

- `pending`
- `authorized`
- `paid`
- `failed`
- `refunded`

MVPでの使い方:

- モバイルオーダー
  - Stripe 完了後に `paid`
- 店舗POS
  - 注文作成時は `pending`
  - 店員が `料金受領` を押した時に `paid`

### 2-3. POS設定は `vendor_stores` に持たせる

MVPでは別設定テーブルを増やしすぎず、`vendor_stores` に以下を追加する。

- `is_store_pos_enabled`
- `store_pos_terminal_name`
- `store_pos_enabled_payment_methods`

この段階では、1店舗1タブレット運用に近い前提で十分。

---

## 3. `schema.sql` / `sql/*.sql` に追加したい内容

### 3-1. `vendor_stores` の拡張

追加列:

- `is_store_pos_enabled boolean not null default false`
- `store_pos_terminal_name text`
- `store_pos_enabled_payment_methods text[] not null default array['cash', 'paypay']::text[]`

### 3-2. `mobile_orders` の拡張

追加列:

- `order_source text not null default 'mobile_order'`
- `payment_method text`
- `paid_at timestamptz`
- `accepted_by_user_id uuid`
- `pos_device_label text`

追加 / 更新したい制約:

- `order_source in ('mobile_order', 'store_pos')`
- `payment_method in ('card_online', 'cash', 'paypay', 'other')`

### 3-3. 既存データとの整合

既存のモバイルオーダー注文に対しては、migration で以下を埋める。

- `order_source = 'mobile_order'`
- `payment_method = 'card_online'`

これにより、既存分析や既存ダッシュボードに対する破壊的変更を避ける。

---

## 4. API / ロジック影響範囲

### 4-1. 既存公開注文API

既存:

- `src/app/api/public/mobile-order/orders/route.ts`

対応方針:

- 既存 API はモバイルオーダー専用として維持
- POS用は別入口を追加
- ただし内部で使う **在庫減算・商品検証・注文作成 helper** は共通化する

### 4-2. 注文管理ダッシュボード

既存:

- `src/app/vendor/mobile-order/orders/page.tsx`

追加したい表示:

- 注文ソース
- 支払方法
- 支払状態
- `料金受領` ボタン

### 4-3. 分析

既存分析では、`mobile_orders` を集計対象にしている箇所に `store_pos` も合流させる。

表示上:

- 合算でよい

裏側:

- `order_source` で分けられるようにする

---

## 5. 型定義で追加したいもの

### `src/types/database.ts`

`MobileOrder` に追加:

- `order_source: 'mobile_order' | 'store_pos'`
- `payment_method: 'card_online' | 'cash' | 'paypay' | 'other' | null`
- `paid_at: string | null`
- `accepted_by_user_id: string | null`
- `pos_device_label: string | null`

`VendorStore` に追加:

- `is_store_pos_enabled: boolean`
- `store_pos_terminal_name: string | null`
- `store_pos_enabled_payment_methods: string[]`

### 追加したいアプリ側 union

- `type StorePosPaymentMethod = 'cash' | 'paypay' | 'other'`
- `type OrderSource = 'mobile_order' | 'store_pos'`

---

## 6. Ticket 1 の結論

Ticket 1 の時点では、以下が固まれば十分。

1. POSは新しい注文テーブルを作らず `mobile_orders` を拡張する
2. 支払方法は `payment_provider` と `payment_method` を分けて扱う
3. 注文ソースは `order_source` で保持する
4. POS設定はまず `vendor_stores` に持たせる
5. 在庫減算は既存ロジックを共通利用する

この前提で、次の `Ticket 2` では型定義追加へ進める。
