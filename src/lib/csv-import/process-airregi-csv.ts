import { buildAirregiCsvImportSource } from '@/lib/csv-import/build-airregi-source'
import { importViaChunkedUpserts } from '@/lib/csv-import/import-via-upsert'
import { tryImportViaRpc } from '@/lib/csv-import/import-via-rpc'
import type { CsvImportSource } from '@/lib/csv-import/types'
import type { CsvUploadResult } from '@/types/database'

export async function importAirregiCsv({
  supabase,
  userId,
  csvText,
}: {
  supabase: any
  userId: string
  csvText: string
}): Promise<CsvUploadResult> {
  const source: CsvImportSource = buildAirregiCsvImportSource(csvText)
  const rpcResult = await tryImportViaRpc(supabase, source)

  if (rpcResult) {
    return rpcResult
  }

  return importViaChunkedUpserts(supabase, userId, source)
}
