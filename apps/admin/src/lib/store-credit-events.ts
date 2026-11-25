/**
 * Loyalty points are store credit, so the customer page's Store credit and Loyalty points cards
 * show the same balance. A card that changed it fires this event and the other reads again.
 * Browser only.
 */
export const STORE_CREDIT_CHANGED_EVENT = 'admin:store-credit-changed'

export function announceStoreCreditChanged(): void {
  window.dispatchEvent(new Event(STORE_CREDIT_CHANGED_EVENT))
}
