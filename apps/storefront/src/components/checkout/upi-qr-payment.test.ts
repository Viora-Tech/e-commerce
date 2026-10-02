import type { UpiQr } from '@commerce/payments'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/cart-actions', () => ({
  checkQrPaymentAction: vi.fn(),
  retryPaymentAction: vi.fn(),
}))

const { default: UpiQrPayment } = await import('./upi-qr-payment')

const qr: UpiQr = {
  upiUri: 'upi://pay?pa=shop@upi&pn=Shop&am=7499.00&cu=INR',
  amountPaise: 749_900,
  expiresAt: '2026-10-02T10:30:00.000Z',
}

const render = (at: string) => {
  vi.setSystemTime(new Date(at))
  return renderToString(
    createElement(UpiQrPayment, { orderNumber: 1001, qr, amountLabel: '₹7,499' }),
  )
}

afterEach(() => {
  vi.useRealTimers()
})

describe('UpiQrPayment', () => {
  // Hydration fix: the server and the shopper's phone read different clocks. Server HTML that
  // depends on the time (the countdown, or the expired state once the QR closes in between)
  // cannot match the browser's first render, React error #418.
  it('renders the same server HTML whatever the clock says', () => {
    vi.useFakeTimers()
    const early = render('2026-10-02T10:00:00.000Z')
    const late = render('2026-10-02T11:00:00.000Z')
    expect(late).toBe(early)
  })

  it('draws the open QR step first, the countdown only once the browser has its clock', () => {
    vi.useFakeTimers()
    const html = render('2026-10-02T11:00:00.000Z')
    expect(html).toContain('I&#x27;ve paid')
    expect(html).not.toContain('This QR closes in')
    expect(html).not.toContain('This QR has closed')
  })
})
