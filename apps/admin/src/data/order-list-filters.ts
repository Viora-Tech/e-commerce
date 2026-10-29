import type { ReturnReason, ReturnResolution } from '@commerce/core/returns'

/** The filter panels on Drafts, Abandoned checkouts, Returns and Shipments (Orders has its own). */

const dateOptions = { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' }

export const draftFiltersContent = {
  created: 'Created',
  anyDate: 'Any date',
  dateOptions,
  total: 'Total',
  totalMin: 'Min total',
  totalMax: 'Max total',
  show: (n: number) => `Show ${n} ${n === 1 ? 'draft' : 'drafts'}`,
}

export const abandonedFiltersContent = {
  active: 'Last active',
  anyDate: 'Last 30 days',
  dateOptions,
  value: 'Cart value',
  valueMin: 'Min value',
  valueMax: 'Max value',
  contact: 'Contact left',
  anyContact: 'Any contact',
  contactOptions: { email: 'Email', phone: 'Phone number', both: 'Email and phone' },
  show: (n: number) => `Show ${n} ${n === 1 ? 'checkout' : 'checkouts'}`,
}

export const returnFiltersContent = {
  reason: 'Reason',
  /** Short, merchant-side names for the reasons a shopper picks. */
  reasonOptions: {
    damaged: 'Damaged',
    wrong_item: 'Wrong item',
    not_as_described: 'Not as described',
    quality: 'Quality',
    size: 'Size',
    changed_mind: 'Changed mind',
    other: 'Other',
  } satisfies Record<ReturnReason, string>,
  outcome: 'Outcome',
  outcomeOptions: {
    refund: 'Refund',
    exchange: 'Exchange',
    store_credit: 'Store credit',
    reship: 'Sent again',
    none: 'Closed with nothing',
  } satisfies Record<ReturnResolution, string>,
  requested: 'Asked on',
  anyDate: 'Any date',
  dateOptions,
  show: (n: number) => `Show ${n} ${n === 1 ? 'return' : 'returns'}`,
}

export const shipmentFiltersContent = {
  courier: 'Courier',
  anyCourier: 'Any courier',
  ndr: 'Delivery problem',
  ndrOptions: {
    none: 'No problem',
    pending: 'Needs your action',
    action_taken: 'Action taken',
    resolved: 'Sorted out',
  },
  booked: 'Booked',
  anyDate: 'Any date',
  dateOptions,
  method: 'Payment method',
  methodOptions: { cod: 'Cash on delivery', prepaid: 'Prepaid' },
  show: (n: number) => `Show ${n} ${n === 1 ? 'shipment' : 'shipments'}`,
  noResults: 'No shipments match these filters',
}
