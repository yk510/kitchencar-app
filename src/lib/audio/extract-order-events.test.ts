import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAudioProductAliasDictionary } from '@/lib/audio/product-alias'
import { extractAudioOrderEvents } from '@/lib/audio/extract-order-events'
import type { ProductAliasRow } from '@/types/audio-analytics'
import type { ProductMaster } from '@/types/database'

const now = '2026-05-10T00:00:00.000Z'

function createProduct(overrides: Partial<ProductMaster> = {}): ProductMaster {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    user_id: overrides.user_id ?? 'user-1',
    product_name: overrides.product_name ?? 'コーラ',
    cost_amount: overrides.cost_amount ?? null,
    cost_rate: overrides.cost_rate ?? null,
    cost_updated_at: overrides.cost_updated_at ?? null,
    created_at: overrides.created_at ?? now,
  }
}

function createAlias(overrides: Partial<ProductAliasRow> = {}): ProductAliasRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    user_id: overrides.user_id ?? 'user-1',
    product_id: overrides.product_id ?? 'product-1',
    alias: overrides.alias ?? 'こーら',
    normalized_alias: overrides.normalized_alias ?? '',
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
  }
}

test('extractAudioOrderEvents extracts product and quantity for simple suffix expressions', () => {
  const cola = createProduct({ id: 'product-cola', product_name: 'コーラ' })
  const dictionary = buildAudioProductAliasDictionary([cola], [])

  assert.deepEqual(extractAudioOrderEvents(dictionary, 'コーラ2つ'), [
    {
      productId: cola.id,
      productName: 'コーラ',
      productNameRaw: 'コーラ',
      normalizedProductName: 'コーラ',
      quantity: 2,
      sourceAlias: 'コーラ',
    },
  ])
})

test('extractAudioOrderEvents supports quantity before product and alias matches', () => {
  const lemonade = createProduct({ id: 'product-lemon', product_name: 'レモンスカッシュ' })
  const dictionary = buildAudioProductAliasDictionary(
    [lemonade],
    [
      createAlias({
        product_id: lemonade.id,
        alias: 'レモスカ',
        normalized_alias: 'レモスカ',
      }),
    ]
  )

  assert.deepEqual(extractAudioOrderEvents(dictionary, '3つレモスカお願いします'), [
    {
      productId: lemonade.id,
      productName: 'レモンスカッシュ',
      productNameRaw: 'レモスカ',
      normalizedProductName: 'レモンスカッシュ',
      quantity: 3,
      sourceAlias: 'レモスカ',
    },
  ])
})

test('extractAudioOrderEvents defaults quantity to one when omitted', () => {
  const hotdog = createProduct({ id: 'product-hotdog', product_name: 'ホットドッグ' })
  const dictionary = buildAudioProductAliasDictionary([hotdog], [])

  assert.deepEqual(extractAudioOrderEvents(dictionary, 'ホットドッグお願いします'), [
    {
      productId: hotdog.id,
      productName: 'ホットドッグ',
      productNameRaw: 'ホットドッグ',
      normalizedProductName: 'ホットドッグ',
      quantity: 1,
      sourceAlias: 'ホットドッグ',
    },
  ])
})

test('extractAudioOrderEvents returns empty when multiple products are detected', () => {
  const cola = createProduct({ id: 'product-cola', product_name: 'コーラ' })
  const lemon = createProduct({ id: 'product-lemon', product_name: 'レモネード' })
  const dictionary = buildAudioProductAliasDictionary([cola, lemon], [])

  assert.deepEqual(extractAudioOrderEvents(dictionary, 'コーラとレモネードを1つずつ'), [])
})

test('extractAudioOrderEvents returns empty when no product alias matches', () => {
  const dictionary = buildAudioProductAliasDictionary([], [])
  assert.deepEqual(extractAudioOrderEvents(dictionary, 'たくさんください'), [])
})

test('extractAudioOrderEvents works with import catalog products even when product master is empty', () => {
  const dictionary = buildAudioProductAliasDictionary([], [], [
    { product_name: '牛すじカレー' },
  ])

  assert.deepEqual(extractAudioOrderEvents(dictionary, '牛すじカレー2つ'), [
    {
      productId: null,
      productName: '牛すじカレー',
      productNameRaw: '牛すじカレー',
      normalizedProductName: '牛すじカレー',
      quantity: 2,
      sourceAlias: '牛すじカレー',
    },
  ])
})
