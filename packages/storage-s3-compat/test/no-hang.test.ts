/**
 * Writes against a local HTTP server standing in for the bucket (no R2, no network):
 * a copy whose download misbehaves, or a bucket that never answers, must end in an
 * error, never wait forever.
 */
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { CredentialCheck } from '@commerce/storage'
import { afterEach, describe, expect, it } from 'vitest'
import { makeS3CompatClient, type S3CompatClientConfig } from '../src/client'
import { S3CompatProvider } from '../src/provider'

class LocalProvider extends S3CompatProvider {
  readonly id = 'local'
  readonly label = 'Local'
  async verifyCredentials(): Promise<CredentialCheck> {
    return { ok: true, message: 'ok' }
  }
}

type Received = { method: string; url: string; headers: IncomingMessage['headers']; body: Buffer }

let server: Server | null = null
afterEach(async () => {
  server?.closeAllConnections()
  await new Promise((r) => server?.close(r) ?? r(null))
  server = null
})

/** A bucket that records each request; `answer: false` reads the body and never responds. */
async function bucket(answer = true, timeouts?: S3CompatClientConfig['timeouts']) {
  const received: Received[] = []
  server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      received.push({
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body: Buffer.concat(chunks),
      })
      if (answer) res.writeHead(200, { etag: '"e"' }).end()
    })
  })
  await new Promise<void>((r) => server?.listen(0, '127.0.0.1', r))
  const { port } = server.address() as AddressInfo
  const client = makeS3CompatClient({
    region: 'auto',
    accessKeyId: 'AKIDEXAMPLE',
    secretAccessKey: 'test-only-secret',
    endpoint: `http://127.0.0.1:${port}`,
    forcePathStyle: true,
    maxAttempts: 1,
    ...(timeouts ? { timeouts } : {}),
  })
  const provider = new LocalProvider(client, {
    bucket: 'b',
    publicBaseUrl: 'https://cdn.example.test',
  })
  return { provider, received }
}

function streamOf(chunks: Uint8Array[], fail?: Error): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(c)
      if (fail) controller.error(fail)
      else controller.close()
    },
  })
}

describe('S3-compatible writes never hang', () => {
  it('putStream sends the bytes it was given with their real length, whatever the source said', async () => {
    const { provider, received } = await bucket()
    // What fetch hands over for a gzip response: more bytes than its content-length said.
    const bytes = new Uint8Array(3000).fill(7)
    await provider.putStream({
      key: 'v.mp4',
      body: streamOf([bytes.subarray(0, 1000), bytes.subarray(1000)]),
      contentType: 'video/mp4',
    })
    const put = received.find((r) => r.method === 'PUT')
    expect(put?.url).toContain('/b/v.mp4')
    expect(put?.headers['content-length']).toBe('3000')
    expect(put?.body.byteLength).toBe(3000)
  })

  it('putStream rejects when the download breaks part way, instead of waiting for bytes that never come', async () => {
    const { provider } = await bucket()
    const broken = streamOf([new Uint8Array(10)], new Error('the download was cut off'))
    await expect(
      provider.putStream({ key: 'v.mp4', body: broken, contentType: 'video/mp4' }),
    ).rejects.toThrow(/cut off/)
  })

  it('putStream stops when its signal aborts, even if the download never sends another byte', async () => {
    const { provider } = await bucket()
    const stalled = new ReadableStream<Uint8Array>({ pull: () => new Promise(() => {}) })
    const signal = AbortSignal.timeout(50)
    await expect(
      provider.putStream({ key: 'v.mp4', body: stalled, contentType: 'video/mp4', signal }),
    ).rejects.toThrow()
  })

  it('a bucket that never answers fails the write after the request timeout', async () => {
    const { provider } = await bucket(false, { requestTimeout: 200 })
    const started = Date.now()
    await expect(
      provider.put({ key: 'a.png', body: new Uint8Array([1, 2, 3]), contentType: 'image/png' }),
    ).rejects.toThrow(/requestTimeout|timed out|timeout/i)
    expect(Date.now() - started).toBeLessThan(5000)
  })

  it('put gives up when the caller aborts', async () => {
    const { provider } = await bucket(false)
    const signal = AbortSignal.timeout(100)
    await expect(
      provider.put({
        key: 'a.png',
        body: new Uint8Array([1, 2, 3]),
        contentType: 'image/png',
        signal,
      }),
    ).rejects.toThrow()
  })
})
