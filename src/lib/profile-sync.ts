const PROFILE_UPDATED_EVENT = 'profile-updated'

export function notifyProfileUpdated() {
  if (typeof window === 'undefined') return

  const detail = { at: Date.now() }
  window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail }))
  window.localStorage.setItem(PROFILE_UPDATED_EVENT, String(detail.at))
}

export function subscribeProfileUpdated(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handleCustomEvent = () => callback()
  const handleStorage = (event: StorageEvent) => {
    if (event.key === PROFILE_UPDATED_EVENT) {
      callback()
    }
  }
  const handleFocus = () => callback()

  window.addEventListener(PROFILE_UPDATED_EVENT, handleCustomEvent)
  window.addEventListener('storage', handleStorage)
  window.addEventListener('focus', handleFocus)

  return () => {
    window.removeEventListener(PROFILE_UPDATED_EVENT, handleCustomEvent)
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener('focus', handleFocus)
  }
}
