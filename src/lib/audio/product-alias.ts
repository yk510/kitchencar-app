import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, ProductMaster } from '@/types/database'
import type {
  AudioImportCatalogProductInput,
  ProductAliasRow,
} from '@/types/audio-analytics'

type ProductMasterRow = Database['public']['Tables']['product_master']['Row']

export type AudioProductAliasMatchSource = 'product_master' | 'product_aliases'

export type AudioProductAliasEntry = {
  productId: string | null
  productName: string
  matchedAlias: string
  normalizedAlias: string
  source: AudioProductAliasMatchSource
}

export type AudioProductAliasConflict = {
  normalizedAlias: string
  keptProductId: string | null
  keptProductName: string
  skippedProductId: string | null
  skippedProductName: string
  skippedAlias: string
  source: AudioProductAliasMatchSource
}

export type AudioProductAliasDictionary = {
  products: ProductMasterRow[]
  aliases: ProductAliasRow[]
  entries: AudioProductAliasEntry[]
  byNormalizedAlias: Map<string, AudioProductAliasEntry>
  conflicts: AudioProductAliasConflict[]
}

export type ResolveAudioProductAliasResult = AudioProductAliasEntry | null

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, '')
}

export function normalizeAudioProductAlias(rawValue: string | null | undefined) {
  return normalizeWhitespace(
    String(rawValue ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[‐‑‒–—―ーｰ]+/g, '-')
    .replace(/[・･]/g, '')
    .replace(/[()（）［］【】「」『』]/g, '')
    .replace(/[.,，、]/g, '')
    .replace(/[!！?？:：;；]/g, '')
    .replace(/[\\/]/g, '')
    .replace(/['"`]/g, '')
    .replace(/&/g, 'and')
  )
}

function buildAliasEntry(
  product: { id: string | null; product_name: string },
  alias: string,
  source: AudioProductAliasMatchSource,
  normalizedAlias = normalizeAudioProductAlias(alias)
): AudioProductAliasEntry | null {
  if (!normalizedAlias) {
    return null
  }

  return {
    productId: product.id,
    productName: product.product_name,
    matchedAlias: alias,
    normalizedAlias,
    source,
  }
}

export function buildAudioProductAliasDictionary(
  products: ProductMasterRow[],
  aliases: ProductAliasRow[],
  importCatalogProducts: AudioImportCatalogProductInput[] = []
): AudioProductAliasDictionary {
  const byProductId = new Map(products.map((product) => [product.id, product]))
  const byNormalizedAlias = new Map<string, AudioProductAliasEntry>()
  const entries: AudioProductAliasEntry[] = []
  const conflicts: AudioProductAliasConflict[] = []

  const registerEntry = (entry: AudioProductAliasEntry) => {
    const existing = byNormalizedAlias.get(entry.normalizedAlias)
    if (!existing) {
      byNormalizedAlias.set(entry.normalizedAlias, entry)
      entries.push(entry)
      return
    }

    if (existing.productId === entry.productId) {
      return
    }

    conflicts.push({
      normalizedAlias: entry.normalizedAlias,
      keptProductId: existing.productId,
      keptProductName: existing.productName,
      skippedProductId: entry.productId,
      skippedProductName: entry.productName,
      skippedAlias: entry.matchedAlias,
      source: entry.source,
    })
  }

  for (const product of products) {
    const entry = buildAliasEntry(product, product.product_name, 'product_master')
    if (entry) {
      registerEntry(entry)
    }
  }

  for (const alias of aliases) {
    const product = byProductId.get(alias.product_id)
    if (!product) continue

    const entry = buildAliasEntry(
      product,
      alias.alias,
      'product_aliases',
      alias.normalized_alias || normalizeAudioProductAlias(alias.alias)
    )
    if (entry) {
      registerEntry(entry)
    }
  }

  for (const importProduct of importCatalogProducts) {
    const productName = String(importProduct.product_name ?? '').trim()
    if (!productName) continue

    const productRef = { id: null, product_name: productName }
    const canonicalEntry = buildAliasEntry(productRef, productName, 'product_master')
    if (canonicalEntry) {
      registerEntry(canonicalEntry)
    }

    for (const alias of importProduct.aliases ?? []) {
      const aliasEntry = buildAliasEntry(productRef, alias, 'product_aliases')
      if (aliasEntry) {
        registerEntry(aliasEntry)
      }
    }
  }

  return {
    products,
    aliases,
    entries,
    byNormalizedAlias,
    conflicts,
  }
}

export function resolveAudioProductAlias(
  dictionary: AudioProductAliasDictionary,
  rawValue: string | null | undefined
): ResolveAudioProductAliasResult {
  const normalizedAlias = normalizeAudioProductAlias(rawValue)
  if (!normalizedAlias) {
    return null
  }

  return dictionary.byNormalizedAlias.get(normalizedAlias) ?? null
}

export async function loadAudioProductAliasDictionary(
  supabase: SupabaseClient<Database>,
  userId: string,
  importCatalogProducts: AudioImportCatalogProductInput[] = []
) {
  const [productsResult, aliasesResult] = await Promise.all([
    supabase
      .from('product_master')
      .select('id, user_id, product_name, cost_amount, cost_rate, cost_updated_at, created_at')
      .eq('user_id', userId)
      .order('product_name', { ascending: true }),
    supabase
      .from('product_aliases')
      .select('id, user_id, product_id, alias, normalized_alias, created_at, updated_at')
      .eq('user_id', userId)
      .order('alias', { ascending: true }),
  ])

  if (productsResult.error) {
    throw new Error(productsResult.error.message)
  }

  if (aliasesResult.error) {
    throw new Error(aliasesResult.error.message)
  }

  return buildAudioProductAliasDictionary(
    productsResult.data ?? [],
    aliasesResult.data ?? [],
    importCatalogProducts
  )
}
