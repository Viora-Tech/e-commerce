import { HeadBucketCommand, type PutObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import { describeStorageProvider } from '@commerce/storage/testing'
import { describe, expect, it, vi } from 'vitest'
import { R2StorageProvider, r2Endpoint, r2Factory } from '../src/r2'

const config = {
  accountId: 'acct',
  accessKeyId: 'ak',
  secretAccessKey: 'sk',
  bucket: 'waimers-media',
  publicBaseUrl: 'https://pub-123.r2.dev/',
}

/** A client whose `send` answers from a script; the presigner is stubbed to echo the command. */
function fake(send: (cmd: unknown) => Promise<unknown> = async () => ({})) {
  const client = { send: vi.fn(send) } as unknown as S3Client
  const sign = vi.fn(async (_c: S3Client, cmd: PutObjectCommand, expiresIn: number) => {
    const { Bucket, Key, ContentType, ContentLength } = cmd.input
    return `https://${Bucket}.acct.r2.cloudflarestorage.com/${Key}?ct=${ContentType}&len=${ContentLength}&exp=${expiresIn}`
  })
  return { client, sign, provider: new R2StorageProvider(config, { client, sign }) }
}

describe('R2StorageProvider', () => {
  it('presigns a PUT pinned to key, content type and size', async () => {
    const { provider, sign } = fake()
    const r = await provider.presignUpload({
      key: 'stores/s/media/x.png',
      contentType: 'image/png',
      size: 42,
    })
    expect(r.method).toBe('PUT')
    expect(r.url).toContain('stores/s/media/x.png')
    expect(r.url).toContain('ct=image/png')
    expect(r.url).toContain('len=42')
    expect(r.headers['content-type']).toBe('image/png')
    expect(sign).toHaveBeenCalledOnce()
  })

  it('public URLs come from the public base, never the S3 endpoint', () => {
    const { provider } = fake()
    expect(provider.publicUrl('stores/s/media/x.png')).toBe(
      'https://pub-123.r2.dev/stores/s/media/x.png',
    )
    expect(r2Endpoint('acct')).toBe('https://acct.r2.cloudflarestorage.com')
  })

  it('delete sends DeleteObject and verify uses HeadBucket', async () => {
    const { provider, client } = fake()
    await provider.delete('k')
    const r = await provider.verifyCredentials()
    expect(r.ok).toBe(true)
    const sent = (client.send as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])
    expect(sent[1]).toBeInstanceOf(HeadBucketCommand)
  })

  it('maps auth and missing-bucket failures to actionable messages', async () => {
    const notFound = fake(async () => {
      const e = new Error('nope')
      e.name = 'NotFound'
      throw e
    })
    expect((await notFound.provider.verifyCredentials()).message).toContain('does not exist')
    const badKey = fake(async () => {
      const e = new Error('nope')
      e.name = 'InvalidAccessKeyId'
      throw e
    })
    expect((await badKey.provider.verifyCredentials()).message).toContain('access key')
  })

  it('factory validates required fields and the public URL scheme', () => {
    expect(r2Factory.validateConfig({ ...config, publicBaseUrl: 'pub.r2.dev' })).toMatchObject({
      ok: false,
    })
    expect(r2Factory.validateConfig({ ...config, bucket: '' })).toMatchObject({ ok: false })
    expect(r2Factory.validateConfig({ ...config, accountId: 'a'.repeat(32) }).ok).toBe(true)
  })

  it('refuses an account id that would move the endpoint to another host', () => {
    for (const accountId of ['acct', 'evil.example#', 'evil.example/', '10.0.0.5:8443/x?']) {
      expect(r2Factory.validateConfig({ ...config, accountId }).ok, accountId).toBe(false)
    }
  })
})

describeStorageProvider('r2', { create: () => fake().provider })
