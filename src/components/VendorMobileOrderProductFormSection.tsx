'use client'

import type { ProductForm } from '@/lib/vendor-mobile-order-products'

type VendorMobileOrderProductFormSectionProps = {
  selectedProductId: string | null
  form: ProductForm
  pending: boolean
  uploadingImage: boolean
  onSubmit: (event: React.FormEvent) => void
  onStartCreateMode: () => void
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onFormChange: (updater: (prev: ProductForm) => ProductForm) => void
}

export function VendorMobileOrderProductFormSection({
  selectedProductId,
  form,
  pending,
  uploadingImage,
  onSubmit,
  onStartCreateMode,
  onImageChange,
  onFormChange,
}: VendorMobileOrderProductFormSectionProps) {
  return (
    <div className="soft-panel p-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">{selectedProductId ? '商品を編集' : '商品を追加'}</h2>
        <p className="mt-1 text-sm text-gray-500">
          {selectedProductId ? '公開状態や価格を更新できます。' : '注文ページに表示する商品を新しく登録します。'}
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
          <h3 className="text-base font-semibold text-gray-800">商品画像</h3>
          <div className="mt-4 flex flex-wrap items-start gap-4">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl border border-[var(--line-soft)] bg-[#f8fafc]">
              {form.image_url ? (
                <img src={form.image_url} alt="商品画像" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-gray-400">未設定</span>
              )}
            </div>
            <div className="min-w-[220px] flex-1">
              <input type="file" accept="image/*" onChange={onImageChange} className="block w-full text-sm text-gray-600" />
              <p className="mt-2 text-xs text-gray-500">
                注文画面に使う画像をアップロードできます。保存前にブラウザ側で圧縮します。
              </p>
              <p className="mt-1 text-xs text-gray-500">
                推奨画像サイズ: <span className="font-semibold text-gray-700">1200 × 900px 以上（4:3 横長）</span>
              </p>
              {uploadingImage && <p className="mt-2 text-xs font-medium text-[var(--accent-blue)]">画像を処理しています...</p>}
              {form.image_url && (
                <button
                  type="button"
                  onClick={() => onFormChange((prev) => ({ ...prev, image_url: '' }))}
                  className="mt-3 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600"
                >
                  商品画像を削除
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">商品名</label>
          <input
            value={form.name}
            onChange={(event) => onFormChange((prev) => ({ ...prev, name: event.target.value }))}
            className="w-full px-4 py-3"
            placeholder="例: チキンオーバーライス"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">商品説明</label>
          <textarea
            value={form.description}
            onChange={(event) => onFormChange((prev) => ({ ...prev, description: event.target.value }))}
            className="w-full min-h-[120px] px-4 py-3"
            placeholder="例: スパイスが香る定番メニュー"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">価格</label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.price}
              onChange={(event) => onFormChange((prev) => ({ ...prev, price: event.target.value }))}
              className="w-full px-4 py-3"
              placeholder="例: 900"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">表示順</label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.sort_order}
              onChange={(event) => onFormChange((prev) => ({ ...prev, sort_order: event.target.value }))}
              className="w-full px-4 py-3"
              placeholder="例: 10"
              required
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">カテゴリ</label>
            <select
              value={form.display_category}
              onChange={(event) =>
                onFormChange((prev) => ({
                  ...prev,
                  display_category: event.target.value as ProductForm['display_category'],
                }))
              }
              className="w-full px-4 py-3"
            >
              <option value="main">メイン</option>
              <option value="side">サイド</option>
              <option value="drink">ドリンク</option>
              <option value="other">その他</option>
            </select>
            <p className="mt-2 text-xs text-gray-500">POS画面での商品の探しやすさに使います。</p>
          </div>
          <div className="flex items-end">
            <label className="w-full rounded-2xl border border-[var(--line-soft)] bg-white px-4 py-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_recommended}
                onChange={(event) => onFormChange((prev) => ({ ...prev, is_recommended: event.target.checked }))}
                className="mr-2"
              />
              おすすめ商品として表示する
            </label>
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-800">在庫管理</h3>
              <p className="mt-1 text-sm text-gray-500">
                商品マスタでは在庫管理の有無だけを設定します。実際の在庫数は営業枠ごとに初期在庫と調整履歴で管理します。
              </p>
            </div>
            <label className="rounded-2xl border border-[var(--line-soft)] bg-[#fafafa] px-4 py-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.tracks_inventory}
                onChange={(event) => onFormChange((prev) => ({ ...prev, tracks_inventory: event.target.checked }))}
                className="mr-2"
              />
              この商品は在庫を管理する
            </label>
          </div>

          {form.tracks_inventory && (
            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">残りわずか表示の閾値</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.low_stock_threshold}
                onChange={(event) => onFormChange((prev) => ({ ...prev, low_stock_threshold: event.target.value }))}
                className="w-full px-4 py-3 md:max-w-sm"
                placeholder="例: 3"
              />
              <p className="mt-2 text-xs text-gray-500">
                残数がこの数以下になると注文画面で「残りわずか」と表示します。
              </p>
            </div>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="rounded-2xl border border-[var(--line-soft)] bg-white px-4 py-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(event) => onFormChange((prev) => ({ ...prev, is_published: event.target.checked }))}
              className="mr-2"
            />
            注文ページに公開する
          </label>
          <label className="rounded-2xl border border-[var(--line-soft)] bg-white px-4 py-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.is_sold_out}
              onChange={(event) => onFormChange((prev) => ({ ...prev, is_sold_out: event.target.checked }))}
              className="mr-2"
            />
            売り切れとして表示する
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-[var(--accent-blue)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? '保存中...' : selectedProductId ? '商品を更新' : '商品を追加'}
          </button>
          <button
            type="button"
            onClick={onStartCreateMode}
            className="rounded-full bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700"
          >
            新規作成に切り替える
          </button>
        </div>
      </form>
    </div>
  )
}
