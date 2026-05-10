import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAudioProductAliasDictionary,
  normalizeAudioProductAlias,
  resolveAudioProductAlias,
} from '@/lib/audio/product-alias'
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
    normalized_alias:
      overrides.normalized_alias ?? normalizeAudioProductAlias(overrides.alias ?? 'こーら'),
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
  }
}

test('normalizeAudioProductAlias normalizes full-width text and spacing', () => {
  assert.equal(normalizeAudioProductAlias(' レモン　スカッシュ '), 'レモンスカッシュ')
  assert.equal(normalizeAudioProductAlias('HOT DOG'), 'hotdog')
  assert.equal(normalizeAudioProductAlias('コーラ・ゼロ'), 'コ-ラゼロ')
})

test('buildAudioProductAliasDictionary includes canonical product names and aliases', () => {
  const cola = createProduct({ id: 'product-cola', product_name: 'コーラ' })
  const lemonade = createProduct({ id: 'product-lemon', product_name: 'レモンスカッシュ' })
  const dictionary = buildAudioProductAliasDictionary(
    [cola, lemonade],
    [
      createAlias({
        product_id: cola.id,
        alias: 'こーら',
      }),
      createAlias({
        product_id: lemonade.id,
        alias: 'レモンスカッシュ',
      }),
    ]
  )

  assert.equal(dictionary.entries.length, 3)
  assert.equal(resolveAudioProductAlias(dictionary, 'コーラ')?.productId, cola.id)
  assert.equal(resolveAudioProductAlias(dictionary, 'こーら')?.productId, cola.id)
  assert.equal(resolveAudioProductAlias(dictionary, ' レモン スカッシュ ')?.productId, lemonade.id)
})

test('buildAudioProductAliasDictionary records conflicts and keeps first match', () => {
  const cola = createProduct({ id: 'product-cola', product_name: 'コーラ' })
  const lemonade = createProduct({ id: 'product-lemon', product_name: 'レモン' })
  const dictionary = buildAudioProductAliasDictionary(
    [cola, lemonade],
    [
      createAlias({
        product_id: lemonade.id,
        alias: 'コーラ',
      }),
    ]
  )

  assert.equal(dictionary.conflicts.length, 1)
  assert.equal(resolveAudioProductAlias(dictionary, 'コーラ')?.productId, cola.id)
})

test('resolveAudioProductAlias returns null for blank or unknown input', () => {
  const dictionary = buildAudioProductAliasDictionary([], [])
  assert.equal(resolveAudioProductAlias(dictionary, ''), null)
  assert.equal(resolveAudioProductAlias(dictionary, '知らない商品'), null)
})

test('buildAudioProductAliasDictionary can include import catalog products without product master rows', () => {
  const dictionary = buildAudioProductAliasDictionary([], [], [
    {
      product_name: '牛すじカレー',
      aliases: ['牛すじ'],
    },
  ])

  assert.equal(resolveAudioProductAlias(dictionary, '牛すじカレー')?.productId, null)
  assert.equal(resolveAudioProductAlias(dictionary, '牛すじ')?.productName, '牛すじカレー')
})
