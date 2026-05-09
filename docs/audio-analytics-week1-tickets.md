# 音声版 店舗Analytics Week 1 実装チケット

最終更新: 2026-05-09

このドキュメントは、音声版 店舗Analytics β版の最初の1週間で着手する実装単位をまとめたものです。

対象前提:
- まずは **商品販売数推定の成立確認**
- 録音クライアント本格開発前に、**DB / API / 抽出ロジックの骨格** を作る

---

## Ticket 1: SQL 基盤を追加する

目的:
- 音声セッション、チャンク、transcript、抽出イベント、alias を保存できるようにする

作業:
- `sql/audio-analytics-foundation.sql` を追加
- RLS 方針も含めて定義

完了条件:
- ローカル / Supabase に流せる SQL になっている
- ベンダー単位でデータ分離できる

---

## Ticket 2: TypeScript 型を追加する

目的:
- 音声Analytics 用の型を追加する

作業:
- `src/types/audio-analytics.ts`
- 必要なら `src/types/database.ts` への追記案も準備

完了条件:
- API payload と DB row を型で表現できる

---

## Ticket 3: 商品 alias 解決ロジックを作る

目的:
- 商品名の揺れを正規化できるようにする

作業:
- `src/lib/audio/product-alias.ts`
- `product_master` と `product_aliases` を見て正規化する helper を作る

完了条件:
- 生テキスト商品名を product_id / product_name に寄せられる

---

## Ticket 4: 数量正規化ロジックを作る

目的:
- `2`, `2つ`, `二つ`, `ひとつ` を整数へ寄せる

作業:
- `src/lib/audio/normalize-quantity.ts`
- まずは MVP 対象表現だけ対応

完了条件:
- 最低限の数量表現が正しく整数化される

---

## Ticket 5: transcript から注文イベントを抽出する

目的:
- 認識テキストから商品名 / 数量を抽出する

作業:
- `src/lib/audio/extract-order-events.ts`
- alias 解決と数量正規化を使う

完了条件:
- 単一商品 + 単一数量の発話から order event を作れる

---

## Ticket 6: 音声セッション API を作る

目的:
- セッション開始 / 停止の骨格を作る

作業:
- `src/app/api/audio/sessions/route.ts`

完了条件:
- セッションを作成・更新できる

---

## Ticket 7: transcript / order event 保存 API を作る

目的:
- 音声認識結果を API 経由で保存できるようにする

作業:
- `src/app/api/audio/transcripts/route.ts`
- 文字起こしテキスト保存
- 抽出イベント保存

完了条件:
- transcript と order event が一連で保存できる

---

## Ticket 8: 商品別・時間帯別の音声Analytics API を作る

目的:
- 音声版MVPの最小集計を返せるようにする

作業:
- `src/app/api/audio/analytics/products/route.ts`
- `src/app/api/audio/analytics/hourly/route.ts`

完了条件:
- 商品別販売数
- 注文回数
- 時間帯別推移
を返せる

---

## Ticket 9: Transcript 画面の最小UIを作る

目的:
- 認識テキストと抽出結果を見られるようにする

作業:
- `src/app/audio-analytics/transcripts/page.tsx`

完了条件:
- 発話時刻
- 認識テキスト
- 抽出商品
- 抽出数量
が一覧表示される

---

## Ticket 10: 音声ダッシュボードの最小UIを作る

目的:
- β版として見せられる最小 Analytics を出す

作業:
- `src/app/audio-analytics/page.tsx`

完了条件:
- 本日の商品別販売数
- 商品ランキング
- 時間帯別推移
が表示される

---

## Week 1 の完了ライン

1週間目の完了ラインは以下です。

1. DB に音声データを保存できる
2. transcript から商品 / 数量抽出ができる
3. 音声由来の集計 API が返せる
4. Transcript と Dashboard の最小 UI が見える

この時点では、
- 録音クライアント
- バックグラウンド録音
- Bluetooth 実運用

までは未着手で問題ありません。
