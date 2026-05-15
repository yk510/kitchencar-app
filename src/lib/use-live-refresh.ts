'use client'

import { useEffect, useRef } from 'react'

type UseLiveRefreshOptions = {
  enabled?: boolean
  intervalMs?: number | null
  refreshOnFocus?: boolean
  refreshOnVisible?: boolean
  minGapMs?: number
  run: () => void | Promise<void>
}

export function useLiveRefresh({
  enabled = true,
  intervalMs = null,
  refreshOnFocus = true,
  refreshOnVisible = true,
  minGapMs = 1200,
  run,
}: UseLiveRefreshOptions) {
  const runRef = useRef(run)
  const lastRunAtRef = useRef(0)

  useEffect(() => {
    runRef.current = run
  }, [run])

  useEffect(() => {
    if (!enabled) return

    function runSafely(force = false) {
      const now = Date.now()
      if (!force && now - lastRunAtRef.current < minGapMs) {
        return
      }

      lastRunAtRef.current = now
      void runRef.current()
    }

    const intervalId =
      intervalMs != null
        ? window.setInterval(() => {
            runSafely()
          }, intervalMs)
        : null

    function handleVisibilityChange() {
      if (!refreshOnVisible) return
      if (document.visibilityState !== 'visible') return
      runSafely()
    }

    function handleFocus() {
      if (!refreshOnFocus) return
      runSafely()
    }

    if (refreshOnVisible) {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    if (refreshOnFocus) {
      window.addEventListener('focus', handleFocus)
    }

    return () => {
      if (intervalId != null) {
        window.clearInterval(intervalId)
      }

      if (refreshOnVisible) {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }

      if (refreshOnFocus) {
        window.removeEventListener('focus', handleFocus)
      }
    }
  }, [enabled, intervalMs, minGapMs, refreshOnFocus, refreshOnVisible])
}
