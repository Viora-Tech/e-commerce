import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/**
 * AES-256-GCM for secrets at rest (gateway keys in store settings). The key is
 * derived from SETTINGS_SECRET so any string works in dev; rotate by
 * re-encrypting. Output format: v1.<iv>.<tag>.<ciphertext>, all base64url.
 */
export function encryptSecret(plain: string, secret: string): string {
  const key = createHash('sha256').update(secret).digest()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    enc.toString('base64url'),
  ].join('.')
}

export function decryptSecret(blob: string, secret: string): string {
  const [v, iv, tag, enc] = blob.split('.')
  if (v !== 'v1' || !iv || !tag || !enc) throw new Error('unrecognised secret format')
  const key = createHash('sha256').update(secret).digest()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(enc, 'base64url')), decipher.final()]).toString(
    'utf8',
  )
}

export const isEncrypted = (v: unknown): v is string => typeof v === 'string' && v.startsWith('v1.')
