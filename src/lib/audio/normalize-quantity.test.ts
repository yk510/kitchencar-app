import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAudioQuantity } from '@/lib/audio/normalize-quantity'

test('normalizeAudioQuantity parses numeric expressions', () => {
  assert.equal(normalizeAudioQuantity('2'), 2)
  assert.equal(normalizeAudioQuantity('２'), 2)
  assert.equal(normalizeAudioQuantity('2つ'), 2)
  assert.equal(normalizeAudioQuantity('3個'), 3)
  assert.equal(normalizeAudioQuantity('4こ'), 4)
})

test('normalizeAudioQuantity parses kana quantity words', () => {
  assert.equal(normalizeAudioQuantity('ひとつ'), 1)
  assert.equal(normalizeAudioQuantity('ふたつ'), 2)
  assert.equal(normalizeAudioQuantity('みっつ'), 3)
  assert.equal(normalizeAudioQuantity('よっつ'), 4)
  assert.equal(normalizeAudioQuantity('とお'), 10)
})

test('normalizeAudioQuantity parses kanji quantity expressions', () => {
  assert.equal(normalizeAudioQuantity('一つ'), 1)
  assert.equal(normalizeAudioQuantity('二つ'), 2)
  assert.equal(normalizeAudioQuantity('十'), 10)
  assert.equal(normalizeAudioQuantity('十一'), 11)
  assert.equal(normalizeAudioQuantity('二十'), 20)
  assert.equal(normalizeAudioQuantity('二十一'), 21)
})

test('normalizeAudioQuantity rejects blank or unsupported expressions', () => {
  assert.equal(normalizeAudioQuantity(''), null)
  assert.equal(normalizeAudioQuantity('0'), null)
  assert.equal(normalizeAudioQuantity('たくさん'), null)
  assert.equal(normalizeAudioQuantity('コーラ2'), null)
})
