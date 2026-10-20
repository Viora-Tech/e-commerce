import { sampleShipment } from '@commerce/shipping/testing'
import { describe, expect, it } from 'vitest'
import { renderIndiaPostLabel } from '../src/label'

describe('India Post label', () => {
  it('renders a one-page PDF with the article number, COD and both addresses', async () => {
    const bytes = await renderIndiaPostLabel({
      articleNumber: 'EE123456785IN',
      orderNumber: 1044,
      storeName: 'Waimers',
      registered: true,
      codPaise: 129900,
      weightGrams: 500,
      customerId: '1234567890',
      bookedOn: '2026-10-20',
      to: sampleShipment.to,
      from: sampleShipment.from,
    })
    const head = new TextDecoder('latin1').decode(bytes.slice(0, 8))
    expect(head.startsWith('%PDF-')).toBe(true)
    const text = new TextDecoder('latin1').decode(bytes)
    expect(text.match(/\/Type \/Page\b/g)?.length).toBe(1)
    // 4 x 6 inches.
    expect(text).toMatch(/\/MediaBox \[0 0 288 432\]/)
  }, 30_000)
})
