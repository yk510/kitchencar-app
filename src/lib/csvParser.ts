// ============================================================
// Airレジ ジャーナル履歴CSV パーサー
// ============================================================

export interface ParsedTransaction {
  txn_no: string
  txn_date: string
  txn_time: string
  day_of_week: number
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

function mergeTransactionItem(items: ParsedItem[], nextItem: ParsedItem) {
  const existingItem = items.find((item) => item.product_name === nextItem.product_name)

  if (!existingItem) {
    items.push(nextItem)
    return
  }

  existingItem.quantity += nextItem.quantity
  existingItem.subtotal += nextItem.subtotal

  // 単価が揺れるケースでは、後続行の値で上書きせず最初の単価を優先する
  // Airレジの同一商品重複行は通常同単価のため、ここでは数量/小計だけ合算する
}

// ====== 支払方法 ======
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
]

function detectPaymentMethod(row: Record<string, string>): string | null {
  for (const col of PAYMENT_COLS) {
    const val = parseInt(row[col] ?? '0', 10)
    if (!isNaN(val) && val > 0) return col
  }
  return null
}

// ====== 曜日変換 ======
function jsDateDayToAppDay(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1
}

// ====== CSVパース ======
export function parseCsvString(csvText: string): Record<string, string>[] {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim())

  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = splitCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').trim()
    })
    rows.push(row)
  }

  return rows
}

function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuote = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]

    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuote = !inQuote
      }
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

// ====== メイン処理 ======
export function groupTransactions(
  rows: Record<string, string>[]
): { transactions: ParsedTransaction[]; errors: string[] } {

  const errors: string[] = []
  const txnMap = new Map<string, ParsedTransaction>()

  for (const row of rows) {
    const txnNo = row['取引No']?.trim()
    if (!txnNo) {
      errors.push('取引Noが空の行をスキップ')
      continue
    }

    const productName = row['商品名']?.trim()
    if (!productName) {
      errors.push(`取引No ${txnNo}: 商品名が空`)
      continue
    }

    const rawDate = row['取引日']?.trim()
    let rawTime = (row['取引時間'] ?? '').trim()

    if (!rawDate || !rawTime) {
      errors.push(`取引No ${txnNo}: 日付・時間が不正`)
      continue
    }

    // ====== 時間フォーマット補正 ======
    if (rawTime.length === 4) rawTime = '0' + rawTime + ':00'
    if (rawTime.length === 5) rawTime = rawTime + ':00'
    if (rawTime.length === 7) rawTime = '0' + rawTime

    const txnDate = rawDate.replace(/\//g, '-')

    // ====== 安全なDate生成 ======
    const [y, m, d] = txnDate.split('-').map(Number)
    const [hh, mm, ss] = rawTime.split(':').map(Number)

    const dateObj = new Date(y, m - 1, d, hh, mm, ss)

    if (isNaN(dateObj.getTime())) {
      errors.push(`取引No ${txnNo}: 日付パース失敗 (${rawDate} ${rawTime})`)
      continue
    }

    const unitPrice = parseInt(row['商品単価'] ?? '0', 10) || 0
    const quantity  = parseInt(row['商品数'] ?? '1', 10) || 1
    const subtotal  = parseInt(row['商品合計金額'] ?? '0', 10) || 0

    const item: ParsedItem = {
      product_name: productName,
      unit_price: unitPrice,
      quantity,
      subtotal,
    }

    if (!txnMap.has(txnNo)) {
      const totalAmount = parseInt(row['合計'] ?? '0', 10) || 0
      const taxAmount   = parseInt(row['内消費税'] ?? '0', 10) || 0

      txnMap.set(txnNo, {
        txn_no: txnNo,
        txn_date: txnDate,
        txn_time: rawTime,
        day_of_week: jsDateDayToAppDay(dateObj.getDay()),
        hour_of_day: dateObj.getHours(),
        raw_txn_kind: row['取引種別'] ?? '',
        is_return: row['取引種別'] === '返品' || row['取引種別'] === '取消',
        total_amount: totalAmount,
        tax_amount: taxAmount,
        discount_total: 0,
        payment_method: detectPaymentMethod(row),
        items: [item],
      })
    } else {
      mergeTransactionItem(txnMap.get(txnNo)!.items, item)
    }
  }

  return {
    transactions: Array.from(txnMap.values()),
    errors,
  }
}
