'use client'

import { useEffect, useRef, useState } from 'react'
import type { VendorMobileOrderListItem } from '@/types/api-payloads'

const NOTIFICATION_STORAGE_KEY = 'mobile-order-dashboard-notifications-enabled'
const NEW_ORDER_HIGHLIGHT_MS = 15000
const LAST_SEEN_ORDER_MARKER_KEY = 'mobile-order-dashboard-last-seen'

type LastSeenOrderMarker = {
  orderedAt: string
}

function getLastSeenMarkerStorageKey(storeId: string, scheduleId: string | null) {
  return `${LAST_SEEN_ORDER_MARKER_KEY}:${storeId}:${scheduleId ?? 'none'}`
}

function readLastSeenMarker(storeId: string, scheduleId: string | null): LastSeenOrderMarker | null {
  if (typeof window === 'undefined') return null

  const raw = window.localStorage.getItem(getLastSeenMarkerStorageKey(storeId, scheduleId))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<LastSeenOrderMarker>
    if (typeof parsed.orderedAt !== 'string' || !parsed.orderedAt) return null
    return { orderedAt: parsed.orderedAt }
  } catch {
    return null
  }
}

function writeLastSeenMarker(
  storeId: string,
  scheduleId: string | null,
  marker: LastSeenOrderMarker | null
) {
  if (typeof window === 'undefined') return

  const key = getLastSeenMarkerStorageKey(storeId, scheduleId)
  if (!marker) {
    window.localStorage.removeItem(key)
    return
  }

  window.localStorage.setItem(key, JSON.stringify(marker))
}

