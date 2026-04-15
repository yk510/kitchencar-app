import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { geocodeAddress } from '@/lib/geocode'

function normalizeMunicipality(address: string) {
  const trimmed = address.trim().replace(/\s+/g, '')

  const fullMatch = trimmed.match(/^.*?[都道府県].*?[市区町村]/)
  if (fullMatch) return fullMatch[0]

  const fallbackMatch = trimmed.match(/^.*?[市区町村]/)
  return fallbackMatch ? fallbackMatch[0] : trimmed
}

// GET: 場所一覧
export async function GET() {
  const { data, error } = await (supabase as any)
    .from('locations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// POST: 新規場所登録
export async function POST(req: NextRequest) {
  try {
    const { name, address } = await req.json()

    if (!name || !address) {
      return NextResponse.json({ error: '場所名と住所は必須です' }, { status: 400 })
    }

    const trimmedName = String(name).trim()
    const normalizedAddress = normalizeMunicipality(String(address))

    if (!trimmedName || !normalizedAddress) {
      return NextResponse.json({ error: '場所名と住所は必須です' }, { status: 400 })
    }

    const geo = await geocodeAddress(normalizedAddress)
    if (!geo) {
      return NextResponse.json(
        { error: '住所から座標を取得できませんでした。市町村までの住所で入力してください。' },
        { status: 422 }
      )
    }

    const { data: location, error: locErr } = await (supabase as any)
      .from('locations')
      .upsert(
        [
          {
            name: trimmedName,
            address: normalizedAddress,
            latitude: geo.latitude,
            longitude: geo.longitude,
          },
        ],
        { onConflict: 'name,address' }
      )
      .select()
      .single()

    if (locErr) {
      return NextResponse.json({ error: locErr.message }, { status: 500 })
    }

    return NextResponse.json({
      location,
      geocoded: geo.displayName,
    })
  } catch (e) {
    console.error('[locations POST]', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}