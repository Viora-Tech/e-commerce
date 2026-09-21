import { describe, expect, it } from 'vitest'
import { NotificationRegistry, renderEmail, renderWhatsapp, TEMPLATE_IDS } from '../src'
import { sampleTemplateData } from '../src/testing'

describe('templates', () => {
  it.each(TEMPLATE_IDS)('%s renders subject, text and html', (id) => {
    const e = renderEmail(id, sampleTemplateData)
    expect(e.subject).toContain('#42')
    expect(e.text).toContain('Maboroshi mousepad x 1')
    expect(e.html).toContain('<li>')
    expect(renderWhatsapp(id, sampleTemplateData).text).toContain('#42')
  })

  it('escapes html in shopper-supplied data', () => {
    const e = renderEmail('order_placed', { ...sampleTemplateData, customerName: '<b>x</b>' })
    expect(e.html).not.toContain('<b>x</b>')
    expect(e.html).toContain('&lt;b&gt;x&lt;/b&gt;')
  })

  it('includes the tracking url when shipped', () => {
    const e = renderEmail('order_shipped', {
      ...sampleTemplateData,
      trackingUrl: 'https://t.example/1',
    })
    expect(e.text).toContain('https://t.example/1')
  })
})

describe('registry', () => {
  it('explains unknown channels and invalid config', () => {
    const r = new NotificationRegistry().register({
      id: 'x',
      label: 'X',
      fields: [],
      validateConfig: () => ({ ok: false, errors: ['nope'] }),
      create: () => {
        throw new Error('unreachable')
      },
    })
    expect(r.create('nope', {})).toEqual({
      ok: false,
      errors: ['unknown notification channel: nope'],
    })
    expect(r.create('x', {})).toEqual({ ok: false, errors: ['nope'] })
    expect(r.ids()).toEqual(['x'])
  })
})
