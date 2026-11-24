/** SOURCE OF TRUTH: the "price changed" note in the shopper's language — WHAT: the words under a cart or checkout line whose price went up since it was added (core `cart/reprice.ts`) / WHY: owner, 24 Nov 2026: neutral wording, in Hindi for Hindi-market shoppers; the pages pass it to their client lines */
import { cartContent } from '@/data/cart'
import { cartContentHi } from '@/data/hi/cart'

/** The note for the market's locale (`MARKET_HEADERS.locale`): Hindi for `hi`, else English. */
export function priceChangedNote(locale: string | null | undefined): string {
  return (locale === 'hi' ? cartContentHi.priceChanged : undefined) ?? cartContent.priceChanged
}
