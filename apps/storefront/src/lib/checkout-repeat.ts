/** SOURCE OF TRUTH: repeated checkouts in the shopper's words — WHAT: the refusal or question `checkoutAction` returns for `DuplicateCheckout`, `TooManyUnpaidCheckouts` and `UnpaidTransferExists`, with links to the earlier order only for its owner / WHY: a link opens the order's page (name, address), so typing someone's email or phone must not hand it out */
import 'server-only'

import { settingsSecret } from '@commerce/config'
import {
  DuplicateCheckout,
  orderViewToken,
  type RecentCheckout,
  TooManyUnpaidCheckouts,
  thankYouPath,
  UnpaidTransferExists,
} from '@commerce/core'
import { checkoutRepeatContent as copy } from '@/data/checkout-repeat'
import type { CheckoutLink, CheckoutResult } from './checkout-result'

/** The order's status page (it pays a transfer, retries a card, or offers paying online). */
const statusPage = (o: { id: string; number: number }) =>
  thankYouPath(o.number, orderViewToken(o.id, settingsSecret()))

/** What the shopper quotes: #D57 while it is an unpaid checkout draft, else the order number. */
const refOf = (o: { number: number; draftNumber?: number | null | undefined }) =>
  o.draftNumber ? `D${o.draftNumber}` : String(o.number)

/**
 * Who may be linked to an earlier order: the signed-in customer it belongs to, or (for the
 * same items only) a guest whose email and phone both match it.
 */
const mayLink = (o: { customerId: string | null }, viewerId: string | null, sameContact = false) =>
  (viewerId !== null && o.customerId === viewerId) || sameContact

function duplicateResult(err: DuplicateCheckout, viewerId: string | null): CheckoutResult {
  const o: RecentCheckout = err.order
  const linked = mayLink(o, viewerId, err.sameContact)
  const href = linked ? statusPage(o) : null
  if (err.kind === 'placed') {
    return {
      confirmAgain: {
        message: copy.placedDuplicate(err.minutesAgo, refOf(o)),
        links: href ? [{ href, label: copy.viewOrder }] : [],
        orderAgain: copy.orderAgain,
      },
    }
  }
  const links: CheckoutLink[] = href ? [{ href, label: copy.completePayment }] : []
  // Only a transfer order can switch how it is paid ("Pay online instead" on its page).
  if (href && o.paymentMethod === 'manual') links.push({ href, label: copy.changeMethod })
  return { error: copy.unpaidDuplicate(refOf(o)), links }
}

/** The result for a repeated checkout, or null when `err` is not one. */
export function repeatCheckoutResult(err: unknown, viewerId: string | null): CheckoutResult | null {
  if (err instanceof DuplicateCheckout) return duplicateResult(err, viewerId)
  if (err instanceof UnpaidTransferExists) {
    const o = { id: err.orderId, number: err.orderNumber, customerId: err.customerId }
    return {
      error: copy.unpaidTransfer(refOf(o)),
      links: mayLink(o, viewerId) ? [{ href: statusPage(o), label: copy.payForIt }] : [],
    }
  }
  if (err instanceof TooManyUnpaidCheckouts) {
    const o = err.latest
    return {
      error: copy.tooMany,
      links: o && mayLink(o, viewerId) ? [{ href: statusPage(o), label: copy.latestOrder }] : [],
    }
  }
  return null
}

/** The IP cap hit before the order was tried: same words, no order to link. */
export const tooManyFromIp = (): CheckoutResult => ({ error: copy.tooMany })
