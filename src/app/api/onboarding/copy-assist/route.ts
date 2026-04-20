import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api-response'
import { generateProfileCopyDraft } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const role = body.role === 'organizer' ? 'organizer' : 'vendor'
    const field = body.field === 'main_menu' ? 'main_menu' : 'description'
    const name = String(body.name ?? '').trim()
    const genreLabel = String(body.genreLabel ?? '').trim() || null
    const mainMenu = String(body.mainMenu ?? '').trim() || null
    const description = String(body.description ?? '').trim() || null
    const notes = String(body.notes ?? '').trim() || null

    if (!name) {
      return apiError('名称を入力してからAI下書きをお試しください', 400)
    }

    const text = await generateProfileCopyDraft({
      role,
      field,
      name,
      genreLabel,
      mainMenu,
      description,
      notes,
    })

    return apiOk({ text })
  } catch (error) {
    console.error('[onboarding/copy-assist POST]', error)
    return apiError(error instanceof Error ? error.message : 'AI下書きの作成に失敗しました')
  }
}
