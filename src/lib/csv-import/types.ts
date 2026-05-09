import type { CsvUploadResult } from '@/types/database'

export const CSV_IMPORT_RPC_NAME = 'import_airregi_csv_payload'
export const UPSERT_CHUNK_SIZE = 200

export interface ParsedItem {
  product_name: string
  unit_price: number
  quantity: number
  subtotal: number
}

export interface ParsedTransaction {
  txn_no: string
  txn_date: string
  txn_time: string
  day_of_week: number
  hour_of_day: number
  raw_txn_kind: string
  is_return: boolean
  total_amount: number
  tax_amount: number
  discount_total: number
  payment_method: string | null
  items: ParsedItem[]
}

export type CsvImportSource = {
  transactions: ParsedTransaction[]
  errors: string[]
}

export type CsvImportRpcResult = {
  inserted: number
  updated: number
  skipped: number
  newProducts: string[]
  errors: string[]
}

export type CsvImportExecutor = (
  supabase: any,
  source: CsvImportSource,
  userId: string
) => Promise<CsvUploadResult>

export type CsvImportSourceBuilder = (csvText: string) => CsvImportSource

export class CsvImportValidationError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'CsvImportValidationError'
    this.statusCode = statusCode
  }
}
