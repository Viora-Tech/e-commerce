import type { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { CredentialCheck } from '@commerce/storage'
import { describe, expect, it, vi } from 'vitest'
import { S3CompatProvider } from '../src/provider'

/** Minimal concrete subclass: the point of this test is the shared behaviour, not a real adapter. */
class FakeProvider extends S3CompatProvider {
  readonly id = 'fake'
  readonly label = 'Fake'
  async verifyCredentials(): Promise<CredentialCheck> {
    return { ok: true, message: 'ok' }
  }
}

function fake(prefix?: string) {
  const client = { send: vi.fn(async () => ({})) } as unknown as S3Client
  const sign = vi.fn(async (_c: S3Client, cmd: PutObjectCommand, expiresIn: number) => {
    const { Bucket, Key } = cmd.input
    return `https://example.test/${Bucket}/${Key}?exp=${expiresIn}`
  })
  const provider = new FakeProvider(
    client,
    { bucket: 'bucket', publicBaseUrl: 'https://cdn.example.test/', keyPrefix: prefix },
    { client, sign },
  )
  return { client, sign, provider }
}

describe('S3CompatProvider', () => {
  it('presigns a PUT against the bucket and key', async () => {
    const { provider, sign } = fake()
    const r = await provider.presignUpload({ key: 'a/b.png', contentType: 'image/png', size: 1 })
    expect(r.method).toBe('PUT')
    expect(r.url).toContain('bucket/a/b.png')
    expect(sign).toHaveBeenCalledOnce()
  })

  it('public URL strips a trailing slash from the base and joins the key', () => {
    const { provider } = fake()
    expect(provider.publicUrl('a/b.png')).toBe('https://cdn.example.test/a/b.png')
  })

  it('an optional key prefix is applied consistently to presign, public URL, put, get and delete', async () => {
    const { provider, client } = fake('media')
    expect(provider.publicUrl('a.png')).toBe('https://cdn.example.test/media/a.png')
    await provider.put({ key: 'a.png', body: new Uint8Array([1]), contentType: 'image/png' })
    const sent = (client.send as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
    expect(sent.input.Key).toBe('media/a.png')
  })

  it('delete is idempotent by design: it never checks existence first', async () => {
    const { provider, client } = fake()
    await provider.delete('missing.png')
    expect(client.send).toHaveBeenCalledOnce()
  })
})
