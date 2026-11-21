import { type DeliveryOption, DeliveryOptionInputSchema } from '@commerce/core/delivery-options'
import { describe, expect, it } from 'vitest'
import {
  fasterAmounts,
  fasterOf,
  formFasterOf,
  formMoreChanged,
  formWithFaster,
  listMoreChanged,
  withFaster,
  withRounding,
} from './option-answers'
import { formOf, inputOf } from './option-form-state'

const opt = (over: Record<string, unknown> = {}): DeliveryOption => ({
  ...DeliveryOptionInputSchema.parse({ name: 'Delivery', ...over }),
  id: 'o1',
  position: 0,
})

describe('question 2: can shoppers pick a faster courier?', () => {
  it('reads No from one card, and Yes from what faster couriers cost', () => {
    expect(fasterOf(opt().couriers)).toBe('difference')
    expect(fasterOf(opt({ couriers: { extra: 'full' } }).couriers)).toBe('full')
    expect(fasterOf(opt({ couriers: { max: 1, extra: 'full' } }).couriers)).toBe('no')
    // Nothing extra lives in More settings: no card is ticked.
    expect(fasterOf(opt({ couriers: { extra: 'none' } }).couriers)).toBeNull()
  })

  it('No caps the list at one courier; Yes shows every courier again', () => {
    const no = withFaster(opt({ couriers: { max: 4 } }).couriers, 'no')
    expect(no.max).toBe(1)
    const yes = withFaster(no, 'full')
    expect(yes).toMatchObject({ max: null, extra: 'full' })
    // A saved "Show at most 4" stays when switching between the two Yes answers.
    expect(withFaster(opt({ couriers: { max: 4 } }).couriers, 'difference').max).toBe(4)
  })

  it('round-trips through the option page form', () => {
    const f = formWithFaster(formOf(opt({ couriers: { show: 'list' } })), 'no')
    expect(formFasterOf(f)).toBe('no')
    expect(inputOf(f).couriers.max).toBe(1)
    const back = formWithFaster(f, 'full')
    expect(inputOf(back).couriers).toMatchObject({ max: null, extra: 'full' })
  })
})

describe('question 3: round prices to', () => {
  it('sets price.rounding, and a list’s +₹…9 switch follows it', () => {
    const list = opt({ couriers: { show: 'list' } })
    expect(withRounding(list, 'off')).toMatchObject({
      price: { rounding: 'off' },
      couriers: { roundTo9: false },
    })
    expect(withRounding(opt(), 'nine').couriers.roundTo9).toBe(true)
  })
})

describe('the faster-courier card amounts', () => {
  it('come from the example costs (Surface ₹43, Air ₹72)', () => {
    // ₹10 rounding: Surface ₹50; Air costs ₹29 more (+ ₹…9 → + ₹29); its own price ₹80.
    expect(fasterAmounts(opt())).toEqual({ extraPaise: 2900, fullPaise: 8000 })
    expect(fasterAmounts(opt({ price: { rounding: 'nine' } }))).toEqual({
      extraPaise: 2900,
      fullPaise: 7900,
    })
  })

  it('name no amount when the included courier is already the fastest', () => {
    expect(fasterAmounts(opt({ strategy: 'fastest' }))).toEqual({
      extraPaise: null,
      fullPaise: null,
    })
  })
})

describe('More settings: what changed', () => {
  it('counts nothing on a new option', () => {
    expect(listMoreChanged(opt())).toEqual([])
    expect(formMoreChanged(formOf(null))).toEqual([])
  })

  it('does not count the 3 questions', () => {
    const asked = opt({
      price: { source: 'free', rounding: 'nine' },
      couriers: { max: 1, extra: 'full' },
    })
    expect(listMoreChanged(asked)).toEqual([])
    const form = formWithFaster({ ...formOf(null), priceSource: 'zone', rounding: 'off' }, 'no')
    expect(formMoreChanged(form)).toEqual([])
  })

  it('counts each changed setting once', () => {
    const changed = opt({
      price: { markupPaise: 1000, markupPercent: 5, maxPaise: 9900 },
      couriers: { extra: 'none', max: 3 },
      insurance: { default: 'on' },
      cod: { fee: 'separate' },
    })
    expect(listMoreChanged(changed)).toEqual([
      'markup',
      'max',
      'showAtMost',
      'sameAsFirst',
      'insurance',
      'codFee',
    ])
  })

  it('on the option page: express prepaid only is not a change', () => {
    const express = formOf(opt({ speed: 'express', cod: { mode: 'prepaid_only' } }))
    expect(formMoreChanged(express)).toEqual([])
    expect(formMoreChanged({ ...formOf(null), markup: '10', buffer: '1' })).toEqual([
      'markup',
      'buffer',
    ])
  })
})
