import { chunkArray } from '@/lib/csv-import/chunk'
import { createCsvUploadResultBase } from '@/lib/csv-import/result'
import type { CsvImportSource } from '@/lib/csv-import/types'
import { UPSERT_CHUNK_SIZE } from '@/lib/csv-import/types'
import type { CsvUploadResult } from '@/types/database'

export async function importViaChunkedUpserts(
  supabase: any,
  userId: string,
  source: CsvImportSource
): Promise<CsvUploadResult> {
  const result = createCsvUploadResultBase(source.errors)

  const txnNos = source.transactions.map((txn) => txn.txn_no)
  const transactionRows = source.transactions.map((txn) => ({
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
  const productRows = source.transactions.flatMap((txn) =>
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
      (supabase as any)
        .from('product_sales')
        .upsert(rows, { onConflict: 'user_id,txn_no,product_name' })
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

    const { error: pmErr } = await (supabase as any).from('product_master').upsert(inserts, {
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
