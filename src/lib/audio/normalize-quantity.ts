const KANA_QUANTITY_MAP = new Map<string, number>([
  ['ひとつ', 1],
  ['ふたつ', 2],
  ['みっつ', 3],
  ['よっつ', 4],
  ['いつつ', 5],
  ['むっつ', 6],
  ['ななつ', 7],
  ['やっつ', 8],
  ['ここのつ', 9],
  ['とお', 10],
])

const KANJI_DIGIT_MAP = new Map<string, number>([
  ['〇', 0],
  ['零', 0],
  ['一', 1],
  ['二', 2],
  ['三', 3],
  ['四', 4],
  ['五', 5],
  ['六', 6],
  ['七', 7],
  ['八', 8],
  ['九', 9],
])

const QUANTITY_SUFFIX_PATTERN = /(つ|個|こ|杯|本|枚|点|食|人|名)$/

function normalizeQuantityText(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
}

function stripQuantitySuffix(value: string) {
  return value.replace(QUANTITY_SUFFIX_PATTERN, '')
}

function parseJapaneseKanjiNumber(value: string) {
  if (!value) return null

  if (!value.includes('十')) {
    const digit = KANJI_DIGIT_MAP.get(value)
    return digit == null ? null : digit
  }

  const [rawTens, rawOnes] = value.split('十')
  if (value.split('十').length > 2) {
    return null
  }

  const tens =
    rawTens === ''
      ? 1
      : KANJI_DIGIT_MAP.get(rawTens) ?? null

  const ones =
    rawOnes === ''
      ? 0
      : KANJI_DIGIT_MAP.get(rawOnes) ?? null

  if (tens == null || ones == null) {
    return null
  }

  return tens * 10 + ones
}

export function normalizeAudioQuantity(rawValue: string | null | undefined) {
  const normalized = normalizeQuantityText(rawValue)
  if (!normalized) {
    return null
  }

  const exactKanaQuantity = KANA_QUANTITY_MAP.get(normalized)
  if (exactKanaQuantity != null) {
    return exactKanaQuantity
  }

  const withoutSuffix = stripQuantitySuffix(normalized)
  if (!withoutSuffix) {
    return null
  }

  if (/^\d+$/.test(withoutSuffix)) {
    const parsed = Number.parseInt(withoutSuffix, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }

  const kanaQuantity = KANA_QUANTITY_MAP.get(withoutSuffix)
  if (kanaQuantity != null) {
    return kanaQuantity
  }

  const kanjiQuantity = parseJapaneseKanjiNumber(withoutSuffix)
  if (kanjiQuantity != null && kanjiQuantity > 0) {
    return kanjiQuantity
  }

  return null
}
