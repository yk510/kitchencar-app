export const BRAND_NAME = 'クリダス!!'
export const BRAND_NAME_LATIN = 'KURIDAS!!'
export const BRAND_CONCEPT = '作業者を経営者に変えるキッチンカーOS'
export const BRAND_STAGE = 'Alpha'
export const BRAND_STAGE_LABEL = 'アルファ版'

export function getWorkspaceLabel(role: 'vendor' | 'organizer' | null | undefined) {
  return role === 'organizer' ? 'ORGANIZER WORKSPACE' : 'VENDOR WORKSPACE'
}

export function getBoardTitle(role: 'vendor' | 'organizer' | null | undefined) {
  return role === 'organizer' ? '主催者ワークスペース' : 'ベンダーワークスペース'
}
