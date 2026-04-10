// ============================================================
// Nominatim（OpenStreetMap）ジオコーディング
// APIキー不要・無料
// ============================================================

export interface GeocodedLocation {
  latitude: number
  longitude: number
  displayName: string
}

export async function geocodeAddress(address: string): Promise<GeocodedLocation | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q',       address)
    url.searchParams.set('format',  'json')
    url.searchParams.set('limit',   '1')
    url.searchParams.set('countrycodes', 'jp')  // 日本に絞る

    const res = await fetch(url.toString(), {
      headers: {
        // Nominatim利用規約でUser-Agentの設定が必要
        'User-Agent': 'kitchencar-app/1.0',
      },
    })
    if (!res.ok) return null

    const json = await res.json()
    if (!json || json.length === 0) return null

    return {
      latitude:    parseFloat(json[0].lat),
      longitude:   parseFloat(json[0].lon),
      displayName: json[0].display_name,
    }
  } catch {
    return null
  }
}
