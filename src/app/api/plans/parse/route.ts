import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { parseCalendarImageToDraft } from '@/lib/openai'
import { apiError, apiOk } from '@/lib/api-response'
import type { PlansParseApiPayload } from '@/types/api-payloads'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response

    const { imageDataUrl, knownLocations } = await req.json()

    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      return apiError('画像データがありません', 400)
    }

    const draft = await parseCalendarImageToDraft(
      imageDataUrl,
      Array.isArray(knownLocations) ? knownLocations : []
    )
    const payload: PlansParseApiPayload = { draft }
    return apiOk(payload)
  } catch (error) {
    console.error('[plans/parse POST]', error)
    return apiError(error instanceof Error ? error.message : '予測案の作成に失敗しました')
  }
}
