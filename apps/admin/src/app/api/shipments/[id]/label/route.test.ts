/** SOURCE OF TRUTH: tests for ./route.ts — a courier that has no label answers a readable 4xx page, never a 5xx Cloudflare replaces. */
import { ORPCError } from '@orpc/server'
import { describe, expect, it, vi } from 'vitest'

const call = vi.fn()
/** The router's refusal, as `call` rejects with it (made per call, as the router would). */
const refuse = (make: () => unknown) =>
  call.mockImplementation(async () => {
    throw make()
  })

vi.mock('@/lib/api', () => ({
  appRouter: { shipments: { label: {} } },
  call: (...args: unknown[]) => call(...args),
  serverContext: async () => ({}),
}))
vi.mock('@/lib/request-log', () => ({ withEvlog: <T>(handler: T) => handler }))
vi.mock('@/lib/copy-server', () => ({ getCopy: async <T>(en: T) => en }))

const get = async () => {
  const { GET } = await import('./route')
  return (
    GET as unknown as (r: Request, c: { params: Promise<{ id: string }> }) => Promise<Response>
  )(new Request('http://admin.test/api/shipments/s1/label'), {
    params: Promise.resolve({ id: 's1' }),
  })
}

describe('GET /api/shipments/[id]/label', () => {
  it('a label Delhivery has not made yet is a 409 page that says so, not a 502', async () => {
    refuse(
      () =>
        new ORPCError('BAD_REQUEST', {
          message:
            'Delhivery has no label for #2503 yet. Try again in a minute, or print it from Delhivery One.',
          data: { code: 'label_not_ready', provider: 'delhivery' },
        }),
    )
    const res = await get()
    expect(res.status).toBe(409)
    expect(res.status).toBeLessThan(500)
    expect(res.headers.get('content-type')).toContain('text/html')
    const body = await res.text()
    expect(body).toContain('Delhivery has no label for #2503 yet.')
    expect(body).toContain('Label not ready')
  })

  it('any other courier failure is a 424 page, with the words escaped', async () => {
    refuse(() => new ORPCError('BAD_REQUEST', { message: 'Courier said <b>no</b>' }))
    const res = await get()
    expect(res.status).toBe(424)
    const body = await res.text()
    expect(body).toContain('Courier said &lt;b&gt;no&lt;/b&gt;')
    expect(body).not.toContain('<b>no</b>')
  })

  it('still serves the PDF when there is one', async () => {
    call.mockResolvedValue(new File([new Uint8Array([0x25, 0x50])], 'label-s1.pdf'))
    const res = await get()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
  })
})
