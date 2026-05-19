# iPad WebView ラッパー bridge 契約

最終更新: 2026-05-19

## 目的

- WebView 上のクリダスから、iOS ネイティブ印刷層へ **注文レシート印刷要求** を安全に渡す
- MVP では
  - `注文管理画面からの再印刷`
  - `POS 受領後の自動印刷`
  を対象にする

## 送信方向

- Web -> iOS: `window.webkit.messageHandlers.kuridasPrinter.postMessage`
- fallback:
  - `kuridas-printer://print?payload=...`

## Web -> iOS request contract

### kind

- `receipt_print`

### request payload

```ts
{
  kind: 'receipt_print'
  bridge_version: 1
  mode: 'ios_webview_wrapper' | 'ios_helper_app'
  intent: 'auto_print' | 'reprint' | 'probe'
  origin: 'vendor_mobile_order_orders' | 'store_pos' | 'vendor_mobile_order_settings'
  request_id: string
  created_at: string
  payload: ReceiptPrintPayload
  plain_text: string
  printer_hint: {
    vendor: 'sii_mp_b20'
    connection: 'bluetooth'
  }
  callback: {
    event_name: 'kuridas:native-receipt-print'
    callback_url: string | null
  }
}
```

## 必須ルール

- `request_id` は Web 側で一意に採番する
- `payload` には既存 `ReceiptPrintPayload` をそのまま入れる
- `plain_text` は補助表示・暫定印刷・ログ確認用として同梱する
- `intent` で
  - `auto_print`
  - `reprint`
  - `probe`
  を区別する
- `origin` でどの画面起点かを区別する

## iOS -> Web callback contract

### event

- `window.dispatchEvent(new CustomEvent('kuridas:native-receipt-print', { detail }))`

### callback payload

```ts
{
  kind: 'receipt_print_result'
  bridge_version: 1
  request_id: string
  status: 'accepted' | 'printed' | 'failed' | 'unsupported'
  printer_vendor: 'sii_mp_b20'
  printer_connection: 'bluetooth'
  error_code: string | null
  error_message: string | null
  printed_at: string | null
}
```

## status の意味

- `accepted`
  - iOS 側が要求を受け付けた
  - まだ印刷完了ではない
- `printed`
  - 印刷成功
- `failed`
  - 印刷失敗
- `unsupported`
  - 現在の実行環境では bridge を処理できない

## MVP 時点の Web 側期待動作

### 再印刷

- `accepted` で一旦「ネイティブへ送信しました」
- `printed` で成功表示
- `failed` / `unsupported` で失敗表示

### POS 受領後の自動印刷

- `accepted` で内部的に受付
- `failed` でも会計処理は止めない
- 失敗時は店員向けに fallback 文言を出す

## 非対象

- 双方向のリアルタイム接続監視
- 複数プリンター自動切替
- 印刷ジョブキューの永続化
- App Store 公開用の汎用 contract