export function useOrderDashboardNotifications() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [notificationBanner, setNotificationBanner] = useState<string | null>(null)
  const [newOrderIds, setNewOrderIds] = useState<string[]>([])
  const knownOrderIdsRef = useRef<string[]>([])
  const knownScheduleIdRef = useRef<string | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const notificationBannerTimeoutRef = useRef<number | null>(null)
  const newOrderTimeoutsRef = useRef<Record<string, number>>({})

  function clearNotificationBannerLater() {
    if (notificationBannerTimeoutRef.current != null) {
      window.clearTimeout(notificationBannerTimeoutRef.current)
    }

    notificationBannerTimeoutRef.current = window.setTimeout(() => {
      setNotificationBanner(null)
    }, 7000)
  }

  function clearNewOrderHighlight(orderId: string) {
    setNewOrderIds((current) => current.filter((id) => id !== orderId))
    const timeoutId = newOrderTimeoutsRef.current[orderId]
    if (timeoutId != null) {
      window.clearTimeout(timeoutId)
      delete newOrderTimeoutsRef.current[orderId]
    }
  }

  function highlightNewOrders(orderIds: string[]) {
    if (orderIds.length === 0 || typeof window === 'undefined') return

    setNewOrderIds((current) => Array.from(new Set([...current, ...orderIds])))

    for (const orderId of orderIds) {
      const existingTimeout = newOrderTimeoutsRef.current[orderId]
      if (existingTimeout != null) {
        window.clearTimeout(existingTimeout)
      }

      newOrderTimeoutsRef.current[orderId] = window.setTimeout(() => {
        clearNewOrderHighlight(orderId)
      }, NEW_ORDER_HIGHLIGHT_MS)
    }
  }

  function playNotificationSound() {
    if (typeof window === 'undefined') return

    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return

    const audioContext = audioContextRef.current ?? new AudioContextCtor()
    audioContextRef.current = audioContext

    if (audioContext.state === 'suspended') {
      void audioContext.resume()
    }

    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    const now = audioContext.currentTime

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, now)
    oscillator.frequency.setValueAtTime(1174, now + 0.12)

    gainNode.gain.setValueAtTime(0.0001, now)
    gainNode.gain.exponentialRampToValueAtTime(0.14, now + 0.02)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.34)

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.start(now)
    oscillator.stop(now + 0.36)
  }

  function primeNotificationAudio() {
    if (typeof window === 'undefined') return

    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (AudioContextCtor) {
      const audioContext = audioContextRef.current ?? new AudioContextCtor()
      audioContextRef.current = audioContext

      if (audioContext.state === 'suspended') {
        void audioContext.resume().catch(() => undefined)
      }
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices()
    }
  }

  function speakNotification(messageToSpeak: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(messageToSpeak)
    utterance.lang = 'ja-JP'
    utterance.rate = 1
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
  }

  function announceNewOrders(
    newOrders: Array<Pick<VendorMobileOrderListItem, 'id' | 'ordered_at' | 'order_number'>>
  ) {
    if (newOrders.length === 0) return

    const newestOrder = [...newOrders].sort(
      (a, b) => new Date(b.ordered_at).getTime() - new Date(a.ordered_at).getTime()
    )[0]
    const bannerMessage =
      newOrders.length === 1
        ? `新しい注文 ${newestOrder.order_number} を受け付けました`
        : `新しい注文を ${newOrders.length} 件 受け付けました`

    setNotificationBanner(bannerMessage)
    clearNotificationBannerLater()
    playNotificationSound()
    speakNotification('注文を受け付けました')
  }

  async function enableNotifications() {
    try {
      primeNotificationAudio()
      playNotificationSound()
      speakNotification('通知を有効にしました')
      window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, 'true')
      setNotificationsEnabled(true)
      setNotificationBanner('新着注文の音声通知を有効にしました')
      clearNotificationBannerLater()
    } catch {
      setNotificationBanner('通知の有効化に失敗しました')
      clearNotificationBannerLater()
    }
  }

  function processIncomingOrders(
    storeId: string,
    responseScheduleId: string | null,
    incomingOrders: VendorMobileOrderListItem[]
  ) {
    const nextOrderIds = incomingOrders.map((order) => order.id)
    const isSameSchedule = knownScheduleIdRef.current === responseScheduleId
    const lastSeenMarker = readLastSeenMarker(storeId, responseScheduleId)
    const latestOrder = incomingOrders
      .slice()
      .sort((a, b) => new Date(b.ordered_at).getTime() - new Date(a.ordered_at).getTime())[0]

    const ordersSinceLastSeen =
      notificationsEnabled && lastSeenMarker
        ? incomingOrders.filter(
            (order) => new Date(order.ordered_at).getTime() > new Date(lastSeenMarker.orderedAt).getTime()
          )
        : []

    if (notificationsEnabled) {
      if (ordersSinceLastSeen.length > 0) {
        announceNewOrders(ordersSinceLastSeen)
        highlightNewOrders(ordersSinceLastSeen.map((order) => order.id))
      } else if (isSameSchedule && knownOrderIdsRef.current.length > 0) {
        const newOrders = incomingOrders.filter((order) => !knownOrderIdsRef.current.includes(order.id))
        if (newOrders.length > 0) {
          announceNewOrders(newOrders)
          highlightNewOrders(newOrders.map((order) => order.id))
        }
      }
    }

    knownScheduleIdRef.current = responseScheduleId
    knownOrderIdsRef.current = nextOrderIds
    writeLastSeenMarker(
      storeId,
      responseScheduleId,
      latestOrder ? { orderedAt: latestOrder.ordered_at } : null
    )
  }

  function resetForScheduleChange() {
    setNewOrderIds([])
    for (const timeoutId of Object.values(newOrderTimeoutsRef.current)) {
      window.clearTimeout(timeoutId)
    }
    newOrderTimeoutsRef.current = {}
  }

  useEffect(() => {
    const saved = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY)
    setNotificationsEnabled(saved === 'true')
  }, [])

  useEffect(() => {
    if (!notificationsEnabled) return

    primeNotificationAudio()

    const rearmAudio = () => {
      primeNotificationAudio()
    }

    window.addEventListener('pointerdown', rearmAudio, { passive: true })
    window.addEventListener('touchstart', rearmAudio, { passive: true })
    window.addEventListener('keydown', rearmAudio)
    window.addEventListener('focus', rearmAudio)

    return () => {
      window.removeEventListener('pointerdown', rearmAudio)
      window.removeEventListener('touchstart', rearmAudio)
      window.removeEventListener('keydown', rearmAudio)
      window.removeEventListener('focus', rearmAudio)
    }
  }, [notificationsEnabled])

  useEffect(() => {
    return () => {
      if (notificationBannerTimeoutRef.current != null) {
        window.clearTimeout(notificationBannerTimeoutRef.current)
      }

      for (const timeoutId of Object.values(newOrderTimeoutsRef.current)) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [])

  return {
    notificationsEnabled,
    notificationBanner,
    newOrderIds,
    clearNewOrderHighlight,
    enableNotifications,
    processIncomingOrders,
    resetForScheduleChange,
  }
}
