import { describe, expect, it } from 'vitest'
import { withFallback } from '../src/fallback'
import { sampleTemplateData } from '../src/samples'
import type { MarketingSend, Message, NotificationChannel, SendResult } from '../src/types'

/** A channel that answers every send with `result` and counts its calls. */
function fake(id: string, result: SendResult, marketing = true) {
  const calls = { send: 0, marketing: 0 }
  const channel: NotificationChannel = {
    id,
    label: `Email (${id})`,
    requires: 'email',
    send: async (_m: Message) => {
      calls.send += 1
      return result
    },
    ...(marketing
      ? {
          sendMarketing: async (_m: MarketingSend) => {
            calls.marketing += 1
            return result
          },
        }
      : {}),
  }
  return { channel, calls }
}

const message: Message = {
  to: { email: 'shopper@example.com' },
  template: 'order_placed',
  data: sampleTemplateData,
}
const campaign: MarketingSend = {
  kind: 'email',
  to: { email: 'shopper@example.com' },
  subject: 's',
  html: 'h',
  text: 't',
}

describe('withFallback', () => {
  it('uses the primary alone when it delivers, under its id and label', async () => {
    const a = fake('ses', { ok: true, providerRef: 'm1' })
    const b = fake('resend', { ok: true, providerRef: 'r1' })
    const ch = withFallback(a.channel, b.channel)
    expect(ch.id).toBe('ses')
    expect(ch.label).toBe('Email (ses)')
    expect(await ch.send(message)).toEqual({ ok: true, providerRef: 'm1' })
    expect(b.calls.send).toBe(0)
  })

  it('tries the secondary after a retryable failure and tags its reference', async () => {
    const a = fake('ses', { ok: false, error: 'throttled', retryable: true })
    const b = fake('resend', { ok: true, providerRef: 'r1' })
    const ch = withFallback(a.channel, b.channel)
    expect(await ch.send(message)).toEqual({ ok: true, providerRef: 'resend:r1' })
    expect(await ch.sendMarketing?.(campaign)).toEqual({ ok: true, providerRef: 'resend:r1' })
    expect(b.calls).toEqual({ send: 1, marketing: 1 })
  })

  it('never sends a refused message twice', async () => {
    const a = fake('ses', { ok: false, error: 'MessageRejected' })
    const b = fake('resend', { ok: true, providerRef: 'r1' })
    expect(await withFallback(a.channel, b.channel).send(message)).toEqual({
      ok: false,
      error: 'MessageRejected',
    })
    expect(b.calls.send).toBe(0)
  })

  it('reports both errors when both providers fail', async () => {
    const a = fake('ses', { ok: false, error: 'down', retryable: true })
    const b = fake('resend', { ok: false, error: 'also down', retryable: true })
    expect(await withFallback(a.channel, b.channel).send(message)).toEqual({
      ok: false,
      error: 'down; fallback resend: also down',
      retryable: true,
    })
  })

  it('keeps marketing on the primary when the secondary cannot send it, and drops it when neither can', async () => {
    const a = fake('ses', { ok: false, error: 'down', retryable: true })
    const b = fake('resend', { ok: true, providerRef: 'r1' }, false)
    const ch = withFallback(a.channel, b.channel)
    expect(await ch.sendMarketing?.(campaign)).toMatchObject({ ok: false, error: 'down' })
    const none = withFallback(fake('x', { ok: true, providerRef: '1' }, false).channel, b.channel)
    expect(none.sendMarketing).toBeUndefined()
  })
})
