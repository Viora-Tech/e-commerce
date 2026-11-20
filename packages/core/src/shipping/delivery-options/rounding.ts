/** SOURCE OF TRUTH: how the Delivery options app rounds a price it makes — WHAT: `roundPrice` for the option's "Round delivery prices" setting: up to …9 (₹43 → ₹49), up to …49/…99 (₹58 → ₹99), up to the next ₹10 (₹43 → ₹50), or off (whole rupees) / WHY: owner, 20 Nov 2026: prices that end in 9 read cheaper; a store picks its own step. Pure. */

export const PRICE_ROUNDINGS = ['nine', 'fifty', 'ten', 'off'] as const
export type PriceRounding = (typeof PRICE_ROUNDINGS)[number]

/** Rupees rounded up so they end in 9 (₹37 → ₹39, ₹40 → ₹49); paise in, paise out. */
export function upToNine(paise: number): number {
  if (paise <= 0) return 0
  const rupees = Math.ceil(paise / 100)
  return (rupees + ((9 - (rupees % 10) + 10) % 10)) * 100
}

/** Rupees rounded up so they end in 49 or 99 (₹43 → ₹49, ₹58 → ₹99, ₹100 → ₹149). */
export function upToFortyNine(paise: number): number {
  if (paise <= 0) return 0
  const rupees = Math.ceil(paise / 100)
  return (rupees + ((49 - (rupees % 50) + 50) % 50)) * 100
}

/** A price the engine made, rounded up the store's way; ₹0 stays ₹0. */
export function roundPrice(paise: number, how: PriceRounding): number {
  if (paise <= 0) return 0
  switch (how) {
    case 'nine':
      return upToNine(paise)
    case 'fifty':
      return upToFortyNine(paise)
    case 'ten':
      return Math.ceil(paise / 1000) * 1000
    case 'off':
      return Math.ceil(paise / 100) * 100
  }
}
