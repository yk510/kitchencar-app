import { NextRequest, NextResponse } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { parseCalendarImageToDraft } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response

    const { imageDataUrl, knownLocations } = await req.json()

    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      return NextResponse.json({ error: '画像データがありません' }, { status: 400 })
    }

    const draft = await parseCalendarImageToDraft(
      imageDataUrl,
      Array.isArray(knownLocations) ? knownLocations : []
    )
    return NextResponse.json({ draft })
  } catch (error) {
    console.error('[plans/parse POST]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '予測案の作成に失敗しました' },
      { status: 500 }
    )
  }
}
