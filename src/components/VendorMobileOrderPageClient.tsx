'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { buildReceiptPrintPreviewPayload } from '@/lib/receipt-printing-payload'
import type {
  ReceiptPrintMode,
  ReceiptPrinterProvider,
  StorePosPaymentMethod,
  VendorMobileOrderSchedulesPayload,
  VendorMobileOrderSettingsPayload,
} from '@/types/api-payloads'
import { useVendorMobileOrderAdminResource } from '@/lib/use-vendor-mobile-order-admin-resource'

const STORE_POS_PAYMENT_METHOD_OPTIONS: Array<{
  value: StorePosPaymentMethod
  label: string
  hint: string
}> = [
  { value: 'cash', label: '現金', hint: '現金受領でそのまま会計できます。' },
  { value: 'paypay', label: 'PayPay', hint: 'QR 決済の受領用として表示します。' },
  { value: 'other', label: 'その他', hint: 'その他の受領方法をまとめて扱います。' },
]

const RECEIPT_PRINTER_PROVIDER_OPTIONS: Array<{
  value: ReceiptPrinterProvider
  label: string
  hint: string
}> = [
  {
    value: 'epson_epos',
    label: 'Epson ePOS Print',
    hint: 'LAN 接続の Epson プリンターへ Web から送信する方式です。',
  },
]

const RECEIPT_PRINT_MODE_OPTIONS: Array<{
  value: ReceiptPrintMode
  label: string
  hint: string
}> = [
  {
    value: 'manual_dashboard',
    label: '注文管理画面から手動印刷',
    hint: '店員が注文管理画面で必要な注文だけ印刷します。',
  },
]

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getCurrentSchedule(schedules: VendorMobileOrderSchedulesPayload['schedules']) {
  const now = Date.now()
  return schedules.find((schedule) => {
    if (!['scheduled', 'open'].includes(schedule.status)) return false
    const startsAt = new Date(schedule.opens_at).getTime()
    const endsAt = new Date(schedule.closes_at).getTime()
    return startsAt <= now && now < endsAt
  }) ?? null
}

function getNextSchedule(schedules: VendorMobileOrderSchedulesPayload['schedules']) {
  const now = Date.now()
  return (
    schedules.find((schedule) => new Date(schedule.opens_at).getTime() > now && schedule.status !== 'cancelled') ??
    null
  )
}

