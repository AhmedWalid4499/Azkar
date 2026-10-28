import { useEffect, useState } from 'react'
import { haptic } from '../../native'
import { nextAligned } from './heading'

/**
 * Whether the phone faces the Qibla, given how far it still has to turn (null
 * without a live compass). Each time it comes into line the phone gives a
 * single haptic; holding it there, or wavering within the margin, gives no more.
 */
export function useAlignment(turn: number | null): boolean {
  const [aligned, setAligned] = useState(false)
  const next = turn === null ? false : nextAligned(aligned, turn)
  // Adjusting state while rendering: alignment depends on whether it was aligned before.
  if (next !== aligned) setAligned(next)

  useEffect(() => {
    if (aligned) haptic('done')
  }, [aligned])

  return next
}
