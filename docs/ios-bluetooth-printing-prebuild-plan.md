# iPad Bluetooth 印刷 事前実装計画

最終更新: 2026-05-19

## 目的

- 実機が届く前に、iPad 向け Bluetooth 印刷の実装土台を進める
- 補助アプリ案 / WebView ラッパー案のどちらでも再利用できる構造にする

## Phase 1: Web 側の bridge 契約を作る

やること:
- Web → ネイティブ印刷要求の envelope 定義
- `window.webkit.messageHandlers` 向け helper
- `custom URL scheme` fallback helper
- payload / plain text / meta 情報を一緒に渡す

完了条件:
- iPad ネイティブ層が受け取る契約が決まる

## Phase 2: 送信元導線を限定してつなぐ

やること:
- まずは注文管理画面の再印刷導線を接続候補にする
- POS の自動印刷は次段
- 既存 LAN 印刷とネイティブ印刷の分岐点を 1 箇所にまとめる

完了条件:
- Web 側は「LAN / ネイティブ」の両方へ送れる構造になる

## Phase 3: 補助アプリ案のプロトコルを確定する

やること:
- Deep Link 名
- 戻り先 URL
- 失敗時 callback
- 再印刷フラグ
- 対象注文 ID

完了条件:
- 補助アプリ PoC に渡せる仕様が決まる

## Phase 4: WebView ラッパー案のプロトコルを確定する

やること:
- `kuridasPrinter.postMessage` の payload 仕様
- 成功 / 失敗 callback 方針
- 認証セッション維持の前提整理

完了条件:
- 将来ラッパー化する時にも Web 側変更を最小化できる

## いま先にやる実装

1. Web 側 native print bridge helper
2. receipt payload から native request を組む helper
3. docs で補助アプリ / WebView ラッパー比較を残す

## この段階でまだやらないこと

- iOS アプリ本体の実装
- App Store / TestFlight 配布作業
- Bluetooth SDK 固有実装
