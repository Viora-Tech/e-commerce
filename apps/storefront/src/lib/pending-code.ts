/**
 * A discount code typed into the cart's or checkout's field but never applied: the field and its
 * Apply button carry `data-pending-code` / `data-apply-code` ("discount"). Paying or heading to
 * checkout with it still sitting there charged the full price, so callers look for it first.
 */

/** The typed, unapplied code, or null when the field is empty or not on the page. */
export function typedDiscountCode(): string | null {
  const code = document
    .querySelector<HTMLInputElement>('[data-pending-code="discount"]')
    ?.value.trim()
  return code || null
}

/**
 * Presses the field's Apply for a typed code and tells the caller which code it was, so it can
 * ask the shopper to check the new total. True when there was one (stop the payment).
 */
export function applyPendingDiscountCode(onApplied: (code: string) => void): boolean {
  const code = typedDiscountCode()
  if (!code) return false
  document.querySelector<HTMLButtonElement>('[data-apply-code="discount"]')?.click()
  onApplied(code)
  return true
}
