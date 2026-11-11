/** SOURCE OF TRUTH: delivery card note tests — WHAT: the prepaid-only hint shows only under a prepaid-only card when COD is offered / WHY: #1522. */
import { describe, expect, it } from 'vitest'
import { deliveryOptionsContent as appCopy } from '@/data/delivery-options'
import { deliveryCardNote } from './delivery-card-note'

describe('deliveryCardNote', () => {
  it('hints "pay online" under Express when the store offers cash on delivery', () => {
    expect(deliveryCardNote({ delivery: { codAllowed: false } }, true)).toBe(appCopy.prepaidOnly)
  })

  it('says nothing when cash on delivery is not offered at this checkout', () => {
    expect(deliveryCardNote({ delivery: { codAllowed: false } }, false)).toBeNull()
  })

  it('says nothing under a card that takes cash on delivery, or a plain zone rate', () => {
    expect(deliveryCardNote({ delivery: { codAllowed: true } }, true)).toBeNull()
    expect(deliveryCardNote({}, true)).toBeNull()
  })

  it('is a hint, not the old error wording', () => {
    expect(appCopy.prepaidOnly).not.toMatch(/not available/i)
  })
})
