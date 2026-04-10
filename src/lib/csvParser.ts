// ============================================================
// Airレジ ジャーナル履歴CSV パーサー
// - Shift_JIS → UTF-8 変換
// - 取引Noでグルーピング
// - 合計金額は先頭行のみ使用
// - カスタム割引列を動的に合算
// ============================================================

export interface ParsedTransaction {
  txn_no: string
  txn_date: string        // YYYY-MM-DD
  txn_time: string        // HH:MM:SS
  day_of_week: number     // 0=月 〜 6=日
  hour_of_day: number
  raw_txn_kind: string
  is_return: boolean
  total_amount: number
  tax_amount: number
  discount_total: number
  payment_method: string | null
  items: ParsedItem[]
}

export interface ParsedItem {
  product_name: string
  unit_price: number
  quantity: number
  subtotal: number
}

// Airレジの固定カラム（これ以外の数値列をカスタム割引として扱う）
const FIXED_COLUMNS = new Set([
  '取引No', '元取引No', '取引日', '取引時間', '来店日', '来店時間',
  '店舗番号', '店舗名', '取引種別', 'レジ番号', 'レジ担当者番号', 'レジ担当者名',
  '商品名', 'バリエーション種別1', 'バリエーション種別2', '販売単位',
  '商品単価', '販売分量', '商品数', '商品合計金額',
  '割引・割増', '個別割引・割増金額', '単位', '個別割引・割増数', '個別割引・割増合計金額',
  'まとめ買い割引名', 'まとめ買い割引セット価格', 'まとめ買い割引セット数',
  'まとめ買い割引数', 'まとめ買い割引合計額',
  '小計数', '小計', '外税額',
  'カスタム割引・割増', '端数値引', '割引調整',
  '合計', '内消費税',
  '合計（10%標準）', '内消費税（10%標準）',
  '合計（8%標準）', '内消費税（8%標準）',
  '合計（8%軽減）', '内消費税（8%軽減）',
  '合計（非課税）',
  'クレジットカード(Airペイ タッチ)', 'クレジットカード(Airペイ)',
  'UnionPay 銀聯(Airペイ)', '現金', 'QUICPay(Airペイ)',
  'QR決済(Airペイ QR)', 'QR決済(Airペイ)',
  'クレジットカード(オンライン決済)', 'ポイント(Airペイ ポイント)',
  'クレジットカード/電子マネー(Square)', 'Pontaポイント/リクルートポイント',
  'Apple Pay(Airペイ)', '交通系電子マネー(Airペイ)', 'iD(Airペイ)',
  'ポイント(ホットペッパーグルメ)', 'スマート支払い(ホットペッパーグルメ)',
  'クレジットカード(モバイルオーダー 店外版)',
  'お預り金額', 'おつり金額',
])

// 支払方法カラムの優先順位
const PAYMENT_COLS = [
  'クレジットカード(Airペイ タッチ)',
  'クレジットカード(Airペイ)',
  'QR決済(Airペイ QR)',
  'QR決済(Airペイ)',
  'QUICPay(Airペイ)',
  'Apple Pay(Airペイ)',
  '交通系電子マネー(Airペイ)',
  'iD(Airペイ)',
  '現金',
  'クレジットカード/電子マネー(Square)',
]

// 曜日変換（JSのgetDay()は0=日曜なので変換）
function jsDateDayToAppDay(jsDay: number): number {
  // JS: 0=日,1=月,...,6=土 → App: 0=月,...,6=日
  return jsDay === 0 ? 6 : jsDay - 1
}

// 主な支払方法を判定
function detectPaymentMethod(row: Record<string, string>): string | null {
  for (const col of PAYMENT_COLS) {
    const val = parseInt(row[col] ?? '0', 10)
    if (!isNaN(val) && val > 0) return col
  }
  return null
}

