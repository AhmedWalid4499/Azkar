import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppPlatform } from './platform'

const native = vi.hoisted(() => ({
  platform: 'ios' as AppPlatform,
  registered: [] as string[],
  publish: vi.fn(async (_options: { json: string }) => {}),
  takePendingActions: vi.fn(async (): Promise<{ actions?: unknown }> => ({ actions: [] })),
}))

vi.mock('@capacitor/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@capacitor/core')>()),
  registerPlugin: (name: string) => {
    native.registered.push(name)
    return { publish: native.publish, takePendingActions: native.takePendingActions }
  },
}))
vi.mock('./platform', () => ({
  appPlatform: () => native.platform,
  isNativeApp: () => native.platform !== 'web',
}))

const { hasNativeWidgets, publishWidgetSnapshot, takeWidgetActions } = await import('./index')

const tap = (id: string, at: number) => ({ id, date: '2026-10-12', prayer: 'asr', status: 'ontime', at })

beforeEach(() => {
  native.platform = 'ios'
})

it('talks to the plugin by the name the iOS app registers it under', () => {
  // ios/App/App/AzkarWidgetPlugin.swift: jsName = "AzkarWidget"
  expect(native.registered).toEqual(['AzkarWidget'])
})

describe('outside the iOS app', () => {
  it.each(['web', 'android'] as const)('does nothing on %s', async (platform) => {
    native.platform = platform
    expect(hasNativeWidgets()).toBe(false)
    expect(await publishWidgetSnapshot('{}')).toBe(false)
    expect(await takeWidgetActions()).toEqual([])
    expect(native.publish).not.toHaveBeenCalled()
    expect(native.takePendingActions).not.toHaveBeenCalled()
  })
})

describe('publishWidgetSnapshot', () => {
  it('hands the JSON to the widgets as it is', async () => {
    expect(hasNativeWidgets()).toBe(true)
    expect(await publishWidgetSnapshot('{"version":1}')).toBe(true)
    expect(native.publish).toHaveBeenCalledWith({ json: '{"version":1}' })
  })

  it('reports a refusal instead of throwing', async () => {
    native.publish.mockRejectedValueOnce(new Error('The snapshot could not be read.'))
    expect(await publishWidgetSnapshot('{')).toBe(false)
  })
})

describe('takeWidgetActions', () => {
  it('returns the taps oldest first', async () => {
    native.takePendingActions.mockResolvedValueOnce({ actions: [tap('b', 2_000), tap('a', 1_000)] })
    expect(await takeWidgetActions()).toEqual([tap('a', 1_000), tap('b', 2_000)])
  })

  it('leaves out anything not shaped like a tap', async () => {
    native.takePendingActions.mockResolvedValueOnce({
      actions: [
        tap('ok', 1_000),
        null,
        'asr',
        { ...tap('no time', 1_000), at: '1000' },
        { ...tap('endless', 1_000), at: Number.POSITIVE_INFINITY },
        { ...tap('no prayer', 1_000), prayer: undefined },
        { ...tap('numeric date', 1_000), date: 20261012 },
      ],
    })
    expect(await takeWidgetActions()).toEqual([tap('ok', 1_000)])
  })

  it('returns nothing for an answer without a list, or a failure', async () => {
    native.takePendingActions.mockResolvedValueOnce({})
    expect(await takeWidgetActions()).toEqual([])
    native.takePendingActions.mockResolvedValueOnce({ actions: { 0: tap('a', 1) } })
    expect(await takeWidgetActions()).toEqual([])
    native.takePendingActions.mockRejectedValueOnce(new Error('App Group unavailable'))
    expect(await takeWidgetActions()).toEqual([])
  })
})
