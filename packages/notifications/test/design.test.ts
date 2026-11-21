import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  defaultEmailDesign,
  designSlots,
  type EmailTemplateDesign,
  parseEmailDesign,
  unknownVariables,
  variablesFor,
} from '../src/design'
import { resolveDesign } from '../src/design/resolve'
import { sampleEmailBrand, sampleTemplateDataByTemplate } from '../src/samples'
import { renderEmail, TEMPLATE_IDS } from '../src/templates'
import { designableTemplate } from '../src/templates/internal'
import type { TemplateData, TemplateId } from '../src/types'

const data = (t: TemplateId, extra: Partial<TemplateData> = {}): TemplateData => ({
  ...sampleTemplateDataByTemplate[t],
  brand: sampleEmailBrand,
  ...extra,
})

const design = (
  blocks: EmailTemplateDesign['blocks'],
  extra: Partial<EmailTemplateDesign> = {},
) => ({
  version: 1 as const,
  blocks,
  removed: [],
  ...extra,
})

afterEach(() => vi.restoreAllMocks())

describe('email designs', () => {
  it('the default design is the built-in email, for every template a merchant can design', async () => {
    for (const t of TEMPLATE_IDS.filter(designableTemplate)) {
      const plain = await renderEmail(t, data(t))
      const designed = await renderEmail(t, data(t, { design: defaultEmailDesign(t) }))
      expect(designed.subject, t).toBe(plain.subject)
      expect(designed.text, t).toBe(plain.text)
      // Same words in the same order (the HTML differs only in wrapper markup).
      const words = (h: string) =>
        h
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;|\s+/g, ' ')
          .trim()
      expect(words(designed.html), t).toBe(words(plain.html))
    }
  })

  it('renders a saved design: own heading, text, button and subject with variables filled', async () => {
    const d = defaultEmailDesign('order_shipped')
    const saved = design(
      [
        { id: 'h', type: 'heading', text: 'On its way, {{customer_name}}!', size: 'large' },
        ...d.blocks,
        {
          id: 't',
          type: 'text',
          text: 'Order #{{order_number}} from {{store_name}}',
          align: 'center',
          muted: false,
        },
        { id: 'b', type: 'button', label: 'Track it', url: '{{tracking_url}}' },
      ],
      { subject: 'Shipped: #{{order_number}}' },
    )
    const sample = data('order_shipped')
    const email = await renderEmail('order_shipped', { ...sample, design: saved })
    expect(email.subject).toBe(`Shipped: #${sample.orderNumber}`)
    expect(email.html).toContain(`On its way, ${sample.customerName}!`)
    expect(email.html).toContain(`Order #${sample.orderNumber} from ${sample.storeName}`)
    expect(email.html).toContain(`href="${sample.trackingUrl}"`)
    expect(email.text).toContain(`Track it: ${sample.trackingUrl}`)
    expect(email.html).not.toContain('{{')
  })

  it('always draws the locked order blocks, even when the JSON leaves them out', async () => {
    const slots = designSlots('order_placed')
    expect(slots.find((s) => s.kind === 'items')?.locked).toBe(true)
    const sample = data('order_placed')
    const onlyText = design(
      [{ id: 't', type: 'text', text: 'Hello', align: 'center', muted: false }],
      { removed: slots.map((s) => s.key) },
    )
    const email = await renderEmail('order_placed', { ...sample, design: onlyText })
    for (const line of sample.lines) expect(email.html).toContain(line.title.split(' / ')[0])
    expect(email.html).toContain(sample.totalLabel)
    // And the resolver keeps every locked slot once, in the built-in order.
    const resolved = resolveDesign(design([], { removed: ['items#0', 'text#0'] }), [
      { kind: 'items', lines: [], title: 'x', totalHeading: 'x', qty: () => '' },
      { kind: 'text', text: 'line' },
    ])
    expect(
      resolved.filter((r) => r.kind === 'slot').map((r) => r.kind === 'slot' && r.key),
    ).toEqual(['items#0'])
    expect(resolved.some((r) => r.kind === 'intro')).toBe(true)
  })

  it('keeps the sign-in code in a login email whatever the design says', async () => {
    const sample = data('login_code')
    const email = await renderEmail('login_code', {
      ...sample,
      design: design([{ id: 's', type: 'spacer', size: 'small' }], { removed: ['code#0'] }),
    })
    expect(email.html).toContain(String(sample.code))
  })

  it('a broken design falls back to the built-in email and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const plain = await renderEmail('delivered', data('delivered'))
    for (const broken of [{ version: 99, blocks: [] }, 'nonsense', { version: 1, blocks: 'x' }]) {
      const email = await renderEmail('delivered', data('delivered', { design: broken }))
      expect(email.html).toBe(plain.html)
    }
    expect(warn).toHaveBeenCalled()
  })

  it('escapes merchant text and shopper data, and drops unsafe links and images', async () => {
    const email = await renderEmail(
      'delivered',
      data('delivered', {
        customerName: '<img src=x onerror=alert(1)>',
        design: design([
          {
            id: 't',
            type: 'text',
            text: '<script>alert(1)</script> Hi {{customer_name}}',
            align: 'left',
            muted: false,
          },
          { id: 'b', type: 'button', label: 'Bad', url: 'javascript:alert(1)' },
          { id: 'i', type: 'image', src: 'http://insecure.example/a.png', alt: 'x', width: 100 },
        ]),
      }),
    )
    expect(email.html).not.toContain('<script>alert')
    expect(email.html).toContain('&lt;script&gt;')
    expect(email.html).not.toContain('<img src=x')
    expect(email.html).not.toContain('javascript:')
    expect(email.html).not.toContain('insecure.example')
  })

  it('unknown variables are flagged and never printed', async () => {
    expect(
      unknownVariables('Hi {{customer_name}} {{nope}} {{ nope }}', variablesFor('delivered')),
    ).toEqual(['nope'])
    expect(variablesFor('order_shipped')).toContain('tracking_url')
    expect(variablesFor('login_code')).not.toContain('tracking_url')
    const email = await renderEmail(
      'delivered',
      data('delivered', {
        design: design([
          { id: 't', type: 'text', text: 'A{{nope}}B', align: 'center', muted: false },
        ]),
      }),
    )
    expect(email.html).toContain('AB')
  })

  it('team reports and platform mail ignore a design', async () => {
    expect(designableTemplate('staff_weekly_report')).toBe(false)
    expect(designableTemplate('staff_invite')).toBe(false)
    const plain = await renderEmail('staff_invite', data('staff_invite'))
    const withDesign = await renderEmail(
      'staff_invite',
      data('staff_invite', { design: design([]) }),
    )
    expect(withDesign.html).toBe(plain.html)
  })
})

describe('parseEmailDesign', () => {
  it('drops unknown block types, duplicate ids and bad slot keys', () => {
    const parsed = parseEmailDesign({
      version: 1,
      blocks: [
        { id: 'a', type: 'text', text: 'x' },
        { id: 'a', type: 'text', text: 'again' },
        { id: 'b', type: 'html', html: '<b>' },
        { id: 'c', type: 'slot', slot: 'items; drop' },
        { id: 'd', type: 'slot', slot: 'items#0' },
      ],
      removed: ['text#0', 'bad key'],
    })
    expect(parsed?.blocks.map((b) => b.id)).toEqual(['a', 'd'])
    expect(parsed?.removed).toEqual(['text#0'])
  })
})
