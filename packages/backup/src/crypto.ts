import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/**
 * Encrypts backup archives (the pg_dump and uploads .tar.gz `scripts/backup-db.ts`
 * writes) with AES-256-GCM, under `BACKUP_ENCRYPTION_KEY` — deliberately a *different*
 * secret from `SETTINGS_SECRET` (`packages/core/src/secrets.ts`), so a leaked app
 * secret can't also open the backups.
 *
 * No dependency on `@commerce/core` on purpose (see this package's description) —
 * the key derivation and format are duplicated, not shared, so this stays a small,
 * standalone, dependency-free module.
 *
 * Format (all integers big-endian):
 *   magic      4 bytes    "CMBK"
 *   version    1 byte     0x01
 *   keyId      4 bytes    ascii, first 4 hex chars of sha256(key)
 *   chunkSize  4 bytes    uint32, plaintext bytes per chunk
 *   chunks...  each: [4-byte ciphertext length][12-byte iv][16-byte tag][ciphertext]
 *
 * Chunked (not one GCM call over the whole archive) so a multi-hundred-MB dump
 * doesn't need a single giant ciphertext buffer held alongside the plaintext, and so
 * a truncated/corrupt tail chunk fails on its own auth tag rather than the whole file.
 */

export const BACKUP_MAGIC = 'CMBK'
export const BACKUP_FORMAT_VERSION = 1
export const BACKUP_CHUNK_SIZE = 4 * 1024 * 1024 // 4 MiB plaintext per chunk
const HEADER_LEN = 4 + 1 + 4 + 4
const IV_LEN = 12
const TAG_LEN = 16

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest()
}

/** First 4 hex chars of sha256(key) — enough to tell "wrong key" apart from "corrupt file". */
export function backupKeyId(secret: string): string {
  return deriveKey(secret).toString('hex').slice(0, 4)
}

export function isEncryptedBackup(data: Buffer): boolean {
  return data.length >= HEADER_LEN && data.subarray(0, 4).toString('ascii') === BACKUP_MAGIC
}

export function encryptBackup(plain: Buffer, secret: string): Buffer {
  const key = deriveKey(secret)
  const kid = backupKeyId(secret)
  const parts: Buffer[] = []

  const header = Buffer.alloc(HEADER_LEN)
  header.write(BACKUP_MAGIC, 0, 'ascii')
  header.writeUInt8(BACKUP_FORMAT_VERSION, 4)
  header.write(kid, 5, 'ascii')
  header.writeUInt32BE(BACKUP_CHUNK_SIZE, 9)
  parts.push(header)

  for (let offset = 0; offset < plain.length; offset += BACKUP_CHUNK_SIZE) {
    const chunk = plain.subarray(offset, offset + BACKUP_CHUNK_SIZE)
    const iv = randomBytes(IV_LEN)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const ct = Buffer.concat([cipher.update(chunk), cipher.final()])
    const tag = cipher.getAuthTag()
    const lenPrefix = Buffer.alloc(4)
    lenPrefix.writeUInt32BE(ct.length, 0)
    parts.push(lenPrefix, iv, tag, ct)
  }
  // An empty archive still needs a decryptable (zero-chunk) file.
  return Buffer.concat(parts)
}

export type DecryptResult =
  | { ok: true; plain: Buffer }
  | { ok: false; reason: 'not-encrypted' | 'unsupported-version' | 'wrong-key-or-corrupt' }

export function decryptBackup(data: Buffer, secret: string): DecryptResult {
  if (!isEncryptedBackup(data)) return { ok: false, reason: 'not-encrypted' }
  const version = data.readUInt8(4)
  if (version !== BACKUP_FORMAT_VERSION) return { ok: false, reason: 'unsupported-version' }
  const kid = data.subarray(5, 9).toString('ascii')
  const chunkSize = data.readUInt32BE(9)
  if (kid !== backupKeyId(secret)) return { ok: false, reason: 'wrong-key-or-corrupt' }

  const key = deriveKey(secret)
  const out: Buffer[] = []
  let offset = HEADER_LEN
  try {
    while (offset < data.length) {
      const ctLen = data.readUInt32BE(offset)
      offset += 4
      const iv = data.subarray(offset, offset + IV_LEN)
      offset += IV_LEN
      const tag = data.subarray(offset, offset + TAG_LEN)
      offset += TAG_LEN
      const ct = data.subarray(offset, offset + ctLen)
      offset += ctLen
      const decipher = createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(tag)
      out.push(Buffer.concat([decipher.update(ct), decipher.final()]))
    }
  } catch {
    return { ok: false, reason: 'wrong-key-or-corrupt' }
  }
  void chunkSize // informational only; chunk boundaries are self-describing via the length prefix
  return { ok: true, plain: Buffer.concat(out) }
}
