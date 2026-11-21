import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { deliveryOptionsContent as appCopy } from '@/data/delivery-options'
import InsuranceToggle from './insurance-toggle'

const render = (on: boolean, free = false) =>
  renderToStaticMarkup(
    createElement(InsuranceToggle, { on, price: '₹61', free, onChange: () => undefined }),
  )

/** Owner, 21 Nov 2026: turning insurance off says the shopper carries a lost or damaged parcel. */
describe('the insurance tick', () => {
  it('says who carries the risk only while it is off', () => {
    expect(render(false)).toContain(appCopy.insureOffNote.slice(0, 30))
    expect(render(true)).not.toContain(appCopy.insureOffNote.slice(0, 30))
  })

  it('shows no price when the store pays it (a free delivery)', () => {
    expect(render(true, true)).not.toContain('Free')
    expect(render(true, true)).not.toContain('+ ₹61')
    expect(render(true)).toContain('+ ₹61')
  })
})
