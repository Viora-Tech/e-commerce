import { describe, expect, it } from 'vitest'
import {
  firstOpenSection,
  resolveStep,
  type SectionGates,
  sectionDomId,
  sectionFromParam,
  sectionsFor,
  stepParam,
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
  // The step lives in the URL (`?step=delivery`); a bad value must open the page, never break it.
  it('follows a known step to its card', () => {
    expect(sectionFromParam('payment', physical)).toBe('payment')
    expect(sectionFromParam('delivery', physical)).toBe('shipping')
    expect(sectionFromParam('address', physical)).toBe('address')
    expect(sectionFromParam(' Payment ', physical)).toBe('payment')
    expect(sectionFromParam('DELIVERY', physical)).toBe('shipping')
  })

  it('still reads older links that said shipping', () => {
    expect(sectionFromParam('shipping', physical)).toBe('shipping')
  })

  it('ignores anything else instead of failing', () => {
    for (const raw of [null, undefined, '', 'bogus', 'review', '../payment', 'payment;']) {
      expect(sectionFromParam(raw, physical)).toBeNull()
    }
    // A gift-card basket has no Delivery step.
    expect(sectionFromParam('delivery', digital)).toBeNull()
    expect(sectionFromParam('shipping', digital)).toBeNull()
  })

  it('writes Shipping as delivery, the word the shopper sees', () => {
    expect(physical.map(stepParam)).toEqual(['contact', 'address', 'delivery', 'payment'])
    for (const s of physical) expect(sectionFromParam(stepParam(s), physical)).toBe(s)
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

describe('resolveStep', () => {
  it('opens the asked step when every step before it is done', () => {
    expect(resolveStep('payment', open, physical)).toEqual({ kind: 'show', step: 'payment' })
    expect(resolveStep('contact', { ...open, contact: 'blocked' }, physical)).toEqual({
      kind: 'show',
      step: 'contact',
    })
    // Its own gate does not count: the shopper is there to finish it.
    expect(resolveStep('shipping', { ...open, shipping: 'blocked' }, physical)).toEqual({
      kind: 'show',
      step: 'shipping',
    })
  })

  it('never skips ahead: the first unfinished step opens instead', () => {
    const noAddress: SectionGates = { ...open, address: 'blocked', shipping: 'pending' }
    expect(resolveStep('payment', noAddress, physical)).toEqual({
      kind: 'fall-back',
      step: 'address',
    })
    expect(
      resolveStep('shipping', { contact: 'blocked', address: 'blocked', shipping: 'ok' }, physical),
    ).toEqual({ kind: 'fall-back', step: 'contact' })
    expect(resolveStep('payment', { ...open, shipping: 'blocked' }, physical)).toEqual({
      kind: 'fall-back',
      step: 'shipping',
    })
  })

  it('waits while the courier is still quoting, instead of bouncing', () => {
    expect(resolveStep('payment', { ...open, shipping: 'pending' }, physical)).toEqual({
      kind: 'wait',
      step: 'payment',
    })
  })

  it('does not wait on shipping for a basket of gift cards', () => {
    expect(resolveStep('payment', { ...open, shipping: 'pending' }, digital)).toEqual({
      kind: 'show',
      step: 'payment',
    })
  })
})
