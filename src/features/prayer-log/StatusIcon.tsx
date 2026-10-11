import { Check, History, Minus, Users, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PrayerStatus } from './types'

const ICONS: Record<PrayerStatus, LucideIcon> = {
  ontime: Check,
  jamaah: Users,
  late: History,
  missed: X,
  excused: Minus,
}

interface StatusIconProps {
  status: PrayerStatus
  size?: number
}

/** The glyph for a status. Decorative: the status is always named in text alongside it. */
export function StatusIcon({ status, size = 18 }: StatusIconProps) {
  const Icon = ICONS[status]
  return <Icon aria-hidden size={size} strokeWidth={2.4} />
}
