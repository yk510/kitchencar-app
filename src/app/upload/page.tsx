'use client'

import { useState, useRef } from 'react'

interface UploadResult {
  inserted: number
  updated: number
  skipped: number
  newProducts: string[]
  errors: string[]
}

export default function UploadPage() {
  const [file, setFile]       = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<UploadResult | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const inputRef              = useRef<HTMLInputElement>(null)

  async function handleUpload() {
    if (!file) return
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const buffer = await file.arrayBuffer()

      // Shift_JIS → UTF-8 デコード（ブラウザのTextDecoderを使用）
      const decoder = new TextDecoder('shift-jis')
      const text    = decoder.decode(buffer)

      const res = await fetch('/api/upload-csv', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ csvText: text }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'アップロードに失敗しました')
        return
      }
      setResult(json)
    } catch (e) {
      setError('通信エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">CSVアップロード</h1>
      <p className="text-sm text-gray-500 mb-8">
        Airレジの「ジャーナル履歴」CSVをアップロードしてください。<br />
        既存データがある場合は最新内容で上書きされます。
      </p>

      {/* アップロードエリア */}
      <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-10 text-center mb-6
        hover:border-blue-400 transition cursor-pointer"
        onClick={() => inputRef.current?.click()}>
        <div className="text-4xl mb-3">📁</div>
        {file ? (
          <p className="text-blue-700 font-medium">{file.name}</p>
        ) : (
          <>
            <p className="text-gray-600 font-medium">クリックしてファイルを選択</p>
            <p className="text-gray-400 text-sm mt-1">ジャーナル履歴_YYYYMM.csv（Shift_JIS）</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) { setFile(f); setResult(null); setError(null) }
          }}
        />
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold text-lg
          hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition">
        {loading ? '処理中...' : 'アップロードして取り込む'}
      </button>

      {/* エラー表示 */}
      {error && (
        <div className="mt-6 bg-red-50 border border-red-300 rounded-xl p-4 text-red-700">
          {error}
        </div>
      )}

      {/* 結果表示 */}
      {result && (
        <div className="mt-6 space-y-4">
          <div className="bg-green-50 border border-green-300 rounded-xl p-5">
            <h2 className="font-bold text-green-800 text-lg mb-3">取り込み完了</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-700">{result.inserted}</p>
                <p className="text-sm text-green-600">新規登録</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                <p className="text-sm text-blue-600">更新</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-500">{result.skipped}</p>
                <p className="text-sm text-gray-400">スキップ</p>
              </div>
            </div>
          </div>

          {result.newProducts.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
              <p className="font-semibold text-amber-800 mb-2">
                ⚠ 新規商品 {result.newProducts.length} 件を検出しました
              </p>
              <ul className="text-sm text-amber-700 list-disc list-inside space-y-1">
                {result.newProducts.map(n => <li key={n}>{n}</li>)}
              </ul>
              <a href="/products/master"
                className="inline-block mt-3 text-sm bg-amber-500 text-white rounded-lg px-3 py-1.5 hover:bg-amber-600">
                原価を登録する →
              </a>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="font-semibold text-gray-600 mb-2">スキップされた行（{result.errors.length}件）</p>
              <ul className="text-xs text-gray-500 list-disc list-inside space-y-0.5 max-h-32 overflow-y-auto">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
