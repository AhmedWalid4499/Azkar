import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as azkar from './index'
import { resetStores } from './testing/harness'

vi.mock('./data', async () => (await import('./testing/fixture')).createDataModule())
vi.mock('../prayer-times', () => ({ usePrayerDay: () => null }))

beforeEach(() => {
  resetStores()
})

describe('public surface', () => {
  it('exports what the Today and Settings pages import', () => {
    expect(Object.keys(azkar)).toEqual(
      expect.arrayContaining(['AzkarRoutes', 'AzkarSettingsSection', 'AzkarSourcesSection', 'AzkarTodayCards']),
    )
  })

  it('exports what the tracker page reads', () => {
    expect(Object.keys(azkar)).toEqual(
      expect.arrayContaining([
        'useDaySessions',
        'useSessionsInRange',
        'useAzkarStreaks',
        'useAzkarCompletionRate',
        'useAzkarLifetime',
        'useSessionRecord',
        'useAzkarProgress',
        'useCompletedLabel',
        'useTimeOfDay',
        'sessionsInRange',
        'computeAzkarStreaks',
        'azkarCompletionRate',
        'lifetimeTotals',
        'ratePercent',
        'sessionDateKey',
        'useAzkarClock',
        'COLLECTION_META',
        'collectionPath',
        'DAILY_COLLECTIONS',
        'availableCollections',
        'COLLECTION_IDS',
      ]),
    )
  })

  it('renders the Today cards and both settings sections side by side', () => {
    render(
      <MemoryRouter>
        <azkar.AzkarTodayCards />
        <azkar.AzkarSettingsSection />
        <azkar.AzkarSourcesSection />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Morning azkar' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Azkar reader' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Sources and credits' })).toBeInTheDocument()
  })
})
