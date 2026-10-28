import { useEffect, useRef, useState } from 'react'

/** A screen reader hears the live compass at most this often, so turning the phone is not a stream of numbers. */
export const ANNOUNCE_EVERY_MS = 3000

/**
 * The text for a polite live region that follows `text` at most once every
 * `intervalMs`, always settling on the latest text. A change of `urgency`
 * (coming into line with the Qibla, or leaving it) is passed on at once.
 */
export function useRestrainedText(text: string, urgency: string, intervalMs = ANNOUNCE_EVERY_MS): string {
  const [shown, setShown] = useState(text)
  const last = useRef({ at: -Infinity, urgency })

  useEffect(() => {
    if (text === shown) return
    const wait = last.current.urgency !== urgency ? 0 : Math.max(0, last.current.at + intervalMs - Date.now())
    const id = window.setTimeout(() => {
      last.current = { at: Date.now(), urgency }
      setShown(text)
    }, wait)
    return () => window.clearTimeout(id)
  }, [text, urgency, shown, intervalMs])

  return shown
}
