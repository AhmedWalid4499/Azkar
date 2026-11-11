// Signs a sample card with throwaway certificates made by OpenSSL, then checks the result:
// the files are there, each hash matches, the signature verifies over manifest.json, and the
// request handler refuses what it should. Run: npm test
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { unzipSync, strFromU8 } from 'fflate'
import worker from '../src/index.js'

const dir = mkdtempSync(join(tmpdir(), 'azkar-wallet-'))
const ssl = (...args) => execFileSync('openssl', args, { cwd: dir, stdio: 'pipe' })
ssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem', '-subj', '/CN=Test WWDR', '-days', '2')
ssl('req', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'pass.key', '-out', 'pass.csr', '-subj', '/CN=Pass Type ID: pass.test')
ssl('x509', '-req', '-in', 'pass.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'pass.pem', '-days', '2')
const read = (name) => readFileSync(join(dir, name), 'utf8')
const env = {
  PASS_TYPE_ID: 'pass.test', TEAM_ID: 'TEAM123456', APP_KEY: 'k',
  PASS_CERTIFICATE: read('pass.pem'), PASS_KEY: read('pass.key'), WWDR_CERTIFICATE: read('ca.pem'),
}
let failures = 0
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failures++ }

const card = { serialNumber: 'abcdef12-3456', pass: { description: 'Today', generic: { primaryFields: [{ key: 'p', label: 'Prayed', value: '3/5' }] }, webServiceURL: 'https://evil.example' } }
const request = (body, key = 'k', method = 'POST') => new Request('https://w.example/v1/pass', { method, headers: { 'x-azkar-key': key }, body: method === 'POST' ? JSON.stringify(body) : undefined })

const response = await worker.fetch(request(card), env)
check(response.status === 200 && response.headers.get('content-type') === 'application/vnd.apple.pkpass', 'a card is signed and returned')
const files = unzipSync(new Uint8Array(await response.arrayBuffer()))
check(['pass.json', 'manifest.json', 'signature', 'icon.png', 'icon@2x.png', 'logo.png'].every((f) => f in files), 'it holds pass.json, the manifest, the signature and the images')
const pass = JSON.parse(strFromU8(files['pass.json']))
check(pass.passTypeIdentifier === 'pass.test' && pass.teamIdentifier === 'TEAM123456' && pass.serialNumber === 'abcdef12-3456', 'identity comes from the server')
check(!('webServiceURL' in pass) && pass.sharingProhibited === true && pass.formatVersion === 1, 'fields the app may not set are dropped')
check(pass.barcodes?.[0]?.format === 'PKBarcodeFormatQR' && pass.barcodes[0].message.endsWith('/get.html') && pass.barcodes[0].altText === 'Scan to get Azkar', 'the QR code leads to the app page')
const manifest = JSON.parse(strFromU8(files['manifest.json']))
check(Object.entries(manifest).every(([name, hash]) => createHash('sha1').update(files[name]).digest('hex') === hash), 'every hash in the manifest matches its file')
writeFileSync(join(dir, 'manifest.json'), files['manifest.json'])
writeFileSync(join(dir, 'signature'), files['signature'])
let verified = true
try { ssl('cms', '-verify', '-binary', '-inform', 'DER', '-in', 'signature', '-content', 'manifest.json', '-CAfile', 'ca.pem', '-purpose', 'any', '-out', '/dev/null') } catch { verified = false }
check(verified, 'the signature verifies over manifest.json with the certificate chain')

check(!('thumbnail@2x.png' in files), 'a card without a ring (builds before 5) has no thumbnail')
const ringed = unzipSync(new Uint8Array(await (await worker.fetch(request({ ...card, ring: '10110' }), env)).arrayBuffer()))
check(['thumbnail.png', 'thumbnail@2x.png', 'thumbnail@3x.png', 'logo@3x.png'].every((f) => f in ringed) && JSON.parse(strFromU8(ringed['manifest.json']))['thumbnail@3x.png'], 'a ring adds the thumbnail, listed in the manifest')
const odd = unzipSync(new Uint8Array(await (await worker.fetch(request({ ...card, ring: '../../x' }), env)).arrayBuffer()))
check(!('thumbnail@2x.png' in odd), 'an unknown ring is ignored')

const tricky = { serialNumber: 'abcdef12-3456', pass: { locations: [{ latitude: 1, longitude: 2 }], generic: { primaryFields: [{ key: 'p', value: '1', attributedValue: '<a href="https://evil.example">x</a>', label: 'L' }, { key: 'q' }] } } }
const cleaned = JSON.parse(strFromU8(unzipSync(new Uint8Array(await (await worker.fetch(request(tricky), env)).arrayBuffer()))['pass.json']))
check(cleaned.barcodes.length === 1 && cleaned.barcodes[0].message.endsWith('/get.html'), 'the app cannot change where the QR code leads')
check(!('locations' in cleaned) && cleaned.generic.primaryFields.length === 1 && !('attributedValue' in cleaned.generic.primaryFields[0]), 'only plain text fields are signed')
check((await worker.fetch(new Request('https://w.example/v1/pass', { method: 'POST', headers: { 'x-azkar-key': 'k' }, body: 'null' }), env)).status === 400, 'a body of null is refused')

check((await worker.fetch(request(card, 'wrong'), env)).status === 401, 'a wrong app key is refused')
check((await worker.fetch(request({ ...card, serialNumber: '../x' }), env)).status === 400, 'a bad serial number is refused')
check((await worker.fetch(request(card, 'k', 'GET'), env)).status === 405, 'GET is refused')
check((await worker.fetch(request({ serialNumber: 'abcdef12-3456', pass: {} }), env)).status === 400, 'a card without fields is refused')

if (failures) { console.log(`${failures} failed`); process.exit(1) }
console.log('all passed')
