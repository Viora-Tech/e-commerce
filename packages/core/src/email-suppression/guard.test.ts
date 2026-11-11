/** SOURCE OF TRUTH: withSuppressionGuard tests — WHAT: suppressed addresses never reach the provider on send or sendMarketing, sign-in mail still goes, phone channels untouched / WHY: one wrapper is the only gate every store email passes */
import type { EmailSuppressionReason } from '@commerce/db'
import type { MarketingSend, Message, NotificationChannel } from '@commerce/notifications'
import { sampleTemplateDataByTemplate } from '@commerce/notifications'
import { describe, expect, it } from 'vitest'
import { SUPPRESSED_PREFIX, withSuppressionGuard } from './guard'

/** A channel that records what reached the provider. */
class Recorder implements NotificationChannel {
  readonly id: string
  readonly label = 'Recorder'
  readonly requires: 'email' | 'phone'
  sent: string[] = []
  constructor(id: string, requires: 'email' | 'phone') {
    this.id = id
    this.requires = requires
  }
  async send(message: Message) {
    this.sent.push(`${message.template}:${message.to.email ?? message.to.phone}`)
    return { ok: true as const, providerRef: 'p-1' }
  }
  async sendMarketing(message: MarketingSend) {
    this.sent.push(`marketing:${message.to.email ?? message.to.phone}`)
    return { ok: true as const, providerRef: 'p-2' }
  }
}

const list = new Map<string, EmailSuppressionReason>([
  ['bounced@example.com', 'hard_bounce'],
  ['spam@example.com', 'complaint'],
])

const order = (email: string, template: Message['template'] = 'order_placed'): Message => ({
  to: { email },
  template,
  data: sampleTemplateDataByTemplate.order_placed,
})

describe('withSuppressionGuard', () => {
  it('skips suppressed addresses on every email send, saying why, and lets others through', async () => {
    const email = new Recorder('ses', 'email')
    const [guarded] = withSuppressionGuard([email], list)
    if (!guarded) throw new Error('no channel')
    const skipped = await guarded.send(order('Bounced@Example.com '))
    expect(skipped.ok).toBe(false)
    expect(skipped.ok ? '' : skipped.error).toMatch(new RegExp(`^${SUPPRESSED_PREFIX} hard_bounce`))
    expect(skipped).not.toHaveProperty('retryable')
    const market = await guarded.sendMarketing?.({
      kind: 'email',
      to: { email: 'spam@example.com' },
      subject: 's',
      html: '<p>s</p>',
      text: 's',
    })
    expect(market?.ok ? '' : market?.error).toMatch(/^suppressed: complaint/)
    expect(await guarded.send(order('fine@example.com'))).toEqual({ ok: true, providerRef: 'p-1' })
    expect(email.sent).toEqual(['order_placed:fine@example.com'])
    // The wrapped channel keeps its identity.
    expect(guarded.id).toBe('ses')
  })

  it('still sends a sign-in code or link the shopper asked for', async () => {
    const email = new Recorder('ses', 'email')
    const [guarded] = withSuppressionGuard([email], list)
    await guarded?.send(order('spam@example.com', 'login_code'))
    await guarded?.send(order('spam@example.com', 'login_link'))
    expect(email.sent).toEqual(['login_code:spam@example.com', 'login_link:spam@example.com'])
  })

  it('leaves phone channels and an empty list alone', async () => {
    const phone = new Recorder('whatsapp', 'phone')
    const email = new Recorder('ses', 'email')
    const [p] = withSuppressionGuard([phone], list)
    expect(p).toBe(phone)
    const [e] = withSuppressionGuard([email], new Map())
    expect(e).toBe(email)
  })
})
