import type { FulfillmentHoldReason } from '@commerce/core/order-edit-rules'

/** Copy for holding an order's fulfilment (#1011): the menu item, the dialog and the banner. */
export const orderHoldContent = {
  action: 'Hold fulfilment',
  chip: 'On hold',
  dialog: {
    title: 'Hold fulfilment',
    body: 'Nothing on this order can be fulfilled or shipped until you release the hold.',
    reason: 'Reason',
    note: 'Note (optional)',
    notePlaceholder: 'What are you waiting for?',
    cancel: 'Cancel',
    confirm: 'Hold fulfilment',
  },
  reasons: {
    awaiting_stock: 'Awaiting stock',
    address_check: 'Address check',
    payment_check: 'Payment check',
    customer_request: 'Customer request',
    other: 'Other',
  } satisfies Record<FulfillmentHoldReason, string>,
  banner: {
    title: 'Fulfilment on hold',
    /** An automation's hold has no picked reason, only its text. */
    noReason: 'No reason given',
    by: (who: string, when: string) => `Held by ${who} · ${when}`,
    since: (when: string) => `Held ${when}`,
    release: 'Release hold',
  },
  held: 'Fulfilment on hold',
  released: 'Hold released',
  failed: 'Could not change the hold. Try again.',
}
