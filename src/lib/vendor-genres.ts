export const VENDOR_GENRE_OPTIONS = [
  { value: 'curry', label: 'カレー' },
  { value: 'rice_bowl', label: '丼・ごはんもの' },
  { value: 'burger', label: 'バーガー・サンド' },
  { value: 'hot_snack', label: '揚げ物・軽食' },
  { value: 'noodle', label: '麺類' },
  { value: 'asian', label: 'アジアン・エスニック' },
  { value: 'meat', label: '肉料理・グリル' },
  { value: 'sweets', label: 'スイーツ' },
  { value: 'drink', label: 'ドリンク' },
  { value: 'bakery', label: 'パン・焼き菓子' },
  { value: 'other', label: 'その他' },
] as const

export type VendorGenre = (typeof VENDOR_GENRE_OPTIONS)[number]['value']

const genreLabelMap = new Map<string, string>(VENDOR_GENRE_OPTIONS.map((item) => [item.value, item.label]))

export function getVendorGenreLabel(value: string | null | undefined) {
  if (!value) return '未設定'
  return genreLabelMap.get(value) ?? value
}
