const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const

export function getWeekdayIndex(date: string) {
  return new Date(`${date}T00:00:00+09:00`).getDay()
}

export function getWeekdayLabel(date: string) {
  return WEEKDAY_LABELS[getWeekdayIndex(date)] ?? ''
}

export function getDefaultHolidayFlag(date: string) {
  const weekday = getWeekdayIndex(date)
  if (weekday === 0) return '日曜'
  if (weekday === 6) return '土曜'
  return ''
}

export function getHolidayFlagTone(flag: string | null | undefined) {
  if (!flag) return 'text-gray-500 bg-white'
  if (flag.includes('祝')) return 'text-rose-700 bg-rose-50'
  if (flag.includes('日')) return 'text-rose-700 bg-rose-50'
  if (flag.includes('土')) return 'text-sky-700 bg-sky-50'
  return 'text-amber-700 bg-amber-50'
}
