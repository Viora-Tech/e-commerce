import { describe, expect, it } from 'vitest'
import {
  type CheckoutStep,
  canContinue,
  canVisit,
  parseStep,
  resolveStep,
  type StepGates,
  stepSearch,
  stepStatus,
  stepsFor,
  transition,
} from './checkout-steps'

const steps = stepsFor(false)
const digital = stepsFor(true)
const open: StepGates = { address: 'ok', shipping: 'ok' }
const noAddress: StepGates = { address: 'blocked', shipping: 'pending' }
const quoting: StepGates = { address: 'ok', shipping: 'pending' }
const noRate: StepGates = { address: 'ok', shipping: 'blocked' }

describe('stepsFor', () => {
  it('runs Address → Shipping → Payment, and skips shipping for gift cards', () => {
    expect(steps).toEqual(['address', 'shipping', 'payment'])
    expect(digital).toEqual(['address', 'payment'])
  })
})

describe('parseStep', () => {
  it('reads a known step and falls back to the first', () => {
    expect(parseStep('payment', steps)).toBe('payment')
    expect(parseStep(null, steps)).toBe('address')
    expect(parseStep('pay', steps)).toBe('address')
    expect(parseStep('shipping', digital)).toBe('address')
  })
})

describe('resolveStep', () => {
  it('sends a shopper back to the first blocked gate', () => {
    expect(resolveStep('payment', noAddress, steps)).toBe('address')
    expect(resolveStep('payment', noRate, steps)).toBe('shipping')
    expect(resolveStep('shipping', noRate, steps)).toBe('shipping')
  })

  it('lets a pending gate through, so a re-quote does not bounce the shopper', () => {
    expect(resolveStep('payment', quoting, steps)).toBe('payment')
  })

  it('keeps an open path as asked', () => {
    expect(resolveStep('payment', open, steps)).toBe('payment')
    expect(resolveStep('address', noAddress, steps)).toBe('address')
  })

  it('ignores the shipping gate when there is no shipping step', () => {
    expect(resolveStep('payment', { address: 'ok', shipping: 'blocked' }, digital)).toBe('payment')
  })
})

describe('transition', () => {
  it('continues only through an open gate', () => {
    expect(transition('address', { type: 'next' }, open, steps)).toEqual({
      step: 'shipping',
      moved: true,
    })
    expect(transition('address', { type: 'next' }, noAddress, steps).moved).toBe(false)
    expect(transition('shipping', { type: 'next' }, quoting, steps).moved).toBe(false)
    expect(transition('shipping', { type: 'next' }, noRate, steps).moved).toBe(false)
  })

  it('stops at the ends', () => {
    expect(transition('payment', { type: 'next' }, open, steps)).toEqual({
      step: 'payment',
      moved: false,
    })
    expect(transition('address', { type: 'back' }, open, steps).moved).toBe(false)
    expect(transition('payment', { type: 'back' }, open, steps).step).toBe('shipping')
    expect(transition('payment', { type: 'back' }, open, digital).step).toBe('address')
  })

  it('jumps back freely, forward only past open gates', () => {
    const goto = (step: CheckoutStep) => ({ type: 'goto', step }) as const
    expect(transition('payment', goto('address'), noRate, steps).step).toBe('address')
    expect(transition('address', goto('payment'), open, steps).step).toBe('payment')
    expect(transition('address', goto('payment'), quoting, steps).moved).toBe(false)
    expect(transition('address', goto('address'), open, steps).moved).toBe(false)
  })
})

describe('canContinue and canVisit', () => {
  it('needs an open gate', () => {
    expect(canContinue('address', open)).toBe(true)
    expect(canContinue('shipping', quoting)).toBe(false)
    expect(canContinue('payment', noAddress)).toBe(true)
  })

  it('reaches earlier steps always and later ones through open gates', () => {
    expect(canVisit('address', 'payment', noAddress, steps)).toBe(true)
    expect(canVisit('shipping', 'address', open, steps)).toBe(true)
    expect(canVisit('shipping', 'address', noAddress, steps)).toBe(false)
    expect(canVisit('shipping', 'address', open, digital)).toBe(false)
  })
})

describe('stepStatus', () => {
  it('marks steps behind as done', () => {
    expect(steps.map((s) => stepStatus(s, 'shipping', steps))).toEqual([
      'done',
      'current',
      'upcoming',
    ])
  })
})

describe('stepSearch', () => {
  it('writes the step and keeps other parameters', () => {
    expect(stepSearch('shipping', steps, '')).toBe('?step=shipping')
    expect(stepSearch('payment', steps, '?utm_source=mail&step=shipping')).toBe(
      '?utm_source=mail&step=payment',
    )
  })

  it('drops the parameter on the first step', () => {
    expect(stepSearch('address', steps, '?step=payment')).toBe('')
    expect(stepSearch('address', steps, '?step=payment&ref=x')).toBe('?ref=x')
  })
})
