# リファクタ実装計画

最終更新: 2026-05-06

## 目的

今回のリファクタは、以下の2つを主目的として進める。

1. 認証まわりの不安定さを減らし、ログイン後すぐ触れる状態を作る
2. CSV取り込みまわりの保守性と拡張性を上げる

すでに着手済みの内容:

- CSV取り込みの一括 upsert 化
- CSV取り込みの RPC 優先化
- ログイン直後の待ち時間短縮
- 確認コード完了後の待ち時間短縮

このドキュメントでは、その次に進める実装を `第1フェーズ / 第2フェーズ / 第3フェーズ` に分けて整理する。

---

## 第1フェーズ

### テーマ

認証セッション処理の一本化

### 狙い

- ログイン、確認コード、LIFF、既存セッション復元で分散している認証確立処理を共通化する
- `ログインできているはずなのに LP に飛ぶ / ログインが必要です と出る` の再発を防ぐ
- ログイン後の体感速度をさらに安定させる

### 実装単位

#### 1-1. セッション確立処理の共通ユーティリティ化

対象:

- `/Users/yukikuchi/Documents/1.KX/仲町CS/kitchencar-app/src/app/api/auth/session-cookie/route.ts`
- `/Users/yukikuchi/Documents/1.KX/仲町CS/kitchencar-app/src/app/login/page.tsx`
- `/Users/yukikuchi/Documents/1.KX/仲町CS/kitchencar-app/src/components/RoleSignupPage.tsx`
- `/Users/yukikuchi/Documents/1.KX/仲町CS/kitchencar-app/src/components/EmailConfirmedContent.tsx`

やること:

- `session確立 -> server-readable cookie同期 -> role確定` を1本の共通処理に寄せる
- ログイン成功時と確認コード完了時で別々に持っている同期ロジックを減らす
- LIFF 側でも共通処理を利用できるように設計する

完了条件:

- ログイン系の cookie 同期ロジックが複数箇所に重複していない
- 認証確立後の遷移条件が統一されている

#### 1-2. AuthProvider の責務縮小

対象:

- `/Users/yukikuchi/Documents/1.KX/仲町CS/kitchencar-app/src/components/AuthProvider.tsx`

やること:

- `AuthProvider` は `session / role / profileReady` を供給する責務に絞る
- `redirect` や `host 不一致時の画面遷移判断` を持たせすぎない
- `onAuthStateChange` の分岐を整理して、必要なイベントだけ再同期する

完了条件:

- `AuthProvider` が画面遷移判断の中心になっていない
- 認証イベントのたびに不要な `router.refresh()` が走らない

#### 1-3. AppShell の route guard 専任化

対象:

- `/Users/yukikuchi/Documents/1.KX/仲町CS/kitchencar-app/src/components/AppShell.tsx`

やること:

- `AppShell` は `現在の route が許可されているか` の判定に集中させる
- `ログイン後の遷移制御` と `初回認証確立待ち` を切り分ける
- `/lp` に来てしまった認証済みユーザーの扱いも整理する

完了条件:

- `AppShell` 内の role/host/redirect 分岐が読みやすく整理されている
- ログイン後の画面ぱちぱちや二重遷移が起きにくい

### 第1フェーズ完了後に確認すること

- vendor ログイン後にダッシュボードが安定して出る
- organizer ログイン後にログイン画面へ戻されない
- `原価登録`, `分析`, `モバイルオーダー`, `募集一覧` などで 401 が再発しない

---

## 第2フェーズ

### テーマ

role / host 判定ルールの共通化と軽量 profile 化

### 狙い

- `vendor / organizer / public` の判定ルールを1か所に寄せる
- 初回表示で重い profile 取得を必須にしない
- 認証まわりの可読性を上げる

### 実装単位

#### 2-1. role / host 判定ルールの共通定義

対象:

- `/Users/yukikuchi/Documents/1.KX/仲町CS/kitchencar-app/src/lib/domain.ts`
- 認証・ガード関連の各 component / page

やること:

- `vendor host`
- `organizer host`
- `public host`
- `各 role が入ってよい route`

を1か所の定義に集約する

完了条件:

- host 判定ロジックが複数ファイルに散っていない
- route 許可ルールを一覧で追える

#### 2-2. profile API の軽量化

