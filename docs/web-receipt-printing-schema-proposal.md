# Webアプリ前提 レシート印刷 schema proposal

最終更新: 2026-05-19

## 1. Ticket 1 の結論

レシート印刷設定は、まず **`vendor_stores` に持つ** のが自然です。

理由:

- 店頭POS / モバイルオーダー / 注文管理は、いずれも `store` 単位で運用される
- 注文番号の prefix や `store_order_pages` と同じく、店舗単位の設定として扱いやすい
- 今後「複数営業枠で同じプリンターを使う」ケースにもそのまま合う

MVP では、**お客様向けの紙に店舗名・注文番号・注文日時が出ればよい** 前提で、設定も最小構成に寄せます。

---

## 2. 保存したい設定

### 必須

- `is_receipt_print_enabled`
  - レシート印刷を使うか
- `receipt_printer_provider`
  - まずは `epson_epos`
- `receipt_printer_endpoint`
  - プリンターの URL / IP ベースの接続先

### あると良い

- `receipt_printer_label`
  - 店員が見て分かる名前
- `receipt_print_mode`
  - いつ印刷するか

---

## 3. MVP の列案

### `vendor_stores`

- `is_receipt_print_enabled boolean not null default false`
- `receipt_printer_provider text`
- `receipt_printer_endpoint text`
- `receipt_printer_label text`
- `receipt_print_mode text not null default 'manual_dashboard'`

### check constraint

- `receipt_printer_provider in ('epson_epos')`
- `receipt_print_mode in ('manual_dashboard', 'manual_dashboard_and_reprint', 'auto_after_payment')`

---

## 4. まず採用しないもの

MVP では以下は列にしません。

- 注文ごとの印刷履歴
- 印刷失敗履歴
- 営業枠ごとの別プリンター設定
- キッチンプリンター / 会計プリンターの複数台設定
- Bluetooth 設定

必要になった段階で別テーブルへ切り出す方が安全です。

---

## 5. fallback 方針

今回のプロダクトでは、`store_order_pages.notes` に fallback を持たせる流れがすでにあります。

レシート印刷設定でも、移行初期は同じ方針でよいです。

### 優先順位

1. `vendor_stores` 正式列
2. `store_order_pages.notes` fallback
3. 未設定

### notes に保存する場合のイメージ

```text
[kuridas:receipt-print-settings]
{"is_receipt_print_enabled":true,"receipt_printer_provider":"epson_epos","receipt_printer_endpoint":"http://192.168.10.50/cgi-bin/epos/service.cgi","receipt_printer_label":"counter-printer","receipt_print_mode":"manual_dashboard"}
[/kuridas:receipt-print-settings]
```

---

## 6. 画面との対応

`/vendor/mobile-order` の設定画面で持たせる項目:

- レシート印刷を有効にする
- プリンター種別
- 接続先 URL / IP
- プリンター名
- 印刷タイミング

MVP では、印刷タイミングのデフォルトは

- `manual_dashboard`

にしておくのが安全です。

---

## 7. 注文データ側で追加不要なもの

今回の MVP では、注文側に新しい列は不要です。

理由:

- 注文番号はすでに `mobile_orders.order_number` がある
- 店舗名は `vendor_stores.store_name` がある
- POS / モバイルオーダーの区別は `order_source` がある

つまり、Ticket 1 時点では **印刷設定だけ追加** で足ります。

---

## 8. 次チケットへのつながり

### Ticket 2

この schema をもとに、

- settings UI
- settings API

へ進める

### Ticket 3

注文から

- 店舗名
- 注文番号
- 注文日時
- 明細

を整形する receipt payload formatter を作る
