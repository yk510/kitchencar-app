# Android + Bluetooth プリンター MVP 検証 Week 1 チケット

最終更新: 2026-05-19

## Ticket 1

**検証対象端末とプリンターを固定する**

やること:
- Android タブレット候補を 1〜2 台に絞る
- Bluetooth プリンター候補を 1 機種に固定する
- 検証環境を定義する

成果物:
- 端末候補メモ
- 対象プリンター決定

決定:
- Android タブレット: `Redmi Pad SE（Wi-Fi）`
- Bluetooth プリンター: `SII MP-B20`
- ブラウザ: `Android Chrome`
- 印字幅: `58mm`

## Ticket 2

**Bluetooth 方式の技術 PoC を決める**

やること:
- Web Bluetooth を先に試すか
- 補助アプリ方式へ進むか
- 判断基準を決める

成果物:
- 技術方針メモ

方針:
- 先に `Android Chrome + Web Bluetooth` を試す
- `MP-B20` が見えるか、GATT 接続まで進めるかを確認する
- ここで不安定なら、同じ端末・同じプリンターのまま補助アプリ方式へ進む

## Ticket 3

**既存 ReceiptPrintPayload の Bluetooth 再利用案を整理する**

やること:
- LAN 印刷の payload をそのまま使える形にする
- 送信層だけ差し替える設計を固める

成果物:
- payload 共通方針

結論:
- `ReceiptPrintPayload` は Epson / Bluetooth で共通利用する
- 差し替えるのは送信層ではなく、正確には **renderer + transport**
- 共通の印字ドキュメント表現を 1 段挟み、Epson は XML、Bluetooth は将来の送信形式へ変換する

## Ticket 4

**Bluetooth 送信層の最小実装**

やること:
- Web Bluetooth または補助アプリ連携の最小実装
- テスト印刷

完了条件:
- 1 回印字できる

最小実装:
- 共通 payload から ESC/POS 風 byte 列を作る helper
- BLE writable characteristic へ chunk 送信する generic transport
- `MP-B20` 固有 UUID の固定は、PoC 結果を見て次段で判断

## Ticket 5

**受領後の印刷導線に接続**

やること:
- `料金受領を記録` 後に自動印刷
- `再印刷`
- エラー表示

完了条件:
- 注文管理から運用できる

## Ticket 6

**現場評価**

やること:
- 接続安定性
- スリープ復帰
- 再接続
- 印字速度
- 店員オペレーション

完了条件:
- 継続判断できる
