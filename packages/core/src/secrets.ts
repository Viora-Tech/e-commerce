import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/**
 * AES-256-GCM for secrets at rest (gateway keys in store settings, gift card
 * codes, import connection tokens). Keys are derived from a passphrase
 * (SETTINGS_SECRET) so any string works in dev.
 *
 * Formats:
 *  - `v1.<iv>.<tag>.<ct>` (legacy, no key id — always tried against the
 *    current key, then each previous key in order).
 *  - `v2.<keyId>.<iv>.<tag>.<ct>` (current) — `keyId` is the first 8 hex
 *    characters of sha256(key), so decryption can pick the right key out of
 *    the keyring without brute-forcing every candidate.
 *
 * Rotation: set `SETTINGS_SECRET_PREVIOUS` to the old value(s)
 * (comma-separated) alongside a new `SETTINGS_SECRET`. New writes use the new
 * key; old ciphertext keeps decrypting via the previous keys until
 * `scripts/rotate-secrets.ts --apply` re-encrypts it.
 */

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest()
}

/** First 8 hex chars of sha256(key) — identifies which keyring entry encrypted a v2 blob. */
export function keyId(secret: string): string {
  return deriveKey(secret).toString('hex').slice(0, 8)
}

/** `SETTINGS_SECRET_PREVIOUS` (comma-separated) -> a clean list, current key excluded/deduped by caller. */
export function parsePreviousSecrets(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function gcmDecrypt(key: Buffer, ivB64: string, tagB64: string, ctB64: string): string {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

/** Encrypts under the CURRENT key only. Always writes the current `v2` format. */
export function encryptSecret(plain: string, secret: string): string {
  const key = deriveKey(secret)
  const id = keyId(secret)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    'v2',
    id,
    iv.toString('base64url'),
    tag.toString('base64url'),
    enc.toString('base64url'),
  ].join('.')
}

/**
 * Decrypts `v1` or `v2` blobs. `previousSecrets` is the rotation keyring
 * (`SETTINGS_SECRET_PREVIOUS`, parsed) tried after the current key when a v2
 * blob's key id doesn't match the current key, or for any v1 blob.
 */
export function decryptSecret(
  blob: string,
  secret: string,
  previousSecrets: string[] = [],
): string {
  const parts = blob.split('.')
  const version = parts[0]

  if (version === 'v2') {
    const [, kid, iv, tag, enc] = parts
    if (!kid || !iv || !tag || !enc) throw new Error('unrecognised secret format')
    const candidates = [secret, ...previousSecrets]
    const match = candidates.find((s) => keyId(s) === kid)
    if (match) return gcmDecrypt(deriveKey(match), iv, tag, enc)
    // Key id didn't match anything in the keyring; try them all anyway (auth will fail cleanly).
    for (const s of candidates) {
      try {
        return gcmDecrypt(deriveKey(s), iv, tag, enc)
      } catch {
        // try next
      }
    }
    throw new Error('unable to decrypt: no matching key in keyring')
  }

  if (version === 'v1') {
    const [, iv, tag, enc] = parts
    if (!iv || !tag || !enc) throw new Error('unrecognised secret format')
    for (const s of [secret, ...previousSecrets]) {
      try {
        return gcmDecrypt(deriveKey(s), iv, tag, enc)
      } catch {
        // try next key in the ring
      }
    }
    throw new Error('unable to decrypt: no matching key in keyring')
  }

  throw new Error('unrecognised secret format')
}

export const isEncrypted = (v: unknown): v is string =>
  typeof v === 'string' && (v.startsWith('v1.') || v.startsWith('v2.'))

/** True only for the current-format (`v2`) blobs — used by the rotation script to find stale ciphertext. */
export const isLegacyEncrypted = (v: unknown): v is string =>
  typeof v === 'string' && v.startsWith('v1.')
