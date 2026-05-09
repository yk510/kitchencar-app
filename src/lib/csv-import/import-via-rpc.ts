import { formatRpcImportResult } from '@/lib/csv-import/result'
import type { CsvImportRpcResult, CsvImportSource } from '@/lib/csv-import/types'
import { CSV_IMPORT_RPC_NAME } from '@/lib/csv-import/types'

export async function tryImportViaRpc(
  supabase: any,
  source: CsvImportSource
): Promise<CsvImportRpcResult | null> {
  const { data, error } = await supabase.rpc(CSV_IMPORT_RPC_NAME, {
    payload: {
      transactions: source.transactions,
      errors: source.errors,
    },
  })

  if (!error && data) {
    return formatRpcImportResult(data as Record<string, unknown>, source.errors)
  }

  const rpcUnavailable =
    error?.code === 'PGRST202' ||
    error?.message?.includes(CSV_IMPORT_RPC_NAME) ||
    error?.message?.includes('Could not find the function')

  if (rpcUnavailable) {
    return null
  }

  throw error
}
