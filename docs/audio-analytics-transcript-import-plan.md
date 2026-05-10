# 音声Analytics 文字起こしインポート実装計画

最終更新: 2026-05-10

## 1. 目的

音声Analytics では、将来的に

- 外部の文字起こしツールで作った JSON
- テスト用のサンプル transcript
- 録音クライアント以外の経路で生成した transcript

を取り込めるようにしたい。

今回の実装では、**検証用途の JSON 取込を最初の入口** として作りつつ、将来の正式 import 機能へつながる構造にする。

## 2. 方針

1. transcript / order event 保存ロジックを共通 helper に切り出す
2. import 専用の JSON payload 型を追加する
3. `POST /api/audio/import-transcripts` を追加する
4. Vendor UI に検証用の JSON インポート入口を追加する

## 3. import 対象の責務

importer は次をまとめて扱う。

- audio session の作成
- audio chunk の作成
- audio transcript の保存
- 商品 / 数量抽出
- audio order event の保存

## 4. 入力フォーマット

canonical な import payload は以下を基本とする。

```json
{
  "source_label": "soupcurry-sample",
  "session": {
    "device_label": "sample import",
    "microphone_label": "manual transcript",
    "notes": "2hours sample",
    "started_at": "2026-05-10T11:00:00+09:00",
    "ended_at": "2026-05-10T13:00:00+09:00",
    "status": "completed"
  },
  "chunks": [
    {
      "chunk_label": "11時台",
      "started_at": "2026-05-10T11:00:00+09:00",
      "ended_at": "2026-05-10T12:00:00+09:00",
      "duration_sec": 3600,
      "transcripts": [
        {
          "spoken_at": "2026-05-10T11:02:00+09:00",
          "speaker_type": "staff",
          "confidence": 0.98,
          "transcript_text": "牛すじカレー1つお願いします"
        }
      ]
    }
  ]
}
```

## 5. 互換入力

既存の `audio-analytics-sample-soupcurry-2hours.json` をそのまま使えるように、

- `chunk_payload_templates`

形式も importer 側で受けられるようにする。

## 6. 完了条件

- sample JSON を画面から選んで取り込める
- session / chunk / transcript / order event が一連で保存される
- 取り込み後に `/audio-analytics` と `/audio-analytics/transcripts` で確認できる
- transcript 抽出ロジックは既存 API と同じ helper を使う
