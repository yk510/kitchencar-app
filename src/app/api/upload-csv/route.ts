import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { importAirregiCsv } from '@/lib/csv-import/process-airregi-csv'
import { CsvImportValidationError } from '@/lib/csv-import/types'
import { apiError, apiOk } from '@/lib/api-response'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response
    const { supabase, user } = auth.session

    const { csvText } = await req.json()
    if (!csvText || typeof csvText !== 'string') {
      return apiError('CSVテキストが空です', 400)
    }

    const result = await importAirregiCsv({
      supabase,
      userId: user.id,
      csvText,
    })

    return apiOk(result)
  } catch (e) {
    console.error('[upload-csv]', e)
    if (e instanceof CsvImportValidationError) {
      return apiError(e.message, e.statusCode)
    }
    return apiError('サーバーエラーが発生しました')
  }
}
