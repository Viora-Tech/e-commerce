import { formatInZone } from '@commerce/dates'

/*
 * The pre-order note (#936): the line Shopify's pre-order apps print under the button ("This
 * product is on pre-order and will arrive around the end of November 2026. Pre-orders cannot be
 * cancelled."). A product's own note wins over the store's default; either may name the
 * expected ship date. Client-safe: the storefront, checkout and emails all read it.
 */

/** Longest note a product or the store may keep. */
export const PREORDER_NOTE_MAX = 500

/** What a note may say to fill in the product's expected ship date. */
export const PREORDER_NOTE_PLACEHOLDERS = {
  /** "30 November 2026". */
  shipDate: '{ship_date}',
  /** "November 2026", for "around the end of {ship_month}". */
  shipMonth: '{ship_month}',
} as const

const PLACEHOLDER = /\{\s*(ship_date|ship_month)\s*\}/gi

const filled = (key: string, date: Date): string =>
  key.toLowerCase() === 'ship_month'
    ? formatInZone(date, { month: 'long', year: 'numeric' }, { locale: 'en-GB' })
    : formatInZone(date, { day: 'numeric', month: 'long', year: 'numeric' }, { locale: 'en-GB' })

/**
 * The note to show for a pre-order: the product's own, else the store's, with the ship date
 * filled in. Null when neither has one, or when it names the ship date and none is set (a
 * half sentence "arrives around the end of ." helps nobody).
 */
export function preorderNoteText(input: {
  productNote: string | null | undefined
  storeNote: string | null | undefined
  shipDate: Date | string | null | undefined
}): string | null {
  const note = input.productNote?.trim() || input.storeNote?.trim() || ''
  if (!note) return null
  const needsDate = new RegExp(PLACEHOLDER.source, 'i').test(note)
  if (!needsDate) return note
  const date = input.shipDate ? new Date(input.shipDate) : null
  if (!date || Number.isNaN(date.getTime())) return null
  return note.replace(PLACEHOLDER, (_m, key: string) => filled(key, date))
}
