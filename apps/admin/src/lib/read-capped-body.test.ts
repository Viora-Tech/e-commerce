import { describe, expect, it } from 'vitest'
import { readCappedBody } from './read-capped-body'

function streamed(chunks: number[]): Request {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const size of chunks) controller.enqueue(new Uint8Array(size))
      controller.close()
    },
  })
  return new Request('http://x.test/api/uploads', {
    method: 'PUT',
    body,
    duplex: 'half',
  } as RequestInit)
}

describe('readCappedBody', () => {
  it('reads a body under the cap', async () => {
    const r = await readCappedBody(new Request('http://x.test', { method: 'PUT', body: 'abc' }), 10)
    expect(r.ok && r.bytes.byteLength).toBe(3)
  })

  it('refuses on the declared length before reading', async () => {
    const req = new Request('http://x.test', {
      method: 'PUT',
      body: 'abc',
      headers: { 'content-length': '999999' },
    })
    expect(await readCappedBody(req, 10)).toEqual({ ok: false })
  })

  it('stops a chunked body that grows past the cap', async () => {
    expect(await readCappedBody(streamed([6, 6, 6]), 10)).toEqual({ ok: false })
    const fits = await readCappedBody(streamed([4, 4]), 10)
    expect(fits.ok && fits.bytes.byteLength).toBe(8)
  })

  it('refuses an empty body', async () => {
    expect(await readCappedBody(streamed([]), 10)).toEqual({ ok: false })
  })
})
