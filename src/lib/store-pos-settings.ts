import type { StoreOrderPageRow, StorePosPaymentMethod, VendorStoreRow } from '@/types/api-payloads'

const STORE_POS_SETTINGS_START = '[kuridas:store-pos-settings]'
const STORE_POS_SETTINGS_END = '[/kuridas:store-pos-settings]'

const VALID_STORE_POS_PAYMENT_METHODS: StorePosPaymentMethod[] = ['cash', 'paypay', 'other']

type StorePosSettingsSnapshot = {
  is_store_pos_enabled: boolean
  store_pos_terminal_name: string | null
  store_pos_enabled_payment_methods: StorePosPaymentMethod[]
}

type StorePosSettingsMetadata = Partial<StorePosSettingsSnapshot>

function parseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function isValidPaymentMethod(value: unknown): value is StorePosPaymentMethod {
  return typeof value === 'string' && VALID_STORE_POS_PAYMENT_METHODS.includes(value as StorePosPaymentMethod)
}

export function normalizeStorePosPaymentMethods(values: unknown): StorePosPaymentMethod[] {
  const candidates = Array.isArray(values) ? values : []
  const unique = new Set<StorePosPaymentMethod>()

  for (const value of candidates) {
    if (isValidPaymentMethod(value)) {
      unique.add(value)
    }
  }

  return unique.size > 0 ? Array.from(unique) : ['cash', 'paypay', 'other']
}

export function extractStorePosSettingsFromNotes(notes: string | null | undefined): StorePosSettingsMetadata | null {
  const text = String(notes ?? '')
  if (!text.includes(STORE_POS_SETTINGS_START) || !text.includes(STORE_POS_SETTINGS_END)) {
    return null
  }

  const pattern = new RegExp(
    `${STORE_POS_SETTINGS_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s\\S]*?)${STORE_POS_SETTINGS_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
  )
  const match = text.match(pattern)
  if (!match?.[1]) return null

  const parsed = parseJsonObject(match[1].trim())
  if (!parsed) return null

  const metadata = parsed as Record<string, unknown>

  return {
    is_store_pos_enabled:
      typeof metadata.is_store_pos_enabled === 'boolean' ? metadata.is_store_pos_enabled : undefined,
    store_pos_terminal_name:
      typeof metadata.store_pos_terminal_name === 'string'
        ? metadata.store_pos_terminal_name.trim() || null
        : metadata.store_pos_terminal_name === null
          ? null
          : undefined,
    store_pos_enabled_payment_methods: normalizeStorePosPaymentMethods(metadata.store_pos_enabled_payment_methods),
  }
}

export function upsertStorePosSettingsInNotes(
  notes: string | null | undefined,
  settings: StorePosSettingsSnapshot
) {
  const metadataBlock = `${STORE_POS_SETTINGS_START}\n${JSON.stringify(settings)}\n${STORE_POS_SETTINGS_END}`
  const text = String(notes ?? '').trim()
  const pattern = new RegExp(
    `${STORE_POS_SETTINGS_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${STORE_POS_SETTINGS_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    'g'
  )

  if (!text) {
    return metadataBlock
  }

  if (pattern.test(text)) {
    return text.replace(pattern, metadataBlock)
  }

  return `${text}\n\n${metadataBlock}`
}

export function resolveStorePosSettings(
  store: Partial<VendorStoreRow> | null | undefined,
  orderPage?: Partial<StoreOrderPageRow> | null
): StorePosSettingsSnapshot {
  const noteSettings = extractStorePosSettingsFromNotes(orderPage?.notes ?? null)

  const isStorePosEnabled =
    typeof store?.is_store_pos_enabled === 'boolean'
      ? store.is_store_pos_enabled
      : noteSettings?.is_store_pos_enabled ?? true

  const terminalName =
    typeof store?.store_pos_terminal_name === 'string'
      ? store.store_pos_terminal_name.trim() || null
      : noteSettings?.store_pos_terminal_name ?? 'front-tablet'

  const enabledPaymentMethods = Array.isArray(store?.store_pos_enabled_payment_methods)
    ? normalizeStorePosPaymentMethods(store.store_pos_enabled_payment_methods)
    : normalizeStorePosPaymentMethods(noteSettings?.store_pos_enabled_payment_methods)

  return {
    is_store_pos_enabled: isStorePosEnabled,
    store_pos_terminal_name: terminalName,
    store_pos_enabled_payment_methods: enabledPaymentMethods,
  }
}

export function applyStorePosSettingsToStore<T extends Partial<VendorStoreRow>>(
  store: T,
  orderPage?: Partial<StoreOrderPageRow> | null
) {
  const settings = resolveStorePosSettings(store, orderPage)
  return {
    ...store,
    ...settings,
  } as T & StorePosSettingsSnapshot
}

