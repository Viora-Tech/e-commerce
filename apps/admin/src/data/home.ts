/** Copy for the admin home page. */
export const homeContent = {
  title: (storeName: string) => `Hi, ${storeName}`,
  subtitle: (role: string) => `You are ${role} of this store.`,
  stats: {
    revenue: 'Revenue',
    orders: 'Orders',
    products: 'Products',
    awaitingPayment: 'Awaiting payment',
  },
  recentOrders: 'Recent orders',
  viewAll: 'View all orders',
  emptyOrders: {
    heading: 'No orders yet',
    body: 'Orders appear here as soon as a customer checks out.',
  },
  columns: {
    order: 'Order',
    customer: 'Customer',
    total: 'Total',
    status: 'Status',
  },
} as const
