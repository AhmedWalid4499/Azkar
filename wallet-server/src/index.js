// The Azkar Wallet server. One endpoint, POST /v1/pass: the app sends the card's content (built on
// the iPhone, in the user's language), and gets back the signed card to add or replace in Wallet.
// The server keeps nothing. Secrets, set with `npx wrangler secret put`: PASS_CERTIFICATE,
// PASS_KEY, WWDR_CERTIFICATE, APP_KEY, TEAM_ID, and PASS_KEY_PASSWORD when the key has one.
// Plain setting, in wrangler.toml: PASS_TYPE_ID.

import { buildPass } from './sign.js'
import { IMAGES } from './images.js'
import { LOGO, RINGS } from './art.js'

/** What the app may set; identity, signing and web-service fields always come from the server. */
const ALLOWED = ['description', 'logoText', 'foregroundColor', 'backgroundColor', 'labelColor', 'generic', 'relevantDates', 'relevantDate']
/** The rows of a generic card, and what each field may carry. */
const SECTIONS = ['headerFields', 'primaryFields', 'secondaryFields', 'auxiliaryFields', 'backFields']
const FIELD_KEYS = ['key', 'label', 'value', 'textAlignment']
const MAX_TEXT = 400
/** Where the card's QR code leads: a page about the app, which sends people to the App Store once it is there. */
const GET_URL = 'https://ahmedwalid4499.github.io/Azkar/get.html'
const MAX_BODY = 32 * 1024

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname !== '/v1/pass') return text('Not found', 404)
    if (request.method !== 'POST') return text('Use POST', 405)
    // Not a secret from a determined person (it ships in the app), but it keeps strangers off.
    if (!env.APP_KEY || request.headers.get('x-azkar-key') !== env.APP_KEY) return text('Not allowed', 401)

    const body = await request.text()
    if (body.length > MAX_BODY) return text('Too large', 413)
    let input
    try {
      input = JSON.parse(body)
    } catch {
      return text('Not JSON', 400)
    }
    if (typeof input !== 'object' || input === null) return text('Not an object', 400)
    const serialNumber = typeof input.serialNumber === 'string' ? input.serialNumber : ''
    if (!/^[A-Za-z0-9-]{8,64}$/.test(serialNumber) || typeof input.pass !== 'object' || input.pass === null) {
      return text('Missing serialNumber or pass', 400)
    }

    const pass = { formatVersion: 1 }
    for (const key of ALLOWED) if (key in input.pass) pass[key] = input.pass[key]
    pass.generic = cleanFields(pass.generic)
    if (!pass.generic) return text('The pass needs generic fields', 400)
    for (const key of ['description', 'logoText', 'foregroundColor', 'backgroundColor', 'labelColor', 'relevantDate']) {
      if (key in pass && (typeof pass[key] !== 'string' || pass[key].length > MAX_TEXT)) delete pass[key]
    }
    if ('relevantDates' in pass && !Array.isArray(pass.relevantDates)) delete pass.relevantDates
    Object.assign(pass, {
      passTypeIdentifier: env.PASS_TYPE_ID,
      teamIdentifier: env.TEAM_ID,
      serialNumber,
      organizationName: 'Azkar',
      description: pass.description || 'Azkar',
      sharingProhibited: true,
    })
    // The QR code fills the bottom of the card; the app sends its caption in the card's language.
    const qrText = typeof input.qrText === 'string' && input.qrText.length <= 60 ? input.qrText : 'Scan to get Azkar'
    pass.barcodes = [{ format: 'PKBarcodeFormatQR', message: GET_URL, messageEncoding: 'iso-8859-1', altText: qrText }]

    // The ring of the prayers logged, Fajr first ("10110"), beside "Prayed today". Builds before
    // build 5 send none, and their card has no ring.
    const images = { ...IMAGES, ...LOGO }
    const ring = typeof input.ring === 'string' && /^[01]{5}$/.test(input.ring) ? RINGS[input.ring] : undefined
    if (ring) Object.assign(images, { 'thumbnail.png': ring[0], 'thumbnail@2x.png': ring[0], 'thumbnail@3x.png': ring[1] })

    try {
      const file = buildPass(pass, images, {
        certificate: env.PASS_CERTIFICATE,
        key: env.PASS_KEY,
        keyPassword: env.PASS_KEY_PASSWORD,
        wwdr: env.WWDR_CERTIFICATE,
      })
      return new Response(file, {
        headers: { 'content-type': 'application/vnd.apple.pkpass', 'cache-control': 'no-store' },
      })
    } catch (error) {
      console.error('signing failed', error)
      return text('Signing failed', 500)
    }
  },
}

/** Keeps only the card's rows and plain text fields, so the key in the app can't be used to sign anything else. */
function cleanFields(generic) {
  if (typeof generic !== 'object' || generic === null) return undefined
  const clean = {}
  for (const section of SECTIONS) {
    if (!Array.isArray(generic[section])) continue
    clean[section] = generic[section].slice(0, 10).flatMap((field) => {
      if (typeof field !== 'object' || field === null || typeof field.key !== 'string') return []
      const kept = {}
      for (const key of FIELD_KEYS) {
        if (typeof field[key] === 'string' && field[key].length <= MAX_TEXT) kept[key] = field[key]
      }
      return 'value' in kept ? [kept] : []
    })
  }
  return Object.keys(clean).length ? clean : undefined
}

const text = (body, status) => new Response(body, { status, headers: { 'content-type': 'text/plain' } })
