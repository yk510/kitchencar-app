import test from 'node:test'
import assert from 'node:assert/strict'

import {
  groupAirregiTransactions,
  parseAirregiCsvString,
} from '@/lib/airregi-csv-parser'
import { buildAirregiCsvImportSource } from '@/lib/csv-import/build-airregi-source'
import { CsvImportValidationError } from '@/lib/csv-import/types'

const AIRREGI_HEADERS = [
  '取引No',
  '商品名',
  '取引日',
  '取引時間',
  '商品単価',
  '商品数',
  '商品合計金額',
  '合計',
  '内消費税',
  '取引種別',
  'クレジットカード(Airペイ タッチ)',
  'クレジットカード(Airペイ)',
  'QR決済(Airペイ QR)',
  'QR決済(Airペイ)',
  'QUICPay(Airペイ)',
  'Apple Pay(Airペイ)',
  '交通系電子マネー(Airペイ)',
  'iD(Airペイ)',
  '現金',
].join(',')

function joinCsvRows(rows: string[][]): string {
  return [AIRREGI_HEADERS, ...rows.map((row) => row.join(','))].join('\n')
}

test('buildAirregiCsvImportSource groups duplicate item rows in the same transaction', () => {
  const csv = joinCsvRows([
    [
      'TXN-001',
      '牛すじ',
      '2026/04/19',
      '14:02:09',
      '1000',
      '1',
      '1000',
      '2400',
      '218',
      '会計',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '2400',
    ],
    [
      'TXN-001',
      '牛すじ',
      '2026/04/19',
      '14:02:09',
      '1000',
      '2',
      '2000',
      '2400',
      '218',
      '会計',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '2400',
    ],
    [
      'TXN-001',
      'ラッシー',
      '2026/04/19',
      '14:02:09',
      '200',
      '2',
      '400',
      '2400',
      '218',
      '会計',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '2400',
    ],
  ])

  const source = buildAirregiCsvImportSource(csv)

  assert.equal(source.errors.length, 0)
  assert.equal(source.transactions.length, 1)
  assert.equal(source.transactions[0].items.length, 2)
  assert.deepEqual(source.transactions[0].items[0], {
    product_name: '牛すじ',
    unit_price: 1000,
    quantity: 3,
    subtotal: 3000,
  })
  assert.deepEqual(source.transactions[0].items[1], {
    product_name: 'ラッシー',
    unit_price: 200,
    quantity: 2,
    subtotal: 400,
  })
})

test('buildAirregiCsvImportSource rejects empty csv content', () => {
  assert.throws(() => buildAirregiCsvImportSource(''), (error: unknown) => {
    assert.ok(error instanceof CsvImportValidationError)
    assert.equal(error.message, 'CSVの行が読み取れませんでした')
    return true
  })
})

test('groupAirregiTransactions derives return flag, day/hour, and payment method', () => {
  const rows = parseAirregiCsvString(
    joinCsvRows([
      [
        'TXN-RET-001',
        'チキン',
        '2026/04/20',
        '9:15',
        '1000',
        '1',
        '1000',
        '1000',
        '91',
        '返品',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '1000',
      ],
      [
        'TXN-CARD-001',
        '匠',
        '2026/04/21',
        '14:30',
        '1500',
        '1',
        '1500',
        '1500',
        '136',
        '会計',
        '0',
        '1500',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
      ],
    ])
  )

  const { transactions, errors } = groupAirregiTransactions(rows)

  assert.equal(errors.length, 0)
  assert.equal(transactions.length, 2)
  assert.deepEqual(
    transactions.map((txn) => ({
      txn_no: txn.txn_no,
      is_return: txn.is_return,
      txn_time: txn.txn_time,
      hour_of_day: txn.hour_of_day,
      payment_method: txn.payment_method,
    })),
    [
      {
        txn_no: 'TXN-RET-001',
        is_return: true,
        txn_time: '09:15:00',
        hour_of_day: 9,
        payment_method: '現金',
      },
      {
        txn_no: 'TXN-CARD-001',
        is_return: false,
        txn_time: '14:30:00',
        hour_of_day: 14,
        payment_method: 'クレジットカード(Airペイ)',
      },
    ]
  )
})

test('groupAirregiTransactions records validation errors for missing product names', () => {
  const rows = parseAirregiCsvString(
    joinCsvRows([
      [
        'TXN-ERR-001',
        '',
        '2026/04/21',
        '14:30',
        '1500',
        '1',
        '1500',
        '1500',
        '136',
        '会計',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '1500',
      ],
    ])
  )

  const { transactions, errors } = groupAirregiTransactions(rows)

  assert.equal(transactions.length, 0)
  assert.deepEqual(errors, ['取引No TXN-ERR-001: 商品名が空'])
})
