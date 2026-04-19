import { useState } from 'react'

export function useSubmissionFeedback<TMessage = string>() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<TMessage | null>(null)

  function start() {
    setPending(true)
    setError(null)
    setMessage(null)
  }

  function succeed(nextMessage?: TMessage | null) {
    setPending(false)
    setMessage(nextMessage ?? null)
  }

  function fail(nextError: string) {
    setPending(false)
    setError(nextError)
  }

  function stop() {
    setPending(false)
  }

  function reset() {
    setError(null)
    setMessage(null)
  }

  return {
    pending,
    error,
    message,
    setError,
    setMessage,
    start,
    succeed,
    fail,
    stop,
    reset,
  }
}
