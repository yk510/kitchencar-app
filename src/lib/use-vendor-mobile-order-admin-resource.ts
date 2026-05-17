'use client'

import { useCallback, useState } from 'react'
import { ApiClientError, fetchApi } from '@/lib/api-client'

type AdminHookOptions<T> = {
  endpoint: string
  initialData?: T | null
  initialLoading?: boolean
  errorMessage: string
}

export function useVendorMobileOrderAdminResource<T>({
  endpoint,
  initialData = null,
  initialLoading = false,
  errorMessage,
}: AdminHookOptions<T>) {
  const [data, setData] = useState<T | null>(initialData)
  const [loading, setLoading] = useState(initialLoading)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetchApi<T>(endpoint, { cache: 'no-store' })
      setData(response)
      setError(null)
      return response
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : errorMessage)
      setData(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [endpoint, errorMessage])

  return {
    data,
    setData,
    loading,
    error,
    setError,
    load,
  }
}
