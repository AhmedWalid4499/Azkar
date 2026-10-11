import { useCallback, useRef, useState } from 'react'
import { deviceTimeZone } from '../../../shared/date'
import { useI18n } from '../../../shared/i18n'
import { useLocationStore } from '../../../shared/location'
import type { SavedLocation } from '../../../shared/location'
import { LookupError, reverseGeocode } from './geocoding'
import type { LookupErrorCode } from './geocoding'
import { GeoError, requestPosition } from './geolocation'
import type { GeoErrorCode } from './geolocation'
import { coordinatesLabel, placeLabel } from './place'

export interface LocateState {
  /** `locating`: waiting for the device. `naming`: position saved, looking up its name. */
  status: 'idle' | 'locating' | 'naming'
  error: GeoErrorCode | null
  /** Set when the position was saved but could not be given a place name. */
  unnamed: LookupErrorCode | null
}

const IDLE: LocateState = { status: 'idle', error: null, unnamed: null }

/** Stored precision: about a hundred metres, far finer than prayer times need. */
function roundForStorage(value: number): number {
  return Math.round(value * 1000) / 1000
}

/** Roughly ten kilometres: the same town, so its name and country still apply. */
const SAME_PLACE_DEGREES = 0.1

function isSamePlace(a: SavedLocation, latitude: number, longitude: number): boolean {
  return Math.abs(a.latitude - latitude) < SAME_PLACE_DEGREES && Math.abs(a.longitude - longitude) < SAME_PLACE_DEGREES
}

/**
 * "Use my location": reads the device position, saves it at once so the times
 * work offline, then tries to put a name on it. Runs only when `locate` is called.
 */
export function useLocate(): LocateState & { locate: () => Promise<void>; dismiss: () => void } {
  const i18n = useI18n()
  const [state, setState] = useState<LocateState>(IDLE)
  // Bumped whenever a newer choice supersedes a request still in flight.
  const generation = useRef(0)

  /** Drops any message and abandons a request in progress, e.g. because a city was picked instead. */
  const dismiss = useCallback(() => {
    generation.current += 1
    setState(IDLE)
  }, [])

  const locate = useCallback(async () => {
    const mine = ++generation.current
    const superseded = () => mine !== generation.current
    setState({ status: 'locating', error: null, unnamed: null })

    let latitude: number
    let longitude: number
    try {
      const position = await requestPosition()
      latitude = roundForStorage(position.latitude)
      longitude = roundForStorage(position.longitude)
    } catch (error) {
      if (!superseded()) setState({ status: 'idle', error: error instanceof GeoError ? error.code : 'unavailable', unnamed: null })
      return
    }
    if (superseded()) return

    const store = useLocationStore.getState()
    const previous = store.location
    // An update from the same town keeps its name if the lookup below fails.
    const known =
      previous &&
      typeof previous.countryCode === 'string' &&
      typeof previous.label === 'string' &&
      previous.label !== '' &&
      isSamePlace(previous, latitude, longitude)
        ? previous
        : null
    const saved: SavedLocation = {
      latitude,
      longitude,
      timeZone: deviceTimeZone(),
      label: known ? known.label : coordinatesLabel(latitude, longitude, i18n),
      countryCode: known ? known.countryCode : null,
      source: 'gps',
      updatedAt: Date.now(),
    }
    store.setLocation(saved)
    setState({ status: 'naming', error: null, unnamed: null })

    let unnamed: LookupErrorCode | null = null
    try {
      const place = await reverseGeocode(latitude, longitude, i18n.lang)
      const label = place ? placeLabel(place.name, place.country, i18n.t) : ''
      // A city picked by hand while the lookup was in flight wins.
      if (place && useLocationStore.getState().location === saved) {
        store.setLocation({ ...saved, label: label || saved.label, countryCode: place.countryCode ?? saved.countryCode })
      }
      if (label === '' && !known) unnamed = 'failed'
    } catch (error) {
      if (!known) unnamed = error instanceof LookupError ? error.code : 'failed'
    }
    if (!superseded()) setState({ status: 'idle', error: null, unnamed })
  }, [i18n])

  return { ...state, locate, dismiss }
}
