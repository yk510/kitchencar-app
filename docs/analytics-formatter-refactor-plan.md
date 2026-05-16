# Analytics formatter 統一計画

## 目的

- analytics route ごとに散っている response shape 組み立てを共通化する
- 日別売上クライアント側の summary / chart / CSV 向け整形も formatter に寄せる
- 集計 helper は「集計」、formatter は「返却・表示用整形」に責務を分ける

## 対象

- `/api/analytics/products`
- `/api/analytics/hourly`
- `/api/analytics/weekday`
- `/analytics/daily` クライアント整形

## 分離方針

### 1. API payload formatter

- 商品別
- 時間帯別
- 曜日別

の route で返す shape を formatter で統一する。

### 2. 日別売上 UI formatter

- summary card 用集計
- trend chart 用 shape
- CSV 出力時の列値解決

を formatter に切り出す。

## 完了条件

- route 内の `map` や shape 組み立てが薄くなる
- `DailySalesAnalyticsClient` の summary / chart / CSV switch が減る
- build が通る
