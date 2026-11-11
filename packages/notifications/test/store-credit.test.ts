import { describe, expect, it } from 'vitest'
import { renderEmail, renderWhatsapp, sampleTemplateDataByTemplate } from '../src'
import { sampleTemplateData } from '../src/testing'

describe('store credit in emails', () => {
  it('a draft invoice paid partly by store credit shows Total, Store credit and To pay', async () => {
    const data = {
      ...sampleTemplateDataByTemplate.draft_invoice,
      totalLabel: '₹1,500.00',
      storeCredit: { appliedLabel: '−₹500.00', toPayLabel: '₹1,000.00' },
    }
    const e = await renderEmail('draft_invoice', data)
    expect(e.text).toContain('Total: ₹1,500.00\nStore credit: −₹500.00\nTo pay: ₹1,000.00')
    expect(e.text).toContain('so ₹1,000.00 is left to pay')
    expect(e.html).toContain('Store credit')
    expect(e.html).toContain('−₹500.00')
    expect(e.html).toContain('To pay')
    expect(renderWhatsapp('draft_invoice', data).text).toContain('₹1,000.00 to pay')
  })

  it('a draft invoice without store credit is unchanged', async () => {
    const e = await renderEmail('draft_invoice', sampleTemplateDataByTemplate.draft_invoice)
    expect(e.text).not.toContain('Store credit')
    expect(e.text).not.toContain('To pay')
  })

  it('order confirmation says what store credit paid and the balance left', async () => {
    const e = await renderEmail('order_placed', {
      ...sampleTemplateData,
      storeCredit: { change: { kind: 'used', amountLabel: '₹300.00', balanceLabel: '₹200.00' } },
    })
    expect(e.text).toContain('Store credit used ₹300.00 · balance ₹200.00')
    expect(e.html).toContain('Store credit used ₹300.00 · balance ₹200.00')
  })

  it('a refund or return to store credit says what was added and the balance', async () => {
    const change = { kind: 'added' as const, amountLabel: '₹450.00', balanceLabel: '₹950.00' }
    for (const id of ['refund_issued', 'return_refunded'] as const) {
      const e = await renderEmail(id, {
        ...sampleTemplateDataByTemplate[id],
        storeCredit: { change },
      })
      expect(e.text).toContain('₹450.00 added to your store credit · balance ₹950.00')
      expect(e.html).toContain('₹450.00 added to your store credit · balance ₹950.00')
    }
  })

  it('no balance line without a change', async () => {
    const e = await renderEmail('order_placed', sampleTemplateData)
    expect(e.text).not.toContain('Store credit')
  })
})
