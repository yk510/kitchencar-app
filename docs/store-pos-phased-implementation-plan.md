# 店舗POS MVP 実装フェーズ計画

最終更新: 2026-05-12

このドキュメントは、既存モバイルオーダー基盤を活用した店舗POS MVP の実装順を整理したものです。

---

## Phase 1: POS注文の土台を作る

目的:
- 既存モバイルオーダー注文基盤に、`store_pos` という新しい注文ソースを追加する

実装単位:
- 注文テーブル / 型に `order_source` を追加
- `payment_method`
- `payment_status`
- `paid_at`
を追加
- POS用の注文作成APIを追加
- 既存在庫減算ロジックが POS でも動くように整理

対象ファイル候補:
- `sql/*store-pos*.sql`
- `src/types/database.ts`
- `src/types/mobile-order*.ts`
- `src/app/api/vendor/mobile-order/orders/*`
- `src/lib/mobile-order.ts`

完了条件:
- `store_pos` 注文を DB に保存できる
- POS注文でも在庫が減る
- モバイルオーダー既存フローを壊さない

---

## Phase 2: タブレット用 POS 注文画面を作る

目的:
- 店頭設置タブレットで、誰でも注文しやすい UI を作る

方針:
- 公開注文ページの基盤を流用
- ただし UI は POS 専用に最適化

実装単位:
- POS専用ページを追加
- 大きいタップ領域
- シンプルなカート
- 支払方法選択
- 合計表示
- 完了画面
- 完了画面に `次の注文を始める` CTA を配置
- 一定時間後の自動ホーム復帰
- 自動復帰時のカート / 入力状態リセット
- `まもなく次の注文画面へ戻ります` 案内表示

対象ファイル候補:
- `src/app/pos/[token]/page.tsx` または `src/app/store-pos/[token]/page.tsx`
- `src/components/*mobile-order*`
- POS専用 UI component 群

完了条件:
- 店頭タブレットで商品選択から注文作成まで完結できる
- 老若男女が使いやすい大きめ UI になっている
- 注文完了後に次のお客様向け画面へスムーズに戻れる

---

## Phase 3: 支払受領フローを追加する

目的:
- 注文作成と支払確定を分離し、店員が会計受領を確定できるようにする

推奨フロー:
- 注文作成時は `payment_status = pending`
- ダッシュボードで `料金受領` を押すと `paid`

実装単位:
- 支払状態更新 API
- `料金受領` ボタン
- 未払い / 支払済みの表示
- 支払方法の表示

対象ファイル候補:
- `src/app/vendor/mobile-order/orders/page.tsx`
- `src/app/api/vendor/mobile-order/orders/[id]/route.ts`
- 注文一覧 / 注文詳細 component

完了条件:
- POS注文は未払いで作成される
- 店員がダッシュボードで受領確定できる

---

## Phase 4: ベンダー設定と支払方法設定を追加する

目的:
- ベンダーごとに使える支払方法を管理できるようにする

実装単位:
- POS設定画面
- 現金 / PayPay / その他 の有効化
- POS画面で有効な支払方法だけ表示

対象ファイル候補:
- `src/app/vendor/mobile-order/page.tsx`
- `src/app/vendor/mobile-order/settings/*` または POS設定ページ
- `src/app/api/vendor/mobile-order/settings/*`

完了条件:
- ベンダーが支払方法を管理できる
- POS画面が設定値に従って出し分けられる

---

## Phase 5: 注文管理ダッシュボードをPOS対応する

目的:
- モバイルオーダーとPOSの注文を同じ画面で運用できるようにする

実装単位:
- 注文ソース表示
- 支払方法表示
- 支払状態表示
- フィルタ追加
  - すべて
  - モバイルオーダー
  - 店頭POS

対象ファイル候補:
- `src/app/vendor/mobile-order/orders/page.tsx`
- 関連 API / types

完了条件:
- 店員が 1 画面で両方の注文を扱える
- POS注文だけ見たい時も切り分けられる

---

## Phase 6: 分析統合

目的:
- 既存分析に POS 売上を合算しつつ、裏側ではソースを保持する

実装単位:
- 売上 / 商品別 / 時間帯別 / 日別集計に `store_pos` を合流
- 合算表示
- 必要に応じて内部的なソース別集計 helper を追加

対象ファイル候補:
- `src/app/analytics/*`
- `src/app/api/analytics/*`
- `src/lib/analytics-*`

完了条件:
- 既存分析に POS 売上が自然に乗る
- 将来 `order_source` で切り分け可能

---

## Phase 7: タブレット運用の磨き込み

目的:
- 現場で実運用できるようにする

実装単位:
- タブレット向けレイアウト調整
- 全画面表示しやすい構成
- 注文完了後の自動初期化
- 放置時のホーム復帰
- アクセシビリティ改善

完了条件:
- 店頭タブレットとして置いても運用しやすい

---

## 実装優先順位

1. Phase 1: POS注文の土台
2. Phase 2: タブレット注文画面
3. Phase 3: 支払受領フロー
4. Phase 5: 注文管理ダッシュボード対応
5. Phase 4: ベンダー設定
6. Phase 6: 分析統合
7. Phase 7: 運用磨き込み

この順にする理由:

- 先に注文データを正しく作れるようにする
- 次に店頭で使える画面を出す
- その上で支払受領・管理・分析へ広げる

---

## MVPで最初に確認したいこと

1. POS注文が既存注文基盤に無理なく載るか
2. POS注文でも在庫連動が破綻しないか
3. 現金 / PayPay の受領確定フローが現場で自然か
4. 注文管理画面を共通化しても運用しやすいか
