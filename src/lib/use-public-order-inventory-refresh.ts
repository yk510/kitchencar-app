'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchApi } from '@/lib/api-client'
import { applyInventorySnapshotToPayload } from '@/lib/public-mobile-order-data'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import type {
  PublicMobileOrderInventorySnapshot,
  PublicMobileOrderPagePayload,
} from '@/types/api-payloads'

type UsePublicOrderInventoryRefreshArgs = {
  data: PublicMobileOrderPagePayload
  enabled?: boolean
  intervalMs?: number
}

export function usePublicOrderInventoryRefresh({
  data,
  enabled = true,
  intervalMs = 15000,
}: UsePublicOrderInventoryRefreshArgs) {
  const [pageData, setPageData] = useState<PublicMobileOrderPagePayload>(data)
  const [inventoryRefreshing, setInventoryRefreshing] = useState(!data.inventoryHydrated)

  useEffect(() => {
    setPageData(data)
    setInventoryRefreshing(!data.inventoryHydrated)
  }, [data])

  const refreshInventory = useCallback(async () => {
    try {
      const snapshot = await fetchApi<PublicMobileOrderInventorySnapshot>(
        `/api/public/mobile-order/${pageData.orderPage.public_token}/inventory`,
        { cache: 'no-store' }
      )
      setPageData((current) => applyInventorySnapshotToPayload(current, snapshot))
    } catch {
      // Keep current snapshot if inventory refresh fails.
    } finally {
      setInventoryRefreshing(false)
    }
  }, [pageData.orderPage.public_token])

  useEffect(() => {
    if (pageData.inventoryHydrated) return
    setInventoryRefreshing(true)
    void refreshInventory()
  }, [pageData.inventoryHydrated, refreshInventory])

  useLiveRefresh({
    enabled,
    intervalMs,
    run: async () => {
      await refreshInventory()
    },
  })

  return {
    pageData,
    inventoryRefreshing,
    refreshInventory,
  }
}
