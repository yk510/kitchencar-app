# CSV取込 回帰確認チェックリスト

最終更新: 2026-05-09

## 目的

CSV取込まわりを変更したあとに、以下を毎回短時間で確認できるようにする。

- 取引件数が崩れていない
- 売上合計が崩れていない
- 月別集計が崩れていない
- 商品別集計が崩れていない
- 同一取引内の同一商品名が正しく合算される

## 使い分け

### 1. ローカルで先に見る

まずは軽量テストを実行する。

```bash
npm run test:csv-import
```

このテストでは主に以下を確認する。

- 同一取引内の同一商品名が合算される
- 空CSVが弾かれる
- 返品フラグと支払方法の解釈が崩れていない
- 商品名欠損がエラーとして拾われる

### 2. 実データで最終確認する

本番またはステージングでCSVを取り込んだあと、Supabaseで SQL を実行して照合する。

## 実データ確認手順

### 前提

- 対象ユーザーの `user_id` が分かっている
- 取込対象期間が分かっている
- 期待値となる件数・売上・商品別集計値を手元で持っている

### 1. 取引件数と売上合計

```sql
select
  min(txn_date) as min_date,
  max(txn_date) as max_date,
  count(*) as txn_count,
  sum(total_amount) as sales_total
from public.transactions
where user_id = '<USER_ID>'
  and txn_date between '<FROM_DATE>' and '<TO_DATE>';
```

確認すること:

- `txn_count` が CSV 上のユニーク取引件数と一致する
- `sales_total` が CSV 上の売上合計と一致する

### 2. 月別件数と月別売上

```sql
select
  to_char(txn_date, 'YYYY-MM') as month,
  count(*) as txn_count,
  sum(total_amount) as sales_total
from public.transactions
where user_id = '<USER_ID>'
  and txn_date between '<FROM_DATE>' and '<TO_DATE>'
group by 1
order by 1;
```

確認すること:

- 月別件数が CSV 集計値と一致する
- 月別売上が CSV 集計値と一致する

### 3. 商品別数量と商品別売上

```sql
select
  product_name,
  sum(quantity) as qty,
  sum(subtotal) as sales
from public.product_sales
where user_id = '<USER_ID>'
  and txn_date between '<FROM_DATE>' and '<TO_DATE>'
group by product_name
order by sales desc;
```

確認すること:

- 商品別数量が CSV 集計値と一致する
- 商品別売上が CSV 集計値と一致する
- 特に同一取引内で重複しやすい商品が欠けていない

## 重点確認ケース

### ケースA: 同一取引内の同一商品名が複数行ある

期待結果:

- `product_sales` が後勝ちで上書きされない
- 同一商品名の数量と小計が合算される

### ケースB: 再取り込み

期待結果:

- `transactions` 件数が二重に増えない
- `product_sales` の商品別集計が崩れない
- `updated` と `inserted` の表示が大きく不自然にならない

### ケースC: 不正行を含むCSV

期待結果:

- 全体が即失敗ではなく、想定されたエラー表示になる
- 空商品名や不正日付が `errors` に載る

## 実施メモ欄

- 対象環境:
- 対象ユーザー:
- 対象期間:
- 期待値メモ:
- 実測結果:
- 差分:
- 対応内容:
