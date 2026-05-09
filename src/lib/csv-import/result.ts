import type { CsvUploadResult } from '@/types/database'
import type { CsvImportRpcResult } from '@/lib/csv-import/types'

export function createCsvUploadResultBase(errors: string[]): CsvUploadResult {
  return {
    inserted: 0,
    updated: 0,
    skipped: errors.length,
    newProducts: [],
    errors: [...errors],
  }
}

export function formatRpcImportResult(
  rpcResult: Record<string, unknown>,
  fallbackErrors: string[]
): CsvImportRpcResult {
  return {
    inserted: Number(rpcResult.inserted ?? 0),
    updated: Number(rpcResult.updated ?? 0),
    skipped: Number(rpcResult.skipped ?? fallbackErrors.length),
    newProducts: Array.isArray(rpcResult.newProducts)
      ? (rpcResult.newProducts as string[])
      : [],
    errors: Array.isArray(rpcResult.errors)
      ? (rpcResult.errors as string[])
      : fallbackErrors,
  }
}
