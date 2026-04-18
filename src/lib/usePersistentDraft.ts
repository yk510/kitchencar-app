'use client'

import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react'

export function usePersistentDraft<T>(storageKey: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue)
  const [hydrated, setHydrated] = useState(false)
  const [hasStoredDraft, setHasStoredDraft] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw) {
        setValue(JSON.parse(raw) as T)
        setHasStoredDraft(true)
      }
    } catch {
      // 壊れた下書きは無視して初期値へ戻す
    } finally {
      setHydrated(true)
    }
  }, [storageKey])

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value))
    } catch {
      // 保存失敗時も画面操作は止めない
    }
  }, [hydrated, storageKey, value])

  const clearDraft = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey)
    }
    setHasStoredDraft(false)
  }, [storageKey])

  return {
    value,
    setValue: setValue as Dispatch<SetStateAction<T>>,
    hydrated,
    hasStoredDraft,
    clearDraft,
  }
}
