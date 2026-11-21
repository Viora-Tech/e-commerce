import {
  defaultEmailDesign,
  type Message,
  type NotificationChannel,
  TEMPLATE_IDS,
} from '@commerce/notifications'
import { describe, expect, it } from 'vitest'
import { EmailTemplateDesignSchema, withEmailDesigns } from './email-template-design'

const base = { version: 1, removed: [] }
const parse = (blocks: unknown[], extra: Record<string, unknown> = {}) =>
  EmailTemplateDesignSchema.safeParse({ ...base, blocks, ...extra })

describe('EmailTemplateDesignSchema', () => {
  it('accepts every template default design', () => {
    for (const t of TEMPLATE_IDS) {
      expect(EmailTemplateDesignSchema.safeParse(defaultEmailDesign(t)).success, t).toBe(true)
    }
  })

  it('accepts the editor block set with variables in links', () => {
    const r = parse([
      { id: 'a', type: 'heading', text: 'Hi {{customer_name}}', size: 'large' },
      { id: 'b', type: 'button', label: 'Shop', url: '{{shop_url}}/collections/sale' },
      { id: 'c', type: 'button', label: 'Write', url: 'mailto:help@example.com' },
      { id: 'd', type: 'image', src: '/media/abc.webp', alt: '', width: 80 },
      {
        id: 'e',
        type: 'image',
        src: 'https://cdn.example.com/a.png',
        alt: 'A',
        width: 100,
        href: 'https://example.com',
      },
      { id: 'f', type: 'spacer', size: 'small' },
      { id: 'g', type: 'slot', slot: 'items#0' },
    ])
    expect(r.success).toBe(true)
  })

  it('refuses unknown block types, script links, plain-http images and HTML blocks', () => {
    expect(parse([{ id: 'a', type: 'html', html: '<script>' }]).success).toBe(false)
    expect(
      parse([{ id: 'a', type: 'button', label: 'x', url: 'javascript:alert(1)' }]).success,
    ).toBe(false)
    expect(parse([{ id: 'a', type: 'button', label: 'x', url: 'data:text/html,hi' }]).success).toBe(
      false,
    )
    expect(
      parse([{ id: 'a', type: 'image', src: 'http://example.com/a.png', alt: '', width: 100 }])
        .success,
    ).toBe(false)
    expect(
      parse([{ id: 'a', type: 'image', src: 'javascript:x', alt: '', width: 100 }]).success,
    ).toBe(false)
  })

  it('refuses removing a locked block, duplicate ids, two intros and oversized text', () => {
    expect(parse([], { removed: ['items#0'] }).success).toBe(false)
    expect(parse([], { removed: ['text#0'] }).success).toBe(true)
    expect(
      parse([
        { id: 'a', type: 'spacer', size: 'small' },
        { id: 'a', type: 'spacer', size: 'small' },
      ]).success,
    ).toBe(false)
    expect(
      parse([
        { id: 'a', type: 'intro' },
        { id: 'b', type: 'intro' },
      ]).success,
    ).toBe(false)
    expect(
      parse([{ id: 'a', type: 'text', text: 'x'.repeat(2001), align: 'left', muted: false }])
        .success,
    ).toBe(false)
    expect(
      parse(Array.from({ length: 61 }, (_, i) => ({ id: `s${i}`, type: 'social' }))).success,
    ).toBe(false)
  })
})

describe('withEmailDesigns', () => {
  const sent: Message[] = []
  const channel: NotificationChannel = {
    id: 'fake',
    label: 'Fake',
    requires: 'email',
    send: async (m) => {
      sent.push(m)
      return { ok: true, providerRef: 'x' }
    },
  } as NotificationChannel
  const message = (template: Message['template']): Message => ({
    to: { email: 'a@example.com' },
    template,
    data: { storeName: 'S', customerName: 'C', totalLabel: '', lines: [], paymentMethodLabel: '' },
  })

  it('attaches the saved design once per template and never fails a send when loading throws', async () => {
    sent.length = 0
    let loads = 0
    const design = defaultEmailDesign('delivered')
    const [wrapped] = withEmailDesigns([channel], async (t) => {
      loads += 1
      if (t === 'order_shipped') throw new Error('db down')
      return t === 'delivered' ? design : null
    })
    await wrapped?.send(message('delivered'))
    await wrapped?.send(message('delivered'))
    const r = await wrapped?.send(message('order_shipped'))
    await wrapped?.send(message('staff_invite'))
    expect(r?.ok).toBe(true)
    expect(sent[0]?.data.design).toEqual(design)
    expect(sent[2]?.data.design).toBeUndefined()
    // Platform mail is never designed, so it is never looked up.
    expect(loads).toBe(2)
  })
})
