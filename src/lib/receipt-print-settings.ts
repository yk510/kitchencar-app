import type {
  ReceiptPrintMode,
  ReceiptPrinterProvider,
  StoreOrderPageRow,
  VendorStoreRow,
} from '@/types/api-payloads'

const RECEIPT_PRINT_SETTINGS_START = '[kuridas:receipt-print-settings]'
const RECEIPT_PRINT_SETTINGS_END = '[/kuridas:receipt-print-settings]'

const VALID_RECEIPT_PRINTER_PROVIDERS: ReceiptPrinterProvider[] = ['epson_epos']
const VALID_RECEIPT_PRINT_MODES: ReceiptPrintMode[] = ['manual_dashboard']

type ReceiptPrintSettingsSnapshot = {
  is_receipt_print_enabled: boolean
  receipt_printer_provider: ReceiptPrinterProvider | null
  receipt_printer_endpoint: string | null
  receipt_printer_label: string | null
  receipt_print_mode: ReceiptPrintMode | null
}

type ReceiptPrintSettingsMetadata = Partial<ReceiptPrintSettingsSnapshot>

function parseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function normalizeNullableText(value: unknown) {
  if (value == null) return null
  const text = String(value).trim()
  return text || null
}

function normalizeReceiptPrinterProvider(value: unknown): ReceiptPrinterProvider | null {
  return typeof value === 'string' && VALID_RECEIPT_PRINTER_PROVIDERS.includes(value as ReceiptPrinterProvider)
    ? (value as ReceiptPrinterProvider)
    : null
}

function normalizeReceiptPrintMode(value: unknown): ReceiptPrintMode | null {
  return typeof value === 'string' && VALID_RECEIPT_PRINT_MODES.includes(value as ReceiptPrintMode)
    ? (value as ReceiptPrintMode)
    : null
}

export function extractReceiptPrintSettingsFromNotes(
  notes: string | null | undefined
): ReceiptPrintSettingsMetadata | null {
  const text = String(notes ?? '')
  if (!text.includes(RECEIPT_PRINT_SETTINGS_START) || !text.includes(RECEIPT_PRINT_SETTINGS_END)) {
    return null
  }

  const pattern = new RegExp(
    `${RECEIPT_PRINT_SETTINGS_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s\\S]*?)${RECEIPT_PRINT_SETTINGS_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
  )
  const match = text.match(pattern)
  if (!match?.[1]) return null

  const parsed = parseJsonObject(match[1].trim())
  if (!parsed) return null

  const metadata = parsed as Record<string, unknown>

  return {
    is_receipt_print_enabled:
      typeof metadata.is_receipt_print_enabled === 'boolean' ? metadata.is_receipt_print_enabled : undefined,
    receipt_printer_provider: normalizeReceiptPrinterProvider(metadata.receipt_printer_provider),
    receipt_printer_endpoint: normalizeNullableText(metadata.receipt_printer_endpoint),
    receipt_printer_label: normalizeNullableText(metadata.receipt_printer_label),
    receipt_print_mode: normalizeReceiptPrintMode(metadata.receipt_print_mode),
  }
}

export function upsertReceiptPrintSettingsInNotes(
  notes: string | null | undefined,
  settings: ReceiptPrintSettingsSnapshot
) {
  const metadataBlock = `${RECEIPT_PRINT_SETTINGS_START}\n${JSON.stringify(settings)}\n${RECEIPT_PRINT_SETTINGS_END}`
  const text = String(notes ?? '').trim()
  const pattern = new RegExp(
    `${RECEIPT_PRINT_SETTINGS_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${RECEIPT_PRINT_SETTINGS_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
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

export function resolveReceiptPrintSettings(
  store: Partial<VendorStoreRow> | null | undefined,
  orderPage?: Partial<StoreOrderPageRow> | null
): ReceiptPrintSettingsSnapshot {
  const noteSettings = extractReceiptPrintSettingsFromNotes(orderPage?.notes ?? null)

  return {
    is_receipt_print_enabled:
      typeof store?.is_receipt_print_enabled === 'boolean'
        ? store.is_receipt_print_enabled
        : noteSettings?.is_receipt_print_enabled ?? false,
    receipt_printer_provider: normalizeReceiptPrinterProvider(store?.receipt_printer_provider) ??
      noteSettings?.receipt_printer_provider ??
      'epson_epos',
    receipt_printer_endpoint:
      normalizeNullableText(store?.receipt_printer_endpoint) ??
      noteSettings?.receipt_printer_endpoint ??
      null,
    receipt_printer_label:
      normalizeNullableText(store?.receipt_printer_label) ??
      noteSettings?.receipt_printer_label ??
      'kitchen-printer',
    receipt_print_mode:
      normalizeReceiptPrintMode(store?.receipt_print_mode) ?? noteSettings?.receipt_print_mode ?? 'manual_dashboard',
  }
}

export function applyReceiptPrintSettingsToStore<T extends Partial<VendorStoreRow>>(
  store: T,
  orderPage?: Partial<StoreOrderPageRow> | null
) {
  const settings = resolveReceiptPrintSettings(store, orderPage)
  return {
    ...store,
    ...settings,
  } as T & ReceiptPrintSettingsSnapshot
}

