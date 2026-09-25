import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  BACKUP_CHUNK_SIZE,
  backupKeyId,
  decryptBackup,
  encryptBackup,
  isEncryptedBackup,
} from '../src/crypto'

const KEY = 'test-only-backup-encryption-key'
const OTHER_KEY = 'a-completely-different-key-value'

describe('encryptBackup / decryptBackup', () => {
  it('round-trips a small plaintext', () => {
    const plain = Buffer.from('a small pg_dump.gz stand-in')
    const encrypted = encryptBackup(plain, KEY)
    expect(isEncryptedBackup(encrypted)).toBe(true)
    const result = decryptBackup(encrypted, KEY)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plain.equals(plain)).toBe(true)
  })

  it('round-trips a plaintext spanning multiple chunks', () => {
    const plain = randomBytes(BACKUP_CHUNK_SIZE * 2 + 137)
    const encrypted = encryptBackup(plain, KEY)
    const result = decryptBackup(encrypted, KEY)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plain.equals(plain)).toBe(true)
  })

  it('round-trips an empty plaintext', () => {
    const encrypted = encryptBackup(Buffer.alloc(0), KEY)
    const result = decryptBackup(encrypted, KEY)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plain.length).toBe(0)
  })

  it('fails cleanly with the wrong key', () => {
    const encrypted = encryptBackup(Buffer.from('secret archive bytes'), KEY)
    const result = decryptBackup(encrypted, OTHER_KEY)
    expect(result).toEqual({ ok: false, reason: 'wrong-key-or-corrupt' })
  })

  it('reports plain (unencrypted) data as such rather than throwing', () => {
    const plain = Buffer.from('this is a plain gzip, not our format')
    expect(isEncryptedBackup(plain)).toBe(false)
    const result = decryptBackup(plain, KEY)
    expect(result).toEqual({ ok: false, reason: 'not-encrypted' })
  })

  it('detects tampering (auth tag) rather than returning corrupted plaintext', () => {
    const encrypted = encryptBackup(Buffer.from('do not tamper with me'), KEY)
    const tampered = Buffer.from(encrypted)
    tampered[tampered.length - 1] = tampered[(tampered.length - 1) as number] ^ 0xff
    const result = decryptBackup(tampered, KEY)
    expect(result.ok).toBe(false)
  })

  it('keyId is stable for a given key and differs across keys', () => {
    expect(backupKeyId(KEY)).toBe(backupKeyId(KEY))
    expect(backupKeyId(KEY)).not.toBe(backupKeyId(OTHER_KEY))
  })
})
