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

  it('put sends the Cache-Control a media file gets, and none for other files', async () => {
    const { provider, client } = fake()
    const body = new Uint8Array([1])
    await provider.put({
      key: 'stores/s1/media/x-w640.webp',
      body,
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
    })
    await provider.put({ key: 'stores/s1/media/x.mp4', body, contentType: 'video/mp4' })
    await provider.put({ key: 'stores/s1/invoices/1.pdf', body, contentType: 'application/pdf' })
    const calls = (client.send as ReturnType<typeof vi.fn>).mock.calls
    expect(calls[0]?.[0].input.CacheControl).toBe('public, max-age=31536000, immutable')
    expect(calls[1]?.[0].input.CacheControl).toBe('public, max-age=31536000, immutable')
    expect(calls[2]?.[0].input.CacheControl).toBeUndefined()
  })

  it('put forwards the caller signal to the SDK, combined with the hard deadline', async () => {
    const { provider, client } = fake()
    const caller = new AbortController()
    await provider.put({
      key: 'a.png',
      body: new Uint8Array([1]),
      contentType: 'image/png',
      signal: caller.signal,
    })
    const opts = (client.send as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      abortSignal: AbortSignal
    }
    expect(opts.abortSignal.aborted).toBe(false)
    caller.abort()
    expect(opts.abortSignal.aborted).toBe(true)
  })

  it('every bucket call carries a deadline signal', async () => {
    const { provider, client } = fake()
    await provider.put({ key: 'a.png', body: new Uint8Array([1]), contentType: 'image/png' })
    await provider.delete('a.png')
    await provider.head('a.png')
    const calls = (client.send as ReturnType<typeof vi.fn>).mock.calls
    expect(calls.length).toBe(3)
    for (const call of calls)
      expect((call[1] as { abortSignal?: AbortSignal })?.abortSignal).toBeInstanceOf(AbortSignal)
  })

  it('delete is idempotent by design: it never checks existence first', async () => {
    const { provider, client } = fake()
    await provider.delete('missing.png')
    expect(client.send).toHaveBeenCalledOnce()
  })
})

describe('S3CompatProvider.deletePrefix', () => {
  it('lists the prefix page by page and deletes each page in one request', async () => {
    const pages = [
      {
        Contents: [{ Key: 'media/stores/s1/a.png' }, { Key: 'media/stores/s1/b.png' }],
        IsTruncated: true,
        NextContinuationToken: 't2',
      },
      { Contents: [{ Key: 'media/stores/s1/c.png' }], IsTruncated: false },
    ]
    const sent: { name: string; input: Record<string, unknown> }[] = []
    const client = {
      send: vi.fn(
        async (cmd: { constructor: { name: string }; input: Record<string, unknown> }) => {
          sent.push({ name: cmd.constructor.name, input: cmd.input })
          return cmd.constructor.name === 'ListObjectsV2Command' ? pages.shift() : {}
        },
      ),
    } as unknown as S3Client
    const provider = new FakeProvider(
      client,
      { bucket: 'bucket', publicBaseUrl: 'https://cdn.example.test', keyPrefix: 'media' },
      { client },
    )
    expect(await provider.deletePrefix('stores/s1/')).toBe(3)
    expect(sent.map((s) => s.name)).toEqual([
      'ListObjectsV2Command',
      'DeleteObjectsCommand',
      'ListObjectsV2Command',
      'DeleteObjectsCommand',
    ])
    // The deployment key prefix is applied once, and the second page follows the token.
    expect(sent[0]?.input.Prefix).toBe('media/stores/s1/')
    expect(sent[2]?.input.ContinuationToken).toBe('t2')
    expect(sent[1]?.input.Delete).toEqual({
      Objects: [{ Key: 'media/stores/s1/a.png' }, { Key: 'media/stores/s1/b.png' }],
      Quiet: true,
    })
  })

  it('refuses a prefix that is not a folder, so stores/ab never matches stores/abc', async () => {
    const { provider, client } = fake()
    await expect(provider.deletePrefix('stores/ab')).rejects.toThrow()
    await expect(provider.deletePrefix('/')).rejects.toThrow()
    expect(client.send).not.toHaveBeenCalled()
  })
})
