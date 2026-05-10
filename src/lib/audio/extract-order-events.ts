import {
  normalizeAudioProductAlias,
  type AudioProductAliasDictionary,
  type AudioProductAliasEntry,
} from '@/lib/audio/product-alias'
import { normalizeAudioQuantity } from '@/lib/audio/normalize-quantity'

const QUANTITY_TOKEN_PATTERN =
  /(\d+(?:つ|個|こ|杯|本|枚|点|食|人|名)?|[一二三四五六七八九十〇零]+(?:つ|個|こ|杯|本|枚|点|食|人|名)?|ひとつ|ふたつ|みっつ|よっつ|いつつ|むっつ|ななつ|やっつ|ここのつ|とお)/g

export type ExtractedAudioOrderEvent = {
  productId: string
  productName: string
  productNameRaw: string
  normalizedProductName: string
  quantity: number
  sourceAlias: string
}

function collectAliasMatches(dictionary: AudioProductAliasDictionary, transcriptText: string) {
  const normalizedTranscript = normalizeAudioProductAlias(transcriptText)
  if (!normalizedTranscript) {
    return []
  }

  return dictionary.entries
    .filter((entry) => normalizedTranscript.includes(entry.normalizedAlias))
    .sort((left, right) => right.normalizedAlias.length - left.normalizedAlias.length)
}

function chooseSingleAliasMatch(matches: AudioProductAliasEntry[]) {
  if (matches.length === 0) return null

  const [first, ...rest] = matches
  const distinctProductIds = new Set([first.productId, ...rest.map((entry) => entry.productId)])
  if (distinctProductIds.size > 1) {
    return null
  }

  return first
}

function findQuantityTokenCandidates(text: string) {
  const normalized = String(text ?? '').normalize('NFKC').toLowerCase()
  return Array.from(normalized.matchAll(QUANTITY_TOKEN_PATTERN))
    .map((match) => match[0])
    .filter(Boolean)
}

function extractQuantityAroundAlias(
  transcriptText: string,
  matchedAlias: AudioProductAliasEntry
) {
  const normalizedTranscript = normalizeAudioProductAlias(transcriptText)
  const aliasIndex = normalizedTranscript.indexOf(matchedAlias.normalizedAlias)
  if (aliasIndex < 0) {
    return 1
  }

  const before = normalizedTranscript.slice(0, aliasIndex)
  const after = normalizedTranscript.slice(aliasIndex + matchedAlias.normalizedAlias.length)

  const candidates = [
    ...findQuantityTokenCandidates(after),
    ...findQuantityTokenCandidates(before).reverse(),
  ]

  for (const candidate of candidates) {
    const parsedQuantity = normalizeAudioQuantity(candidate)
    if (parsedQuantity != null) {
      return parsedQuantity
    }
  }

  return 1
}

export function extractAudioOrderEvents(
  dictionary: AudioProductAliasDictionary,
  transcriptText: string
): ExtractedAudioOrderEvent[] {
  const trimmedText = String(transcriptText ?? '').trim()
  if (!trimmedText) {
    return []
  }

  const matches = collectAliasMatches(dictionary, trimmedText)
  const matchedAlias = chooseSingleAliasMatch(matches)
  if (!matchedAlias) {
    return []
  }

  return [
    {
      productId: matchedAlias.productId,
      productName: matchedAlias.productName,
      productNameRaw: matchedAlias.matchedAlias,
      normalizedProductName: matchedAlias.productName,
      quantity: extractQuantityAroundAlias(trimmedText, matchedAlias),
      sourceAlias: matchedAlias.matchedAlias,
    },
  ]
}
