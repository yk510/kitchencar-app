# 公開注文 / POS payload リファクタ計画

## 目的

- 公開注文ページと POS 画面で返す payload の組み立て責務を 1 箇所に寄せる
- `public-mobile-order-data` を「取得」、payload formatter を「整形」に分離する
- page / api route をさらに薄くし、差分は `applyStorePosSettings` などの入力で表現する

## 対象

- `/order/[token]`
- `/store-pos/[token]`
- `/api/public/mobile-order/[token]`
- `/api/public/mobile-order/[token]/inventory`

## 分離方針

### 1. resource loader

- 公開ページ token から
  - store / orderPage
  - schedules
  - products
  - option groups / choices / links
  を読み込む

### 2. payload formatter

- base page payload
- inventory snapshot
- inventory hydrate apply

を formatter 側で組み立てる

### 3. route / page

- token 解決
- 404 / error 変換
- formatter 呼び出し

だけに寄せる

## 完了条件

- `public-mobile-order-data.ts` から payload 組み立てロジックが減っている
- `/order` と `/store-pos` の page がほぼ wrapper 化されている
- 公開 API route の重い shape 組み立てが formatter 経由に揃う
