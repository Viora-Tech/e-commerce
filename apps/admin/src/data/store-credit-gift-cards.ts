/** The gift cards page's "Store credit cards" card: old store-credit gift cards moved into balances. */
export const storeCreditGiftCardsContent = {
  heading: 'Gift cards that were store credit',
  intro:
    'Store credit is now a balance on the customer, not a gift card. Move these cards into their customers’ balances: the value left becomes store credit and the card code stops working.',
  origin: {
    refund: 'Refund card made here',
    shopify: 'Imported from Shopify',
  },
  suggestedNote:
    'Refund cards are ticked for you. Shopify does not say which of its cards were store credit, so tick those yourself.',
  to: (who: string) => `To ${who}`,
  newCustomer: (email: string) => `To ${email} (a customer record is made)`,
  expires: (day: string) => `Keeps its expiry: last day ${day}`,
  problems: {
    no_customer: 'No customer or email, so there is no balance to put it on',
    expired: 'Expired, nothing to move',
  } as Record<string, string>,
  selectAll: 'Select all',
  move: (count: number) => (count === 1 ? 'Move 1 card to balance' : `Move ${count} cards to balance`),
  confirmTitle: 'Move to store credit?',
  confirmBody: (amount: string) =>
    `${amount} goes onto the customers’ store credit balances, and these card codes stop working. Each card moves once; running it again changes nothing.`,
  confirm: 'Move to balance',
  done: (moved: number, skipped: number) =>
    skipped > 0
      ? `${moved} moved, ${skipped} could not be moved`
      : moved === 1
        ? '1 card moved to store credit'
        : `${moved} cards moved to store credit`,
  skipped: {
    not_found: 'not found',
    empty: 'no value left',
    disabled: 'disabled',
    expired: 'expired',
    currency: 'not in rupees',
    no_customer: 'no customer',
    refused: 'refused',
  } as Record<string, string>,
  failed: 'Could not move the cards. Try again.',
  loadFailed: 'Could not load the cards.',
}
