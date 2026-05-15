# 店舗POS 正式スキーマ適用手順

最終更新: 2026-05-15

このドキュメントは、店舗POSを `notes` fallback や `payment_provider = store_pos_*` の互換実装から、正式な DB 列中心の運用へ寄せるための適用手順です。

## 1. 目的

正式に使いたい列:

- `vendor_stores.is_store_pos_enabled`
- `vendor_stores.store_pos_terminal_name`
- `vendor_stores.store_pos_enabled_payment_methods`
- `mobile_orders.order_source`
- `mobile_orders.payment_method`
- `mobile_orders.paid_at`
- `mobile_orders.accepted_by_user_id`
- `mobile_orders.pos_device_label`

この適用で得たいこと:

- POS設定を `store_order_pages.notes` ではなく `vendor_stores` に保持する
- POS注文を `payment_provider` の文字列判定だけに依存せず扱える
- 今後の分析・注文管理・支払受領フローを正式列ベースで安定させる

## 2. 前提

- アプリ側はすでに fallback 付きで動いている
- そのため、SQL 適用前でも機能は使える
- 今回の migration は **既存運用を止めずに正式列へ寄せる** ためのもの

## 3. 実行SQL

実行対象:

- [store-pos-foundation.sql](/Users/yukikuchi/Documents/1.KX/仲町CS/kitchencar-app/sql/store-pos-foundation.sql)

この SQL は以下を行います。

- `vendor_stores` へ POS 設定列を追加
- `store_order_pages.notes` にある POS 設定 metadata を `vendor_stores` に backfill
- `mobile_orders` へ POS 用列を追加
- 既存の `store_pos_*` 支払 provider から
  - `order_source = store_pos`
  - `payment_method = cash / paypay / other`
  - `paid_at`
  を backfill
- index / check 制約を追加

## 4. 実行後の確認SQL

### 4-1. vendor_stores の追加列確認

```sql
select
  id,
  store_name,
  is_store_pos_enabled,
  store_pos_terminal_name,
  store_pos_enabled_payment_methods
from public.vendor_stores
order by created_at desc
limit 20;
```

### 4-2. mobile_orders の正式列確認

```sql
select
  id,
  order_number,
  payment_provider,
  payment_status,
  order_source,
  payment_method,
  paid_at,
  accepted_by_user_id,
  pos_device_label,
  created_at
from public.mobile_orders
order by created_at desc
limit 50;
```

### 4-3. 旧 provider と新列の整合確認

```sql
select
  payment_provider,
  order_source,
  payment_method,
  count(*) as orders
from public.mobile_orders
group by 1, 2, 3
order by 1, 2, 3;
```

期待する見え方:

- `stripe_checkout` 系は `order_source = mobile_order`
- `store_pos_cash` は `order_source = store_pos`, `payment_method = cash`
- `store_pos_paypay` は `order_source = store_pos`, `payment_method = paypay`
- `store_pos_other` は `order_source = store_pos`, `payment_method = other`

## 5. 適用後のアプリ確認

1. `vendor/mobile-order`
   - POS設定の保存が成功する
2. `store-pos/[token]`
   - 支払方法の表示が期待どおり
3. `vendor/mobile-order/orders`
   - POS注文の受領記録ができる
4. `analytics/daily`
   - POS売上が日別売上に反映される

## 6. cleanup 方針

この migration を流したあとも、しばらくはアプリ側の fallback を残してよいです。

cleanup の順番:

1. 本番で列が安定していることを確認
2. `notes_fallback` 表示が不要になったら UI 文言から外す
3. `store_order_pages.notes` の POS settings metadata 読み取り依存を減らす
4. `payment_provider = store_pos_*` 前提の判定を `order_source / payment_method` 中心へ寄せる

## 7. リスク

- 既存データへの列追加がある
- `mobile_orders` の backfill が走る
- ただし既存モバイルオーダー注文は `order_source = mobile_order`, `payment_method = card_online` に寄せるだけなので、破壊的変更は小さい

本番適用時は、SQL 実行後に `vendor/mobile-order` と `store-pos/[token]` を1回ずつ確認するのがおすすめです。
