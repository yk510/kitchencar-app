# iPad WebView ラッパー MVP 実機検証チェックリスト

最終更新: 2026-05-20

## 目的

- iPad 向け WebView ラッパーアプリで、クリダスの **Bluetooth レシート印刷 MVP** が店頭運用に耐えるかを確認する
- **再印刷** と **POS 受領後の自動印刷** を中心に、成功時だけでなく **切断・失敗・復帰** も確認する

## 対象構成

- iPad WebView ラッパーアプリ
- `WKWebView`
- `window.webkit.messageHandlers.kuridasPrinter`
- Bluetooth プリンター: `SII MP-B20`
- クリダス Web アプリ
  - `vendor/mobile-order`
  - `vendor/mobile-order/orders`
  - `store-pos/[token]`

## 事前準備

### 端末・アプリ

- iPad に WebView ラッパーアプリがインストールされている
- WebView ラッパーからクリダスへログインできる
- Guided Access など、店頭運用向けの固定表示設定が必要なら事前に有効化しておく

### プリンター

- `SII MP-B20` の充電が十分ある
- 用紙が正しくセットされている
- iPad と Bluetooth ペアリング済み
- ラッパーアプリ側で MP-B20 を対象プリンターとして認識できる

### クリダス設定

- `vendor/mobile-order` のレシート印刷設定が有効
- プリンター方式が `iPad WebView ラッパー`
- 印刷モードが検証対象に応じて設定済み
  - 再印刷確認: `manual_dashboard_and_reprint`
  - 自動印刷確認: `auto_after_payment`
- POS 画面で注文可能な営業枠・商品・在庫が準備済み

## 期待する印字内容

### ヘッダー

- 注文番号が一番大きく目立つ

### ボディ

- 商品名
- 数量
- オプション / トッピング

### フッター

- 店舗名
- 注文日時

### 再印刷時の追加表示

- `再印刷` の印が入る

## シナリオ 1: 設定画面からの native bridge 疎通確認

目的:
- WebView ラッパーで `kuridasPrinter` が受け口として動いているか確認する

手順:
1. `vendor/mobile-order` を WebView ラッパーで開く
2. レシート印刷設定を `iPad WebView ラッパー` にする
3. ラッパーアプリ側の debug 表示またはログで `receipt_print` request を受けられる状態にする
4. 必要なら `intent=probe` を送る検証導線を使う

確認ポイント:
- `window.webkit.messageHandlers.kuridasPrinter.postMessage(...)` が受け取られる
- native 側で request parse に成功する
- `accepted` または `unsupported` の callback が Web 側へ返る

合格条件:
- request が native 側に届き、callback が Web 側で受け取れる

## シナリオ 2: 注文管理画面からの再印刷

目的:
- 再印刷導線が native bridge 経由で成立するか確認する

手順:
1. 受領済みの注文を 1 件用意する
2. `vendor/mobile-order/orders` を WebView ラッパーで開く
3. 対象注文を選ぶ
4. `レシートを再印刷` を押す

確認ポイント:
- Web 側で native request が dispatch される
- native 側で `accepted` callback が返る
- MP-B20 からレシートが印字される
- 印字に `再印刷` が入る
- 注文番号が最も目立つ
- 注文内容、店舗名、注文日時が含まれる

合格条件:
- 再印刷が 1 回の操作で成功し、印字内容が想定どおり

## シナリオ 3: POS 受領後の自動印刷

目的:
- 店員の `料金受領を記録` 操作後に、自動印刷が native bridge 経由で成立するか確認する

手順:
1. `store-pos/[token]` で POS 注文を 1 件作る
2. `vendor/mobile-order/orders` で対象注文を開く
3. `料金受領を記録` を押す

確認ポイント:
- 会計処理自体は成功する
- `receipt_print.delivery = native_bridge` のレスポンスが返る
- Web 側が native request を dispatch する
- native 側で `accepted` → `printed` callback が返る
- MP-B20 から自動印刷される

合格条件:
- 会計記録と自動印刷が両立し、店員の追加操作なしで印字される

