import { DeliveryOptionInputSchema } from '@commerce/core/delivery-options'
import { describe, expect, it } from 'vitest'
import { formOf, inputOf } from './option-form-state'

describe('option page form', () => {
  it('keeps the courier list switches when the option page saves (Figma 938:12101)', () => {
    const saved = {
      ...DeliveryOptionInputSchema.parse({
        name: 'Standard',
        couriers: {
          show: 'list',
          allow: ['delhivery:standard'],
          known: ['delhivery:standard', 'ekart:standard'],
          extra: 'none',
        },
      }),
      id: 'o1',
      position: 0,
    }
    const back = inputOf(formOf(saved))
    expect(back.couriers).toMatchObject({
      allow: ['delhivery:standard'],
      known: ['delhivery:standard', 'ekart:standard'],
      extra: 'none',
    })
  })

  it('leaves an option without a list as it was: every courier allowed', () => {
    const back = inputOf({ ...formOf(null), name: 'Express' })
    expect(back.couriers.allow).toBeNull()
    expect(back.couriers.known).toEqual([])
  })
})

describe('option page form: Round delivery prices', () => {
  it('keeps the saved rounding when the option page saves', () => {
    const saved = {
      ...DeliveryOptionInputSchema.parse({ name: 'Standard', price: { rounding: 'nine' } }),
      id: 'o1',
      position: 0,
    }
    expect(formOf(saved).rounding).toBe('nine')
    expect(inputOf(formOf(saved)).price.rounding).toBe('nine')
  })

  it('a new option starts on the ₹10 rule and saves what is picked', () => {
    const form = { ...formOf(null), name: 'Express' }
    expect(form.rounding).toBe('ten')
    expect(inputOf({ ...form, rounding: 'off' }).price.rounding).toBe('off')
  })
})
