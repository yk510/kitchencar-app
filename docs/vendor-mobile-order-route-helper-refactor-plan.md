# vendor mobile-order route helper refactor plan

## 目的

`/api/vendor/mobile-order/*` 配下の route で重複していた

- vendor 権限チェック
- `req.json()` の parse
- `apiOk` / `apiError` の返し分け
- 例外ログ出力

を共通 helper に寄せ、route を配線中心にする。

## 対象

- `products`
- `options`
- `schedules`
- `settings`
- `orders`

## 方針

### 1. route context 取得を共通化

- `requireVendorMobileOrderRouteContext`
- vendor 以外は 403 を返す

### 2. route 実行 wrapper を共通化

- `executeVendorMobileOrderRoute`
- `executeVendorMobileOrderJsonRoute`

これにより route は

- 認証
- success response
- JSON body parse
- error map

を毎回書かずに済むようにする。

### 3. エラー分類を共通化

- `badRequest`
- `notFound`
- `conflict`

の message map を route ごとに渡す。

## 今回の実装範囲

- 共通 helper 追加
- `products/options/schedules/settings/orders` の route を wrapper ベースへ移行

## 次にやるとよいこと

- `api/vendor/*` の他系統 route にも同じ helper パターンを展開
- query param parse helper も追加して、一覧系 route の定型処理をさらに揃える
