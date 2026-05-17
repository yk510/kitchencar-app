## Analytics API 3層化 計画

### 目的
- analytics API route を
  - request parse / auth
  - loader
  - formatter
  - response
に分ける。

### 方針
1. `vendor-analytics-api`
- scope / start / end の parse
- vendor 権限チェック

2. `vendor-analytics-loaders`
- product / hourly / weekday 用の payload loader

3. route
- helper 呼び出しと `apiOk / apiError` だけに寄せる

### 完了条件
- `products / hourly / weekday` route が同じ形で揃う
- loader は formatter を使って payload を返す
