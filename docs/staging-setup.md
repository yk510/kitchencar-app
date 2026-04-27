# ステージング環境セットアップ

このリポジトリは `Next.js + Supabase` 構成なので、いちばん早いステージングは `Vercel` に `Preview Deployment` を作る方法です。

## おすすめ構成

- アプリ: `Vercel`
- DB / Auth / Storage: 既存 `Supabase`
- ステージングURL: `https://stg.vnd.kuridasu-os.jp`
- 対象ブランチ: `codex/mobile-order-foundation`

## 先に決めること

1. ベンダー用だけ先に公開するか
2. 主催者画面も同じタイミングでステージング化するか

モバイルオーダー確認を急ぐなら、まずはベンダー用の `stg.vnd.kuridasu-os.jp` だけで十分です。

## Vercel 側でやること

1. GitHub の `yk510/kitchencar-app` を Vercel に接続する
2. Framework は `Next.js` の自動判定で進める
3. Production Branch はいったん既定のままでよい
4. Environment Variables に下記を登録する
5. `codex/mobile-order-foundation` の Preview Deployment を作る
6. ステージング用のカスタムドメイン `stg.vnd.kuridasu-os.jp` を紐づける

## 必須環境変数

`.env.staging.example` をそのままベースにしてください。

最低限必要なのは下記です。

```env
APP_URL=https://stg.vnd.kuridasu-os.jp
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxx
NEXT_PUBLIC_LINE_LIFF_ID=2009899451-BmHFJRYH
LINE_MESSAGING_API_CHANNEL_ACCESS_TOKEN=xxxxxxxx
VENDOR_APP_HOST=stg.vnd.kuridasu-os.jp
ORGANIZER_APP_HOST=stg.org.kuridasu-os.jp
VENDOR_AUTH_COOKIE_NAME=kuridas-vendor-access-token
ORGANIZER_AUTH_COOKIE_NAME=kuridas-organizer-access-token
VENDOR_SUPABASE_STORAGE_KEY=kuridas-vendor-auth
ORGANIZER_SUPABASE_STORAGE_KEY=kuridas-organizer-auth
```

## ドメインの考え方

このアプリはホスト名から `vendor` / `organizer` のスコープを推定します。

- ベンダー: `stg.vnd.kuridasu-os.jp`
- 主催者: `stg.org.kuridasu-os.jp`

今回はモバイルオーダー確認が主目的なので、先に `stg.vnd.kuridasu-os.jp` だけでも問題ありません。

## LINE Developers 側の切り替え

LIFF App の `Endpoint URL` は、ステージング確認時は下記へ変更します。

```text
https://stg.vnd.kuridasu-os.jp/liff/mobile-order
```

LIFF の入口URLは固定で、実際の店舗は `?token=...` で切り分けます。

例:

```text
https://stg.vnd.kuridasu-os.jp/liff/mobile-order?token=xxxxxxxxxxxxxxxx
```

## 確認手順

1. ステージングURLでベンダーログインできる
2. `/vendor/mobile-order` が開く
3. 固定注文URLが `https://stg.vnd.kuridasu-os.jp/order/...` になる
4. LIFF入口URLを LINE で開ける
5. 注文時に `customer_line_user_id` が保存される
6. 注文完了通知 / 完成通知を手動送信できる

## いまの注意点

- この端末には `Vercel CLI` が入っていないため、Vercel 連携そのものはブラウザ側で行う前提です
- `LINE_MESSAGING_API_CHANNEL_ACCESS_TOKEN` は Vercel の Environment Variables に必ず登録してください
- `NEXT_PUBLIC_LINE_LIFF_ID` は client-side で読むため、Preview / Production の両方に設定しておくと安全です

## 次にやると良いこと

1. Vercel にリポジトリ接続
2. Environment Variables 登録
3. `codex/mobile-order-foundation` を Preview Deploy
4. `stg.vnd.kuridasu-os.jp` を割り当て
5. LIFF Endpoint URL を `https://stg.vnd.kuridasu-os.jp/liff/mobile-order` に変更
