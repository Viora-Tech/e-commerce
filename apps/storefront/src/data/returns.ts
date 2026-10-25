import type { ReturnStatus, TimelineStepKey } from '@commerce/core/returns'

export { RETURN_REASON_LABELS as returnReasonLabels } from '@commerce/core/return-reasons'

/** Every string the shopper sees about returns. Plain words on purpose. */
export const returnsContent = {
  card: {
    title: 'Returns',
    openUntil: (date: string, days: number) =>
      days === 0
        ? `You can ask for a return until today (${date}).`
        : `You can ask for a return until ${date}.`,
    closed: (date: string) => `The time to ask for a return ended on ${date}.`,
    notDelivered: 'You can ask for a return once your order has been delivered.',
    disabled: 'This shop does not take returns online. Please contact the shop.',
    cancelled: 'This order was cancelled, so there is nothing to return.',
    nothingLeft: 'Every item on this order is already being returned.',
    start: 'Return or exchange',
    sent: 'We got your return request. We will email you once the shop has looked at it.',
    items: (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`,
    declined: (note: string) => `Reason: ${note}`,
    pickup: (waybill: string) => `A courier will collect it. Tracking number ${waybill}.`,
    shipYourself: 'Please pack the items and send them back to the shop.',
    refunded: (amount: string) => `Refund of ${amount} sent to the way you paid.`,
    credited: (amount: string) => `Store credit of ${amount} sent to your email.`,
    exchanged: 'A replacement is being prepared.',
  },
  status: {
    requested: 'Waiting for the shop',
    approved: 'Approved',
    rejected: 'Not accepted',
    in_transit: 'On its way back',
    received: 'Received by the shop',
    resolved: 'Done',
    cancelled: 'Cancelled',
  } satisfies Record<ReturnStatus, string>,
  steps: {
    requested: 'You asked for a return',
    approved: 'The shop approved it',
    rejected: 'The shop did not accept it',
    in_transit: 'On its way back',
    received: 'The shop received it',
    resolved: 'Refund or exchange done',
    cancelled: 'Cancelled',
  } satisfies Record<TimelineStepKey, string>,
  form: {
    title: (n: number) => `Return items from order #${n}`,
    back: 'Back to order',
    intro: (date: string) =>
      `You can ask for a return until ${date}. Pick what you want to send back.`,
    itemsHeading: 'What do you want to return?',
    quantity: 'How many',
    notReturnable: {
      gift_card: 'Gift cards can not be returned.',
      not_shipped: 'Not shipped yet.',
      already_returning: 'Already being returned.',
    },
    reasonHeading: 'Why are you returning it?',
    noteLabel: 'Anything else we should know? (optional)',
    notePlaceholder: 'For example: the corner was torn when it arrived.',
    photosHeading: 'Add photos (optional)',
    photosHelp:
      'Up to 3 photos, JPG, PNG or WEBP, each under 5 MB. Photos help the shop decide faster.',
    addPhoto: 'Add a photo',
    uploading: 'Uploading photo',
    removePhoto: 'Remove photo',
    submit: 'Send return request',
    submitting: 'Sending',
    exchangeNote: 'Want a replacement instead of your money back? Say so in the note.',
    outcomeHeading: 'What would you like?',
    outcomes: {
      refund: 'My money back',
      exchange: 'The same item in another size or colour',
      store_credit: 'Store credit to shop again',
    },
    swapFor: 'Swap for',
    swapPick: 'Choose one',
    noSwaps: 'Nothing else is in stock for this item right now.',
    errors: {
      noItems: 'Choose at least one item to return.',
      noReason: 'Choose a reason.',
      noSwap: 'Choose what you want instead.',
      photoType: 'Photos must be JPG, PNG or WEBP.',
      photoSize: 'Each photo must be under 5 MB.',
      photoLimit: 'You can add up to 3 photos.',
      photoFailed: 'The photo could not be uploaded. Please try again.',
      rateLimited: 'Too many attempts. Please wait a minute and try again.',
      generic: 'Something went wrong. Please try again.',
    },
  },
} as const
