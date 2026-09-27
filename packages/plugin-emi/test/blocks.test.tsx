import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { emiBlocks } from '../src/blocks'
import { emiPlugin } from '../src/plugin'

const block = emiBlocks[0]

describe('EMI & pay later app', () => {
  it('is a builtin app with one settings page and one namespaced block', () => {
    expect(emiPlugin.id).toBe('emi-pay-later')
    expect(emiPlugin.kind).toBe('builtin')
    expect(emiPlugin.admin?.pages?.map((p) => p.path)).toEqual([''])
    expect(emiBlocks.map((b) => b.type)).toEqual(['emi-pay-later/EmiOffers'])
  })

  it('draws the offer handed over by the product page', () => {
    const html = renderToStaticMarkup(
      block?.render({
        puck: {
          metadata: {
            appBlockContext: {
              emiOffers: { amountPaise: 1_200_000, monthlyPaise: 100_000, razorpayKeyId: null },
            },
          },
        },
      }) as React.ReactElement,
    )
    expect(html).toContain('or ₹1,000/month with EMI or pay later')
    expect(html).toContain('emi-offers__widget')
  })

  it('draws nothing without an offer (app off, or price under the minimum)', () => {
    const none = renderToStaticMarkup(block?.render({}) as React.ReactElement)
    const nulled = renderToStaticMarkup(
      block?.render({
        puck: { metadata: { appBlockContext: { emiOffers: null } } },
      }) as React.ReactElement,
    )
    expect(none).toBe('')
    expect(nulled).toBe('')
  })
})