## シナリオ 4: 通常ブラウザでの誤操作 fallback

目的:
- WebView 外で誤って使った時に、無言で失敗せず案内できるか確認する

手順:
1. Safari など通常ブラウザで `vendor/mobile-order/orders` を開く
2. 受領済み注文で `レシートを再印刷` を押す

確認ポイント:
- `iPad の WebView ラッパーアプリ内で実行してください` の案内が出る
- ブラウザ上で中途半端な印刷処理が走らない

合格条件:
- 誤操作時の案内が明確で、運用上混乱しない

## シナリオ 5: プリンター電源 OFF / 切断時

目的:
- Bluetooth 切断や電源 OFF 時に、失敗を検知し案内できるか確認する

手順:
1. MP-B20 の電源を切る、または Bluetooth 切断状態にする
2. 再印刷を試す
3. POS 自動印刷も試す

確認ポイント:
- native 側で `failed` callback が返る
- Web 側に再試行可能な失敗文言が表示される
- POS の `料金受領を記録` は失敗扱いに戻らない

合格条件:
- 印刷失敗時も会計処理は保持され、店員が次の行動を判断できる

## シナリオ 6: 用紙切れ時

目的:
- 印刷は開始されたが完了しないケースへの運用耐性を確認する

手順:
1. 用紙が少ない状態、または用紙なし状態を作る
2. 再印刷または自動印刷を試す

確認ポイント:
- native 側が失敗として返せるか
- 店員が用紙補充後に `レシートを再印刷` で復旧できるか

合格条件:
- 用紙補充後の再試行で回復できる

## シナリオ 7: iPad スリープ復帰後

目的:
- 休止後でも WebView ラッパーと Bluetooth 接続が復帰できるか確認する

手順:
1. WebView ラッパーを開いた状態で iPad をスリープ
2. 数分後に復帰
3. 再印刷を実行
4. 可能なら POS 自動印刷も再確認

確認ポイント:
- Web セッションが維持されている
- `kuridasPrinter` bridge が引き続き動く
- Bluetooth 再接続に成功する、または再接続失敗時の案内が出る

合格条件:
- スリープ復帰後も、少ない操作で印刷運用を再開できる

## シナリオ 8: プリンター再起動後

目的:
- プリンター側だけ再起動しても、復旧可能か確認する

手順:
1. MP-B20 を再起動する
2. iPad 側のペアリング維持を確認する
3. 再印刷を試す

確認ポイント:
- 自動または少ない操作で再接続できる
- 再接続できない場合も、再ペアリング手順が運用可能な範囲か

合格条件:
- プリンター再起動後も、実運用に耐える復旧手順がある

## シナリオ 9: 連続印刷

目的:
- 連続した会計・再印刷に耐えられるか確認する

手順:
1. POS 注文を 3〜5 件続けて作る
2. `料金受領を記録` を順に押す
3. 必要に応じて再印刷も混ぜる

確認ポイント:
- request が取り違えられない
- `request_id` 単位で callback が対応している
- 注文番号の異なるレシートが正しく出る

合格条件:
- 連続会計でも order mismatch が起きない

## ログ記録項目

実機検証時は、最低限次を残す。

- 実施日時
- iPad 端末名 / iPadOS バージョン
- WebView ラッパー build version
- MP-B20 firmware / 接続状態
- 実施シナリオ名
- `request_id`
- `intent`
- callback status
- 印刷成否
- 失敗時メッセージ
- 再現手順

## MVP 合格ライン

以下を満たせば、店頭 MVP 検証に進める。

- 再印刷が WebView ラッパー経由で安定して通る
- POS の `料金受領を記録` 後に自動印刷が通る
- 印刷失敗時も会計処理は止まらない
- 通常ブラウザ誤操作時の案内が分かりやすい
- スリープ復帰またはプリンター再起動後の復旧手順が現場運用可能

## 補足

- 実機初回は、**再印刷シナリオから始める** のがおすすめ
- その後に **POS 自動印刷** を確認すると、切り分けしやすい
- MVP では `SII MP-B20` 1 機種固定でよい