export default function VendorMobileOrderPageClient({
  initialData,
}: {
  initialData: VendorMobileOrderSchedulesPayload
}) {
  const { data, setData, loading, error, setError, load } =
    useVendorMobileOrderAdminResource<VendorMobileOrderSchedulesPayload>({
      endpoint: '/api/vendor/mobile-order/schedules',
      initialData,
      errorMessage: 'モバイルオーダー設定の取得に失敗しました',
    })
  const [origin, setOrigin] = useState<string | null>(null)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const [storePosEnabled, setStorePosEnabled] = useState(true)
  const [storePosTerminalName, setStorePosTerminalName] = useState('front-tablet')
  const [storePosPaymentMethods, setStorePosPaymentMethods] = useState<StorePosPaymentMethod[]>(['cash', 'paypay'])
  const [savingStorePosSettings, setSavingStorePosSettings] = useState(false)
  const [storePosSettingsMessage, setStorePosSettingsMessage] = useState<string | null>(null)
  const [receiptPrintEnabled, setReceiptPrintEnabled] = useState(false)
  const [receiptPrinterProvider, setReceiptPrinterProvider] = useState<ReceiptPrinterProvider>('epson_epos')
  const [receiptPrinterEndpoint, setReceiptPrinterEndpoint] = useState('')
  const [receiptPrinterLabel, setReceiptPrinterLabel] = useState('kitchen-printer')
  const [receiptPrintMode, setReceiptPrintMode] = useState<ReceiptPrintMode>('manual_dashboard')
  const [savingReceiptSettings, setSavingReceiptSettings] = useState(false)
  const [receiptSettingsMessage, setReceiptSettingsMessage] = useState<string | null>(null)

  function hydrateStorePosSettings(source: VendorMobileOrderSchedulesPayload | null) {
    setStorePosEnabled(source?.store.is_store_pos_enabled !== false)
    setStorePosTerminalName(source?.store.store_pos_terminal_name?.trim() || 'front-tablet')
    const methods = Array.isArray(source?.store.store_pos_enabled_payment_methods)
      ? (source.store.store_pos_enabled_payment_methods as StorePosPaymentMethod[])
      : (['cash', 'paypay', 'other'] as StorePosPaymentMethod[])
    setStorePosPaymentMethods(methods.length > 0 ? methods : (['cash', 'paypay', 'other'] as StorePosPaymentMethod[]))
  }

  function hydrateReceiptSettings(source: VendorMobileOrderSchedulesPayload | null) {
    setReceiptPrintEnabled(source?.store.is_receipt_print_enabled === true)
    setReceiptPrinterProvider(source?.store.receipt_printer_provider ?? 'epson_epos')
    setReceiptPrinterEndpoint(source?.store.receipt_printer_endpoint?.trim() || '')
    setReceiptPrinterLabel(source?.store.receipt_printer_label?.trim() || 'kitchen-printer')
    setReceiptPrintMode(source?.store.receipt_print_mode ?? 'manual_dashboard')
  }

  useEffect(() => {
    hydrateStorePosSettings(initialData)
    hydrateReceiptSettings(initialData)
  }, [initialData])

  useEffect(() => {
    if (data) hydrateStorePosSettings(data)
    if (data) hydrateReceiptSettings(data)
  }, [data])

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  function toggleStorePosPaymentMethod(method: StorePosPaymentMethod) {
    setStorePosPaymentMethods((current) =>
      current.includes(method) ? current.filter((value) => value !== method) : [...current, method]
    )
  }

  async function handleSaveStorePosSettings() {
    if (storePosPaymentMethods.length === 0) {
      setStorePosSettingsMessage('支払方法を1つ以上選択してください')
      return
    }

    setSavingStorePosSettings(true)
    setStorePosSettingsMessage(null)

    try {
      const response = await fetchApi<VendorMobileOrderSettingsPayload>('/api/vendor/mobile-order/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_store_pos_enabled: storePosEnabled,
          store_pos_terminal_name: storePosTerminalName,
          store_pos_enabled_payment_methods: storePosPaymentMethods,
        }),
      })

      setData((current) =>
        current
          ? {
              ...current,
              store: response.store,
              orderPage: response.orderPage,
            }
          : current
      )
      hydrateStorePosSettings({
        store: response.store,
        orderPage: response.orderPage,
        schedules: data?.schedules ?? [],
        locations: data?.locations ?? [],
      })
      setStorePosSettingsMessage(
        response.persistence === 'notes_fallback'
          ? '設定を保存しました。現行DBではメモ領域に互換保存しています。'
          : '店頭POSの設定を更新しました。'
      )
    } catch (err) {
      setStorePosSettingsMessage(err instanceof ApiClientError ? err.message : '店頭POS設定の保存に失敗しました')
    } finally {
      setSavingStorePosSettings(false)
    }
  }

  async function handleSaveReceiptSettings() {
    if (receiptPrintEnabled && !receiptPrinterEndpoint.trim()) {
      setReceiptSettingsMessage('レシート印刷を有効にする場合は、プリンター接続先を入力してください')
      return
    }

    setSavingReceiptSettings(true)
    setReceiptSettingsMessage(null)

    try {
      const response = await fetchApi<VendorMobileOrderSettingsPayload>('/api/vendor/mobile-order/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_receipt_print_enabled: receiptPrintEnabled,
          receipt_printer_provider: receiptPrinterProvider,
          receipt_printer_endpoint: receiptPrinterEndpoint.trim() || null,
          receipt_printer_label: receiptPrinterLabel.trim() || null,
          receipt_print_mode: receiptPrintMode,
        }),
      })

      setData((current) =>
        current
          ? {
              ...current,
              store: response.store,
              orderPage: response.orderPage,
            }
          : current
      )
      hydrateReceiptSettings({
        store: response.store,
        orderPage: response.orderPage,
        schedules: data?.schedules ?? [],
        locations: data?.locations ?? [],
      })
      setReceiptSettingsMessage(
        response.persistence === 'notes_fallback'
          ? '印刷設定を保存しました。現行DBではメモ領域に互換保存しています。'
          : 'レシート印刷設定を更新しました。'
      )
    } catch (err) {
      setReceiptSettingsMessage(err instanceof ApiClientError ? err.message : '印刷設定の保存に失敗しました')
    } finally {
      setSavingReceiptSettings(false)
    }
  }

  const currentSchedule = useMemo(() => (data ? getCurrentSchedule(data.schedules) : null), [data])
  const nextSchedule = useMemo(() => (data ? getNextSchedule(data.schedules) : null), [data])
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID?.trim() ?? null
  const publicUrl = data ? `/order/${data.orderPage.public_token}` : null
  const storePosUrl = data ? `/store-pos/${data.orderPage.public_token}` : null
  const publicOrderUrl = publicUrl && origin ? new URL(publicUrl, origin).toString() : publicUrl
  const liffOrderUrl = data && liffId
    ? `https://liff.line.me/${liffId}?token=${encodeURIComponent(data.orderPage.public_token)}`
    : null
  const receiptPreview = useMemo(
    () => buildReceiptPrintPreviewPayload(data?.store.store_name ?? '店舗名サンプル'),
    [data?.store.store_name]
  )
  const qrTargetUrl = liffOrderUrl ?? publicOrderUrl
  const qrImageUrl = qrTargetUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=16&data=${encodeURIComponent(qrTargetUrl)}`
    : null

  async function handleCopyUrl() {
    if (!qrTargetUrl) return

    try {
      await navigator.clipboard.writeText(qrTargetUrl)
      setCopyMessage(liffOrderUrl ? 'LINE注文URLをコピーしました' : '固定注文URLをコピーしました')
      window.setTimeout(() => setCopyMessage(null), 2500)
    } catch {
      setCopyMessage('URLのコピーに失敗しました')
      window.setTimeout(() => setCopyMessage(null), 2500)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <div>
          <div className="badge-blue badge-soft inline-block mb-3">モバイルオーダー</div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">注文受付の準備と確認</h1>
              <p className="text-sm text-gray-500">固定QRコードで開く注文ページと、営業時間に応じた受付設定をここから管理します。</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/vendor/mobile-order/orders" className="rounded-full bg-[var(--accent-blue)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm">注文管理を開く</Link>
              <Link href={storePosUrl ?? '#'} className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600" aria-disabled={!storePosUrl}>店頭POSを開く</Link>
              <Link href="/vendor/mobile-order/products" className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[var(--accent-blue)] ring-1 ring-[var(--accent-blue-soft)]">商品設定へ</Link>
            </div>
          </div>
        </div>
        {error && <p className="alert-danger px-4 py-3 text-sm text-red-700">{error}</p>}
        {copyMessage && <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{copyMessage}</p>}
        {storePosSettingsMessage && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">{storePosSettingsMessage}</p>}
        {receiptSettingsMessage && <p className="rounded-2xl bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700">{receiptSettingsMessage}</p>}
        {loading && <div className="soft-panel p-6 text-sm text-gray-500">最新情報を更新中...</div>}
        {data ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <section className="soft-panel p-5"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">店舗</p><h2 className="mt-2 text-lg font-semibold text-gray-800">{data.store.store_name}</h2><p className="mt-2 text-sm text-gray-500">店舗コード: <span className="font-semibold text-gray-700">{data.store.store_code}</span></p></section>
              <section className="soft-panel p-5"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">現在の受付</p><p className={`mt-2 text-lg font-semibold ${currentSchedule ? 'text-emerald-700' : 'text-amber-700'}`}>{currentSchedule ? '受付中' : '受付時間外'}</p><p className="mt-2 text-sm text-gray-500">{currentSchedule ? `${formatDateTime(currentSchedule.opens_at)} - ${formatDateTime(currentSchedule.closes_at)}` : '現在有効な営業枠はありません'}</p></section>
              <section className="soft-panel p-5"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">次回営業枠</p><p className="mt-2 text-lg font-semibold text-gray-800">{nextSchedule ? formatDateTime(nextSchedule.opens_at) : '未設定'}</p><p className="mt-2 text-sm text-gray-500">{nextSchedule ? `終了 ${formatDateTime(nextSchedule.closes_at)}` : '営業スケジュールを追加してください'}</p></section>
              <section className="soft-panel p-5"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">{liffOrderUrl ? 'LINE注文URL' : '固定注文URL'}</p><p className="mt-2 text-sm font-medium text-gray-700 break-all">{publicOrderUrl ?? '-'}</p><p className="mt-2 text-xs text-gray-500">{liffOrderUrl ? 'QRコードはLINE入口URLで生成しています。下のWeb注文URLはブラウザ直接確認用です。' : 'このURLをもとに店頭QRコードを発行します。'}</p></section>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
              <section className="soft-panel p-6">
                <div className="flex items-center justify-between gap-3">
                  <div><h2 className="text-lg font-semibold text-gray-800">営業スケジュール</h2><p className="mt-1 text-sm text-gray-500">営業日と受付時間を設定して、固定QRからの注文受付を制御します。</p></div>
                  <Link href="/vendor/mobile-order/schedules" className="rounded-full bg-[var(--accent-blue)] px-4 py-2 text-sm font-semibold text-white shadow-sm">管理画面を開く</Link>
                </div>
                <div className="mt-4 rounded-[28px] border border-dashed border-[var(--line-soft)] bg-white px-5 py-5">
                  {data.schedules.length === 0 ? <p className="text-sm text-gray-500">まだ営業枠がありません。まずは営業スケジュールを追加してください。</p> : <div className="space-y-3">{data.schedules.slice(0, 4).map((schedule) => (<div key={schedule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line-soft)] px-4 py-3"><div><p className="text-sm font-semibold text-gray-800">{formatDateTime(schedule.opens_at)} - {formatDateTime(schedule.closes_at)}</p><p className="mt-1 text-xs text-gray-500">{schedule.business_date} / {schedule.location_id ? data.locations.find((location) => location.id === schedule.location_id)?.name ?? '出店場所未設定' : '出店場所未設定'}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{schedule.status}</span></div>))}</div>}
                </div>
              </section>
              <section className="soft-panel p-6">
                <div className="flex items-center justify-between gap-3">
                  <div><h2 className="text-lg font-semibold text-gray-800">店頭掲示用QRコード</h2><p className="mt-1 text-sm text-gray-500">このQRコードを画像保存すると、LINE入口URL付きでPOP制作に使えます。</p></div>
                  <button type="button" onClick={() => void handleCopyUrl()} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">URLをコピー</button>
                </div>
                <div className="mt-5 flex justify-center">{qrImageUrl ? <div className="rounded-[32px] bg-white p-4 shadow-sm ring-1 ring-[var(--line-soft)]"><img src={qrImageUrl} alt="注文ページQRコード" className="h-64 w-64 rounded-2xl object-contain" /></div> : <div className="rounded-[28px] border border-dashed border-[var(--line-soft)] bg-white px-6 py-14 text-sm text-gray-500">QRコードを生成できませんでした</div>}</div>
              </section>
            </div>
            <section className="soft-panel p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">店頭POSの支払方法設定</h2>
                  <p className="mt-1 text-sm text-gray-500">タブレット注文画面でお客様に見せる支払方法をここで管理します。</p>
                </div>
                <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">POS画面と連動</div>
              </div>
              <div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-[28px] border border-[var(--line-soft)] bg-white px-5 py-5">
                  <label className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">店頭POSを有効にする</p>
                      <p className="mt-1 text-sm text-gray-500">無効にすると、タブレット注文画面からの新規注文を止めます。</p>
                    </div>
                    <input type="checkbox" className="mt-1 h-5 w-5 rounded border-[var(--line-soft)] text-[var(--accent-blue)]" checked={storePosEnabled} onChange={(event) => setStorePosEnabled(event.target.checked)} />
                  </label>
                  <div className="mt-5">
                    <label className="text-sm font-semibold text-gray-700">端末ラベル</label>
                    <input type="text" value={storePosTerminalName} onChange={(event) => setStorePosTerminalName(event.target.value)} placeholder="front-tablet" className="mt-2 w-full rounded-2xl border border-[var(--line-soft)] bg-[#fbfdff] px-4 py-3 text-sm text-gray-700 shadow-inner outline-none focus:border-[var(--accent-blue)]" />
                    <p className="mt-2 text-xs text-gray-500">注文の発生元メモとして使う端末名です。</p>
                  </div>
                </div>
                <div className="rounded-[28px] border border-[var(--line-soft)] bg-white px-5 py-5">
                  <p className="text-sm font-semibold text-gray-800">お客様に見せる支払方法</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {STORE_POS_PAYMENT_METHOD_OPTIONS.map((option) => {
                      const checked = storePosPaymentMethods.includes(option.value)
                      return (
                        <label key={option.value} className={`rounded-[24px] border px-4 py-4 transition ${checked ? 'border-[var(--accent-blue)] bg-[var(--accent-blue-soft)]' : 'border-[var(--line-soft)] bg-[#fbfdff]'}`}>
                          <div className="flex items-start gap-3">
                            <input type="checkbox" className="mt-1 h-4 w-4 rounded border-[var(--line-soft)] text-[var(--accent-blue)]" checked={checked} onChange={() => toggleStorePosPaymentMethod(option.value)} />
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{option.label}</p>
                              <p className="mt-1 text-xs leading-5 text-gray-500">{option.hint}</p>
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-gray-500">POS画面では、ここで選んだ支払方法だけを表示します。</p>
                    <button type="button" onClick={() => void handleSaveStorePosSettings()} disabled={savingStorePosSettings} className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-50">
                      {savingStorePosSettings ? '保存中...' : 'POS設定を保存'}
                    </button>
                  </div>
                </div>
              </div>
            </section>
            <section className="soft-panel p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">レシート印刷設定</h2>
                  <p className="mt-1 text-sm text-gray-500">注文管理画面からレシート印刷を使うための、最小設定をここで管理します。</p>
                </div>
                <div className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">店舗名・注文番号・注文日時を印字</div>
              </div>
              <div className="mt-5 grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
                <div className="rounded-[28px] border border-[var(--line-soft)] bg-white px-5 py-5">
                  <label className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">レシート印刷を有効にする</p>
                      <p className="mt-1 text-sm text-gray-500">注文管理画面から店舗名・注文番号・注文日時のレシートを印刷できます。</p>
                    </div>
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 rounded border-[var(--line-soft)] text-[var(--accent-blue)]"
                      checked={receiptPrintEnabled}
                      onChange={(event) => setReceiptPrintEnabled(event.target.checked)}
                    />
                  </label>
                  <div className="mt-5">
                    <label className="text-sm font-semibold text-gray-700">プリンター表示名</label>
                    <input
                      type="text"
                      value={receiptPrinterLabel}
                      onChange={(event) => setReceiptPrinterLabel(event.target.value)}
                      placeholder="kitchen-printer"
                      className="mt-2 w-full rounded-2xl border border-[var(--line-soft)] bg-[#fbfdff] px-4 py-3 text-sm text-gray-700 shadow-inner outline-none focus:border-[var(--accent-blue)]"
                    />
                    <p className="mt-2 text-xs text-gray-500">店員が管理画面で認識しやすいプリンター名です。</p>
                  </div>
                </div>
                <div className="rounded-[28px] border border-[var(--line-soft)] bg-white px-5 py-5">
                  <div className="grid gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700">プリンター方式</label>
                      <select
                        value={receiptPrinterProvider}
                        onChange={(event) => setReceiptPrinterProvider(event.target.value as ReceiptPrinterProvider)}
                        className="mt-2 w-full rounded-2xl border border-[var(--line-soft)] bg-[#fbfdff] px-4 py-3 text-sm text-gray-700 shadow-inner outline-none focus:border-[var(--accent-blue)]"
                      >
                        {RECEIPT_PRINTER_PROVIDER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs text-gray-500">
                        {RECEIPT_PRINTER_PROVIDER_OPTIONS.find((option) => option.value === receiptPrinterProvider)?.hint}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700">プリンター接続先</label>
                      <input
                        type="text"
                        value={receiptPrinterEndpoint}
                        onChange={(event) => setReceiptPrinterEndpoint(event.target.value)}
                        placeholder="http://192.168.0.80/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000"
                        className="mt-2 w-full rounded-2xl border border-[var(--line-soft)] bg-[#fbfdff] px-4 py-3 text-sm text-gray-700 shadow-inner outline-none focus:border-[var(--accent-blue)]"
                      />
                      <p className="mt-2 text-xs text-gray-500">LAN 上の Epson プリンターに送る URL または接続先です。</p>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700">印刷モード</label>
                      <select
                        value={receiptPrintMode}
                        onChange={(event) => setReceiptPrintMode(event.target.value as ReceiptPrintMode)}
                        className="mt-2 w-full rounded-2xl border border-[var(--line-soft)] bg-[#fbfdff] px-4 py-3 text-sm text-gray-700 shadow-inner outline-none focus:border-[var(--accent-blue)]"
                      >
                        {RECEIPT_PRINT_MODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs text-gray-500">
                        {RECEIPT_PRINT_MODE_OPTIONS.find((option) => option.value === receiptPrintMode)?.hint}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-gray-500">まずは注文管理画面からの手動印刷だけを対象にします。</p>
                    <button
                      type="button"
                      onClick={() => void handleSaveReceiptSettings()}
                      disabled={savingReceiptSettings}
                      className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50"
                    >
                      {savingReceiptSettings ? '保存中...' : '印刷設定を保存'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-5 rounded-[28px] border border-[var(--line-soft)] bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">印字イメージ</p>
                    <p className="mt-1 text-xs text-gray-500">注文番号を主表示にして、注文内容を補足、店舗名と注文日時をフッターに置く想定です。</p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">プレビュー</div>
                </div>
                <div className="mt-4 flex justify-center">
                  <div className="w-full max-w-[420px] rounded-[28px] border border-dashed border-slate-300 bg-[#fffdf8] px-6 py-6 shadow-inner">
                    <div className="border-b border-dashed border-slate-300 pb-4 text-center">
                      <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-500">{receiptPreview.header.label}</p>
                      <p className="mt-2 text-4xl font-black tracking-[0.08em] text-slate-900">{receiptPreview.header.value}</p>
                    </div>
                    <div className="border-b border-dashed border-slate-300 py-4">
                      <p className="text-xs font-semibold tracking-[0.14em] text-slate-500">{receiptPreview.body.label}</p>
                      <div className="mt-3 space-y-3">
                        {receiptPreview.body.items.map((item) => (
                          <div key={item.order_item_id} className="space-y-1">
                            <div className="flex items-start justify-between gap-4 text-sm font-semibold text-slate-800">
                              <span>{item.product_name}</span>
                              <span>×{item.quantity}</span>
                            </div>
                            {item.options.length > 0 && (
                              <div className="space-y-1 pl-3 text-xs text-slate-500">
                                {item.options.map((option, index) => (
                                  <p key={`${item.order_item_id}-${index}`}>
                                    {option.option_group_name}: {option.option_choice_name}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="pt-4 text-center text-xs text-slate-500">
                      <p>{receiptPreview.footer.store_name}</p>
                      <p className="mt-1">{receiptPreview.footer.ordered_at_label}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}
