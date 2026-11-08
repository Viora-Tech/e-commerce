/** What `checkoutAction` hands back when it does not redirect: a refusal (with links), or a question. */

export type CheckoutLink = { href: string; label: string }

export type CheckoutResult =
  | {
      error: string
      /** "Complete payment", "Change payment method": the shopper's own earlier order. */
      links?: CheckoutLink[] | undefined
    }
  | {
      /** The same items were placed a little while ago: "Order again?" before a second order. */
      confirmAgain: { message: string; links: CheckoutLink[]; orderAgain: string }
    }
  | undefined

/** What the form keeps between submits: a plain message, or a refusal or question with links. */
export type CheckoutProblem = string | NonNullable<CheckoutResult>

/** The words of a problem; null for an "Order again?" question, which has its own panel. */
export function problemText(p: CheckoutProblem | null): string | null {
  if (p === null || typeof p === 'string') return p
  return 'error' in p ? p.error : null
}
