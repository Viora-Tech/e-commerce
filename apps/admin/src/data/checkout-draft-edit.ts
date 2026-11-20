/**
 * "Edit" on a shopper's unpaid checkout draft: staff take it over as an ordinary draft. The
 * button, the confirm popup that says the shopper's link stops, and why it can be refused.
 */
export const checkoutDraftEditContent = {
  edit: 'Edit',
  confirmTitle: 'Edit this checkout?',
  confirmBody:
    'The shopper’s current payment link will stop working, and any payment they started on it is cancelled. After your changes, send them the new link from the draft (Send invoice). From then on it works like any draft you made.',
  confirm: 'Stop the link and edit',
  cancel: 'Cancel',
  done: 'The old payment link stopped. You can edit the draft now.',
  failed: 'Could not take this checkout over. Try again.',
  /** The API's refusal reasons (`data.reason`), in the merchant's words. */
  refused: {
    not_found: 'This draft was not found. It may have been deleted.',
    not_checkout:
      'This is no longer an unpaid checkout: it was paid, converted or already taken over. Refresh the page.',
    paid: 'A payment was captured on this checkout, so it cannot be edited. Convert it, or refund the payment first.',
    in_progress:
      'A payment on this checkout is going through right now. Wait a few minutes and refresh the page.',
    shopper_paid:
      'The shopper says they paid by UPI or bank transfer. Check your bank and mark it paid instead.',
    split_tender:
      'A gift card or store credit is held on this checkout, so it cannot be edited. Convert it to an order instead.',
    unchecked:
      'Could not check this checkout’s payment with the payment gateway, so nothing was changed. Try again in a few minutes.',
  },
}
