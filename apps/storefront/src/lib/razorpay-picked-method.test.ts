import { describe, expect, it } from 'vitest'
import { withPickedMethod } from './razorpay-picked-method'

const display = (options: Record<string, unknown>) =>
  (options.config as { display: Record<string, unknown> }).display

describe('withPickedMethod', () => {
  it('leaves the options alone without a pick or with an unknown one', () => {
    const options = { key: 'k' }
    expect(withPickedMethod(options, null)).toBe(options)
    expect(withPickedMethod(options, 'crypto')).toBe(options)
  })

  it('puts the picked method first and keeps the other methods when none are hidden', () => {
    const result = withPickedMethod(
      { key: 'k', config: { display: { preferences: { show_default_blocks: true } } } },
      'card',
    )
    expect(display(result).sequence).toEqual(['block.card'])
    expect(display(result).preferences).toEqual({ show_default_blocks: true })
    expect(result.key).toBe('k')
  })

  it('keeps the other blocks behind the picked one', () => {
    const result = withPickedMethod(
      {
        config: {
          display: {
            blocks: { upi: { name: 'UPI' }, card: { name: 'Cards' } },
            sequence: ['block.upi', 'block.card'],
            preferences: { show_default_blocks: false },
          },
        },
      },
      'card',
    )
    expect(display(result).sequence).toEqual(['block.card', 'block.upi'])
    expect(display(result).preferences).toEqual({ show_default_blocks: false })
  })

  it('never brings back a method the store hid', () => {
    const options = {
      config: {
        display: {
          blocks: { upi: { name: 'UPI' } },
          sequence: ['block.upi'],
          preferences: { show_default_blocks: false },
        },
      },
    }
    expect(withPickedMethod(options, 'emi')).toBe(options)
  })
})
