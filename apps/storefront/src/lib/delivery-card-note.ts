/** SOURCE OF TRUTH: the quiet note under a delivery card — WHAT: "Pay online for this option" under a prepaid-only card (Express), only when the store offers cash on delivery at this checkout / WHY: it read as a red error before the shopper had chosen how to pay (#1522), and with no COD on offer it says nothing useful. Never an error: Payment explains COD when the shopper picks it. */
import { deliveryOptionsContent as appCopy } from '@/data/delivery-options'

type Card = { delivery?: { codAllowed: boolean } | undefined }

export function deliveryCardNote(card: Card, codOffered: boolean): string | null {
  return codOffered && card.delivery && !card.delivery.codAllowed ? appCopy.prepaidOnly : null
}
