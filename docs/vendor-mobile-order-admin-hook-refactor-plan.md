## モバイルオーダー管理画面群 共通 Admin Hook 計画

### 目的
- 商品 / オプション / 営業枠 / 設定画面の
  - 初期値受け取り
  - 再取得
  - loading
  - error
を共通 hook に寄せる。

### 対象
- `/vendor/mobile-order`
- `/vendor/mobile-order/products`
- `/vendor/mobile-order/options`
- `/vendor/mobile-order/schedules`

### 完了条件
- 各 page client が `useVendorMobileOrderAdminResource` を使う
- `load()` / `setData()` / `setError()` の書き方が揃う
- 初期 payload がある画面と無い画面の両方を扱える
