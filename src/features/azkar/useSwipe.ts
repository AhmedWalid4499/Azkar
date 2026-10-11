import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

export type SwipeDirection = 'left' | 'right'

const MIN_DISTANCE = 64
/** The gesture must be clearly sideways, not a diagonal scroll. */
const MIN_RATIO = 2
const MAX_DURATION_MS = 700
/** Leave the screen edges to the browser's own back and forward gestures. */
const EDGE_GUARD = 24

interface SwipeStart {
  pointerId: number
  x: number
  y: number
  at: number
}

interface SwipeHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: () => void
}

function hasSelection(): boolean {
  const selection = typeof window.getSelection === 'function' ? window.getSelection() : null
  return selection !== null && !selection.isCollapsed
}

/**
 * Horizontal swipes on a touch screen. The element needs `touch-action: pan-y
 * pinch-zoom` so the browser keeps vertical scrolling and zoom for itself and
 * hands sideways movement to us; once it starts scrolling it cancels the
 * pointer and no swipe is reported. Mouse drags are ignored so text can still
 * be selected.
 */
export function useSwipe(onSwipe: (direction: SwipeDirection) => void): SwipeHandlers {
  const start = useRef<SwipeStart | null>(null)

  return {
    onPointerDown: (event) => {
      start.current = null
      if (event.pointerType !== 'touch' || !event.isPrimary) return
      const width = window.innerWidth
      if (event.clientX < EDGE_GUARD || event.clientX > width - EDGE_GUARD) return
      start.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now() }
    },
    onPointerUp: (event) => {
      const from = start.current
      start.current = null
      if (!from || from.pointerId !== event.pointerId) return
      const dx = event.clientX - from.x
      const dy = event.clientY - from.y
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * MIN_RATIO) return
      if (performance.now() - from.at > MAX_DURATION_MS || hasSelection()) return
      onSwipe(dx < 0 ? 'left' : 'right')
    },
    onPointerCancel: () => {
      start.current = null
    },
  }
}
