import type { StringKey } from '../../shared/i18n'
import type { SessionStatus } from './session'

export const STATE_LABEL: Record<SessionStatus, StringKey> = {
  idle: 'azkar.state.start',
  active: 'azkar.state.continue',
  complete: 'azkar.state.completed',
}
