import { describe, expect, it } from 'vitest'
import {
  firstOpenSection,
  type SectionGates,
  sectionDomId,
  sectionFromParam,
  sectionsFor,
} from './checkout-sections'

const physical = sectionsFor(false)
const digital = sectionsFor(true)
const open: SectionGates = { contact: 'ok', address: 'ok', shipping: 'ok' }

describe('sectionsFor', () => {
  it('drops Shipping for a basket of gift cards', () => {
    expect(physical).toEqual(['contact', 'address', 'shipping', 'payment'])
    expect(digital).toEqual(['contact', 'address', 'payment'])
  })
})

describe('sectionFromParam', () => {
  // Old stepped-checkout links (`?step=payment`) must open the one page, never break it.
  it('follows a known step to its card', () => {
    expect(sectionFromParam('payment', physical)).toBe('payment')
    expect(sectionFromParam('shipping', physical)).toBe('shipping')
    expect(sectionFromParam(' Payment ', physical)).toBe('payment')
  })

  it('ignores anything else instead of failing', () => {
    for (const raw of [null, undefined, '', 'bogus', 'review', '../payment', 'payment;']) {
      expect(sectionFromParam(raw, physical)).toBeNull()
    }
    // A gift-card basket has no Shipping card.
    expect(sectionFromParam('shipping', digital)).toBeNull()
  })

  it('names the card ids the links scroll to', () => {
    expect(sectionDomId('payment')).toBe('checkout-section-payment')
  })
})

describe('firstOpenSection', () => {
  it('points Pay at the first card still waiting, in page order', () => {
    expect(firstOpenSection(open, physical)).toBeNull()
    expect(firstOpenSection({ ...open, shipping: 'pending' }, physical)).toBe('shipping')
    expect(firstOpenSection({ ...open, address: 'blocked', shipping: 'blocked' }, physical)).toBe(
      'address',
    )
    expect(
      firstOpenSection({ contact: 'blocked', address: 'blocked', shipping: 'ok' }, physical),
    ).toBe('contact')
  })

  it('never waits on shipping for a basket with nothing to ship', () => {
    expect(firstOpenSection({ ...open, shipping: 'blocked' }, digital)).toBeNull()
  })
})
