# 注文管理 API リファクタ計画

## 目的

- `/api/vendor/mobile-order/orders` 系 route の責務を薄くする
- 取得系と更新系を server helper に寄せ、UI 側の refactor と揃える
- POS / モバイルオーダー差分の将来拡張をしやすくする

## 分離方針

### 1. 取得系 helper

- `summary`
- `list`
- `detail`
- `full payload`

を route から切り離し、payload 組み立てを helper 化する。

### 2. 更新系 helper

- ステータス変更
- 料金受領
- 通知送信

を helper 化し、route は

- 認証
- body parse
- 例外変換
- HTTP 応答

に寄せる。

### 3. ownership / vendor access 検証

- 対象注文
- 対象通知

への vendor 権限確認を共通化する。

## 実装ステップ

1. `vendor-mobile-order-dashboard-api.ts`
   - 一覧/件数/詳細 payload の組み立て
2. `vendor-mobile-order-dashboard-mutations.ts`
   - status / payment / notification send を分離
3. route 更新
   - `/orders`
   - `/orders/list`
   - `/orders/summary`
   - `/orders/[id]`
   - `/orders/[id]/notifications/[notificationId]/send`

## 完了条件

- route に重い query / update ロジックが残っていない
- build が通る
- 既存の dashboard UI / optimistic update と互換がある
