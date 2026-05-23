# App Store 審査メモ

## App Review Notes

このアプリはキッチンカー運営者向けの注文POSです。iPadで店頭の注文受付を行います。

お客さまがiPad上の注文POS画面で商品を選び、店員が料金受領を記録すると、iPad nativeアプリがBluetooth接続されたSII MP-B20プリンターへ注文番号レシートを印刷します。お客さまは注文番号レシートを受け取り、商品完成時に番号で呼び出されます。

審査環境にMP-B20プリンターがない場合、印刷自体は確認できません。ただしプリンター未接続時も、注文作成、料金受領記録、注文管理画面の確認は正常に動作します。印刷に失敗した場合はWeb画面上に「プリンターに接続できません」「プリンターの電源とBluetooth接続を確認してください」「必要に応じて再印刷してください」という案内が表示されます。

プリンター設定は店員/管理者向け機能です。注文POS画面はお客さまも触る画面のため、iPad native側ではURLに `store-pos` が含まれる画面でプリンター設定ボタンを非表示にしています。Web本体側の注文POS URLは `/store-pos/{public_token}` です。

## 審査で確認してほしい流れ

1. テストアカウントでログインします。
2. 「注文受付の準備と確認」から「店頭POSを開く」を押します。
3. POS画面で商品を選択し、注文を作成します。
4. 注文管理画面を開き、対象注文の「料金受領を記録」を押します。
5. POS画面で支払完了状態へ進みます。
6. MP-B20プリンターが未接続でも、アプリは破綻せず、印刷失敗時の案内を表示します。

## Test Account

App Store Connect に入力するアカウント:

- Email: `app-review@kuridas.app`
- Password: `AppReview-2026!`
- Role: `vendor`

このローカル環境にはSupabase管理APIキーが無いため、通常signupを試したところメール確認待ちで停止しました。Supabase Dashboardでこのユーザーを確認済みにするか、service role key がある環境で以下を実行して、ユーザー作成、メール確認、店舗データ投入を行います。

```bash
SUPABASE_SERVICE_ROLE_KEY=... npm exec -- node scripts/prepare-app-review-account.mjs
```

投入後、以下が確認できる状態にします。

- 店頭POS画面を開ける
- 注文を作成できる
- 料金受領を記録できる
- 注文管理画面を確認できる
- MP-B20プリンターがない環境でもWeb UIが正常に継続する

## Privacy Policy URL

App Store Connect の Privacy Policy URL:

- `/privacy`

本番ドメイン公開後は、例: `https://{production-domain}/privacy`
