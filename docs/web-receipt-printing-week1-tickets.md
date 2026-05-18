# Webアプリ前提 レシート印刷 Week 1 チケット

最終更新: 2026-05-18

## Ticket 1

**印刷設定のデータモデル案を作る**

やること:
- ベンダー設定に持つ印刷設定項目を整理
- 既存 `vendor_stores` / `store_order_pages.notes` fallback とどう共存するか決める

成果物:
- schema proposal
- SQL たたき台

---

## Ticket 2

**印刷設定 UI / API の最小追加**

やること:
- `vendor/mobile-order` に印刷設定項目を追加
- settings API を拡張

完了条件:
- ベンダーが印刷利用有無と接続先を保存できる

---

## Ticket 3

**注文からレシート payload を作る formatter を追加**

やること:
- 注文番号
- 商品明細
- オプション
- 店舗名
- 注文日時

を整形する shared helper を作る

完了条件:
- POS / モバイルオーダー両対応の payload が作れる
- 注文番号を主表示、注文内容を補足、店舗名と注文日時をフッターに出せる

---

## Ticket 4

**Epson ePOS Print 送信 helper を追加**

やること:
- XML 生成
- POST 送信
- タイムアウトとエラー整形

完了条件:
- 疎通確認可能

---

## Ticket 5

**注文管理画面からの印刷 API を追加**

やること:
- `POST /api/vendor/mobile-order/orders/[id]/print`
- vendor 権限確認
- 印刷設定確認
- payload 生成
- 送信

完了条件:
- API 単体で印刷可能

---

## Ticket 6

**注文管理画面に印刷導線を追加**

やること:
- `レシート印刷`
- `再印刷`
- 印刷中 UI
- 成功 / 失敗表示

完了条件:
- 店員が実際に操作できる

---

## Ticket 7

**失敗時の運用 fallback を整える**

やること:
- 未設定時メッセージ
- プリンター未到達時メッセージ
- 再試行導線

完了条件:
- 現場で止まりにくい
