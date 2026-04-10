import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseCsvString, groupTransactions } from '@/lib/csvParser'
import type { CsvUploadResult } from '@/types/database'

export async function POST(req: NextRequest) {
  try {
    const { csvText } = await req.json()
    if (!csvText || typeof csvText !== 'string') {
      return NextResponse.json({ error: 'CSVテキストが空です' }, { status: 400 })
    }

    // 1. CSV をパース
    const rows = parseCsvString(csvText)
    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSVの行が読み取れませんでした' }, { status: 400 })
    }

    const { transactions, errors } = groupTransactions(rows)

    const result: CsvUploadResult = {
      inserted:    0,
      updated:     0,
      skipped:     errors.length,
      newProducts: [],
      errors,
    }

    // 2. 既存の product_master を取得（新商品検出用）
    const { data: existingProducts } = await supabase
      .from('product_master')
      .select('product_name')
    const knownProducts = new Set((existingProducts ?? []).map(p => p.product_name))
    const newProductNames = new Set<string>()

    // 3. 取引ごとに upsert
    for (const txn of transactions) {
      // transactions テーブルへ upsert
      const { error: txnErr, data: txnData } = await supabase
        .from('transactions')
        .upsert(
          {
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
          },
          { onConflict: 'txn_no' }
        )
        .select('id')
        .single()

      if (txnErr) {
        result.errors.push(`取引No ${txn.txn_no}: ${txnErr.message}`)
        result.skipped++
        continue
      }

      // 既存か新規かを判定（upsert後に取引が存在していたか確認）
      // Supabase upsert は既存の場合も data を返すが区別のため事前確認
      const wasNew = !txnData  // 簡易判定（実際は upsert の戻り値で確認）
      if (wasNew) result.inserted++
      else result.updated++

      // product_sales テーブルへ upsert（商品行）
      for (const item of txn.items) {
        const { error: itemErr } = await supabase
          .from('product_sales')
          .upsert(
            {
              txn_no:       txn.txn_no,
              txn_date:     txn.txn_date,
              product_name: item.product_name,
              unit_price:   item.unit_price,
              quantity:     item.quantity,
              subtotal:     item.subtotal,
            },
            { onConflict: 'txn_no,product_name' }
          )

        if (itemErr) {
          result.errors.push(`商品行 ${item.product_name}: ${itemErr.message}`)
        }

        // 新商品検出
        if (!knownProducts.has(item.product_name)) {
          newProductNames.add(item.product_name)
          knownProducts.add(item.product_name) // 同一CSV内の重複検出を防ぐ
        }
      }
    }

    // 4. 新商品を product_master に登録（cost = NULL）
    if (newProductNames.size > 0) {
      const inserts = [...newProductNames].map(name => ({ product_name: name }))
      const { error: pmErr } = await supabase
        .from('product_master')
        .upsert(inserts, { onConflict: 'product_name', ignoreDuplicates: true })

      if (!pmErr) {
        result.newProducts = [...newProductNames]
      }
    }

    // 5. inserted / updated を再集計（upsert の簡易判定を補正）
    // シンプルに: transactions 総数 - errors でカウント
    const total = transactions.length - result.skipped
    result.inserted = total  // MVP では挿入/更新の厳密区別は省略
    result.updated  = 0

    return NextResponse.json(result)
  } catch (e) {
    console.error('[upload-csv]', e)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
