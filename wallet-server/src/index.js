// The Azkar Wallet server. One endpoint, POST /v1/pass: the app sends the card's content (built on
// the iPhone, in the user's language), and gets back the signed card to add or replace in Wallet.
// The server keeps nothing. Secrets, set with `npx wrangler secret put`: PASS_CERTIFICATE,
// PASS_KEY, WWDR_CERTIFICATE, APP_KEY, TEAM_ID, and PASS_KEY_PASSWORD when the key has one.
// Plain setting, in wrangler.toml: PASS_TYPE_ID.

import { buildPass } from './sign.js'
import { IMAGES } from './images.js'

/** What the app may set; identity, signing and web-service fields always come from the server. */
const ALLOWED = ['description', 'logoText', 'foregroundColor', 'backgroundColor', 'labelColor', 'generic', 'relevantDates', 'relevantDate', 'locations']
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
    const serialNumber = typeof input.serialNumber === 'string' ? input.serialNumber : ''
    if (!/^[A-Za-z0-9-]{8,64}$/.test(serialNumber) || typeof input.pass !== 'object' || input.pass === null) {
      return text('Missing serialNumber or pass', 400)
    }

    const pass = { formatVersion: 1 }
    for (const key of ALLOWED) if (key in input.pass) pass[key] = input.pass[key]
    if (!pass.generic) return text('The pass needs generic fields', 400)
    Object.assign(pass, {
      passTypeIdentifier: env.PASS_TYPE_ID,
      teamIdentifier: env.TEAM_ID,
      serialNumber,
      organizationName: 'Azkar',
      description: pass.description || 'Azkar',
      sharingProhibited: true,
    })

    try {
      const file = buildPass(pass, IMAGES, {
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

const text = (body, status) => new Response(body, { status, headers: { 'content-type': 'text/plain' } })
