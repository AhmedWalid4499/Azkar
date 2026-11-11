// Builds and signs an Apple Wallet pass (.pkpass): pass.json, the images, manifest.json with each
// file's SHA-1, and a detached PKCS #7 signature of the manifest made with the Pass Type ID
// certificate, Apple's WWDR intermediate certificate included, as Apple's "Building a pass" describes.

import forge from 'node-forge'
import { zipSync, strToU8 } from 'fflate'

const sha1 = (bytes) => {
  const md = forge.md.sha1.create()
  md.update(forge.util.binary.raw.encode(bytes))
  return md.digest().toHex()
}

const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

/**
 * @param {object} pass        the complete pass.json
 * @param {Record<string,string>} images  file name -> base64 PNG
 * @param {{ certificate: string, key: string, keyPassword?: string, wwdr: string }} signing  PEM texts
 * @returns {Uint8Array} the .pkpass file
 */
export function buildPass(pass, images, signing) {
  const files = { 'pass.json': strToU8(JSON.stringify(pass)) }
  for (const [name, base64] of Object.entries(images)) files[name] = fromBase64(base64)

  const manifest = {}
  for (const [name, bytes] of Object.entries(files)) manifest[name] = sha1(bytes)
  const manifestBytes = strToU8(JSON.stringify(manifest))

  const certificate = forge.pki.certificateFromPem(signing.certificate)
  const wwdr = forge.pki.certificateFromPem(signing.wwdr)
  const key = signing.keyPassword
    ? forge.pki.decryptRsaPrivateKey(signing.key, signing.keyPassword)
    : forge.pki.privateKeyFromPem(signing.key)
  if (!key) throw new Error('the pass key could not be read')

  const p7 = forge.pkcs7.createSignedData()
  p7.content = forge.util.createBuffer(forge.util.binary.raw.encode(manifestBytes))
  p7.addCertificate(certificate)
  p7.addCertificate(wwdr)
  p7.addSigner({
    key,
    certificate,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  })
  p7.sign({ detached: true })
  const signature = forge.util.binary.raw.decode(forge.asn1.toDer(p7.toAsn1()).getBytes())

  return zipSync({ ...files, 'manifest.json': manifestBytes, signature }, { level: 6 })
}
