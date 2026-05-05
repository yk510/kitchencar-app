import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { parseCsvString, groupTransactions } from '@/lib/csvParser'
import type { CsvUploadResult } from '@/types/database'
import { apiError, apiOk } from '@/lib/api-response'
import type { ParsedTransaction } from '@/lib/csvParser'

const UPSERT_CHUNK_SIZE = 200
const CSV_IMPORT_RPC_NAME = 'import_airregi_csv_payload'

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }

  return chunks
}

type CsvImportRpcResult = {
  inserted: number
  updated: number
  skipped: number
  newProducts: string[]
  errors: string[]
}

async function tryImportViaRpc(
  supabase: any,
  transactions: ParsedTransaction[],
  errors: string[]
): Promise<CsvImportRpcResult | null> {
  const { data, error } = await supabase.rpc(CSV_IMPORT_RPC_NAME, {
    payload: {
      transactions,
      errors,
    },
  })

  if (!error && data) {
    return {
      inserted: Number(data.inserted ?? 0),
      updated: Number(data.updated ?? 0),
      skipped: Number(data.skipped ?? errors.length),
      newProducts: Array.isArray(data.newProducts) ? data.newProducts : [],
      errors: Array.isArray(data.errors) ? data.errors : errors,
    }
  }

  const rpcUnavailable =
    error?.code === 'PGRST202' ||
    error?.message?.includes(CSV_IMPORT_RPC_NAME) ||
    error?.message?.includes('Could not find the function')

  if (rpcUnavailable) {
    return null
  }

  throw error
}

async function importViaChunkedUpserts(
  supabase: any,
  userId: string,
  transactions: ParsedTransaction[],
  errors: string[]
): Promise<CsvUploadResult> {
  const result: CsvUploadResult = {
    inserted: 0,
    updated: 0,
    skipped: errors.length,
    newProducts: [],
    errors: [...errors],
  }

  const txnNos = transactions.map((txn) => txn.txn_no)
  const transactionRows = transactions.map((txn) => ({
    user_id: userId,
    txn_no: txn.txn_no,
    txn_date: txn.txn_date,
    txn_time: txn.txn_time,
    day_of_week: txn.day_of_week,
    hour_of_day: txn.hour_of_day,
    raw_txn_kind: txn.raw_txn_kind,
    is_return: txn.is_return,
    total_amount: txn.total_amount,
    tax_amount: txn.tax_amount,
    discount_total: txn.discount_total,
    payment_method: txn.payment_method,
  }))
  const productRows = transactions.flatMap((txn) =>
    txn.items.map((item) => ({
      user_id: userId,
      txn_no: txn.txn_no,
      txn_date: txn.txn_date,
      product_name: item.product_name,
      unit_price: item.unit_price,
      quantity: item.quantity,
      subtotal: item.subtotal,
    }))
  )
  const parsedProductNames = Array.from(new Set(productRows.map((row) => row.product_name)))

  const [{ data: existingProducts }, { data: existingTxnRows }] = await Promise.all([
    (supabase as any)
      .from('product_master')
      .select('product_name')
      .eq('user_id', userId)
      .in('product_name', parsedProductNames),
    txnNos.length > 0
      ? (supabase as any)
          .from('transactions')
          .select('txn_no')
          .eq('user_id', userId)
          .in('txn_no', txnNos)
      : Promise.resolve({ data: [] }),
  ])

  const existingTxnNos = new Set(((existingTxnRows ?? []) as any[]).map((row: any) => row.txn_no))

  result.inserted = txnNos.filter((txnNo) => !existingTxnNos.has(txnNo)).length
  result.updated = txnNos.length - result.inserted

  const { error: transactionUpsertError } = await Promise.all(
    chunkArray(transactionRows, UPSERT_CHUNK_SIZE).map((rows) =>
      (supabase as any).from('transactions').upsert(rows, { onConflict: 'user_id,txn_no' })
    )
  ).then((responses) => ({
    error: responses.find((response: any) => response.error)?.error ?? null,
  }))

  if (transactionUpsertError) {
    throw new Error(`取引データの保存に失敗しました: ${transactionUpsertError.message}`)
  }

  const { error: productUpsertError } = await Promise.all(
    chunkArray(productRows, UPSERT_CHUNK_SIZE).map((rows) =>
      (supabase as any).from('product_sales').upsert(rows, { onConflict: 'user_id,txn_no,product_name' })
    )
  ).then((responses) => ({
    error: responses.find((response: any) => response.error)?.error ?? null,
  }))

  if (productUpsertError) {
    throw new Error(`商品別売上データの保存に失敗しました: ${productUpsertError.message}`)
  }

  const knownProducts = new Set(((existingProducts ?? []) as any[]).map((p: any) => p.product_name))
  const newProductNames = parsedProductNames.filter((name) => !knownProducts.has(name))

  if (newProductNames.length > 0) {
    const inserts = newProductNames.map((name) => ({
      user_id: userId,
      product_name: name,
    }))

    const { error: pmErr } = await (supabase as any)
      .from('product_master')
      .upsert(inserts, {
        onConflict: 'user_id,product_name',
        ignoreDuplicates: true,
      })

    if (!pmErr) {
      result.newProducts = newProductNames
    } else {
      result.errors.push(`商品マスタ登録: ${pmErr.message}`)
    }
  }

  return result
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response
    const { supabase, user } = auth.session

    const { csvText } = await req.json()
    if (!csvText || typeof csvText !== 'string') {
      return apiError('CSVテキストが空です', 400)
    }

    // 1. CSV をパース
    const rows = parseCsvString(csvText)
    if (rows.length === 0) {
      return apiError('CSVの行が読み取れませんでした', 400)
    }

    const { transactions, errors } = groupTransactions(rows)

    const rpcResult = await tryImportViaRpc(supabase, transactions, errors)
    if (rpcResult) {
      return apiOk(rpcResult)
    }

    const fallbackResult = await importViaChunkedUpserts(supabase, user.id, transactions, errors)
    return apiOk(fallbackResult)
  } catch (e) {
    console.error('[upload-csv]', e)
    return apiError('サーバーエラーが発生しました')
  }
}
