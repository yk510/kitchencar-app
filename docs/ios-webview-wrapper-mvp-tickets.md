# iPad WebView ラッパー MVP 実装チケット

最終更新: 2026-05-19

## 前提

- 対象は **iPad 向け WebView ラッパーアプリ**
- 目的は **店頭で Bluetooth レシート印刷つき POS 運用を MVP 検証できる状態**
- クリダス本体は引き続き **Web アプリ**
- まずは **注文管理画面からの再印刷** と **POS 受領後の自動印刷** を優先する

## Ticket 1

**WebView ラッパー MVP の要求仕様を固定する**

やること:
- 対象画面を固定する
  - POS 画面
  - 注文管理画面
- MVP の印刷対象を固定する
  - 再印刷
  - 受領後の自動印刷
- 非対象を明確にする
  - 汎用ブラウザ対応
  - 複数プリンター切替
  - App Store 一般公開

成果物:
- 要求仕様メモ

固定する内容:
- 対象画面は `店頭POS画面` と `注文管理画面`
- 印刷導線は `POS受領後の自動印刷` と `注文管理画面からの再印刷`
- Web 側は Bluetooth を直接扱わず、`iOS ネイティブ bridge` に印刷要求を渡す
- Safari 単体対応、汎用ブラウザ対応、複数プリンター切替は MVP から外す

## Ticket 2

**Web → iOS bridge 契約を固める**

やること:
- `window.webkit.messageHandlers.kuridasPrinter.postMessage` の request 形式を確定
- request に含める項目を固定
  - request id
  - order id
  - plain text
  - structured payload
  - printer hint
  - callback url
- 成功 / 失敗 callback の形を決める

成果物:
- bridge contract

## Ticket 3

**Web 側に iOS native print dispatcher をつなぐ**

やること:
- 既存 `native-print-bridge.ts` を利用する
- 再印刷導線で native bridge を通せるようにする
- LAN 印刷との分岐点を 1 箇所に寄せる

完了条件:
- Web 側から「iOS ネイティブへ印刷要求を渡す」導線ができる

## Ticket 4

**注文管理画面の再印刷を native bridge 対応する**

やること:
- `レシートを再印刷` で
  - LAN 印刷
  - iOS native bridge
  のどちらかを呼べるようにする
- WebView 外で誤って押した時の文言を決める

完了条件:
- WebView ラッパー前提の再印刷導線がつながる

## Ticket 5

**POS の受領後自動印刷を native bridge 対応する**

やること:
- `料金受領を記録` 後の自動印刷分岐を追加
- 印刷失敗時も会計記録を止めない
- POS 画面に必要な fallback 表示を整理

完了条件:
- POS 受領後の自動印刷が WebView ラッパー前提でも呼べる

## Ticket 6

**iOS アプリ側の最小受け口仕様を確定する**

やること:
- `WKWebView` 上で `kuridasPrinter` を受ける設計を整理
- Bluetooth プリンター接続の担当層を決める
- Web への callback 手段を決める
  - postMessage callback
  - URL callback
  - local state callback

成果物:
- iOS 実装仕様メモ

## Ticket 7

**MVP の実機検証シナリオを作る**

やること:
- POS 注文
- 料金受領
- 自動印刷
- 再印刷
- 接続切れ
- スリープ復帰
- 失敗時 fallback

成果物:
- 実機検証チェックリスト

## おすすめ順

1. Ticket 1
2. Ticket 2
3. Ticket 3
4. Ticket 4
5. Ticket 5
6. Ticket 6
7. Ticket 7

## 実機到着前に進められるもの

- Ticket 1
- Ticket 2
- Ticket 3
- Ticket 4 の一部
- Ticket 6 の仕様整理

## 実機が来てから必要なもの

- Bluetooth 接続確認
- 印字速度確認
- スリープ復帰確認
- 接続失敗時の再試行確認
