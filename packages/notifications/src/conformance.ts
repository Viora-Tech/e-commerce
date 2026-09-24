import { describe, expect, it } from 'vitest'
import type { NotificationChannel, TemplateData, TemplateId } from './types'

export type ConformanceOptions = {
  /** Fresh channel per test. */
  create: () => NotificationChannel | Promise<NotificationChannel>
  /** Recipient a live test may actually message. Skipped without `live`. */
  recipient?: { email?: string; phone?: string } | undefined
  /** Runs real sends; only when sandbox credentials are present. */
  live?: boolean
}

export const sampleTemplateData: TemplateData = {
  storeName: 'Waimers',
  orderNumber: 42,
  customerName: 'Asha',
  totalLabel: '₹2,048',
  lines: [
    {
      title: 'Maboroshi mousepad',
      quantity: 1,
      priceLabel: '₹1,999',
      imageUrl: 'https://placehold.co/80x80/f2f2f2/141414?text=%20',
    },
  ],
  taxBreakdown: [
    { label: 'CGST (9%)', amount: '₹22' },
    { label: 'SGST (9%)', amount: '₹27' },
  ],
  paymentMethodLabel: 'Cash on delivery',
  storeAddress: '221 MG Road, Bengaluru 560001',
}

const base = sampleTemplateData

/** One representative TemplateData per TemplateId, for the admin's /dev/emails preview. */
export const sampleTemplateDataByTemplate: Record<TemplateId, TemplateData> = {
  order_placed: { ...base, orderUrl: 'https://waimers.example/orders/42' },
  payment_received: { ...base, orderUrl: 'https://waimers.example/orders/42' },
  order_shipped: {
    ...base,
    waybill: 'AWB123456789',
    trackingUrl: 'https://waimers.example/track/42',
  },
  draft_invoice: { ...base, actionUrl: 'https://waimers.example/pay/42' },
  checkout_recovery: {
    ...base,
    orderNumber: undefined,
    actionUrl: 'https://waimers.example/cart/restore/abc',
  },
  document_copy: {
    ...base,
    documentLabel: 'tax invoice INV/25-26/0007',
    links: [{ label: 'Download tax invoice', url: 'https://waimers.example/docs/inv-7.pdf' }],
  },
  login_code: {
    ...base,
    orderNumber: undefined,
    lines: [],
    taxBreakdown: undefined,
    totalLabel: '',
    code: '482913',
  },
  gift_card_issued: {
    ...base,
    orderNumber: undefined,
    lines: [],
    taxBreakdown: undefined,
    giftCard: {
      code: 'WAIM-GIFT-2048',
      balanceLabel: '₹2,000',
      expiresLabel: '31 Mar 2027',
      message: 'Happy birthday Asha, enjoy!',
    },
  },
  balance_request: {
    ...base,
    actionUrl: 'https://waimers.example/pay-balance/42',
    balance: { dueLabel: '₹1,200', depositLabel: '₹848', payByLabel: '10 Oct 2026' },
  },
  balance_reminder: {
    ...base,
    actionUrl: 'https://waimers.example/pay-balance/42',
    balance: {
      dueLabel: '₹1,200',
      depositLabel: '₹848',
      payByLabel: '10 Oct 2026',
      depositNonRefundable: true,
    },
  },
  balance_received: { ...base, orderUrl: 'https://waimers.example/orders/42' },
  payment_reminder: { ...base, orderUrl: 'https://waimers.example/orders/42/pay' },
  unpaid_cancel_notice: { ...base, deadlineLabel: '28 Sep 2026' },
  unpaid_cancelled: { ...base },
  back_in_stock_confirm: {
    ...base,
    orderNumber: undefined,
    lines: [],
    taxBreakdown: undefined,
    backInStock: {
      productTitle: 'Maboroshi mousepad',
      variantTitle: 'Large',
      confirmUrl: 'https://waimers.example/back-in-stock/confirm/abc',
      unsubscribeUrl: 'https://waimers.example/back-in-stock/unsubscribe/abc',
    },
  },
  back_in_stock_alert: {
    ...base,
    orderNumber: undefined,
    lines: [],
    taxBreakdown: undefined,
    backInStock: {
      productTitle: 'Maboroshi mousepad',
      variantTitle: 'Large',
      productUrl: 'https://waimers.example/products/maboroshi-mousepad',
      unsubscribeUrl: 'https://waimers.example/back-in-stock/unsubscribe/abc',
    },
  },
}

/** Behavioural contract every NotificationChannel must satisfy. Offline checks always run. */
export function describeNotificationChannel(name: string, opts: ConformanceOptions): void {
  describe(`NotificationChannel conformance: ${name}`, () => {
    it('has a stable lowercase id, a label and a recipient requirement', async () => {
      const a = await opts.create()
      const b = await opts.create()
      expect(a.id).toMatch(/^[a-z][a-z0-9-]*$/)
      expect(a.id).toBe(b.id)
      expect(a.label.length).toBeGreaterThan(0)
      expect(['email', 'phone']).toContain(a.requires)
    })

    it('reports a missing recipient as a failure instead of throwing', async () => {
      const c = await opts.create()
      const r = await c.send({ to: {}, template: 'order_placed', data: sampleTemplateData })
      expect(r.ok).toBe(false)
    })

    if (opts.live && opts.recipient) {
      const to = opts.recipient
      it('delivers a real order_placed message', async () => {
        const c = await opts.create()
        const r = await c.send({ to, template: 'order_placed', data: sampleTemplateData })
        expect(r.ok).toBe(true)
        if (r.ok) expect(r.providerRef).toBeTruthy()
      })
    }
  })
}
