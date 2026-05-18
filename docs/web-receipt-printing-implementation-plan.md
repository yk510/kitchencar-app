# Webアプリ前提 レシート印刷 実装計画

最終更新: 2026-05-18

## Phase 1: 印刷設定の土台を作る

目的:
- ベンダーごとにプリンター設定を保存できるようにする

実装単位:
- ベンダー設定へ印刷設定追加
- プリンター種別
- 接続先 URL / IP
- 自動印刷フラグ
- 型追加
- settings API 拡張

対象ファイル候補:
- `sql/*receipt*.sql`
- `src/types/database.ts`
- `src/types/api-payloads.ts`
- `src/app/vendor/mobile-order/page.tsx`
- `src/app/api/vendor/mobile-order/settings/route.ts`

完了条件:
- 印刷設定を保存できる
- 未設定時の fallback がある

---

## Phase 2: レシート payload / formatter を作る

目的:
- 注文情報を、印字しやすいフォーマットへ統一変換する

実装単位:
- 注文明細 formatter
- オプション整形
- 金額整形
- 支払方法ラベル整形
- レシート表示名整形

対象ファイル候補:
- `src/lib/receipt-printing/*`
- `src/lib/mobile-order-fields.ts`
- `src/lib/public-order-display.ts`

完了条件:
- POS / モバイルオーダーどちらでも同じレシート payload を作れる

---

## Phase 3: Epson ePOS Print 送信実装

目的:
- Web アプリから LAN 上の Epson プリンターへ送信できるようにする

実装単位:
- ePOS XML 生成
- HTTP 送信 helper
- タイムアウト
- エラーハンドリング
- 疎通確認用の最小印刷

対象ファイル候補:
- `src/lib/receipt-printing/epson-epos.ts`
- `src/lib/receipt-printing/epson-xml.ts`

完了条件:
- テスト注文を印刷できる
- 失敗時のエラー内容が取得できる

---

## Phase 4: 印刷 API を追加

目的:
- 注文管理や POS から叩ける印刷 API を追加する

実装単位:
- `POST /api/vendor/mobile-order/orders/[id]/print`
- 注文所有権確認
- ベンダー印刷設定確認
- レシート payload 生成
- ePOS 送信
- 印刷結果レスポンス

対象ファイル候補:
- `src/app/api/vendor/mobile-order/orders/[id]/print/route.ts`
- `src/lib/vendor-mobile-order-dashboard-api.ts`
- `src/lib/receipt-printing/*`

完了条件:
- 注文 ID を指定して印刷できる

---

## Phase 5: 注文管理画面に導線を追加

目的:
- 店員が注文管理画面から印刷できるようにする

実装単位:
- 詳細画面に `レシート印刷`
- `再印刷`
- 印刷中ローディング
- 成功 / 失敗バナー

対象ファイル候補:
- `src/app/vendor/mobile-order/orders/page.tsx`
- `src/lib/use-vendor-mobile-order-dashboard-actions.ts`

完了条件:
- 店員が注文管理画面から印刷できる

---

## Phase 6: POS 完了画面との連携

目的:
- 必要なら POS 注文完了導線に印刷連携を加える

実装単位:
- 店員へ印刷案内
- 自動印刷トリガの検討
- 手動印刷 fallback

完了条件:
- 現場運用に合わせた印刷タイミングを選べる

---

## 推奨実装順

1. Phase 1: 印刷設定
2. Phase 2: payload / formatter
3. Phase 3: Epson 送信
4. Phase 4: 印刷 API
5. Phase 5: 注文管理導線
6. Phase 6: POS 完了画面連携

---

## MVPで最初に確認したいこと

1. LAN 上の Epson プリンターへ本当に送れるか
2. 注文番号と明細が正しく出るか
3. 店員が注文管理画面から迷わず印刷できるか
4. 印刷失敗時に再試行しやすいか
