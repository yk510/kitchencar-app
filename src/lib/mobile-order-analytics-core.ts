import { resolveMobileOrderSource } from '@/lib/mobile-order-fields'

const JST_HOUR_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tokyo',
  hour: '2-digit',
  hour12: false,
})

export function toJstDate(value: string) {
  const date = new Date(value)
  const year = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
  }).format(date)
  const month = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
  }).format(date)
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    day: '2-digit',
  }).format(date)

  return `${year}-${month}-${day}`
}

export function toJstRangeStart(value: string) {
  return new Date(`${value}T00:00:00+09:00`).toISOString()
}

export function toJstRangeEnd(value: string) {
  return new Date(`${value}T23:59:59.999+09:00`).toISOString()
}

export function isCountableMobileOrder(order: {
  status: string
  payment_status: string
  payment_provider: string | null
  order_source?: string | null
}) {
  if (order.status === 'cancelled') return false

  const source = resolveMobileOrderSource(order)
  if (source === 'store_pos') {
    return order.payment_status === 'paid'
  }

  return ['paid', 'authorized'].includes(order.payment_status)
}

export function getJstHour(orderedAt: string) {
  return Number(JST_HOUR_FORMATTER.format(new Date(orderedAt)))
}

export function getDayOfWeekFromBusinessDate(businessDate: string) {
  return new Date(`${businessDate}T00:00:00+09:00`).getDay()
}
