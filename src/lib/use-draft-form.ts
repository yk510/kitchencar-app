import { usePersistentDraft } from '@/lib/usePersistentDraft'

export function useDraftForm<T>(key: string, initialValue: T) {
  const draft = usePersistentDraft<T>(key, initialValue)

  return {
    form: draft.value,
    setForm: draft.setValue,
    hydrated: draft.hydrated,
    hasStoredDraft: draft.hasStoredDraft,
    clearDraft: draft.clearDraft,
  }
}
