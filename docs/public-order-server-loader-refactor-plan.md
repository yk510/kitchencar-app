## 公開注文 / POS Server Loader リファクタ計画

### 目的
- 公開注文と POS の server 側で混ざっている
  - リソース取得
  - 営業枠判定
  - 在庫 hydration
  - POS 設定適用
を役割ごとに分離する。

### 分離方針
1. `public-mobile-order-resource-loader`
- 注文ページ、店舗、営業枠、商品、オプション、リンクの取得

2. `public-mobile-order-inventory-loader`
- 営業中の営業枠に対する ordered quantity / inventory / adjustments の取得

3. `public-mobile-order-data`
- base payload / inventory snapshot / hydrated payload の orchestration

### 完了条件
- route / page 側が loader の組み合わせを呼ぶだけになる
- POS 設定適用の有無が options で切り替えられる
- inventory 系の取得が base payload loader から独立している
