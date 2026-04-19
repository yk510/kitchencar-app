import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { parseCsvString, groupTransactions } from '@/lib/csvParser'
import type { CsvUploadResult } from '@/types/database'
import { apiError, apiOk } from '@/lib/api-response'

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

    const result: CsvUploadResult = {
      inserted:    0,
      updated:     0,
      skipped:     errors.length,
      newProducts: [],
      errors,
    }

    // 2. 既存商品取得
    const { data: existingProducts } = await (supabase as any)
      .from('product_master')
      .select('product_name')

    const knownProducts = new Set(
      ((existingProducts ?? []) as any[]).map((p: any) => p.product_name)
    )

    const newProductNames = new Set<string>()

    // 3. 取引ごと処理
    for (const txn of transactions) {
      const { error: txnErr, data: txnData } = await (supabase as any)
        .from('transactions')
        .upsert(
          [{
            user_id:         user.id,
            txn_no:         txn.txn_no,
            txn_date:       txn.txn_date,
            txn_time:       txn.txn_time,
            day_of_week:    txn.day_of_week,
            hour_of_day:    txn.hour_of_day,
            raw_txn_kind:   txn.raw_txn_kind,
            is_return:      txn.is_return,
            total_amount:   txn.total_amount,
            tax_amount:     txn.tax_amount,
            discount_total: txn.discount_total,
            payment_method: txn.payment_method,
          }],
          { onConflict: 'user_id,txn_no' }
        )
        .select('id')
        .single()

      if (txnErr) {
        result.errors.push(`取引No ${txn.txn_no}: ${txnErr.message}`)
        result.skipped++
        continue
      }

      const wasNew = !txnData
      if (wasNew) result.inserted++
      else result.updated++

      // 商品行
      for (const item of txn.items) {
        const { error: itemErr } = await (supabase as any)
          .from('product_sales')
          .upsert(
            [{
              user_id:      user.id,
              txn_no:       txn.txn_no,
              txn_date:     txn.txn_date,
              product_name: item.product_name,
              unit_price:   item.unit_price,
              quantity:     item.quantity,
              subtotal:     item.subtotal,
            }],
            { onConflict: 'user_id,txn_no,product_name' }
          )

        if (itemErr) {
          result.errors.push(`商品行 ${item.product_name}: ${itemErr.message}`)
        }

        if (!knownProducts.has(item.product_name)) {
          newProductNames.add(item.product_name)
          knownProducts.add(item.product_name)
        }
      }
    }

    // 4. 新商品登録
    if (newProductNames.size > 0) {
      const inserts = Array.from(newProductNames).map(name => ({
        user_id: user.id,
        product_name: name,
      }))

      const { error: pmErr } = await (supabase as any)
        .from('product_master')
        .upsert(inserts, {
          onConflict: 'user_id,product_name',
          ignoreDuplicates: true,
        })

      if (!pmErr) {
        result.newProducts = Array.from(newProductNames)
      }
    }

    // 5. 再集計
    const total = transactions.length - result.skipped
    result.inserted = total
    result.updated  = 0

    return apiOk(result)
  } catch (e) {
    console.error('[upload-csv]', e)
    return apiError('サーバーエラーが発生しました')
  }
}
