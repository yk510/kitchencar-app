# 商品設定 API リファクタ計画

## 目的
- `vendor/mobile-order/products` 系 API の責務を整理する
- route を `認証 / 入出力 / HTTP応答` に寄せる
- 商品一覧構築・商品保存・在庫 mutation を helper に切り出す

## 対象
- `/src/app/api/vendor/mobile-order/products/route.ts`
- `/src/app/api/vendor/mobile-order/products/[id]/route.ts`
- `/src/app/api/vendor/mobile-order/products/[id]/inventory/route.ts`
- `/src/app/api/vendor/mobile-order/products/[id]/inventory-adjustments/route.ts`

## 分離方針
### 1. 商品一覧構築
- `vendor_profiles` の店舗名取得
- `ensureVendorStoreResources`
- `products / schedules / inventory / adjustments / ordered quantity` の合成
- `VendorMobileOrderManagedProduct` への整形

### 2. 商品保存
- 商品 payload の正規化
- `display_category / is_recommended` fallback 対応
- 作成 / 更新の insert-update 処理

### 3. 在庫 mutation
- 商品所有権チェック
- 在庫管理有効チェック
- 営業枠整合性チェック
- 初期在庫設定
- 差分調整登録

## 実装単位
### lib
- `src/lib/vendor-mobile-order-products-admin.ts`
  - 一覧構築
  - 商品 create/update
  - 所有権チェック
  - display setting 正規化
- `src/lib/vendor-mobile-order-product-inventory.ts`
  - 初期在庫設定
  - 在庫差分調整

### route
- 認証
- body parse
- helper 呼び出し
- `apiOk / apiError`

## 完了条件
- route から複雑な DB 組み立てを除去
- build が通る
- 既存 UI の挙動は変えない
