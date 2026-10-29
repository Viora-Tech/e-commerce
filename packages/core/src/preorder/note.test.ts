/** SOURCE OF TRUTH: pre-order note tests — product note beats store default, ship-date placeholders, store settings parsing (#936) */
import { describe, expect, it } from 'vitest'
import { preorderNoteText } from './note'
import { PreorderStoreSettingsSchema, parsePreorderStoreSettings } from './store-settings'

// 30 Nov 2026, 10:00 in Asia/Kolkata.
const shipDate = new Date('2026-11-30T04:30:00Z')

describe('preorderNoteText (#936)', () => {
  it("fills {ship_month} and {ship_date} from the product's ship date", () => {
    expect(
      preorderNoteText({
        productNote:
          'This Product is on Pre-Order and will arrive around the end of {ship_month}. NOTE: Pre-orders cannot be cancelled and are non-refundable.',
        storeNote: null,
        shipDate,
      }),
    ).toBe(
      'This Product is on Pre-Order and will arrive around the end of November 2026. NOTE: Pre-orders cannot be cancelled and are non-refundable.',
    )
    expect(
      preorderNoteText({ productNote: 'Ships by { ship_date }.', storeNote: null, shipDate }),
    ).toBe('Ships by 30 November 2026.')
    expect(
      preorderNoteText({
        productNote: '{SHIP_MONTH}',
        storeNote: null,
        shipDate: shipDate.toISOString(),
      }),
    ).toBe('November 2026')
  })

  it("uses the product's note over the store's, and the store's when the product has none", () => {
    expect(preorderNoteText({ productNote: 'Own', storeNote: 'Store', shipDate: null })).toBe('Own')
    expect(preorderNoteText({ productNote: '  ', storeNote: 'Store', shipDate: null })).toBe(
      'Store',
    )
    expect(preorderNoteText({ productNote: null, storeNote: null, shipDate })).toBeNull()
  })

  it('shows no half sentence when the note names a ship date the product does not have', () => {
    expect(
      preorderNoteText({ productNote: null, storeNote: 'Arrives {ship_month}.', shipDate: null }),
    ).toBeNull()
    // A note without a placeholder needs no date.
    expect(
      preorderNoteText({ productNote: null, storeNote: 'Non-refundable.', shipDate: null }),
    ).toBe('Non-refundable.')
  })

  it('is kept in the store settings, empty by default', () => {
    expect(parsePreorderStoreSettings(null).note).toBeNull()
    expect(parsePreorderStoreSettings({ note: 'Hello' }).note).toBe('Hello')
    expect(PreorderStoreSettingsSchema.safeParse({ note: 'x'.repeat(501) }).success).toBe(false)
  })
})
