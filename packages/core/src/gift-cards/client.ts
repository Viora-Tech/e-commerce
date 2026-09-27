import { z } from 'zod'
import { normaliseGiftCardCode } from './code'

export { normaliseGiftCardCode } from './code'

/**
 * Pure gift card helpers, safe for client components (`@commerce/core/gift-cards`).
 * Nothing here touches the database or node crypto.
 */

/** Generated codes: 16 characters from an alphabet without 0/O/1/I, shown in groups of four. */
export const GIFT_CARD_CODE_LENGTH = 16
export const GIFT_CARD_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
/** Merchant-chosen codes (Shopify allows 8 to 20 characters). */
export const GIFT_CARD_CUSTOM_CODE_MIN = 8
export const GIFT_CARD_CUSTOM_CODE_MAX = 20
/** A typo guard, not a legal limit: ₹2,00,000. */
export const GIFT_CARD_MAX_VALUE_PAISE = 20_000_000

/** "ABCDEFGHJKLMNPQR" → "ABCD EFGH JKLM NPQR". */
export function formatGiftCardCode(code: string): string {
  return (normaliseGiftCardCode(code).match(/.{1,4}/g) ?? []).join(' ')
}

/** What admin shows instead of the code. */
export function maskedGiftCardCode(lastCharacters: string): string {
  return `•••• ${lastCharacters}`
}

export type GiftCardState = 'active' | 'disabled' | 'expired' | 'empty'

/** One status for badges and filters. `today` is YYYY-MM-DD in the store's time zone. */
export function giftCardState(
  card: { disabledAt: Date | string | null; expiresOn: string | null; balancePaise: number },
  today: string,
): GiftCardState {
  if (card.disabledAt) return 'disabled'
  if (card.expiresOn && card.expiresOn < today) return 'expired'
  if (card.balancePaise <= 0) return 'empty'
  return 'active'
}

/** YYYY-MM-DD for `date` as seen in `timeZone`. */
export function dateInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** `months` after `from` (YYYY-MM-DD), clamped to the month's last day. */
export function addMonths(from: string, months: number): string {
  const [y, m, d] = from.split('-').map(Number) as [number, number, number]
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, last))
  return target.toISOString().slice(0, 10)
}

/**
 * Store-wide gift card settings. `expiryMonths` applies to cards sold on the
 * storefront; null means they never expire. RBI's PPI rules ask for at least a
 * year of validity, so shorter periods are refused.
 */
export const GiftCardSettingsSchema = z.object({
  expiryMonths: z.number().int().min(12).max(120).nullable().default(null),
})
export type GiftCardSettings = z.infer<typeof GiftCardSettingsSchema>

export function parseGiftCardSettings(raw: unknown): GiftCardSettings {
  const parsed = GiftCardSettingsSchema.safeParse(raw ?? {})
  return parsed.success ? parsed.data : { expiryMonths: null }
}
