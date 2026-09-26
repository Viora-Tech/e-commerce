import { HeadObjectCommand, type PutObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import { describeStorageProvider } from '@commerce/storage/testing'
import { describe, expect, it, vi } from 'vitest'
import { defaultS3PublicBaseUrl, S3StorageProvider, s3Factory } from '../src/s3'

const config = {
  accessKeyId: 'AKIAFAKE',
  secretAccessKey: 'sk-fake',
  region: 'ap-south-1',
  bucket: 'waimers-media',
}

/** A client whose `send` answers from a script; the presigner is stubbed to echo the command.
 *  Never touches the network — no test here calls real AWS. */
function fake(send: (cmd: unknown) => Promise<unknown> = async () => ({})) {
  const client = { send: vi.fn(send) } as unknown as S3Client
  const sign = vi.fn(async (_c: S3Client, cmd: PutObjectCommand, expiresIn: number) => {
    const { Bucket, Key, ContentType, ContentLength } = cmd.input
    return `https://${Bucket}.s3.ap-south-1.amazonaws.com/${Key}?ct=${ContentType}&len=${ContentLength}&exp=${expiresIn}`
  })
  return { client, sign, provider: new S3StorageProvider(config, { client, sign }) }
}

describe('S3StorageProvider', () => {
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

  it("defaults the public URL to the bucket's virtual-hosted-style S3 URL", () => {
    const { provider } = fake()
    expect(provider.publicUrl('stores/s/media/x.png')).toBe(
      'https://waimers-media.s3.ap-south-1.amazonaws.com/stores/s/media/x.png',
    )
    expect(defaultS3PublicBaseUrl('waimers-media', 'ap-south-1')).toBe(
      'https://waimers-media.s3.ap-south-1.amazonaws.com',
    )
  })

  it('a CloudFront domain overrides the default public URL', () => {
    const cdn = new S3StorageProvider({ ...config, publicBaseUrl: 'https://cdn.example.com/' })
    expect(cdn.publicUrl('a.png')).toBe('https://cdn.example.com/a.png')
  })

  it('a path prefix is applied to the public URL and every object key', async () => {
    const client = { send: vi.fn(async () => ({})) } as unknown as S3Client
    const provider = new S3StorageProvider({ ...config, pathPrefix: 'waimers' }, { client })
    expect(provider.publicUrl('a.png')).toBe(
      'https://waimers-media.s3.ap-south-1.amazonaws.com/waimers/a.png',
    )
    await provider.put({ key: 'a.png', body: new Uint8Array([1]), contentType: 'image/png' })
    const sent = (client.send as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as PutObjectCommand
    expect(sent.input.Key).toBe('waimers/a.png')
  })

  it('verifyCredentials puts, heads and deletes a tiny test object, then reports success', async () => {
    const calls: string[] = []
    const { provider, client } = fake(async (cmd) => {
      calls.push((cmd as { constructor: { name: string } }).constructor.name)
      return {}
    })
    const r = await provider.verifyCredentials()
    expect(r.ok).toBe(true)
    expect(r.message).toContain('Put, head and delete all worked')
    expect(calls).toEqual(['PutObjectCommand', 'HeadObjectCommand', 'DeleteObjectCommand'])
    expect(client.send).toHaveBeenCalledTimes(3)
  })

  it('verifyCredentials still deletes the test object when the head check fails', async () => {
    const calls: string[] = []
    const { provider } = fake(async (cmd) => {
      const name = (cmd as { constructor: { name: string } }).constructor.name
      calls.push(name)
      if (cmd instanceof HeadObjectCommand)
        throw Object.assign(new Error('nope'), { name: 'AccessDenied' })
      return {}
    })
    const r = await provider.verifyCredentials()
    expect(r.ok).toBe(false)
    expect(calls).toEqual(['PutObjectCommand', 'HeadObjectCommand', 'DeleteObjectCommand'])
  })

  it('maps common AWS errors to actionable messages', async () => {
    const invalidKey = fake(async () => {
      const e = new Error('nope')
      e.name = 'InvalidAccessKeyId'
      throw e
    })
    expect((await invalidKey.provider.verifyCredentials()).message).toContain('access key ID')

    const badSecret = fake(async () => {
      const e = new Error('nope')
      e.name = 'SignatureDoesNotMatch'
      throw e
    })
    expect((await badSecret.provider.verifyCredentials()).message).toContain('secret access key')

    const denied = fake(async () => {
      const e = new Error('nope')
      e.name = 'AccessDenied'
      throw e
    })
    expect((await denied.provider.verifyCredentials()).message).toContain('IAM policy')

    const noBucket = fake(async () => {
      const e = new Error('nope')
      e.name = 'NoSuchBucket'
      throw e
    })
    expect((await noBucket.provider.verifyCredentials()).message).toContain('does not exist')

    const wrongRegion = fake(async () => {
      const e = new Error('nope')
      e.name = 'PermanentRedirect'
      throw e
    })
    expect((await wrongRegion.provider.verifyCredentials()).message).toContain('not in the region')
  })

  it('factory validates required fields and the optional public URL scheme', () => {
    expect(s3Factory.validateConfig({ ...config, bucket: '' })).toMatchObject({ ok: false })
    expect(s3Factory.validateConfig(config).ok).toBe(true)
    expect(s3Factory.validateConfig({ ...config, publicBaseUrl: 'cdn.example.com' })).toMatchObject(
      { ok: false },
    )
    expect(
      s3Factory.validateConfig({ ...config, publicBaseUrl: 'https://cdn.example.com' }).ok,
    ).toBe(true)
  })

  it('factory trims a leading/trailing slash from an optional path prefix', () => {
    const r = s3Factory.validateConfig({ ...config, pathPrefix: '/waimers/' })
    expect(r.ok && r.config.pathPrefix).toBe('waimers')
  })
})

describeStorageProvider('s3', { create: () => fake().provider })
