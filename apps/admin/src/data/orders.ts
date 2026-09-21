export const ORDER_STATUSES = ['placed', 'paid', 'fulfilled', 'delivered', 'cancelled'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** Copy for the orders list and shared order labels. */
export const ordersContent = {
  title: 'Orders',
  export: 'Export',
  resource: { singular: 'order', plural: 'orders' },
  tabs: {
    all: 'All',
  },
  status: {
    placed: 'Placed',
    paid: 'Paid',
    fulfilled: 'Fulfilled',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  } satisfies Record<OrderStatus, string>,
  payment: {
    codPending: 'COD pending',
    cod: 'COD',
    paid: 'Paid',
  },
  guest: 'Guest',
  columns: {
    order: 'Order',
    date: 'Date',
    customer: 'Customer',
    total: 'Total',
    payment: 'Payment',
    status: 'Status',
  },
  bulk: {
    markAs: 'Mark as',
    updated: (n: number, status: string) => `${n} marked ${status.toLowerCase()}`,
    failed: 'Could not update orders',
  },
  empty: {
    heading: 'No orders yet',
    body: 'Orders appear here as soon as a customer checks out.',
  },
} as const

/** Badge tone per order status. */
export const ORDER_STATUS_TONE: Record<
  OrderStatus,
  'warning' | 'info' | 'success' | 'destructive' | 'neutral'
> = {
  placed: 'warning',
  paid: 'info',
  fulfilled: 'success',
  delivered: 'success',
  cancelled: 'destructive',
}