対象:

- `/Users/yukikuchi/Documents/1.KX/仲町CS/kitchencar-app/src/app/api/user/profile/route.ts`
- `/Users/yukikuchi/Documents/1.KX/仲町CS/kitchencar-app/src/components/AuthProvider.tsx`

やること:

- 初回表示で必要な最小情報だけ返す軽量レスポンスを設計する
- 重いプロフィール詳細は後追い取得に分ける
- `role が分かれば先に描画` の方針を API 側でも明確にする

完了条件:

- 初回表示に不要な情報を `/api/user/profile` でまとめて読んでいない
- `role 判定` と `プロフィール詳細表示` の責務が分かれている

#### 2-3. metadata に入れてよい情報の境界整理

対象:

- signup / onboarding / auth 関連実装

やること:

- `auth.users.raw_user_meta_data` に巨大なデータを入れないルールを明文化する
- `logo_image_url` のような大きい値は auth metadata に載せない
- 必要なら保存先を public テーブルや storage に寄せる

完了条件:

- セッショントークン肥大化の再発条件が潰れている
- auth metadata の役割が軽量な識別情報に限定されている

### 第2フェーズ完了後に確認すること

- シークレットウィンドウで vendor / organizer とも初回表示が早い
- host をまたぐ時に role の誤判定が起きにくい
- 新規登録後の確認コード導線で metadata 起因の問題が起きない

---

## 第3フェーズ

### テーマ

CSV取り込みロジックの責務分離

### 狙い

- 取り込み処理を読みやすくし、今後の POS 追加やルール変更に強くする
- API route の肥大化を防ぐ
- テストしやすい構成にする

### 実装単位

#### 3-1. parse / normalize / aggregate / persist の分離

対象:

- `/Users/yukikuchi/Documents/1.KX/仲町CS/kitchencar-app/src/app/api/upload-csv/route.ts`
- `/Users/yukikuchi/Documents/1.KX/仲町CS/kitchencar-app/src/lib/csvParser.ts`

やること:

- CSV parse
- 行の正規化
- 同一取引 / 同一商品の集約
- DB永続化
- レスポンス整形

を別レイヤーに切り分ける

完了条件:

- route.ts に業務ロジックが詰まりすぎていない
- `どこで何を集計しているか` が追いやすい

#### 3-2. RPC 呼び出しレイヤーの明示化

対象:

- upload-csv の import service
- `/Users/yukikuchi/Documents/1.KX/仲町CS/kitchencar-app/sql/csv-import-rpc.sql`

やること:

- RPC を使う経路と fallback 経路を明確に分離する
- `RPC available / unavailable` で分岐する箇所を service 化する
- DB 側に寄せた責務をドキュメント化する

完了条件:

- route 側で RPC の存在判定と business logic が混ざっていない
- SQL 側の役割と app 側の役割が整理されている

#### 3-3. 取込結果の表現統一

対象:

- upload UI
- upload API response
- acceptance test docs

やること:

- `inserted / updated / skipped / errors / warnings` の意味を統一する
- UI の表示文言と API の集計ルールを合わせる
- 再取り込み時の表示も一貫させる

完了条件:

- 「何件取り込まれたか」の意味が画面と API でズレない
- 受け入れテストにそのまま使える形になっている

### 第3フェーズ完了後に確認すること

- 同一取引内の同一商品があっても `product_sales` がずれない
- CSV取り込み route の責務が明確で追いやすい
- 取込結果の表示が運用上の説明に耐える

---

## 今回の進め方

今回のリファクタは、このドキュメントを前提に進める。

実施順:

1. 第1フェーズ
2. 第2フェーズ
3. 第3フェーズ

基本方針:

- まずは認証の複雑さを減らす
- 次に判定ルールと profile 取得を軽くする
- 最後に CSV 取り込みの責務分離を進める

各フェーズでは:

- 実装
- `npm run build`
- ステージング / 本番での実機確認

までを1セットとする。

---

## 今回やらないこと

今回のリファクタ範囲には、以下は含めない。

- デザイン調整中心の変更
- 細かいコンポーネント命名の美化
- 新しい state 管理ライブラリ導入
- CSVジョブ化のような大きな非同期基盤追加

これらは必要になった時点で別タスクとして切り出す。
