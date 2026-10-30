import { CHECKOUT_TEXT_KEYS } from '@commerce/core/checkout-settings'
import { describe, expect, it } from 'vitest'
import { checkoutContent } from '@/data/checkout'

/** The value at a dotted path of the checkout's words. */
const at = (path: string): unknown =>
  path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], checkoutContent)

describe('editable checkout text (#158)', () => {
  it.each(CHECKOUT_TEXT_KEYS)('%s is a plain string in data/checkout.ts', (key) => {
    expect(typeof at(key)).toBe('string')
  })
})