// カスタム割引列の合計を計算
function calcCustomDiscount(row: Record<string, string>, headers: string[]): number {
  let total = 0
  for (const h of headers) {
    if (!FIXED_COLUMNS.has(h)) {
      const val = parseInt(row[h] ?? '0', 10)
      if (!isNaN(val) && val !== 0) total += val
    }
  }
  return total
}

// Shift_JIS ArrayBuffer → UTF-8 string
export async function decodeShiftJis(buffer: ArrayBuffer): Promise<string> {
  const decoder = new TextDecoder('shift-jis')
  return decoder.decode(buffer)
}

// CSV文字列をパース（ヘッダー行あり）
export function parseCsvString(csvText: string): Record<string, string>[] {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return []

  // ヘッダー行
  const headers = lines[0].split(',').map(h => h.trim())

  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = splitCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = (values[idx] ?? '').trim() })
    rows.push(row)
  }
  return rows
}

// CSVの1行をカンマで分割（クォート対応）
function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuote = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { current += '"'; i++ }
      else { inQuote = !inQuote }
    } else if (ch === ',' && !inQuote) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

// メイン：CSV行配列 → ParsedTransaction[]
export function groupTransactions(
  rows: Record<string, string>[]
): { transactions: ParsedTransaction[]; errors: string[] } {
  const errors: string[] = []
  const txnMap = new Map<string, ParsedTransaction>()
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []

  for (const row of rows) {
    const txnNo = row['取引No']?.trim()
    if (!txnNo) { errors.push('取引Noが空の行をスキップしました'); continue }

    const rawKind = row['取引種別']?.trim() ?? ''
    const productName = row['商品名']?.trim()
    if (!productName) { errors.push(`取引No ${txnNo}: 商品名が空のためスキップ`); continue }

    // 日付パース
    const rawDate = row['取引日']?.trim()       // YYYY/MM/DD
    const rawTime = row['取引時間']?.trim()     // HH:MM:SS
    if (!rawDate || !rawTime) {
      errors.push(`取引No ${txnNo}: 日付・時間が不正のためスキップ`)
      continue
    }
    const txnDate = rawDate.replace(/\//g, '-')  // YYYY-MM-DD
    const dateObj = new Date(`${txnDate}T${rawTime}`)
    if (isNaN(dateObj.getTime())) {
      errors.push(`取引No ${txnNo}: 日付パース失敗 (${rawDate} ${rawTime})`)
      continue
    }

    const unitPrice = parseInt(row['商品単価'] ?? '0', 10) || 0
    const quantity  = parseInt(row['商品数'] ?? '1', 10) || 1
    const subtotal  = parseInt(row['商品合計金額'] ?? '0', 10) || 0

    const item: ParsedItem = { product_name: productName, unit_price: unitPrice, quantity, subtotal }

    if (!txnMap.has(txnNo)) {
      // 取引の先頭行 → 合計金額はここから取る
      const totalAmount  = parseInt(row['合計'] ?? '0', 10) || 0
      const taxAmount    = parseInt(row['内消費税'] ?? '0', 10) || 0
      const customDiscount = calcCustomDiscount(row, headers)
      const payment      = detectPaymentMethod(row)
      const isReturn     = rawKind === '返品' || rawKind === '取消'

      txnMap.set(txnNo, {
        txn_no: txnNo,
        txn_date: txnDate,
        txn_time: rawTime,
        day_of_week: jsDateDayToAppDay(dateObj.getDay()),
        hour_of_day: dateObj.getHours(),
        raw_txn_kind: rawKind,
        is_return: isReturn,
        total_amount: totalAmount,
        tax_amount: taxAmount,
        discount_total: customDiscount,
        payment_method: payment,
        items: [item],
      })
    } else {
      // 同一取引の2行目以降 → 商品だけ追加
      txnMap.get(txnNo)!.items.push(item)
    }
  }

  return { transactions: Array.from(txnMap.values()), errors }
}
