import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  LookupError,
  parseReverseResponse,
  parseSearchResponse,
  reverseGeocode,
  roundCoordinate,
  searchCities,
} from './geocoding'

// Trimmed from a real Open-Meteo response for "Cairo".
const SEARCH_RESPONSE = {
  results: [
    {
      id: 360630,
      name: 'Cairo',
      latitude: 30.06263,
      longitude: 31.24967,
      elevation: 23,
      feature_code: 'PPLC',
      country_code: 'EG',
      timezone: 'Africa/Cairo',
      country: 'Egypt',
      admin1: 'Cairo Governorate',
    },
    {
      id: 4234985,
      name: 'Cairo',
      latitude: 37.00533,
      longitude: -89.17646,
      country_code: 'US',
      timezone: 'America/Chicago',
      country: 'United States',
      admin1: 'Illinois',
      admin2: 'Alexander',
    },
  ],
  generationtime_ms: 0.2,
}

// Trimmed from a real BigDataCloud response.
const REVERSE_RESPONSE = {
  latitude: 30.06,
  longitude: 31.25,
  countryName: 'Egypt',
  countryCode: 'EG',
  principalSubdivision: 'Al Qahirah',
  city: 'Cairo',
  locality: 'Bab ash Shariyah',
}

function stubFetch(body: unknown, init: { ok?: boolean } = {}) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: init.ok ?? true,
    json: async () => body,
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function requestedUrl(fetchMock: ReturnType<typeof stubFetch>, call = 0): URL {
  return new URL(fetchMock.mock.calls[call]?.[0] ?? '')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('parseSearchResponse', () => {
  it('reads name, region, country, coordinates, zone and country code', () => {
    expect(parseSearchResponse(SEARCH_RESPONSE)).toEqual([
      {
        id: '360630',
        name: 'Cairo',
        region: 'Cairo Governorate',
        country: 'Egypt',
        countryCode: 'EG',
        latitude: 30.06263,
        longitude: 31.24967,
        timeZone: 'Africa/Cairo',
      },
      {
        id: '4234985',
        name: 'Cairo',
        region: 'Illinois',
        country: 'United States',
        countryCode: 'US',
        latitude: 37.00533,
        longitude: -89.17646,
        timeZone: 'America/Chicago',
      },
    ])
  })

  it('returns nothing for responses of the wrong shape', () => {
    // Open-Meteo omits `results` entirely when nothing matches.
    for (const body of [{ generationtime_ms: 0.5 }, null, undefined, 'oops', 42, [], { results: null }, { results: 'x' }, { results: {} }]) {
      expect(parseSearchResponse(body)).toEqual([])
    }
  })

  it('drops entries it cannot use and keeps the rest', () => {
    const good = SEARCH_RESPONSE.results[0]
    const parsed = parseSearchResponse({
      results: [
        null,
        'Cairo',
        { ...good, id: 1, name: '' },
        { ...good, id: 2, name: 123 },
        { ...good, id: 3, latitude: '30.06' },
        { ...good, id: 4, latitude: 91 },
        { ...good, id: 5, longitude: -181 },
        { ...good, id: 6, longitude: Number.NaN },
        { ...good, id: 7, timezone: 'Mars/Olympus_Mons' },
        { ...good, id: 8, timezone: undefined },
        { ...good, id: 9 },
      ],
    })
    expect(parsed.map((city) => city.id)).toEqual(['9'])
  })

  it('tolerates missing or malformed optional fields', () => {
    const [city] = parseSearchResponse({
      results: [{ name: '  Makkah  ', latitude: 21.42, longitude: 39.82, timezone: 'Asia/Riyadh', country_code: 'sau', admin1: 7 }],
    })
    expect(city).toEqual({
      id: '21.42,39.82',
      name: 'Makkah',
      region: '',
      country: '',
      countryCode: null,
      latitude: 21.42,
      longitude: 39.82,
      timeZone: 'Asia/Riyadh',
    })
    const lower = parseSearchResponse({ results: [{ ...SEARCH_RESPONSE.results[0], country_code: 'eg' }] })
    expect(lower[0]?.countryCode).toBe('EG')
  })

  it('caps the list, removes duplicates and trims absurdly long names', () => {
    const base = SEARCH_RESPONSE.results[0]
    const many = Array.from({ length: 30 }, (_, index) => ({ ...base, id: index % 12, name: 'x'.repeat(500) }))
    const parsed = parseSearchResponse({ results: many })
    expect(parsed).toHaveLength(8)
    expect(new Set(parsed.map((city) => city.id)).size).toBe(8)
    expect(parsed[0]?.name).toHaveLength(80)
  })
})

describe('parseReverseResponse', () => {
  it('prefers the city, then the locality, then the subdivision', () => {
    expect(parseReverseResponse(REVERSE_RESPONSE)).toEqual({ name: 'Cairo', country: 'Egypt', countryCode: 'EG' })
    expect(parseReverseResponse({ ...REVERSE_RESPONSE, city: '' })?.name).toBe('Bab ash Shariyah')
    expect(parseReverseResponse({ ...REVERSE_RESPONSE, city: '', locality: null })?.name).toBe('Al Qahirah')
  })

  it('normalises the country code and refuses malformed ones', () => {
    expect(parseReverseResponse({ ...REVERSE_RESPONSE, countryCode: 'eg' })?.countryCode).toBe('EG')
    for (const countryCode of ['EGY', '', 20, null, 'E1']) {
      expect(parseReverseResponse({ ...REVERSE_RESPONSE, countryCode })?.countryCode).toBeNull()
    }
  })

  it('is null when the response names nothing', () => {
    // BigDataCloud answers like this over open ocean.
    expect(parseReverseResponse({ latitude: 0, longitude: 0, city: '', locality: '', countryName: '', countryCode: '' })).toBeNull()
    for (const body of [null, undefined, 'x', 3, [], {}]) expect(parseReverseResponse(body)).toBeNull()
  })

  it('still gives the country when there is no place name', () => {
    expect(parseReverseResponse({ countryName: 'Egypt', countryCode: 'EG' })).toEqual({
      name: '',
      country: 'Egypt',
      countryCode: 'EG',
    })
  })
})

describe('searchCities', () => {
  it('asks Open-Meteo for up to eight matches in the interface language', async () => {
    const fetchMock = stubFetch(SEARCH_RESPONSE)
    const cities = await searchCities('  القاهرة ', 'ar')
    expect(cities).toHaveLength(2)
    const url = requestedUrl(fetchMock)
    expect(url.origin + url.pathname).toBe('https://geocoding-api.open-meteo.com/v1/search')
    expect(Object.fromEntries(url.searchParams)).toEqual({ name: 'القاهرة', count: '8', language: 'ar', format: 'json' })
  })

  it('does not call the network for fewer than two characters', async () => {
    const fetchMock = stubFetch(SEARCH_RESPONSE)
    expect(await searchCities('c', 'en')).toEqual([])
    expect(await searchCities('   ', 'en')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports a failed lookup for HTTP errors, network errors and unreadable bodies', async () => {
    stubFetch({ error: true, reason: 'bad request' }, { ok: false })
    await expect(searchCities('Cairo', 'en')).rejects.toMatchObject({ name: 'LookupError', code: 'failed' })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(searchCities('Cairo', 'en')).rejects.toBeInstanceOf(LookupError)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => JSON.parse('<html>') }))
    await expect(searchCities('Cairo', 'en')).rejects.toMatchObject({ code: 'failed' })
  })

  it('says so when the device is offline, without trying', async () => {
    const fetchMock = stubFetch(SEARCH_RESPONSE)
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await expect(searchCities('Cairo', 'en')).rejects.toMatchObject({ code: 'offline' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cancels the request when the caller aborts', async () => {
    const seen: AbortSignal[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            const signal = init?.signal as AbortSignal
            seen.push(signal)
            signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
          }),
      ),
    )
    const controller = new AbortController()
    const pending = searchCities('Cairo', 'en', controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(seen[0]?.aborted).toBe(true)
  })

  it('gives up on a request that never answers', async () => {
    vi.useFakeTimers()
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          (_url: string, init?: RequestInit) =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
            }),
        ),
      )
      const pending = searchCities('Cairo', 'en')
      const outcome = expect(pending).rejects.toMatchObject({ name: 'LookupError', code: 'failed' })
      await vi.advanceTimersByTimeAsync(10_000)
      await outcome
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('reverseGeocode', () => {
  it('sends coordinates rounded to two decimals and nothing more precise', async () => {
    const fetchMock = stubFetch(REVERSE_RESPONSE)
    const place = await reverseGeocode(30.044419, 31.235711, 'en')
    expect(place).toEqual({ name: 'Cairo', country: 'Egypt', countryCode: 'EG' })

    const url = requestedUrl(fetchMock)
    expect(url.origin + url.pathname).toBe('https://api.bigdatacloud.net/data/reverse-geocode-client')
    expect(Object.fromEntries(url.searchParams)).toEqual({ latitude: '30.04', longitude: '31.24', localityLanguage: 'en' })
    expect(url.href).not.toContain('30.044')
    expect(url.href).not.toContain('31.235')
  })

  it('rounds negative coordinates the same way', async () => {
    const fetchMock = stubFetch(REVERSE_RESPONSE)
    await reverseGeocode(-33.868832, -151.209351, 'ar')
    expect(Object.fromEntries(requestedUrl(fetchMock).searchParams)).toEqual({
      latitude: '-33.87',
      longitude: '-151.21',
      localityLanguage: 'ar',
    })
    expect(roundCoordinate(-0.004)).toBe(-0)
    expect(roundCoordinate(21.4225)).toBe(21.42)
  })
})
