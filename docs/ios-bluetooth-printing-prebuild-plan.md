# iPad Bluetooth 印刷 事前実装計画

最終更新: 2026-05-19

## 目的

- 実機が届く前に、iPad 向け Bluetooth 印刷の実装土台を進める
- **WebView ラッパー案で MVP 店頭検証** へ進めるための事前実装を進める
- 補助アプリ案にも fallback できる構造を維持する

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

## Phase 3: 注文管理画面の再印刷を bridge 接続する

やること:
- 再印刷導線で native bridge を呼べるようにする
- LAN 印刷との分岐点を整理する
- WebView 外での fallback 表示を決める

完了条件:
- Web 側の再印刷導線が native bridge に接続できる

## Phase 4: POS 自動印刷を bridge 接続する

やること:
- `料金受領を記録` 後の自動印刷を native bridge へ流せる形にする
- 失敗時 fallback を既存 UI と揃える
- 会計処理を止めない保証を維持する

完了条件:
- POS 自動印刷が native bridge 前提でも配線できる

## Phase 5: iOS ラッパー実装仕様を確定する

やること:
- `WKWebView` での `messageHandlers` 実装方針を決める
- Bluetooth 印刷担当クラスの責務を決める
- callback とエラー返却の流れを整理する

完了条件:
- iOS 実装着手に必要な仕様が揃う

## いま先にやる実装

1. Web 側 native print bridge helper
2. receipt payload から native request を組む helper
3. 再印刷導線の native bridge 接続
4. WebView ラッパー MVP チケット化

## この段階でまだやらないこと

- iOS アプリ本体の Bluetooth 実装
- App Store / TestFlight 配布作業
- Bluetooth SDK 固有実装
